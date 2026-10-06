import { describe, expect, it, vi } from 'vitest';
import { createForm } from '../src';
import type { FieldApi } from '../src';

describe('field controller', () => {
  function setup() {
    const form = createForm({
      initialValues: {
        user: { profile: { name: 'Gabriel', email: '' } },
        tags: ['a'],
      },
    });
    return { form, field: form.field('user.profile.name') };
  }

  it('stays synchronized with the form through getters', () => {
    const { form, field } = setup();

    form.setValue('user.profile.name', 'Other');
    expect(field.value).toBe('Other');

    form.setError('user.profile.name', 'Nome inválido');
    expect(field.error).toBe('Nome inválido');
    expect(field.valid).toBe(false);

    form.touch('user.profile.name');
    expect(field.touched).toBe(true);
  });

  it('exposes dirty per path with deep comparison', () => {
    const { field } = setup();
    expect(field.dirty).toBe(false);

    field.setValue('Other');
    expect(field.dirty).toBe(true);

    field.setValue('Gabriel'); // back to the initial value
    expect(field.dirty).toBe(false);
  });

  it('valid is false when any error exists under the path', () => {
    const { form } = setup();
    const user = form.field('user');

    expect(user.valid).toBe(true);
    form.setError('user.profile.email', 'E-mail inválido');
    expect(user.valid).toBe(false);

    const profile = form.field('user.profile');
    expect(profile.valid).toBe(false);
    expect(form.field('user.profile.name').valid).toBe(true);
  });

  it('mutates through the field methods', () => {
    const { form, field } = setup();

    field.setValue('Novo');
    expect(form.getValue('user.profile.name')).toBe('Novo');

    field.setError('manual');
    expect(form.getError('user.profile.name')).toBe('manual');

    field.clearError();
    expect(form.getError('user.profile.name')).toBeUndefined();

    field.touch();
    expect(form.touched).toEqual({ user: { profile: { name: true } } });
  });

  it('validates and resets a single path', async () => {
    const form = createForm({
      initialValues: { user: { profile: { name: '', email: '' } } },
      validator: {
        validate: (values) => ({
          valid: values.user.profile.name !== '',
          errors: values.user.profile.name === '' ? { user: { profile: { name: 'Obrigatório' } } } : null,
        }),
      },
    });
    const field = form.field('user.profile.name');

    const invalid = await field.validate();
    expect(invalid).toBe(false);
    expect(field.error).toBe('Obrigatório');
    expect(field.validating).toBe(false);

    field.setValue('ok');
    expect(await field.validate()).toBe(true);
    expect(field.error).toBeUndefined();

    field.setValue('changed');
    field.reset();
    expect(field.value).toBe('');
    expect(field.dirty).toBe(false);
  });

  it('reflects validating state during its own async validation', async () => {
    let release: (() => void) | undefined;
    const form = createForm({
      initialValues: { name: '' },
      validator: {
        validate: () =>
          new Promise<{ valid: boolean; errors: null }>((resolve) => {
            release = () => resolve({ valid: true, errors: null });
          }),
      },
    });
    const field = form.field('name');

    const pending = field.validate();
    expect(field.validating).toBe(true);
    expect(form.isValidating).toBe(true);

    release?.();
    await pending;
    expect(field.validating).toBe(false);
    expect(form.isValidating).toBe(false);
  });

  it('reflects validating state while the whole form validates', async () => {
    let release: (() => void) | undefined;
    const form = createForm({
      initialValues: { name: '' },
      validator: {
        validate: () =>
          new Promise<{ valid: boolean; errors: null }>((resolve) => {
            release = () => resolve({ valid: true, errors: null });
          }),
      },
    });

    const pending = form.validate();
    expect(form.field('name').validating).toBe(true);

    release?.();
    await pending;
    expect(form.field('name').validating).toBe(false);
  });

  it('exposes the bound path', () => {
    const { field } = setup();
    expect((field as FieldApi<string>).path).toBe('user.profile.name');
  });

  it('is observable through form.subscribe', () => {
    const { form, field } = setup();
    const listener = vi.fn();
    form.subscribe(listener);
    field.setValue('x');
    expect(listener).toHaveBeenCalled();
  });
});
