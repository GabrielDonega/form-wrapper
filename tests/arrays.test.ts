import { describe, expect, it } from 'vitest';
import { createForm } from '../src';

describe('form.array', () => {
  function makeForm() {
    return createForm({
      initialValues: {
        users: [
          { name: 'a', address: { city: 'A1' } },
          { name: 'b', address: { city: 'B1' } },
          { name: 'c', address: { city: 'C1' } },
        ],
        tags: ['x', 'y'],
      },
      validator: {
        validate: (values) => ({
          valid: values.users.every((user) => user.name !== ''),
          errors: {
            users: values.users.map((user) => (user.name === '' ? { name: 'Obrigatório' } : null)),
          } as never,
        }),
      },
    });
  }

  it('appends, prepends and reads', () => {
    const form = makeForm();
    const users = form.array('users');

    expect(users.length).toBe(3);
    users.append({ name: 'd', address: { city: 'D1' } });
    expect(users.length).toBe(4);
    expect(form.getValue('users.3.name')).toBe('d');
    expect(form.getValue('users.0.name')).toBe('a');

    users.prepend({ name: 'z', address: { city: 'Z1' } });
    expect(form.getValue('users.0.name')).toBe('z');
    expect(form.getValue('users.1.name')).toBe('a');
    expect(form.array('users').length).toBe(5);
  });

  it('inserts at an index and rejects out-of-bounds', () => {
    const form = makeForm();
    const tags = form.array('tags');

    tags.insert(1, 'w');
    expect(form.getValue('tags')).toEqual(['x', 'w', 'y']);

    expect(() => tags.insert(9, 'nope')).toThrow(RangeError);
    expect(() => tags.insert(-1, 'nope')).toThrow(RangeError);
  });

  it('removes and rejects out-of-bounds', () => {
    const form = makeForm();
    const tags = form.array('tags');

    tags.remove(0);
    expect(form.getValue('tags')).toEqual(['y']);
    expect(() => tags.remove(5)).toThrow(RangeError);
  });

  it('replaces an item', () => {
    const form = makeForm();
    form.array('users').replace(1, { name: 'B2', address: { city: 'B2' } });
    expect(form.getValue('users.1')).toEqual({ name: 'B2', address: { city: 'B2' } });
    expect(form.getValue('users.0.name')).toBe('a');
  });

  it('moves items in both directions', () => {
    const form = makeForm();
    const users = form.array('users');

    users.move(0, 2);
    expect(form.getValue('users.2.name')).toBe('a');
    expect(form.getValue('users.0.name')).toBe('b');
    expect(form.getValue('users.1.name')).toBe('c');

    users.move(2, 0);
    expect(form.getValue('users.0.name')).toBe('a');
  });

  it('clears the array', () => {
    const form = makeForm();
    form.array('tags').clear();
    expect(form.getValue('tags')).toEqual([]);
    expect(form.array('tags').length).toBe(0);
  });

  it('propagates errors with index shifts on remove', async () => {
    const form = createForm({
      initialValues: { users: [{ name: '' }, { name: '' }, { name: '' }] },
      validator: {
        validate: (values) => ({
          valid: false,
          errors: {
            users: values.users.map((user) => ({ name: `erro: ${user.name}` })),
          },
        }),
      },
    });
    await form.validate();
    expect(form.getError('users.1.name')).toBe('erro: ');

    form.setValue('users.1.name', 'b');
    await form.validate();
    expect(form.getError('users.0.name')).toBe('erro: ');
    expect(form.getError('users.1.name')).toBe('erro: b');
    expect(form.getError('users.2.name')).toBe('erro: ');

    form.array('users').remove(1);
    // old index 1's error is dropped; old index 2's shifts to 1
    expect(form.getError('users.0.name')).toBe('erro: ');
    expect(form.getError('users.1.name')).toBe('erro: ');
    expect(form.getError('users.2.name')).toBeUndefined();
  });

  it('propagates errors with index shifts on insert and prepend', async () => {
    const form = createForm({
      initialValues: { users: [{ name: 'a' }, { name: 'b' }] },
      validator: {
        validate: (values) => ({
          valid: false,
          errors: { users: values.users.map((user) => ({ name: `e:${user.name}` })) },
        }),
      },
    });
    await form.validate();

    form.array('users').insert(1, { name: 'new' });
    expect(form.getError('users.0.name')).toBe('e:a');
    expect(form.getError('users.1.name')).toBeUndefined(); // new item, no error yet
    expect(form.getError('users.2.name')).toBe('e:b');

    form.array('users').prepend({ name: 'first' });
    expect(form.getError('users.0.name')).toBeUndefined();
    expect(form.getError('users.1.name')).toBe('e:a');
    expect(form.getError('users.3.name')).toBe('e:b');
  });

  it('keeps touched aligned with index moves', () => {
    const form = makeForm();
    form.touch('users.0.name');
    form.touch('users.2.name');

    form.array('users').move(0, 2);
    // old index 0 lands on 2; old index 2 lands on 1
    expect(form.field('users.2.name').touched).toBe(true);
    expect(form.field('users.1.name').touched).toBe(true);
    expect(form.field('users.0.name').touched).toBe(false);
  });

  it('keeps dirty tracking after array mutations', () => {
    const form = makeForm();
    form.array('tags').append('z');
    expect(form.isDirty).toBe(true);
    form.array('tags').remove(2);
    expect(form.isDirty).toBe(false);
  });

  it('throws a TypeError when the path does not hold an array', () => {
    const form = makeForm();
    expect(() => form.array('tags')).not.toThrow();

    const wrong = createForm({ initialValues: { items: 'nope' } });
    expect(() => wrong.array('items' as never)).toThrow(TypeError);
    expect(() => createForm({ initialValues: { a: 1 } }).array('a' as never)).toThrow(TypeError);
  });

  it('clones inserted items so later external mutations cannot leak in', () => {
    const form = makeForm();
    const item = { name: 'clone-me', address: { city: 'x' } };
    form.array('users').append(item);
    item.name = 'MUTATED';
    item.address.city = 'MUTATED';
    expect(form.getValue('users.3.name')).toBe('clone-me');
    expect(form.getValue('users.3.address.city')).toBe('x');
  });
});
