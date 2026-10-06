<script setup lang="ts">
import { z } from 'zod';
import { useForm, useField } from '@donega/form-wrapper-vue';
import { zodValidator } from '@donega/form-wrapper-zod';
import type { SubmitOutcome } from '@donega/form-wrapper';

/**
 * This example exercises the three core pillars at once:
 * - nested values (user.profile / user.address)
 * - a dynamic array (user.emails) with automatic index remapping
 * - schema validation through the Zod adapter
 */
const schema = z.object({
  user: z.object({
    profile: z.object({
      name: z.string().min(1, 'Name is required'),
      age: z.coerce.number().min(18, 'Must be 18 or older'),
    }),
    emails: z
      .array(z.string().email('Invalid e-mail'))
      .min(1, 'Add at least one e-mail'),
  }),
});

const { form, state } = useForm({
  initialValues: {
    user: {
      profile: { name: '', age: 0 },
      emails: [''],
    },
  },
  validator: zodValidator(schema),
  onSubmit: async (values) => {
    // Simulated API call. A 422-style response maps server errors to fields:
    if (values.user.emails.includes('taken@mail.com')) {
      form.setErrors({ user: { emails: ['This e-mail is already registered'] } });
      throw new Error('422 Unprocessable Entity');
    }
  },
});

// Field bindings — writable computeds, ready for v-model.
const name = useField(form, 'user.profile.name');
const age = useField(form, 'user.profile.age');

// Array controller: mutations remap errors/touched automatically.
const emails = form.array('user.emails');

function addEmail(): void {
  emails.append('');
}

function removeEmail(index: number): void {
  emails.remove(index);
}

async function onSubmit(): Promise<void> {
  const result: SubmitOutcome<typeof state.value.values, void> = await form.submit();
  if (result.status === 'submitted') {
    // eslint-disable-next-line no-console
    console.log('saved!', state.value.values);
  }
}
</script>

<template>
  <main>
    <h1>Sign up</h1>
    <p>Headless form state + Vue bindings. Open the console to see submitted values.</p>

    <form @submit.prevent="onSubmit">
      <label>
        Name
        <input v-model="name.value" @blur="form.touch('user.profile.name')" />
      </label>
      <span v-if="name.touched && name.error" class="error">{{ name.error }}</span>

      <label>
        Age
        <input v-model.number="age.value" type="number" @blur="form.touch('user.profile.age')" />
      </label>
      <span v-if="age.touched && age.error" class="error">{{ age.error }}</span>

      <fieldset>
        <legend>E-mails</legend>
        <template v-for="(_, index) in state.values.user.emails" :key="index">
          <!-- useField accepts index-based paths: errors follow their item -->
          <EmailInput :form="form" :index="index" />
          <button type="button" @click="removeEmail(index)">remove</button>
        </template>
        <button type="button" @click="addEmail">add e-mail</button>
      </fieldset>

      <button type="submit" :disabled="state.isSubmitting">
        {{ state.isSubmitting ? 'Saving…' : 'Submit' }}
      </button>
    </form>

    <pre>{{ { isDirty: state.isDirty, isValid: state.isValid, submitCount: state.submitCount } }}</pre>
  </main>
</template>

<style>
body { font-family: system-ui, sans-serif; max-width: 34rem; margin: 2rem auto; }
label, fieldset { display: block; margin-bottom: 1rem; }
input { display: block; margin-top: 0.25rem; padding: 0.4rem; width: 100%; box-sizing: border-box; }
.error { color: #c0392b; font-size: 0.85rem; }
button { margin-right: 0.5rem; }
pre { background: #f4f4f4; padding: 0.75rem; border-radius: 4px; }
</style>
