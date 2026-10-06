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

const nameValidator: FormValidator<{ name: string; email: string }> = {
  validate: (values) => ({
    valid: values.name !== '' && values.email.includes('@'),
    errors:
      values.name === ''
        ? { name: 'Nome obrigatório' }
        : values.email.includes('@')
          ? null
          : { email: 'E-mail inválido' },
  }),
};

describe('validation', () => {
  it('returns true and applies no errors when valid', async () => {
    const form = createForm({
      initialValues: { name: 'a', email: 'a@b.c' },
      validator: nameValidator,
    });

    await expect(form.validate()).resolves.toBe(true);
    expect(form.errors).toEqual({});
  });

  it('applies nested errors and reflects isValid', async () => {
    const form = createForm({
      initialValues: { name: '', email: 'x' },
      validator: nameValidator,
    });

    await expect(form.validate()).resolves.toBe(false);
    expect(form.errors).toEqual({ name: 'Nome obrigatório' });
    expect(form.isValid).toBe(false);
  });

  it('supports async validators', async () => {
    const validator: FormValidator<{ name: string }> = {
      validate: async (values) => {
        await Promise.resolve();
        await Promise.resolve();
        return {
          valid: values.name !== 'taken',
          errors: values.name === 'taken' ? { name: 'Já em uso' } : null,
        };
      },
    };
    const form = createForm({ initialValues: { name: 'taken' }, validator });

    await expect(form.validate()).resolves.toBe(false);
    expect(form.getError('name')).toBe('Já em uso');
  });

  it('treats a form without validator as always valid', async () => {
    const form = createForm({ initialValues: { name: '' } });
    await expect(form.validate()).resolves.toBe(true);
    await expect(form.validateField('name')).resolves.toBe(true);
  });

  it('validates a single path, scoping the applied errors', async () => {
    const form = createForm({
      initialValues: { name: '', email: 'x' },
      validator: nameValidator,
    });

    // name is empty, so the validator only reports the name error — but the
    // field validation for email must not apply errors from other paths
    await expect(form.validateField('email')).resolves.toBe(true);
    expect(form.getError('name')).toBeUndefined();
    expect(form.errors).toEqual({});

    form.setValue('name', 'a'); // name ok now; email 'x' is invalid
    await expect(form.validateField('email')).resolves.toBe(false);
    expect(form.errors).toEqual({ email: 'E-mail inválido' });

    form.setValue('email', 'a@b.c');
    await expect(form.validateField('email')).resolves.toBe(true);
    expect(form.errors).toEqual({});
  });

  it('keeps isValidating true while async validation runs', async () => {
    const gate = deferred<{ valid: boolean; errors: null }>();
    const form = createForm({
      initialValues: { name: '' },
      validator: { validate: () => gate.promise },
    });

    const pending = form.validate();
    expect(form.isValidating).toBe(true);

    gate.resolve({ valid: true, errors: null });
    await pending;
    expect(form.isValidating).toBe(false);
  });

  it('discards stale results when values change during async validation', async () => {
    const gates = [deferred<{ valid: boolean; errors: { name: string } | null }>(), deferred<{ valid: boolean; errors: { name: string } | null }>()];
    let call = 0;
    const validator: FormValidator<{ name: string }> = {
      validate: () => gates[call++]!.promise,
    };
    const form = createForm({ initialValues: { name: 'first' }, validator });

    const first = form.validate();
    form.setValue('name', 'second'); // invalidates the in-flight run
    const second = form.validate();

    // the newer call finishes first — its result must win
    gates[1]!.resolve({ valid: true, errors: null });
    await second;
    gates[0]!.resolve({ valid: false, errors: { name: 'resultado velho' } });
    await first;

    expect(form.getError('name')).toBeUndefined();
    expect(form.isValid).toBe(true);
  });

  it('applies the latest result when the older one resolves last', async () => {
    const gates = [deferred<{ valid: boolean; errors: { name: string } | null }>(), deferred<{ valid: boolean; errors: { name: string } | null }>()];
    let call = 0;
    const validator: FormValidator<{ name: string }> = {
      validate: () => gates[call++]!.promise,
    };
    const form = createForm({ initialValues: { name: 'first' }, validator });

    const first = form.validate();
    const second = form.validate();

    gates[0]!.resolve({ valid: false, errors: { name: 'velho' } });
    await first;
    gates[1]!.resolve({ valid: false, errors: { name: 'novo' } });
    await second;

    expect(form.getError('name')).toBe('novo');
  });

  it('replaces previous validation errors on each run', async () => {
    const form = createForm({
      initialValues: { name: '', email: '' },
      validator: nameValidator,
    });
    await form.validate();
    expect(form.errors).toEqual({ name: 'Nome obrigatório' });

    form.setValue('name', 'a');
    await form.validate();
    expect(form.errors).toEqual({ email: 'E-mail inválido' });
  });

  it('runs validation before onSubmit only once per submit and notifies listeners', async () => {
    const validate = vi.fn(() => ({ valid: true, errors: null }));
    const form = createForm({
      initialValues: { name: '' },
      validator: { validate },
      onSubmit: async () => {},
    });

    const events: string[] = [];
    form.subscribe(() => events.push('change'));
    await form.submit();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('stale field validation', () => {
  it('discards a field validation whose values changed mid-flight', async () => {
    const gates = [
      deferred<{ valid: boolean; errors: { name: string } | null }>(),
      deferred<{ valid: boolean; errors: { name: string } | null }>(),
    ];
    let call = 0;
    const validator: FormValidator<{ name: string }> = {
      validate: () => gates[call++]!.promise,
    };
    const form = createForm({ initialValues: { name: 'first' }, validator });

    const first = form.validateField('name');
    form.setValue('name', 'second'); // invalidates the in-flight run
    const second = form.validateField('name');

    gates[1]!.resolve({ valid: true, errors: null });
    await second;
    // the stale run must not apply its error to the path
    gates[0]!.resolve({ valid: false, errors: { name: 'resultado velho' } });
    await first;

    expect(form.getError('name')).toBeUndefined();
    expect(form.isValid).toBe(true);
  });
});
