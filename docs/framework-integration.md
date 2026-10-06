# Framework integration

The core has exactly one integration surface:

- **`form.subscribe(listener)`** — called synchronously after every mutation; returns an unsubscribe function.
- **`form.state`** — a snapshot that is **reference-stable** between changes (cached, rebuilt only on mutation).

Any reactive system that supports "subscribe + stable snapshot" plugs in directly. Adapters add reactivity and nothing else — no components, no UI decisions.

```
@donega/form-wrapper  (state + logic)
        ↓ subscribe() / state
  framework adapter   (reactivity only)
        ↓
   your UI / markup
```

## Vue 3 — official adapter

[`@donega/form-wrapper-vue`](../packages/vue) provides `useForm`, `useFormState` and `useField`:

```vue
<script setup lang="ts">
import { useForm, useField } from '@donega/form-wrapper-vue';

const { form, state } = useForm({
  initialValues: { name: '', email: '' },
  validator, // same contract as the core
  onSubmit: async (values) => api.save(values),
});

// useField returns writable computeds — made for v-model.
const name = useField(form, 'name');
const email = useField(form, 'email');
</script>

<template>
  <form @submit.prevent="form.submit()">
    <input v-model="name.value" @blur="form.touch('name')" />
    <span v-if="name.touched && name.error">{{ name.error }}</span>

    <input v-model="email.value" @blur="form.touch('email')" />
    <span v-if="email.touched && email.error">{{ email.error }}</span>

    <button :disabled="state.isSubmitting">Save</button>
  </form>
</template>
```

Design notes:

- `useForm`/`useField`/`useFormState` translate `subscribe()` into a shallow ref bump; computeds that read it re-evaluate on every form mutation.
- Subscriptions are released automatically when the component's scope is disposed — SSR-safe, no browser APIs.
- Reads **must** go through `useField`/`state` (plain `form.getValue(...)` in a template is not reactive). Writes and actions go through `form`.
- Dynamic arrays: `useField` accepts index paths — `useField(form, 'contacts.0.name')` — and a small per-row component can keep the path reactive while items shift (see the [Vue example](../examples/vue)).

Run the full example: [`examples/vue`](../examples/vue).

## React — no adapter needed

The core API was shaped to fit `useSyncExternalStore`:

```tsx
import { useSyncExternalStore } from 'react';

function useFormState<T extends object, D>(form: FormApi<T, D>) {
  return useSyncExternalStore(
    form.subscribe,       // (listener) => unsubscribe — matches
    () => form.state,     // reference-stable between mutations
  );
}

function Signup({ form }: { form: ReturnType<typeof createForm> }) {
  const state = useFormState(form);
  return (
    <input
      value={state.values.name}
      onChange={(e) => form.setValue('name', e.target.value)}
      onBlur={() => form.touch('name')}
    />
  );
}
```

A dedicated `@donega/form-wrapper-react` (with `useField`-style bindings) is on the roadmap.

## Svelte — writable store

```ts
import { writable } from 'svelte/store';
import { createForm } from '@donega/form-wrapper';

const form = createForm({ initialValues: { name: '' } });
const state = writable(form.state);

form.subscribe(() => state.set(form.state)); // Svelte auto-unsubscribes
```

```svelte
<input
  value={$state.values.name}
  on:input={(e) => form.setValue('name', e.currentTarget.value)}
/>
```

## Writing your own integration

The contract is three lines:

```ts
const render = () => ui.update(form.state);
const unsubscribe = form.subscribe(render);
render(); // initial paint
// later: unsubscribe()
```

Everything else — validation triggers, focus management, styling — stays in your layer.
