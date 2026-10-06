import { describe, expect, it } from 'vitest';
import { deepClone, deepEqual } from '../src/equality.js';

describe('deepEqual', () => {
  it('considers identical primitives and NaN equal', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
  });

  it('distinguishes different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('1', 1)).toBe(false);
  });

  it('compares nested objects and arrays structurally', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('requires the same key sets', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual({ a: 1 }, {})).toBe(false);
  });

  it('compares dates by time', () => {
    expect(deepEqual(new Date(1000), new Date(1000))).toBe(true);
    expect(deepEqual(new Date(1000), new Date(2000))).toBe(false);
  });

  it('handles null and mixed types', () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual(undefined, null)).toBe(false);
  });
});

describe('deepClone', () => {
  it('clones nested structures deeply', () => {
    const original = { user: { tags: ['a'], address: { city: 'x' } } };
    const clone = deepClone(original);

    expect(clone).toEqual(original);
    expect(clone.user).not.toBe(original.user);
    expect(clone.user.tags).not.toBe(original.user.tags);
    expect(clone.user.address).not.toBe(original.user.address);
  });

  it('clones dates and keeps functions/primitives by reference', () => {
    const date = new Date(1000);
    const fn = () => 1;
    const clone = deepClone({ date, fn, n: 1 });

    expect(clone.date).not.toBe(date);
    expect(clone.date).toEqual(date);
    expect(clone.fn).toBe(fn);
  });

  it('returns primitives as-is', () => {
    expect(deepClone(1)).toBe(1);
    expect(deepClone('a')).toBe('a');
  });
});
