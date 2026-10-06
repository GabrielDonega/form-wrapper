import { describe, expect, it } from 'vitest';
import { createForm } from '../src';

describe('touched', () => {
  it('tracks touched per path and exposes the nested structure', () => {
    const form = createForm({
      initialValues: { user: { profile: { name: '', email: '' } } },
    });

    expect(form.field('user.profile.name').touched).toBe(false);

    form.touch('user.profile.name');
    form.touch('user.profile.email');

    expect(form.touched).toEqual({
      user: { profile: { name: true, email: true } },
    });
    expect(form.field('user.profile.name').touched).toBe(true);
    expect(form.field('user.profile.email').touched).toBe(true);
  });

  it('can touch whole subtrees', () => {
    const form = createForm({
      initialValues: { user: { profile: { name: '' } } },
    });
    form.touch('user.profile');
    expect(form.touched).toEqual({ user: { profile: true } });
  });

  it('clears touched on reset and resetField', () => {
    const form = createForm({
      initialValues: { user: { profile: { name: '' }, nick: '' } },
    });
    form.touch('user.profile.name');
    form.touch('user.nick');

    form.resetField('user.profile.name');
    expect(form.touched).toEqual({ user: { nick: true } });

    form.reset();
    expect(form.touched).toEqual({});
  });
});

describe('dirty', () => {
  const makeForm = () =>
    createForm({
      initialValues: {
        name: 'a',
        user: { profile: { name: 'b', tags: ['x', 'y'] }, address: { city: 'c' } },
      },
    });

  it('is false while values match initialValues', () => {
    expect(makeForm().isDirty).toBe(false);
  });

  it('becomes true on any nested change', () => {
    const form = makeForm();
    form.setValue('user.address.city', 'Londrina');
    expect(form.isDirty).toBe(true);
  });

  it('tracks array indices structurally', () => {
    const form = makeForm();
    form.setValue('user.profile.tags', ['x', 'y']);
    expect(form.isDirty).toBe(false);

    form.setValue('user.profile.tags', ['x', 'z']);
    expect(form.isDirty).toBe(true);

    form.setValue('user.profile.tags', ['z', 'x']); // same items, different order
    expect(form.isDirty).toBe(true);
  });

  it('returns to false when every value goes back to the initial state', () => {
    const form = makeForm();
    form.setValue('user.address.city', 'Londrina');
    form.setValue('user.address.city', 'c');
    expect(form.isDirty).toBe(false);
  });

  it('is false again after a full reset', () => {
    const form = makeForm();
    form.setValue('name', 'other');
    form.reset();
    expect(form.isDirty).toBe(false);
  });

  it('compares objects deeply when they come back equal', () => {
    const form = makeForm();
    const original = form.getValue('user.profile');
    form.setValue('user.profile', { name: 'temp', tags: ['q'] });
    form.setValue('user.profile', original);
    expect(form.isDirty).toBe(false);
  });

  it('exposes dirty per field/path', () => {
    const form = makeForm();
    const city = form.field('user.address.city');
    const profile = form.field('user.profile');

    expect(city.dirty).toBe(false);
    expect(profile.dirty).toBe(false);

    city.setValue('Londrina');
    expect(city.dirty).toBe(true);
    expect(profile.dirty).toBe(false);
    expect(form.isDirty).toBe(true);
  });
});
