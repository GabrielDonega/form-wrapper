# API reference

Everything exported by `@donega/form-wrapper`. Paths are typed as `Path<TValues>` — dotted strings checked against `initialValues` at compile time.

```ts
import { createForm } from '@donega/form-wrapper';

const form = createForm({
  initialValues: { name: '' },   // required — defines the value shape
  validator,                     // optional — FormValidator<TValues>
  onSubmit: async (values, form) => data, // optional — runs after validation
});
```

## State (getters)

| Property | Type | Description |
|---|---|---|
| `values` | `TValues` | Current nested values. Mutate only via the API. |
| `initialValues` | `TValues` | Defensive clone of what the form was created with. Never mutated. |
| `errors` | `FormErrors<TValues>` | Nested errors mirroring the values shape (validation + server merged). |
| `touched` | `FormTouched<TValues>` | Nested touched structure. |
| `isDirty` | `boolean` | Any value differs from `initialValues` (deep comparison). |
| `isValid` | `boolean` | No error in either channel. |
| `isSubmitting` | `boolean` | `onSubmit` currently running. |
| `isValidating` | `boolean` | Any validation in flight. |
| `isSubmitted` | `boolean` | Last submit completed successfully. |
| `submitCount` | `number` | Total submit attempts. |
| `state` | `FormState<TValues>` | Consistent snapshot of everything above (reference-stable). |

## Values

| Method | Description |
|---|---|
| `getValue(path)` | Value at `path`, typed as `PathValue<TValues, P>`. |
| `setValue(path, value)` | Replaces the value at `path`. Creates a new root with structural sharing; marks in-flight validations stale. Accepts leaves, whole objects or whole arrays. |

## Errors

| Method | Description |
|---|---|
| `getError(path)` | Merged message at `path` — server errors take precedence. `string \| undefined`. |
| `setError(path, message)` | Writes an **external** (server-side) error at `path`. |
| `setErrors(nested)` | Replaces the whole external channel with a nested structure — the way to apply an API response. `null`/`undefined` clears it. |
| `clearError(path)` | Removes both channels at `path` (exact path only). |
| `clearErrors(path?)` | Removes both channels everywhere, or under `path`. |

## Touched

| Method | Description |
|---|---|
| `touch(path)` | Marks the path as touched. |

## Validation

| Method | Description |
|---|---|
| `validate()` | Runs the validator on the whole form. Resolves `boolean`. |
| `validateField(path)` | Runs the validator but only applies errors **under** `path`. Resolves `boolean`. |

Async runs are race-protected: if values change or a newer validation starts while one is in flight, the stale result is discarded (see [validation](validation.md#async-validation-and-races)).

## Submission

| Method | Description |
|---|---|
| `submit()` | Validates (retrying up to 5 times if values change mid-flight), then calls `onSubmit` with a defensive clone of the values and the form itself. Returns `SubmitOutcome<TValues, TData>` — never throws. Concurrent calls return `{ status: 'skipped' }`. |

## Reset

| Method | Description |
|---|---|
| `reset()` | Restores `initialValues`, clears both error channels, touched and submit state. |
| `resetField(path)` | Restores one path — leaf, object or array — without touching siblings. Clears errors and touched under it. |

## Controllers

### `form.field(path)` → `FieldApi<TValue>`

Per-path controller, cached per form (the same path returns the same object). Getters are always in sync — no subscription needed.

| Member | Type | Description |
|---|---|---|
| `path` | `string` | The bound path. |
| `value` | `TValue` | Current value. |
| `error` | `string \| undefined` | Merged error at this path. |
| `touched` | `boolean` | |
| `dirty` | `boolean` | Deep comparison against the initial value at the same path. |
| `valid` | `boolean` | No error at this path or anywhere under it. |
| `validating` | `boolean` | A validation covering this path is in flight. |
| `setValue(value)` | | Write through the form. |
| `setError(message)` | | External error at this path. |
| `clearError()` | | Remove both channels at this path. |
| `touch()` | | |
| `validate()` | | Same as `form.validateField(path)`. |
| `reset()` | | Same as `form.resetField(path)`. |

### `form.array(path)` → `ArrayApi<TItem>`

Controller for a path whose value is an array. Every operation keeps errors and touched entries aligned with their items via index remapping. Items are cloned on insert. Throws `TypeError` if the path doesn't hold an array and `RangeError` on out-of-bounds indices.

| Member | Description |
|---|---|
| `path` | The bound path. |
| `value` | Current array (live). |
| `length` | Current length. |
| `append(item)` | Adds at the end. |
| `prepend(item)` | Adds at the start — all indices shift +1. |
| `insert(index, item)` | Inserts at `index` (0…length). |
| `remove(index)` | Removes — errors/touched at that index are dropped, later ones shift −1. |
| `replace(index, item)` | Swaps the item in place. |
| `move(from, to)` | Reorders — errors/touched follow their items. |
| `clear()` | Empties the array and drops every error/touched entry under the path. |

## Adapters

| Method | Description |
|---|---|
| `subscribe(listener)` | Calls `listener(form)` synchronously after every mutation. Returns an unsubscribe function. The only hook a framework adapter needs. |

## Exported types

`createForm` · `FormApi` · `FormState` · `FormErrors` · `FormTouched` · `FormValidator` · `ValidationResult` · `SubmitOutcome` · `CreateFormOptions` · `FieldApi` · `ArrayApi` · `Path` · `PathValue` · `ArrayPath` · `ArrayItem` · `Primitive`
