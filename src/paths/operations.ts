/**
 * Centralized runtime path operations. Every part of the core that touches
 * nested structures (values, errors, touched, reset, arrays) goes through
 * these functions — path logic is never duplicated.
 *
 * Updates performed here are immutable: `setByPath` and `deleteByPath`
 * return a new root and share unchanged branches with the original.
 */

/** Splits `'users.0.name'` into `['users', '0', 'name']`. */
export function parsePath(path: string): string[] {
  if (path === '') return [];
  return path.split('.');
}

export function joinPath(segments: readonly string[]): string {
  return segments.join('.');
}

/** Matches non-negative canonical integer segments: `'0'`, `'12'` — not `'01'`, `'-1'`, `'1.0'`. */
export function isIndexSegment(segment: string): boolean {
  return /^0$|^[1-9]\d*$/.test(segment);
}

/** `true` when `path` equals `prefix` or lives inside it (`'users.0.name'` under `'users'`). */
export function isPathUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`);
}

function isContainer(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function getByPath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of parsePath(path)) {
    if (!isContainer(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function hasPath(root: unknown, path: string): boolean {
  let current: unknown = root;
  for (const segment of parsePath(path)) {
    if (!isContainer(current)) return false;
    if (!(segment in current)) return false;
    current = current[segment];
  }
  return true;
}

function cloneWith(container: unknown, key: string, value: unknown): unknown {
  if (Array.isArray(container)) {
    const copy = container.slice();
    copy[Number(key)] = value;
    return copy;
  }
  if (isContainer(container)) {
    return { ...container, [key]: value };
  }
  // Missing intermediate container: create one shaped by the next segment.
  if (isIndexSegment(key)) {
    const array: unknown[] = [];
    array[Number(key)] = value;
    return array;
  }
  return { [key]: value };
}

function setRecursive(
  current: unknown,
  segments: readonly string[],
  index: number,
  value: unknown,
): unknown {
  const segment = segments[index] as string;
  const isLast = index === segments.length - 1;

  if (isLast) {
    if (isContainer(current) && current[segment] === value) return current;
    return cloneWith(current, segment, value);
  }

  const child = isContainer(current) ? current[segment] : undefined;
  const newChild = setRecursive(child, segments, index + 1, value);
  if (newChild === child) return current;
  return cloneWith(current, segment, newChild);
}

/**
 * Returns a new root with `value` placed at `path`. Unchanged branches are
 * shared with the original root; missing intermediate containers are created
 * (arrays for numeric segments, objects otherwise). The input is never mutated.
 */
export function setByPath<T>(root: T, path: string, value: unknown): T {
  const segments = parsePath(path);
  if (segments.length === 0) return value as T;
  return setRecursive(root, segments, 0, value) as T;
}

/** Sentinel returned by `deleteRecursive` when a container became empty. */
const PRUNED: unique symbol = Symbol('form-wrapper.pruned');

function isEmptyContainer(container: unknown): boolean {
  if (Array.isArray(container)) return container.length === 0;
  if (isContainer(container)) return Object.keys(container).length === 0;
  return false;
}

function cloneWithoutKey(container: Record<string, unknown>, key: string): unknown {
  if (Array.isArray(container)) {
    const copy = container.slice();
    copy.splice(Number(key), 1);
    return copy;
  }
  const copy = { ...container };
  delete copy[key];
  return copy;
}

function deleteRecursive(
  current: unknown,
  segments: readonly string[],
  index: number,
): unknown | typeof PRUNED {
  const segment = segments[index] as string;
  if (!isContainer(current)) return PRUNED;
  if (!(segment in current)) return current;

  if (index === segments.length - 1) {
    const copy = cloneWithoutKey(current, segment);
    return isEmptyContainer(copy) ? PRUNED : copy;
  }

  const child = current[segment];
  const newChild = deleteRecursive(child, segments, index + 1);
  if (newChild === child) return current;
  if (newChild === PRUNED) {
    const copy = cloneWithoutKey(current, segment);
    return isEmptyContainer(copy) ? PRUNED : copy;
  }
  const copy = { ...current, [segment]: newChild };
  return copy;
}

/**
 * Returns a new root without the value at `path`. Empty ancestor containers
 * are pruned so leftovers never accumulate; the input is never mutated.
 */
export function deleteByPath<T>(root: T, path: string): T {
  const segments = parsePath(path);
  if (segments.length === 0) return root;
  const result = deleteRecursive(root, segments, 0);
  if (result !== PRUNED) return result as T;
  return (Array.isArray(root) ? [] : {}) as T;
}
