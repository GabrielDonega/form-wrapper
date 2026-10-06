/**
 * Structural comparison and cloning used by dirty tracking, reset and
 * defensive snapshots. Plain objects, arrays and Dates are handled; class
 * instances, functions and other exotics are compared/reused by reference.
 */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => deepEqual(item, b[index]))
    );
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  if (aKeys.length !== Object.keys(bRecord).length) return false;
  return aKeys.every(
    (key) => Object.hasOwn(bRecord, key) && deepEqual(aRecord[key], bRecord[key]),
  );
}

export function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(deepClone) as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = deepClone(item);
    }
    return result as T;
  }
  return value;
}
