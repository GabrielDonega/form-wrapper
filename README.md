# @donega/form-wrapper

A **headless** form state controller: values, fields, validation, errors, dirty/touched, submission and deeply nested structures — in pure TypeScript, with no dependency on Vue, React or any framework.

> This is not a UI library. It knows nothing about inputs, selects, visual messages or CSS. The presentation layer (or a framework adapter) decides how to render.

## Installation

```bash
npm install @donega/form-wrapper
```

Requires Node >= 18 (any modern bundler works in the browser). Zero runtime dependencies, ESM only, tree-shakeable.

## Basic usage

```ts
import { createForm } from '@donega/form-wrapper';

const form = createForm({
  initialValues: {
    user: {
      profile: { name: '', email: '' },
      address: { street: '', number: '', city: '' },
    },
  },
  validator: {
    validate: (values) => ({
      valid: values.user.profile.name !== '',
      errors: values.user.profile.name === ''
        ? { user: { profile: { name: 'Name is required' } } }
        : null,
    }),
  },
  onSubmit: async (values) => {
    await api.save(values); // receives the complete nested structure
  },
});

form.setValue('user.profile.name', 'Gabriel'); // type-checked
form.getValue('user.address.city');
form.touch('user.profile.name');
await form.validateField('user.profile.name');
await form.submit(); // { status: 'submitted' | 'invalid' | 'error' | 'skipped', ... }
```

## Framework integration

The core exposes a single integration hook: `subscribe(listener)`. Every mutation calls the listener synchronously and hands it the form instance; it returns an unsubscribe function. Combined with the reference-stable `form.state` snapshot, the same headless pattern works in any framework:

### React — `useSyncExternalStore`

```tsx
import { useSyncExternalStore } from 'react';
import { createForm, type FormApi } from '@donega/form-wrapper';

export function useForm<TValues extends object, TData = void>(form: FormApi<TValues, TData>) {
  const state = useSyncExternalStore(
    form.subscribe,          // subscribe(listener) — signature matches
    () => form.state,        // snapshot is reference-stable between changes
  );
  return { state, form };
}
```

> `form.state` is cached and only rebuilt when the form changes — exactly what `useSyncExternalStore` requires. Passing a fresh object per access would cause an infinite render loop.

### Vue — `ref` + `watchEffect`

```ts
import { ref, onUnmounted } from 'vue';
import { createForm } from '@donega/form-wrapper';

const form = createForm({ initialValues: { name: '' } });
const state = ref(form.state);

const unsubscribe = form.subscribe(() => {
  state.value = form.state;
});
onUnmounted(unsubscribe);
```

### Svelte — writable store

```ts
import { writable } from 'svelte/store';
import { createForm } from '@donega/form-wrapper';

const form = createForm({ initialValues: { name: '' } });
const state = writable(form.state);

form.subscribe(() => state.set(form.state)); // Svelte auto-unsubscribes
```

