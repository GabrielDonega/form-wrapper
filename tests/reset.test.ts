import { describe, expect, it } from 'vitest';
import { createForm } from '../src/index.js';

describe('reset', () => {
  it('restores every value to the initial state', () => {
    const form = createForm({
      initialValues: { user: { profile: { name: 'a' } }, tags: ['x'] },
    });
    form.setValue('user.profile.name', 'b');
    form.setValue('tags', ['y', 'z']);

    form.reset();

    expect(form.values).toEqual({ user: { profile: { name: 'a' } }, tags: ['x'] });
    expect(form.isDirty).toBe(false);
  });

  it('clears errors, touched and submit state', async () => {
    const form = createForm({
      initialValues: { name: '' },
      onSubmit: async () => {},
    });
    form.setValue('name', 'x');
    form.setError('name', 'erro');
    form.touch('name');
    await form.submit();

    form.reset();

    expect(form.errors).toEqual({});
    expect(form.touched).toEqual({});
    expect(form.isSubmitted).toBe(false);
    expect(form.submitCount).toBe(0);
  });

  it('is safe when initialValues contained nested objects (no shared references)', () => {
    const initialValues = { user: { profile: { name: 'a' } } };
    const form = createForm({ initialValues });
    form.setValue('user.profile.name', 'b');
    form.reset();
    form.setValue('user.profile.name', 'c');

    expect(initialValues).toEqual({ user: { profile: { name: 'a' } } });
    expect(form.getValue('user.profile.name')).toBe('c');
  });
});

describe('resetField', () => {
  const makeForm = () => {
    const form = createForm({
      initialValues: {
        user: { profile: { name: 'a', email: 'b' }, address: { city: 'c' } },
        tags: ['x', 'y'],
      },
    });
    return form;
  };

  it('restores a single leaf', () => {
    const form = makeForm();
    form.setValue('user.profile.name', 'other');
    form.resetField('user.profile.name');
    expect(form.getValue('user.profile.name')).toBe('a');
    expect(form.getValue('user.profile.email')).toBe('b');
    expect(form.isDirty).toBe(false);
  });

  it('restores a whole subtree without touching siblings', () => {
    const form = makeForm();
    form.setValue('user.profile.name', 'other');
    form.setValue('user.address.city', 'Londrina');
    form.setError('user.profile.email', 'erro');
    form.touch('user.profile.name');

    form.resetField('user.profile');

    expect(form.getValue('user.profile')).toEqual({ name: 'a', email: 'b' });
    expect(form.getValue('user.address.city')).toBe('Londrina'); // untouched
    expect(form.getError('user.profile.email')).toBeUndefined();
    expect(form.touched).toEqual({});
    expect(form.isDirty).toBe(true); // address still differs
  });

  it('restores arrays', () => {
    const form = makeForm();
    form.setValue('tags', ['q']);
    form.resetField('tags');
    expect(form.getValue('tags')).toEqual(['x', 'y']);
  });

  it('works through the field controller', () => {
    const form = makeForm();
    const field = form.field('user.profile.name');
    field.setValue('other');
    field.reset();
    expect(field.value).toBe('a');
  });
});
