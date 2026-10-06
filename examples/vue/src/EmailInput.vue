<script setup lang="ts">
import { computed } from 'vue';
import { useFormState } from '@donega/form-wrapper-vue';
import type { FormApi } from '@donega/form-wrapper';

type Values = { user: { profile: { name: string; age: number }; emails: string[] } };

const props = defineProps<{
  form: FormApi<Values>;
  index: number;
}>();

// Tracking source: any form mutation re-runs the computeds below.
const state = useFormState(props.form);

// The path is reactive: when an item is removed, Vue reuses this component
// with a new index and every binding follows the new path.
const path = computed(() => `user.emails.${props.index}` as const);

const value = computed<string>({
  get: () => {
    void state.value;
    return props.form.getValue(path.value);
  },
  set: (next) => props.form.setValue(path.value, next),
});
const error = computed(() => {
  void state.value;
  return props.form.getError(path.value);
});
const touched = computed(() => {
  void state.value;
  return props.form.field(path.value).touched;
});

function onBlur(): void {
  props.form.touch(path.value);
}
</script>

<template>
  <div>
    <input v-model="value" placeholder="you@mail.com" @blur="onBlur" />
    <span v-if="touched && error" class="error">{{ error }}</span>
  </div>
</template>
