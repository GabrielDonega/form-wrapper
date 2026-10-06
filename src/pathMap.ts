import { isIndexSegment, isPathUnder, parsePath } from './paths/operations';

/**
 * Minimal write surface shared by the error stores so validation helpers can
 * target either a PathMap or a plain Map.
 */
interface WritablePathStore<T> {
  set(path: string, value: T): void;
}

/**
 * Flat, path-keyed store backing the errors and touched structures.
 *
 * Keys are dotted paths mirroring the values shape (`'users.0.name'`), so
 * nested access, subtree clearing and — crucially — array index remapping
 * stay O(entries) without maintaining a parallel nested tree.
 */
export class PathMap<T> {
  private readonly entries = new Map<string, T>();

  get size(): number {
    return this.entries.size;
  }

  get(path: string): T | undefined {
    return this.entries.get(path);
  }

  has(path: string): boolean {
    return this.entries.has(path);
  }

  hasUnder(prefix: string): boolean {
    for (const key of this.entries.keys()) {
      if (isPathUnder(key, prefix)) return true;
    }
    return false;
  }

  set(path: string, value: T): void {
    this.entries.set(path, value);
  }

  delete(path: string): void {
    this.entries.delete(path);
  }

  keys(): IterableIterator<string> {
    return this.entries.keys();
  }

  entriesMap(): Map<string, T> {
    return new Map(this.entries);
  }

  clear(prefix?: string): void {
    if (prefix === undefined) {
      this.entries.clear();
      return;
    }
    for (const key of this.entries.keys()) {
      if (isPathUnder(key, prefix)) this.entries.delete(key);
    }
  }

  /**
   * Rewrites the array index segment of every entry under `arrayPath` using
   * `remap` (`null` removes the entry), keeping errors/touched aligned with
   * the values after append/insert/remove/move/clear operations.
   */
  remapIndices(arrayPath: string, remap: (index: number) => number | null): void {
    const prefixSegments = parsePath(arrayPath);
    const depth = prefixSegments.length;
    const removals: string[] = [];
    const updates: Array<[string, T]> = [];

    for (const [key, value] of this.entries) {
      const segments = parsePath(key);
      if (segments.length <= depth) continue;
      if (!prefixSegments.every((segment, index) => segment === segments[index])) continue;

      const indexSegment = segments[depth] as string;
      if (!isIndexSegment(indexSegment)) continue;

      const nextIndex = remap(Number(indexSegment));
      if (nextIndex === null) {
        removals.push(key);
        continue;
      }
      const nextSegment = String(nextIndex);
      if (nextSegment === indexSegment) continue;

      segments[depth] = nextSegment;
      removals.push(key);
      updates.push([segments.join('.'), value]);
    }

    for (const key of removals) this.entries.delete(key);
    for (const [key, value] of updates) this.entries.set(key, value);
  }
}

/**
 * Rebuilds the nested structure a path-keyed map mirrors, e.g.
 * `'users.0.name' -> { users: [{ name }] }`. Used only when exposing public
 * state — internal reads always go through the flat maps.
 */
export function buildNested<T>(map: ReadonlyMap<string, T>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [path, value] of map) {
    const segments = parsePath(path);
    if (segments.length === 0) continue;

    let node = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index] as string;
      const nextIsIndex = isIndexSegment(segments[index + 1] as string);
      const existing: unknown = node[segment];
      if (existing === null || typeof existing !== 'object') {
        node[segment] = nextIsIndex ? [] : {};
      }
      node = node[segment] as Record<string, unknown>;
    }
    node[segments[segments.length - 1] as string] = value;
  }
  return root;
}

export type { WritablePathStore };