Official adapters (`useForm` composable/hook per framework, validators) are planned — see [Roadmap](#roadmap).

## Public API

### State (getters)

| Property | Description |
|---|---|
| `values` | Current nested object (mutate only via the API) |
| `initialValues` | Defensive clone of the initial values (never mutated) |
| `errors` | Nested errors mirroring the structure of `values` |
| `touched` | Nested touched structure |
| `isDirty` | Any value differs from `initialValues` (deep comparison) |
| `isValid` | No errors (validation and external) |
| `isSubmitting` | `onSubmit` running |
| `isValidating` | Any validation in flight |
| `isSubmitted` | Last submit completed successfully |
| `submitCount` | Total submit attempts |
| `state` | Consistent snapshot of everything above (reference-stable between changes) |

### Methods

- **Values**: `getValue(path)`, `setValue(path, value)`
- **Errors**: `getError(path)`, `setError(path, msg)` (external/server channel), `clearError(path)`, `clearErrors(path?)`, `setErrors(nested)` (applies API errors, replacing previous external ones)
- **Touched**: `touch(path)`
- **Validation**: `validate()`, `validateField(path)`
- **Submit**: `submit()` — validates before running `onSubmit`; returns a typed discriminated result; guards against concurrent submits; `isSubmitting` is always restored
- **Reset**: `reset()`, `resetField(path)` (works for leaf, object or array)
- **Controllers**: `field(path)` (value, error, touched, dirty, valid, validating + methods), `array(path)` (append, prepend, insert, remove, replace, move, clear — remapping errors/touched automatically)
- **Adapters**: `subscribe(listener)` — change notification for framework integration

## Path type safety

From `initialValues`, the `Path<T>`, `PathValue<T, P>` and `ArrayPath<T>` types infer valid paths and the value type at each one:

```ts
form.setValue('user.profile.name', 'Gabriel'); // ok — string
form.setValue('age', 30);                      // ok — number
form.setValue('age', '30');                    // ✗ type error
form.setValue('user.nope', 1);                 // ✗ nonexistent path
form.array('users.0.tags');                    // ok — array
form.array('user.profile');                    // ✗ not an array
```

## Validators

The core is agnostic. Any adapter implements the interface:

```ts
interface FormValidator<TValues> {
  validate(values: TValues): ValidationResult<TValues> | Promise<ValidationResult<TValues>>;
}

interface ValidationResult<TValues = unknown> {
  valid: boolean;
  errors: FormErrors<TValues> | null; // nested structure mirroring values
}
```

Planned adapters: `validator-zod`, `validator-valibot`, etc. A custom validator (as above) works too.

## Architecture

```
core (pure TypeScript, no reactivity)
  └── framework adapters (useForm for Vue/React via subscribe())
        └── application UI
```

```
src/
  types.ts            public types (FormApi, FormValidator, SubmitOutcome…)
  form.ts             createForm — orchestration
  field.ts            FieldApi per path
  array.ts            ArrayApi with index remapping
  validation.ts       validation result application
  paths/types.ts      Path<T>, PathValue<T, P>, ArrayPath<T>
  paths/operations.ts getByPath, setByPath, deleteByPath, hasPath
  pathMap.ts          path-keyed store (errors/touched) + remapIndices
  equality.ts         deepEqual, deepClone
```

## Design decisions

- **Selective immutability**: mutations create new roots with structural sharing; `initialValues` and array items are deep-cloned. The API is safe against external mutation.
- **Two error channels**: validation errors (written only by `validate()`) and external/server errors (`setError`/`setErrors`). `getError` merges both (server takes precedence); `isValid` considers both.
- **Validation versioning**: every value mutation invalidates in-flight validations; stale results never overwrite newer ones.
- **`submit()` returns, doesn't throw**: `{ status: 'submitted' | 'invalid' | 'error' | 'skipped' }` — no error is silently swallowed.
- **Reference-stable snapshots**: `state` is cached between mutations, so identity-based render systems (React's `useSyncExternalStore`) work out of the box.

## Known limitations

- Array indices are typed as `${number}`; numeric strings like `'0.1'` also match the pattern (e.g. `'matrix.0.1'` is accepted even if `0.1` isn't a valid index). A deliberate trade-off for type simplicity and autocomplete.
- Array indices in errors/touched produce possibly sparse arrays in the exposed nested structure (`users.0` and `users.2` with errors → hole at `1`).
- No automatic validation on `setValue` (validateOnChange/Blur) — left to the framework adapter, which has the UI context.

## Development

```bash
npm install
npm test          # vitest run (includes type-level test typecheck)
npm run typecheck
npm run build
npm run smoke     # imports the built package in plain Node
```

## Roadmap

1. `@donega/form-wrapper-validator-zod` (and other validation adapters)
2. `@donega/form-wrapper-vue` / `-react` with reactive `useForm()` via `subscribe()`
3. Reactive validation options (`validateOnBlur`, `validateOnChange`) in the adapters
4. `Set`/`Map` and class instance support as values

## License

[MIT](./LICENSE) © Gabriel Donegá
