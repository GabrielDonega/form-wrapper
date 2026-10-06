# Getting started

Your first form in about two minutes — then the same form, step by step, with validation and submission.

## Install

```bash
npm install @donega/form-wrapper
```

Zero runtime dependencies. ESM only. Works in any modern bundler and in Node >= 18.

## 1. Create the form

```ts
import { createForm } from '@donega/form-wrapper';

const form = createForm({
  initialValues: {
    name: '',
    email: '',
  },
});
```

`initialValues` is deep-cloned — the form never mutates your object, and later mutations of it never leak into the form.

## 2. Read and write values

```ts
form.getValue('name');            // ''
form.setValue('name', 'Gabriel');
form.getValue('name');            // 'Gabriel'

form.field('name').dirty;         // true — differs from the initial value
form.isDirty;                     // true — any value differs
```

Every path is type-checked against `initialValues`:

```ts
form.setValue('name', 'Gabriel'); // ✓
form.setValue('email', 42);       // ✗ compile error: string expected
form.setValue('nope', 'x');       // ✗ compile error: unknown path
```

## 3. Mark fields as touched

Touched means "the user interacted with this field" — typically set on blur, so you don't yell at people while they're still typing:

```ts
form.touch('name');
form.field('name').touched; // true
form.touched;               // { name: true, email: false } — nested structure
```

## 4. Validate

Add a validator — any object implementing `validate`:

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
```

```ts
const valid = await form.validate();  // false
form.getError('name');                 // 'Name is required'
form.errors;                           // { name: 'Name is required' } — nested
form.isValid;                          // false
```

Errors mirror the shape of your values. `errors` is fully replaced by each validation run — the validator owns that channel.

## 5. Submit

```ts
const form = createForm({
  initialValues: { name: '', email: '' },
  validator,
  onSubmit: async (values) => {
    return api.save(values); // whatever you return becomes result.data
  },
});
```

```ts
const result = await form.submit();

switch (result.status) {
  case 'submitted': // result.data — onSubmit returned
  case 'invalid':   // result.errors — validation failed, onSubmit NOT called
  case 'error':     // result.error — onSubmit threw
  case 'skipped':   // a submit was already running
}
```

`submit()` validates first, guards against concurrent submits, and never throws — errors come back typed in the result.

## 6. Reset

```ts
form.reset();        // everything back to initialValues
form.resetField('name'); // one path (leaf, object or array) back to initial
```

Reset also clears errors, touched and submit state.

## What's next

- **[Concepts](concepts.md)** — how the pieces fit together
- **[Validation](validation.md)** — field-level and async validation
- **[Nested forms](nested-forms.md)** — deep objects with type-safe paths
- **[Arrays](arrays.md)** — dynamic fields
- **[Server errors](server-errors.md)** — mapping API errors to fields
- **[Framework integration](framework-integration.md)** — wiring into Vue/React/Svelte
