import { describe, expect, it } from 'vitest';
import { createForm } from '../src';

describe('errors', () => {
  const makeForm = () =>
    createForm({
      initialValues: {
        user: { profile: { name: '', email: '' }, address: { city: '' } },
        users: [{ name: '' }],
      },
    });

  it('sets, gets and clears errors by nested path', () => {
    const form = makeForm();

    form.setError('user.profile.name', 'Nome obrigatório');
    expect(form.getError('user.profile.name')).toBe('Nome obrigatório');
    expect(form.errors).toEqual({ user: { profile: { name: 'Nome obrigatório' } } });
    expect(form.isValid).toBe(false);

    form.clearError('user.profile.name');
    expect(form.getError('user.profile.name')).toBeUndefined();
    expect(form.errors).toEqual({});
    expect(form.isValid).toBe(true);
  });

  it('keeps the error structure mirroring the values', () => {
    const form = makeForm();
    form.setError('user.profile.name', 'Nome obrigatório');
    form.setError('user.profile.email', 'E-mail inválido');
    form.setError('users.0.name', 'Informe o nome');

    expect(form.errors).toEqual({
      user: {
        profile: { name: 'Nome obrigatório', email: 'E-mail inválido' },
      },
      users: [{ name: 'Informe o nome' }],
    });
  });

  it('clearErrors clears everything or a subtree', () => {
    const form = makeForm();
    form.setError('user.profile.name', 'a');
    form.setError('user.profile.email', 'b');
    form.setError('users.0.name', 'c');

    form.clearErrors('user.profile');
    expect(form.errors).toEqual({ users: [{ name: 'c' }] });

    form.clearErrors();
    expect(form.errors).toEqual({});
  });

  it('accepts nested server errors and applies them to the respective paths', () => {
    const form = makeForm();

    form.setErrors({
      user: { profile: { email: 'E-mail já cadastrado' } },
      users: [{ name: 'Duplicado' }],
    });

    expect(form.getError('user.profile.email')).toBe('E-mail já cadastrado');
    expect(form.getError('users.0.name')).toBe('Duplicado');
    expect(form.errors).toEqual({
      user: { profile: { email: 'E-mail já cadastrado' } },
      users: [{ name: 'Duplicado' }],
    });
  });

  it('replaces (not merges) server errors on each setErrors call', () => {
    const form = makeForm();
    form.setErrors({ user: { profile: { name: 'first' } } });
    form.setErrors({ users: [{ name: 'second' }] });

    expect(form.getError('user.profile.name')).toBeUndefined();
    expect(form.getError('users.0.name')).toBe('second');
  });

  it('keeps server errors separate from validation errors', async () => {
    const form = createForm({
      initialValues: { name: '' },
      validator: {
        validate: (values) => ({
          valid: values.name !== '',
          errors: values.name === '' ? { name: 'Obrigatório' } : null,
        }),
      },
    });

    form.setError('name', 'erro do servidor');
    await form.validate();

    // validation replaced its own channel; the server error is unaffected
    expect(form.errors).toEqual({ name: 'erro do servidor' });

    form.setValue('name', 'ok');
    await form.validate();
    expect(form.getError('name')).toBe('erro do servidor');
  });

  it('merges both channels in getError with server precedence', () => {
    const form = makeForm();
    form.setError('user.profile.name', 'servidor');
    form.errors; // no validation errors yet

    expect(form.getError('user.profile.name')).toBe('servidor');
  });

  it('accepts errors directly on objects and arrays (whole-node messages)', () => {
    const form = makeForm();
    form.setError('user', 'Dados inválidos');
    expect(form.getError('user')).toBe('Dados inválidos');
    expect(form.errors).toEqual({ user: 'Dados inválidos' });
  });
});
