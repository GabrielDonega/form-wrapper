import { describe, expect, it } from 'vitest';
import { createForm } from '../src/index.js';

describe('values: nested access', () => {
  const form = createForm({
    initialValues: {
      user: {
        profile: { name: '', email: '' },
        address: { street: '', number: '', city: '' },
      },
    },
  });

  it('gets and sets deeply nested values', () => {
    form.setValue('user.profile.name', 'Gabriel');
    expect(form.getValue('user.profile.name')).toBe('Gabriel');
  });

  it('preserves sibling branches untouched', () => {
    form.setValue('user.address.city', 'Londrina');
    expect(form.getValue('user.address.city')).toBe('Londrina');
    expect(form.getValue('user.profile.name')).toBe('Gabriel');
    expect(form.getValue('user.address.street')).toBe('');
  });

  it('keeps form.values nested — never flat', () => {
    expect(form.values).toEqual({
      user: {
        profile: { name: 'Gabriel', email: '' },
        address: { street: '', number: '', city: 'Londrina' },
      },
    });
    expect(Object.keys(form.values)).toEqual(['user']);
  });

  it('supports arbitrary depth', () => {
    const deep = createForm({
      initialValues: { a: { b: { c: { d: { e: { f: '' } } } } } },
    });
    deep.setValue('a.b.c.d.e.f', 'bottom');
    expect(deep.getValue('a.b.c.d.e.f')).toBe('bottom');
  });

  it('supports setting whole subtrees (objects)', () => {
    form.setValue('user.address', { street: 'Av. X', number: '10', city: 'Curitiba' });
    expect(form.getValue('user.address')).toEqual({
      street: 'Av. X',
      number: '10',
      city: 'Curitiba',
    });
  });
});

describe('values: arrays', () => {
  const form = createForm({
    initialValues: {
      users: [{ name: 'a', address: { city: '' } }, { name: 'b', address: { city: '' } }],
      matrix: [[1, 2], [3]],
      tags: ['x'],
    },
  });

  it('reads and writes by index', () => {
    expect(form.getValue('users.0.name')).toBe('a');
    form.setValue('users.1.name', 'B');
    expect(form.getValue('users.1.name')).toBe('B');
  });

  it('handles objects inside arrays and arrays inside objects', () => {
    form.setValue('users.0.address.city', 'Londrina');
    expect(form.getValue('users.0.address.city')).toBe('Londrina');

    form.setValue('matrix.1.0', 9);
    expect(form.getValue('matrix.1.0')).toBe(9);
  });

  it('replaces whole arrays', () => {
    form.setValue('tags', ['y', 'z']);
    expect(form.getValue('tags')).toEqual(['y', 'z']);
  });
});
