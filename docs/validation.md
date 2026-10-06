# Validation

Validation is pluggable and race-protected. The core defines a tiny interface and never depends on a schema library; Zod connects through [`@donega/form-wrapper-zod`](../packages/zod).

## Basic validation

A validator is any object implementing `FormValidator`:

```ts
interface FormValidator<TValues> {
  validate(values: TValues): ValidationResult | Promise<ValidationResult>;
}

interface ValidationResult<TValues = unknown> {
  valid: boolean;
  errors: FormErrors<TValues> | null; // nested like your values
}
```

Hand-rolled example:

```ts
const form = createForm({
  initialValues: { name: '', email: '' },
  validator: {
    validate: (values) => ({
      valid: values.name !== '' && values.email.includes('@'),
      errors:
        values.name === '' ? { name: 'Name is required' }
        : values.email.includes('@') ? null
        : { email: 'Invalid e-mail' },
    }),
  },
});

await form.validate();       // false
form.errors;                 // { name: 'Name is required' }
form.isValid;                // false
```

A form without a validator is always valid — `validate()` resolves `true`.

## Field validation

`validateField(path)` runs the same validator but applies errors **only under the path**:

```ts
const ok = await form.validateField('email');
// errors on other paths are untouched
```

This is what you call on blur. The result is scoped, so per-field validation never clobbers what other fields are showing.

Through the field controller:

```ts
await form.field('email').validate();
```

## Async validation

Validators may be async — checking e-mail availability, for example:

```ts
validator: {
  validate: async (values) => {
    const exists = await api.emailExists(values.email);
    return exists
      ? { valid: false, errors: { email: 'This e-mail is already registered' } }
      : { valid: true, errors: null };
  },
},
```

While it runs, state tells the UI:

```ts
form.isValidating;          // true — any validation in flight
form.field('email').validating; // true — a validation covering this path
```

## Async validation and races

The classic bug: the user types, request A goes out, the user types again, request B returns *first*, then A returns last and overwrites the fresh result. The core prevents it with **validation versioning**:

- every value mutation and every validation start bumps a version;
- when a run finishes and the version moved on, its result is **discarded** — it is never applied;
- if values changed during `submit()`'s validation, the validation is retried (up to 5 attempts) so submission never proceeds on stale data.

You get the correct semantics without debouncing; add your own debounce in the UI layer if you want fewer requests.

## The latest run wins

Multiple concurrent `validate()` calls are also ordered: the last-started run's result is the one applied, regardless of resolution order.

## Writing errors from validators

Errors are nested like the values — including array indices:

```ts
{
  valid: false,
  errors: {
    user: { profile: { name: 'Required' } },
    users: [{ email: 'Invalid' }, {}], // index-based
  },
}
```

A message on a whole node (object or array) is allowed too — see [whole-node messages](server-errors.md#whole-node-messages).

## Validation errors vs server errors

Validation runs **own** their channel: each run replaces previous validation errors entirely. Server errors set via `setError`/`setErrors` live in a separate channel that validation never touches. Details in [server errors](server-errors.md).

## Validate-on-change / validate-on-blur?

Deliberately not built into the core: when validation triggers is UI policy. The [Vue adapter](../packages/vue) roadmap includes `validateOnBlur`/`validateOnChange` helpers; today, wire it yourself:

```ts
// on blur, in your UI layer:
form.touch(path);
form.validateField(path);
```
