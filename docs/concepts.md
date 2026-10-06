# Concepts

The ideas behind the API — read this once and everything else becomes predictable.

## Mental model

```
Form
 ├── values        what the user typed (nested, typed)
 ├── errors        why it can't be submitted yet (nested)
 ├── touched       which fields the user has interacted with
 ├── dirty         what differs from the initial values
 ├── validation    sync or async rules, race-protected
 └── submission    validate → onSubmit → typed result
        ↓
   Framework / UI
```

The form controls state and logic. Rendering is your job — or your framework adapter's job, which only bridges change notifications into reactivity. The core has no components, no CSS, no DOM.

## Two error channels

Errors live in two independent stores:

| Channel | Written by | Cleared by |
|---|---|---|
| **Validation errors** | `validate()` / `validateField()` — the validator fully owns them | the next validation run, `reset()` |
| **External/server errors** | `setError()` / `setErrors()` — e.g. an API response | `clearError()` / `clearErrors()`, `reset()` |

`getError(path)` and `form.errors` merge both, **with server precedence**: if a path has both, you see the server message. This is why API errors survive the next re-validation — validation runs never touch the external channel.

`isValid` considers both channels: the form is valid only when neither store has an error.

## State snapshot

`form.state` returns every public state property in one object:

```ts
const { values, errors, touched, isDirty, isValid, isSubmitting, isValidating, isSubmitted, submitCount } = form.state;
```

The snapshot is **reference-stable**: it is cached and only rebuilt when the form actually changes. This is exactly what identity-comparing render systems need (React's `useSyncExternalStore` would loop forever otherwise). Framework adapters treat `state` as the reactive source of truth.

## Immutability with structural sharing

- `setValue` creates a new root object; unchanged branches are shared with the old one. Nothing is mutated in place.
- `initialValues`, array items you pass to array operations, and values handed to the validator/`onSubmit` are defensive clones.
- Because roots change identity on every mutation, adapters can use reference comparison to detect changes cheaply.

## Paths are the universal address

Every API that targets state takes the same dotted path, typed against `initialValues`:

```ts
form.setValue('user.address.city', 'Londrina');
form.getError('user.address.city');
form.field('user.address.city');
form.array('user.addresses');
form.resetField('user.address');
form.validateField('user.address.city');
```

Leaves, whole objects and whole arrays are all valid targets — you can set, validate, reset or observe any of them.

## Change notification

`subscribe(listener)` is the single integration hook:

```ts
const unsubscribe = form.subscribe((form) => {
  // called synchronously after every mutation
});
unsubscribe();
```

Listeners receive the form itself, so one subscription can drive any rendering strategy. Validation also notifies: `isValidating`/`field.validating` transitions are observable without polling.

## Submission contract

`submit()` never throws:

| Result | Meaning |
|---|---|
| `{ status: 'submitted', data }` | validation passed, `onSubmit` resolved |
| `{ status: 'invalid', errors }` | validation failed — `onSubmit` was not called |
| `{ status: 'error', error }` | `onSubmit` threw — the original error is here |
| `{ status: 'skipped' }` | another submit was already running |

`isSubmitting` is always restored, even when `onSubmit` throws synchronously. `submitCount` counts every attempt.

## What the core deliberately does not do

- **No automatic validation on change/blur** — the adapter layer owns that, because it's a UI-policy decision (and it's on the adapter roadmap).
- **No UI components** — by design; see the [architecture](#mental-model).
- **No schema library dependency** — Zod/Valibot connect through the [`FormValidator` interface](validation.md#validators) via separate adapter packages.
