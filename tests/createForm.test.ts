import { describe, expect, it, vi } from 'vitest';
import { createForm } from '../src';

describe('createForm', () => {
  const initialValues = {
    name: '',
    email: '',
    user: { profile: { name: '', email: '' } },
  };

  it('starts with clean, predictable state', () => {
    const form = createForm({ initialValues });

    expect(form.values).toEqual(initialValues);
    expect(form.initialValues).toEqual(initialValues);
    expect(form.errors).toEqual({});
    expect(form.touched).toEqual({});
    expect(form.isDirty).toBe(false);
    expect(form.isValid).toBe(true);
    expect(form.isSubmitting).toBe(false);
    expect(form.isValidating).toBe(false);
    expect(form.isSubmitted).toBe(false);
    expect(form.submitCount).toBe(0);
  });

  it('exposes a consistent state snapshot', () => {
    const form = createForm({ initialValues });
    form.setValue('name', 'Gabriel');
    form.touch('user.profile.email');
    form.setError('email', 'E-mail inválido');

    const state = form.state;
    expect(state.values.name).toBe('Gabriel');
    expect(state.touched).toEqual({ user: { profile: { email: true } } });
    expect(state.errors).toEqual({ email: 'E-mail inválido' });
    expect(state.isDirty).toBe(true);
    expect(state.isValid).toBe(false);
  });

  it('never mutates and never observes the caller-provided initialValues object', () => {
    const source = { name: 'a', user: { profile: { name: 'b' } } };
    const form = createForm({ initialValues: source });

    form.setValue('name', 'c');
    form.setValue('user.profile.name', 'd');

    expect(source).toEqual({ name: 'a', user: { profile: { name: 'b' } } });
  });

  it('is safe against external mutations of initialValues after creation', () => {
    const source = { user: { profile: { name: 'b' } } };
    const form = createForm({ initialValues: source });

    source.user.profile.name = 'MUTATED';

    expect(form.initialValues.user.profile.name).toBe('b');
    expect(form.values.user.profile.name).toBe('b');
    form.resetField('user.profile.name');
    expect(form.values.user.profile.name).toBe('b');
  });

  it('values getter always reflects the current nested structure', () => {
    const form = createForm({ initialValues });
    form.setValue('user.profile.name', 'Gabriel');

    expect(form.values).toEqual({
      name: '',
      email: '',
      user: { profile: { name: 'Gabriel', email: '' } },
    });
  });

  it('notifies subscribers on every state change until unsubscribed', () => {
    const form = createForm({ initialValues });
    const listener = vi.fn();
    const unsubscribe = form.subscribe(listener);

    form.setValue('name', 'a');
    form.touch('name');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    form.setValue('name', 'b');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('caches field and array controllers per path', () => {
    const form = createForm({ initialValues: { users: [{ name: '' }] } });
    expect(form.field('users.0.name')).toBe(form.field('users.0.name'));
    expect(form.array('users')).toBe(form.array('users'));
  });
});
