/**
 * Type-level machinery for nested paths.
 *
 * `Path<T>` enumerates every valid dotted path inside `T`, using numeric
 * indices (`users.0.name`) for arrays. `PathValue<T, P>` resolves the value
 * type found at path `P`. `ArrayPath<T>` is the subset of paths whose value
 * is an array — the valid targets for `form.array(path)`.
 *
 * `ArrayPath` is derived from `Path` by filtering on `PathValue` instead of
 * being an independent recursion: two sibling recursive template-literal
 * types make the compiler recurse forever when it has to relate them
 * (e.g. `P extends ArrayPath<T> & Path<T>` against `PathValue<T, P>`).
 *
 * Deliberate trade-off: array indices are typed as `${number}` instead of
 * exact tuple literals. This keeps autocomplete fast and types readable for
 * the arbitrary-depth structures this library targets.
 */

export type Primitive =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  | Date;

type Leaf = Primitive | ((...args: never[]) => unknown);

type ObjectPath<T> = {
  [K in keyof T & string]:
    | K
    | (T[K] extends Leaf ? never : `${K}.${Path<T[K]>}`);
}[keyof T & string];

export type Path<T> = T extends Leaf
  ? never
  : T extends readonly (infer U)[]
    ? `${number}` | `${number}.${Path<U>}`
    : ObjectPath<T>;

/**
 * The value type found at path `P` inside `T`. The unconstrained recursion
 * (instead of `Rest & Path<...>` intersections) keeps template-literal
 * paths like `users.${number}.tags` inferable; safety is enforced by the
 * public `P extends Path<T>` constraint.
 */
export type PathValue<T, P extends Path<T>> = PathValueRaw<T, P>;

/** Unconstrained variant — lets helpers like `ArrayItem` stay generic-safe. */
export type PathValueRaw<T, P> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? PathValueRaw<T[Head], Rest>
    : T extends readonly (infer U)[]
      ? PathValueRaw<U, Rest>
      : never
  : P extends keyof T
    ? T[P]
    : T extends readonly (infer U)[]
      ? U
      : never;

/**
 * Every path in `T` whose value is an array (e.g. `'users'`, `'users.0.tags'`,
 * `'matrix.0'`). Valid targets for `form.array(path)`.
 */
export type ArrayPath<T> = Path<T> extends infer P
  ? P extends Path<T>
    ? [PathValue<T, P>] extends [never]
      ? never
      : PathValue<T, P> extends readonly unknown[]
        ? P
        : never
    : never
  : never;
