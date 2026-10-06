# @donega/form-wrapper

**A headless form state controller for TypeScript.** It owns the hard part of forms — values, nested paths, dynamic arrays, validation, errors, dirty/touched tracking and submission — while your UI layer stays 100% yours.

It is for developers who want form logic that is **framework-agnostic** (Vue, React, Svelte or none), **type-safe down to every nested path**, and free of UI assumptions: no inputs, no styles, no components. Just state.

[![npm version](https://img.shields.io/npm/v/@donega/form-wrapper.svg)](https://www.npmjs.com/package/@donega/form-wrapper)
[![npm downloads](https://img.shields.io/npm/dm/@donega/form-wrapper.svg)](https://www.npmjs.com/package/@donega/form-wrapper)
[![CI](https://github.com/GabrielDonega/form-wrapper/actions/workflows/ci.yml/badge.svg)](https://github.com/GabrielDonega/form-wrapper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**Features:** framework-agnostic · TypeScript-first · type-safe nested paths · nested objects · dynamic arrays · sync & async validation · server errors · dirty/touched state · typed submission · zero UI assumptions · zero dependencies

## Why?

Without a form library, every form re-implements the same plumbing by hand:

```
values + errors + touched + dirty + loading + validation
        + submission + server errors + nested fields + dynamic arrays
```

Each concern needs its own state, its own updates, and they all need to stay in sync — especially when arrays reorder or the API returns errors after submit. `form-wrapper` centralizes all of it in one controller, and leaves rendering to you:

```ts
const form = createForm({ initialValues: { name: '' } });

form.setValue('name', 'Gabriel');   // state, dirty tracking, notifications
form.field('name').error;           // error for that exact path
form.array('tags').move(2, 0);      // arrays remap errors/touched for you
await form.submit();                // validates, then calls your onSubmit
```

## Quick Start

```bash
npm install @donega/form-wrapper
```

```ts
import { createForm } from '@donega/form-wrapper';

const form = createForm({
  initialValues: { name: '', email: '' },
});

// read / write (paths and values are type-checked)
form.getValue('name');            // ''
form.setValue('name', 'Gabriel');
form.field('name').dirty;         // true — differs from the initial value

// validate (optional — pass a `validator`, see below)
await form.validate();            // true / false
form.getError('email');           // 'E-mail inválido' | undefined

// submit — validates first, then calls onSubmit
const result = await form.submit();
// { status: 'submitted', data } | { status: 'invalid', errors }
// | { status: 'error', error }  | { status: 'skipped' }

// reset
form.reset();
```

With validation and submission wired in:

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
  onSubmit: async (values) => {
    await api.save(values); // your call — receives the nested values
  },
});
```

**→ Continue with [Getting Started](docs/getting-started.md)** — the same form, step by step.

## Mental model

The form owns state and logic. The UI layer — your app or a framework adapter — renders it:

```
Form
 ├── values
 ├── errors
 ├── touched
 ├── dirty
 ├── validation
 └── submission
        ↓
   Framework / UI
```

The core knows nothing about inputs, selects, CSS or components. Framework adapters only bridge `subscribe()` into reactivity — they add no behavior of their own.

## Cheat sheet

| I want to… | API |
|---|---|
| Read a value | `form.getValue(path)` |
| Change a value | `form.setValue(path, value)` |
| Read an error | `form.getError(path)` |
| Set a server/external error | `form.setError(path, message)` / `form.setErrors(nested)` |
| Clear errors | `form.clearError(path)` / `form.clearErrors(path?)` |
| Mark as touched | `form.touch(path)` |
| Validate the form | `await form.validate()` |
| Validate one field | `await form.validateField(path)` |
| Submit | `await form.submit()` |
| Reset everything | `form.reset()` |
| Reset one field | `form.resetField(path)` |
| Work with a field's state | `form.field(path)` |
| Work with a dynamic array | `form.array(path)` |
| React to any change | `form.subscribe(listener)` |
| Read all state at once | `form.state` |

## Nested objects

Paths are typed from `initialValues` — every dot is checked by the compiler:

```ts
const form = createForm({
  initialValues: {
    user: {
      profile: { name: '', email: '' },
      address: { street: '', city: '' },
    },
  },
});

form.setValue('user.profile.name', 'Gabriel'); // ✓
form.setValue('user.profile.nope', 'x');       // ✗ compile error
form.setValue('user.profile.age', 30);         // ✗ string expected
```

Errors and touched state mirror the same structure, and any path (leaf, object or array) can be validated, reset or observed.

**→ [Nested forms guide](docs/nested-forms.md)**

## Dynamic arrays

```ts
const users = form.array('users');

users.append({ name: '', email: '' });
users.remove(0);
users.move(1, 0);

// errors and touched entries follow their items across shifts
users.insert(0, { name: '', email: '' });
```

Removing or reordering items **remaps** error and touched indices automatically, so messages never end up on the wrong row.

**→ [Arrays guide](docs/arrays.md)**

## Validation

Progressive, from a hand-rolled validator to async:

```ts
// sync
validator: { validate: (values) => ({ valid, errors }) }

// async — e.g. check if the e-mail is taken
validator: {
  validate: async (values) => {
    const taken = await api.emailExists(values.email);
    return taken
      ? { valid: false, errors: { email: 'Already in use' } }
      : { valid: true, errors: null };
  },
}
```

Async validations are race-protected: if values change while a validation is in flight, the stale result is discarded — newer results always win.

**→ [Validation guide](docs/validation.md)** · **→ [Zod adapter](packages/zod)**

## Server errors

`submit()` never throws — it returns a typed result, and your API errors map straight onto fields:

```ts
const result = await form.submit();
if (result.status === 'error') {
  form.setErrors({
    email: 'This e-mail is already registered', // nested like your values
  });
}
```

Server errors live in their own channel with precedence over validation errors, so API messages survive the next re-validation.

**→ [Server errors guide](docs/server-errors.md)**

## field()

`form.field(path)` gives you the state and operations of one field — value, error, touched, dirty, valid, validating — always in sync through getters:

```ts
const name = form.field('user.profile.name');

name.value;      // current value
name.error;      // string | undefined
name.touched;    // boolean
name.dirty;      // deep-compared against the initial value
name.valid;      // no error at this path or under it
name.validating; // validation in flight covering this path

name.setValue('Gabriel');
name.touch();
await name.validate();
name.reset();
```

**→ [API reference](docs/api.md)**

## Framework integration

The whole integration surface is `subscribe(listener)` plus the reference-stable `form.state` snapshot — the same pattern works everywhere:

```ts
// Vue (official adapter)
import { useForm, useField } from '@donega/form-wrapper-vue';

const { form, state } = useForm({ initialValues: { name: '' } });
const name = useField(form, 'name');
// <input v-model="name.value" />
```

```tsx
// React (no adapter needed — useSyncExternalStore fits the API)
const state = useSyncExternalStore(form.subscribe, () => form.state);
```

```svelte
// Svelte
const state = writable(form.state);
form.subscribe(() => state.set(form.state));
```

**→ [Framework integration guide](docs/framework-integration.md)**

## Packages

| Package | Status | Description |
|---|---|---|
| [`@donega/form-wrapper`](#quick-start) | ✅ stable | Core — headless controller, no dependencies |
| [`@donega/form-wrapper-vue`](packages/vue) | ✅ ready | `useForm` / `useField` composables for Vue 3 |
| [`@donega/form-wrapper-zod`](packages/zod) | ✅ ready | Schema validation via Zod |
| `@donega/form-wrapper-react` | 📋 planned | `useForm` hook (the core already fits `useSyncExternalStore`) |
| `@donega/form-wrapper-valibot` | 📋 planned | Schema validation via Valibot |

## Documentation

| Doc | What's inside |
|---|---|
| [Getting started](docs/getting-started.md) | First form in ~2 minutes |
| [Concepts](docs/concepts.md) | Mental model, error channels, snapshots, immutability |
| [API reference](docs/api.md) | Every method, typed and explained |
| [Nested forms](docs/nested-forms.md) | Deep objects and path type-safety |
| [Arrays](docs/arrays.md) | Dynamic fields and index remapping |
| [Validation](docs/validation.md) | Sync, async, field-level, race protection |
| [Server errors](docs/server-errors.md) | API errors, precedence between channels |
| [Framework integration](docs/framework-integration.md) | `subscribe()`, Vue/React/Svelte |
| [Recipes](docs/recipes) | Login, registration, dynamic fields, async validation, multi-step |

## Examples

Runnable apps in [`examples/`](examples):

- **[vanilla](examples/vanilla)** — plain DOM, no build step
- **[vue](examples/vue)** — Vue 3 + Composition API + TypeScript + Vite, using the official adapter

## Roadmap

**Core**
- ✅ Values, nested paths, dynamic arrays, validation, server errors, submission
- ✅ Field/array controllers with automatic index remapping
- Future: reactive validation triggers (`validateOnBlur`/`validateOnChange`) in adapters, `Set`/`Map` value support

**Adapters**
- ✅ Vue 3 (`@donega/form-wrapper-vue`)
- 📋 React, Svelte

**Validators**
- ✅ Zod (`@donega/form-wrapper-zod`)
- 📋 Valibot

**Tooling**
- 📋 Documentation site, DevTools, more examples

## Development

```bash
npm install
npm test                  # core tests (includes type-level tests)
npm run test:packages     # adapter tests
npm run typecheck
npm run build             # core, then: npm run build:packages
npm run smoke             # imports the built package in plain Node
```

## License

[MIT](./LICENSE) © Gabriel Donegá
