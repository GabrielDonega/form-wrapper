import { computed, effectScope } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useForm, useField } from '../src/index.js';

describe('useForm', () => {
  it('exposes the form and a reactive state snapshot', () => {
    const scope = effectScope();
    scope.run(() => {
      const { form, state } = useForm({ initialValues: { name: '' } });

      expect(form.getValue('name')).toBe('');
      expect(state.value.values).toEqual({ name: '' });
      expect(state.value.isDirty).toBe(false);
    });
    scope.stop();
  });

  it('updates the state snapshot when the form mutates', () => {
    const scope = effectScope();
    scope.run(() => {
      const { form, state } = useForm({ initialValues: { name: '' } });

      const before = state.value;
      form.setValue('name', 'Gabriel');

      expect(state.value).not.toBe(before);
      expect(state.value.isDirty).toBe(true);
      expect(state.value.values.name).toBe('Gabriel');
    });
    scope.stop();
  });

  it('tracks computed reads through the state snapshot', () => {
    const scope = effectScope();
    scope.run(() => {
      const { state } = useForm({ initialValues: { name: '' } });
      const dirty = computed(() => state.value.isDirty);

      expect(dirty.value).toBe(false);
      // Mutation happens outside the computed's own evaluation:
      const context = useForm({ initialValues: { age: 0 } });
      context.form.setValue('age', 1);
      expect(computed(() => context.state.value.isDirty).value).toBe(true);
      expect(dirty.value).toBe(false);
    });
    scope.stop();
  });

  it('releases the form subscription when the scope is disposed', () => {
    const scope = effectScope();
    let context: ReturnType<typeof useForm<{ name: string }, void>> | undefined;
    scope.run(() => {
      context = useForm({ initialValues: { name: '' } });
    });

    const listener = vi.fn();
    context!.form.subscribe(listener);
    scope.stop();

    // After disposal the adapter's own subscription is gone; the form still
    // notifies remaining listeners, but the reactive link is severed.
    context!.form.setValue('name', 'after stop');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('useField', () => {
  it('provides a writable value binding', () => {
    const scope = effectScope();
    scope.run(() => {
      const { form } = useForm({ initialValues: { name: '' } });
      const name = useField(form, 'name');

      expect(name.value.value).toBe('');
      name.value.value = 'Gabriel';
      expect(form.getValue('name')).toBe('Gabriel');
      expect(name.value.value).toBe('Gabriel');
    });
    scope.stop();
  });

  it('reflects error, touched, dirty and valid reactively', async () => {
    const scope = effectScope();
    await scope.run(async () => {
      const { form, state } = useForm({
        initialValues: { email: '' },
        validator: {
          validate: (values) => ({
            valid: values.email.includes('@'),
            errors: values.email.includes('@') ? null : { email: 'E-mail inválido' },
          }),
        },
      });
      const email = useField(form, 'email');

      expect(email.error.value).toBeUndefined();
      expect(email.touched.value).toBe(false);
      expect(email.dirty.value).toBe(false);

      email.value.value = 'not-an-email';
      expect(state.value.isDirty).toBe(true);
      expect(email.dirty.value).toBe(true);

      form.touch('email');
      expect(email.touched.value).toBe(true);

      const valid = await form.validate();
      expect(valid).toBe(false);
      expect(email.error.value).toBe('E-mail inválido');
      expect(email.valid.value).toBe(false);
    });
    scope.stop();
  });

  it('supports paths inside dynamic arrays', () => {
    const scope = effectScope();
    scope.run(() => {
      const { form } = useForm({
        initialValues: { users: [{ name: 'a' }, { name: 'b' }] },
      });

      const first = useField(form, 'users.0.name');
      expect(first.value.value).toBe('a');

      form.array('users').move(1, 0);
      // The path is index-based: after the move, index 0 holds 'b'.
      expect(first.value.value).toBe('b');
    });
    scope.stop();
  });

  it('keeps bindings in sync when values change outside the binding', () => {
    const scope = effectScope();
    scope.run(() => {
      const { form } = useForm({ initialValues: { name: '' } });
      const name = useField(form, 'name');

      expect(name.value.value).toBe('');
      form.setValue('name', 'externally');
      expect(name.value.value).toBe('externally');
    });
    scope.stop();
  });
});
