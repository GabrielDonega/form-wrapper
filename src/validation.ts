import type { WritablePathStore } from './pathMap.js';
import type { FormErrors } from './types.js';

/**
 * Flattens a nested error structure into path-keyed entries, e.g.
 * `{ user: { profile: { name: 'Required' } } }` → `'user.profile.name'`.
 * Non-string junk (null/undefined/empty nodes) is skipped.
 */
export function flattenErrors(errors: unknown, out: Map<string, string>, prefix = ''): void {
  if (errors === null || errors === undefined) return;

  if (typeof errors === 'string') {
    if (prefix !== '') out.set(prefix, errors);
    return;
  }

  if (Array.isArray(errors)) {
    errors.forEach((item, index) => {
      flattenErrors(item, out, prefix === '' ? String(index) : `${prefix}.${index}`);
    });
    return;
  }

  if (typeof errors === 'object') {
    for (const [key, value] of Object.entries(errors)) {
      flattenErrors(value, out, prefix === '' ? key : `${prefix}.${key}`);
    }
  }
}

/**
 * Writes a validator result into a store, replacing its previous contents —
 * the latest validation fully owns validation errors. When `filterPrefix` is
 * given, only entries under that path are written (used by validateField).
 */
export function applyValidationResult(
  store: WritablePathStore<string>,
  errors: FormErrors<unknown> | null | undefined,
  filterPrefix?: string,
): void {
  const flattened = new Map<string, string>();
  flattenErrors(errors, flattened);

  for (const [path, message] of flattened) {
    if (filterPrefix === undefined || path === filterPrefix || path.startsWith(`${filterPrefix}.`)) {
      store.set(path, message);
    }
  }
}
