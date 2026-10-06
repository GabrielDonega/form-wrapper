import { describe, expect, it } from 'vitest';
import {
  deleteByPath,
  getByPath,
  hasPath,
  isIndexSegment,
  isPathUnder,
  parsePath,
  setByPath,
} from '../src/paths/operations';

describe('parsePath', () => {
  it('splits dotted paths', () => {
    expect(parsePath('user.profile.name')).toEqual(['user', 'profile', 'name']);
  });

  it('keeps index segments as strings', () => {
    expect(parsePath('users.0.address.city')).toEqual(['users', '0', 'address', 'city']);
  });

  it('returns empty for the root path', () => {
    expect(parsePath('')).toEqual([]);
  });
});

describe('isIndexSegment', () => {
  it('accepts canonical non-negative integers', () => {
    expect(isIndexSegment('0')).toBe(true);
    expect(isIndexSegment('12')).toBe(true);
  });

  it('rejects non-index segments', () => {
    expect(isIndexSegment('name')).toBe(false);
    expect(isIndexSegment('01')).toBe(false);
    expect(isIndexSegment('-1')).toBe(false);
    expect(isIndexSegment('1.5')).toBe(false);
    expect(isIndexSegment('')).toBe(false);
  });
});

describe('isPathUnder', () => {
  it('matches exact and nested paths', () => {
    expect(isPathUnder('user', 'user')).toBe(true);
    expect(isPathUnder('user.profile.name', 'user')).toBe(true);
  });

  it('does not match partial segments or unrelated paths', () => {
    expect(isPathUnder('username', 'user')).toBe(false);
    expect(isPathUnder('other', 'user')).toBe(false);
    expect(isPathUnder('user', 'user.profile')).toBe(false);
  });
});

describe('getByPath', () => {
  const values = { user: { profile: { name: 'Gabriel' } }, users: [{ tags: ['a', 'b'] }] };

  it('reads nested objects and arrays', () => {
    expect(getByPath(values, 'user.profile.name')).toBe('Gabriel');
    expect(getByPath(values, 'users.0.tags.1')).toBe('b');
  });

  it('returns undefined for missing paths without throwing', () => {
    expect(getByPath(values, 'user.missing.deeper')).toBeUndefined();
    expect(getByPath(values, 'users.5.name')).toBeUndefined();
    expect(getByPath(null, 'anything')).toBeUndefined();
  });
});

describe('hasPath', () => {
  const values = { user: { name: 'x', nick: undefined } };

  it('returns true for existing paths, even with undefined values', () => {
    expect(hasPath(values, 'user.name')).toBe(true);
    expect(hasPath(values, 'user.nick')).toBe(true);
  });

  it('returns false for missing paths', () => {
    expect(hasPath(values, 'user.missing')).toBe(false);
    expect(hasPath(values, 'nope.deeper')).toBe(false);
  });
});

describe('setByPath', () => {
  it('sets nested leaves without mutating the input', () => {
    const original = { user: { profile: { name: 'a', email: 'b' } } };
    const next = setByPath(original, 'user.profile.name', 'Gabriel');

    expect(next.user.profile.name).toBe('Gabriel');
    expect(original.user.profile.name).toBe('a');
  });

  it('shares unchanged branches', () => {
    const original = { a: { b: 1 }, c: { d: 2 } };
    const next = setByPath(original, 'c.d', 3);

    expect(next.a).toBe(original.a);
    expect(next.c).not.toBe(original.c);
  });

  it('creates intermediate containers shaped by the next segment', () => {
    const next = setByPath({}, 'users.0.name', 'Gabriel');
    expect(next).toEqual({ users: [{ name: 'Gabriel' }] });

    const nested = setByPath({}, 'a.b.c', 1);
    expect(nested).toEqual({ a: { b: { c: 1 } } });
  });

  it('returns the same reference when the value is unchanged', () => {
    const original = { user: { name: 'a' } };
    expect(setByPath(original, 'user.name', 'a')).toBe(original);
  });

  it('handles nested arrays inside arrays', () => {
    const original = { matrix: [[1, 2], [3]] };
    const next = setByPath(original, 'matrix.1.0', 9);
    expect(next.matrix[1]).toEqual([9]);
    expect(original.matrix[1]).toEqual([3]);
  });
});

describe('deleteByPath', () => {
  it('removes leaves without mutating the input', () => {
    const original = { user: { name: 'a', email: 'b' } };
    const next = deleteByPath(original, 'user.email');
    expect(next).toEqual({ user: { name: 'a' } });
    expect(original).toEqual({ user: { name: 'a', email: 'b' } });
  });

  it('prunes ancestors that become empty', () => {
    const original = { user: { profile: { name: 'a' } }, keep: 1 };
    const next = deleteByPath(original, 'user.profile.name');
    expect(next).toEqual({ keep: 1 });
  });

  it('splices arrays instead of leaving holes', () => {
    const original = { users: [{ name: 'a' }, { name: 'b' }] };
    const next = deleteByPath(original, 'users.0');
    expect(next).toEqual({ users: [{ name: 'b' }] });
  });

  it('is a no-op for missing paths', () => {
    const original = { a: 1 };
    expect(deleteByPath(original, 'nope.deeper')).toEqual({ a: 1 });
  });
});
