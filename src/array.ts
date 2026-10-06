import { deepClone } from './equality';

/**
 * Array operations bound to a path whose value is an array. `TItem` is the
 * element type (e.g. `string` for `'users.0.tags'`). Every mutation keeps
 * values, errors and touched in sync: index shifts are propagated to the
 * error/touched stores so entries keep pointing at the right item.
 */
export interface ArrayApi<TItem> {
  readonly path: string;
  readonly value: TItem[];
  readonly length: number;

  append(item: TItem): void;
  prepend(item: TItem): void;
  insert(index: number, item: TItem): void;
  remove(index: number): void;
  replace(index: number, item: TItem): void;
  move(from: number, to: number): void;
  /** Empties the array and drops every error/touched entry under the path. */
  clear(): void;
}

/**
 * Narrow surface the form exposes to arrays — mirrors the FieldContext
 * approach to avoid circular imports.
 */
export interface ArrayContext {
  getArray(path: string): unknown[];
  mutateArray(
    path: string,
    transform: (current: unknown[]) => {
      next: unknown[];
      remap: (index: number) => number | null;
    },
  ): void;
}

function assertIndex(index: number, length: number, action: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new RangeError(`Cannot ${action} array item: index ${index} is out of bounds.`);
  }
}

export function createArrayApi<TItem>(context: ArrayContext, path: string): ArrayApi<TItem> {
  const cloneInto = (item: TItem): TItem => deepClone(item);

  return {
    path,
    get value(): TItem[] {
      return context.getArray(path) as TItem[];
    },
    get length(): number {
      return context.getArray(path).length;
    },

    append(item: TItem): void {
      context.mutateArray(path, (current) => ({
        next: [...current, cloneInto(item)],
        remap: (index) => index,
      }));
    },

    prepend(item: TItem): void {
      context.mutateArray(path, (current) => ({
        next: [cloneInto(item), ...current],
        remap: (index) => index + 1,
      }));
    },

    insert(index: number, item: TItem): void {
      context.mutateArray(path, (current) => {
        if (!Number.isInteger(index) || index < 0 || index > current.length) {
          throw new RangeError(`Cannot insert array item: index ${index} is out of bounds.`);
        }
        const next = current.slice();
        next.splice(index, 0, cloneInto(item));
        return {
          next,
          remap: (existing) => (existing >= index ? existing + 1 : existing),
        };
      });
    },

    remove(index: number): void {
      context.mutateArray(path, (current) => {
        assertIndex(index, current.length, 'remove');
        const next = current.slice();
        next.splice(index, 1);
        return {
          next,
          remap: (existing) => {
            if (existing === index) return null;
            return existing > index ? existing - 1 : existing;
          },
        };
      });
    },

    replace(index: number, item: TItem): void {
      context.mutateArray(path, (current) => {
        assertIndex(index, current.length, 'replace');
        const next = current.slice();
        next[index] = cloneInto(item);
        return {
          next,
          remap: (existing) => existing,
        };
      });
    },

    move(from: number, to: number): void {
      context.mutateArray(path, (current) => {
        assertIndex(from, current.length, 'move');
        assertIndex(to, current.length, 'move');
        const next = current.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return {
          next,
          remap: (existing) => {
            if (existing === from) return to;
            if (from < to) return existing > from && existing <= to ? existing - 1 : existing;
            return existing >= to && existing < from ? existing + 1 : existing;
          },
        };
      });
    },

    clear(): void {
      context.mutateArray(path, () => ({
        next: [],
        remap: () => null,
      }));
    },
  };
}
