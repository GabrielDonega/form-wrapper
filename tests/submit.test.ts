import { describe, expect, it, vi } from 'vitest';
import { createForm } from '../src/index.js';
import type { FormValidator } from '../src/index.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('submit', () => {
  const validForm = (onSubmit: (values: unknown) => unknown) =>
    createForm({
      initialValues: { user: { profile: { name: '', email: '' } } },
      validator: {
        validate: (values) => ({
          valid: values.user.profile.name !== '' && values.user.profile.email.includes('@'),
          errors:
            values.user.profile.name === ''
              ? { user: { profile: { name: 'Obrigatório' } } }
              : values.user.profile.email.includes('@')
                ? null
                : { user: { profile: { email: 'E-mail inválido' } } },
        }),
      },
      onSubmit: onSubmit as never,
    });

  it('runs the happy path with the full nested structure', async () => {
    const onSubmit = vi.fn(async () => 'done');
    const form = createForm({
      initialValues: { user: { profile: { name: 'Gabriel', email: 'g@email.com' } } },
      onSubmit,
    });

    const result = await form.submit();

    expect(result).toEqual({ status: 'submitted', data: 'done' });
    expect(onSubmit).toHaveBeenCalledWith(
      { user: { profile: { name: 'Gabriel', email: 'g@email.com' } } },
      form,
    );
    expect(form.isSubmitted).toBe(true);
    expect(form.submitCount).toBe(1);
    expect(form.isSubmitting).toBe(false);
  });

  it('never flattens nested values on submit', async () => {
    let received: unknown;
    const form = createForm({
      initialValues: { user: { profile: { name: 'x' } }, tags: ['a'] },
      onSubmit: async (values) => {
        received = values;
      },
    });
    await form.submit();

    expect(received).toEqual({ user: { profile: { name: 'x' } }, tags: ['a'] });
    expect(Object.keys(received as object)).toEqual(['user', 'tags']);
  });

  it('does not run onSubmit when validation fails and reports invalid', async () => {
    const onSubmit = vi.fn();
    const form = validForm(onSubmit);
    form.setValue('user.profile.name', 'Gabriel'); // email still invalid

    const result = await form.submit();

    expect(result).toEqual({
      status: 'invalid',
      errors: { user: { profile: { email: 'E-mail inválido' } } },
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(form.isSubmitted).toBe(false);
    expect(form.submitCount).toBe(1);
    expect(form.isSubmitting).toBe(false);
  });

  it('counts every submit attempt', async () => {
    const form = validForm(vi.fn());
    await form.submit();
    await form.submit();
    expect(form.submitCount).toBe(2);
  });

  it('reports execution errors without swallowing them and keeps state consistent', async () => {
    const boom = new Error('API fora do ar');
    const form = createForm({
      initialValues: { name: 'a' },
      onSubmit: async () => {
        throw boom;
      },
    });

    const result = await form.submit();

    expect(result).toEqual({ status: 'error', error: boom });
    expect(form.isSubmitted).toBe(false);
    expect(form.isSubmitting).toBe(false);
    expect(form.isValid).toBe(true);
  });

  it('prevents concurrent submits', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onSubmit = vi.fn(() => gate);
    const form = createForm({ initialValues: { name: '' }, onSubmit });

    const first = form.submit();
    const second = await form.submit();

    expect(second).toEqual({ status: 'skipped' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(form.submitCount).toBe(1);

    release();
    await first;
    expect(form.isSubmitting).toBe(false);
  });

  it('resets isSubmitting even when onSubmit throws synchronously', async () => {
    const form = createForm({
      initialValues: { name: '' },
      onSubmit: () => {
        throw new Error('sync boom');
      },
    });

    const result = await form.submit();
    expect(result.status).toBe('error');
    expect(form.isSubmitting).toBe(false);
  });

  it('passes a defensive copy so onSubmit cannot mutate form values', async () => {
    const form = createForm({
      initialValues: { user: { profile: { name: 'a' } } },
      onSubmit: async (values) => {
        (values.user.profile as { name: string }).name = 'MUTATED';
      },
    });

    await form.submit();
    expect(form.getValue('user.profile.name')).toBe('a');
  });

  it('works without onSubmit', async () => {
    const form = createForm({ initialValues: { name: '' } });
    const result = await form.submit();
    expect(result).toEqual({ status: 'submitted', data: undefined });
    expect(form.isSubmitted).toBe(true);
  });

  it('exposes isSubmitting while the handler runs', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const form = createForm({
      initialValues: { name: '' },
      onSubmit: () => gate,
    });

    const pending = form.submit();
    // let the submit continuation reach the isSubmitting toggle
    await Promise.resolve();
    await Promise.resolve();
    expect(form.isSubmitting).toBe(true);

    release();
    await pending;
    expect(form.isSubmitting).toBe(false);
  });

  it('applies server errors after a failed API call and keeps values intact', async () => {
    const form = createForm({
      initialValues: { user: { profile: { email: 'a@b.c' } } },
      onSubmit: async () => {
        form.setErrors({ user: { profile: { email: 'E-mail já cadastrado' } } });
        throw new Error('422');
      },
    });

    const result = await form.submit();

    expect(result.status).toBe('error');
    expect(form.getError('user.profile.email')).toBe('E-mail já cadastrado');
    expect(form.isSubmitting).toBe(false);
    expect(form.values).toEqual({ user: { profile: { email: 'a@b.c' } } });
  });
});

describe('submit with values changing during validation', () => {
  it('retries validation instead of submitting stale values', async () => {
    const gates = [
      deferred<{ valid: boolean; errors: { name: string } | null }>(),
      deferred<{ valid: boolean; errors: { name: string } | null }>(),
    ];
    let call = 0;
    const validator: FormValidator<{ name: string }> = {
      validate: () => gates[call++]!.promise,
    };
    const onSubmit = vi.fn(async (_values: { name: string }) => 'done');
    const form = createForm({ initialValues: { name: 'first' }, validator, onSubmit });

    const pending = form.submit();
    // values change while the submit's validation is in flight
    form.setValue('name', 'second');

    gates[0]!.resolve({ valid: true, errors: null }); // stale pass — must be ignored
    await Promise.resolve();
    gates[1]!.resolve({ valid: true, errors: null }); // fresh pass — accepted
    const result = await pending;

    expect(result).toEqual({ status: 'submitted', data: 'done' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toEqual({ name: 'second' });
  });
});
