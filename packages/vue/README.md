# @donega/form-wrapper-vue

Vue 3 adapter for [`@donega/form-wrapper`](../../README.md) — reactive bindings for the headless form controller. Reactivity only: no components, no UI decisions.

```bash
npm install @donega/form-wrapper @donega/form-wrapper-vue
```

## Usage

```vue
<script setup lang="ts">
import { useForm, useField } from '@donega/form-wrapper-vue';

const { form, state } = useForm({
  initialValues: { name: '' },
  onSubmit: async (values) => api.save(values),
});

const name = useField(form, 'name'); // writable computed — made for v-model
</script>

<template>
  <form @submit.prevent="form.submit()">
    <input v-model="name.value" @blur="form.touch('name')" />
    <span v-if="name.touched && name.error">{{ name.error }}</span>
    <button :disabled="state.isSubmitting">Save</button>
  </form>
</template>
```

## API

| Composable | Returns | Purpose |
|---|---|---|
| `useForm(options)` | `{ form, state }` | Creates the form and wires `subscribe()` into Vue's reactivity. |
| `useFormState(form)` | `ComputedRef<FormState>` | Reactive `form.state` for a form created elsewhere (store, parent). |
| `useField(form, path)` | `{ value, error, touched, dirty, valid, validating }` | Per-field binding. `value` is writable → `v-model="field.value"`. |

Notes:

- Reads go through `useField`/`state`; plain `form.getValue(...)` in a template is not reactive. Writes and actions go through `form`.
- Index paths work: `useField(form, 'contacts.0.name')`.
- Subscriptions are released when the component scope is disposed (SSR-safe).

## Full example

[`examples/vue`](../../examples/vue) — nested values, dynamic arrays, Zod validation, server errors.
