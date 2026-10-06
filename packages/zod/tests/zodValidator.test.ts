import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createForm } from '@donega/form-wrapper';
import { zodValidator } from '../src/index.js';

describe('zodValidator', () => {
  it('reports valid with no errors when the schema passes', async () => {
    const form = createForm({
      initialValues: { name: 'Gabriel', email: 'g@email.com' },
      validator: zodValidator(
        z.object({ name: z.string().min(1), email: z.string().email() }),
      ),
    });

    await expect(form.validate()).resolves.toBe(true);
    expect(form.errors).toEqual({});
    expect(form.isValid).toBe(true);
  });

  it('maps flat schema errors to their paths', async () => {
    const form = createForm({
      initialValues: { name: '', email: 'nope' },
      validator: zodValidator(
        z.object({ name: z.string().min(1), email: z.string().email() }),
      ),
    });

    await expect(form.validate()).resolves.toBe(false);
    expect(form.getError('name')).toBeDefined();
    expect(form.getError('email')).toBeDefined();
    expect(form.isValid).toBe(false);
  });

  it('maps nested schema paths to nested errors', async () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({ name: z.string().min(1, 'Nome obrigatório') }),
      }),
    });
    const form = createForm({
      initialValues: { user: { profile: { name: '' } } },
      validator: zodValidator(schema),
    });

    await form.validate();
    expect(form.errors).toEqual({ user: { profile: { name: 'Nome obrigatório' } } });
    expect(form.getValue('user.profile.name')).toBe('');
  });

  it('maps array indices so errors follow the core path convention', async () => {
    const schema = z.object({
      users: z.array(z.object({ email: z.string().email('E-mail inválido') })),
    });
    const form = createForm({
      initialValues: { users: [{ email: 'ok@mail.com' }, { email: 'bad' }] },
      validator: zodValidator(schema),
    });

    await form.validate();
    expect(form.getError('users.1.email')).toBe('E-mail inválido');
    expect(form.getError('users.0.email')).toBeUndefined();
  });

  it('keeps only the first issue message per path', async () => {
    const schema = z.object({
      password: z.string().min(8, 'Mínimo 8').regex(/\d/, 'Precisa de dígito'),
    });
    const form = createForm({
      initialValues: { password: '' },
      validator: zodValidator(schema),
    });

    await form.validate();
    const error = form.getError('password');
    expect(error).toBe('Mínimo 8');
  });

  it('works end-to-end through submit()', async () => {
    const onSubmit = vi.fn(async (values: { name: string }) => values);
    const form = createForm({
      initialValues: { name: '' },
      validator: zodValidator(z.object({ name: z.string().min(1) })),
      onSubmit,
    });

    const result = await form.submit();
    expect(result.status).toBe('invalid');

    form.setValue('name', 'Gabriel');
    const ok = await form.submit();
    expect(ok.status).toBe('submitted');
  });
});
