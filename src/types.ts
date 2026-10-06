import type { ArrayApi } from './array.js';
import type { FieldApi } from './field.js';
import type { ArrayPath, Path, PathValue, PathValueRaw, Primitive } from './paths/types.js';

export type { ArrayPath, Path, PathValue, Primitive };

/**
 * Nested error structure mirroring the values shape. Leaf messages are
 * strings; `string` is accepted at any level so a whole node (e.g. a
 * `user` object or a whole `users` array) can carry a message too.
 */
export type FormErrors<TValues> = {
  [K in keyof TValues]?: TValues[K] extends readonly (infer U)[]
    ? string | FormErrors<U>[]
    : TValues[K] extends Primitive
      ? string
      : FormErrors<TValues[K]> | string;
};

/**
 * Nested touched structure mirroring the values shape, with `true` leaves.
 */
export type FormTouched<TValues> = {
  [K in keyof TValues]?: TValues[K] extends readonly (infer U)[]
    ? FormTouched<U>[] | boolean
    : TValues[K] extends Primitive
      ? boolean
      : FormTouched<TValues[K]> | boolean;
};

/**
 * Contract any validation adapter fulfills — Zod, Yup, Valibot, VineJS or a
 * hand-rolled validator. The core never depends on a specific library.
 */
export interface FormValidator<TValues> {
  validate(values: TValues): ValidationResult<TValues> | Promise<ValidationResult<TValues>>;
}

export interface ValidationResult<TValues = unknown> {
  valid: boolean;
  /** Nested errors shaped like the values; `null`/empty when valid. */
  errors: FormErrors<TValues> | null;
}

export interface CreateFormOptions<TValues extends object, TData = void> {
  initialValues: TValues;
  validator?: FormValidator<TValues>;
  onSubmit?: (values: TValues, form: FormApi<TValues, TData>) => TData | Promise<TData>;
}

export interface FormState<TValues extends object> {
  values: TValues;
  initialValues: TValues;
  errors: FormErrors<TValues>;
  touched: FormTouched<TValues>;
  isDirty: boolean;
  isValid: boolean;
  isSubmitting: boolean;
  isValidating: boolean;
  isSubmitted: boolean;
  submitCount: number;
}

/**
 * Typed result of `submit()`. No exception is swallowed silently: failures
 * surface through `status: 'error'` carrying the original error.
 */
export type SubmitOutcome<TValues extends object, TData> =
  | { status: 'submitted'; data: TData }
  | { status: 'invalid'; errors: FormErrors<TValues> }
  | { status: 'error'; error: unknown }
  | { status: 'skipped' };

/** The element type of the array found at path `P`. */
export type ArrayItem<TValues, P> =
  PathValueRaw<TValues, P> extends readonly (infer U)[] ? U : never;

export interface FormApi<TValues extends object, TData = void> {
  /** Defensive clone of the values the form was created with. Never mutated. */
  readonly initialValues: TValues;
  /** Current values as a nested object. Mutate only through the API. */
  readonly values: TValues;
  /** Nested errors mirroring the values structure (validation + external). */
  readonly errors: FormErrors<TValues>;
  /** Nested touched structure mirroring the values shape. */
  readonly touched: FormTouched<TValues>;
  readonly isDirty: boolean;
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
  readonly isValidating: boolean;
  readonly isSubmitted: boolean;
  readonly submitCount: number;
  /** Consistent snapshot of every public state property. */
  readonly state: FormState<TValues>;

  getValue<P extends Path<TValues>>(path: P): PathValue<TValues, P>;
  setValue<P extends Path<TValues>>(path: P, value: PathValue<TValues, P>): void;

  getError<P extends Path<TValues>>(path: P): string | undefined;
  /** Sets an external (e.g. server-side) error at `path`. */
  setError<P extends Path<TValues>>(path: P, message: string): void;
  clearError<P extends Path<TValues>>(path: P): void;
  /** Clears all errors, or only the subtree under `path` when given. */
  clearErrors(path?: Path<TValues>): void;
  /**
   * Replaces the external errors with a nested map — the way to apply errors
   * received from an API. Validation errors are unaffected.
   */
  setErrors(errors: FormErrors<TValues> | null | undefined): void;

  touch<P extends Path<TValues>>(path: P): void;

  /** Validates the whole form; resolves to whether it is valid. */
  validate(): Promise<boolean>;
  /** Validates only the subtree under `path`. */
  validateField<P extends Path<TValues>>(path: P): Promise<boolean>;

  submit(): Promise<SubmitOutcome<TValues, TData>>;

  /** Restores `initialValues`, clears errors/touched and submit state. */
  reset(): void;
  /** Restores a single path (leaf, object or array) from `initialValues`. */
  resetField<P extends Path<TValues>>(path: P): void;

  field<P extends Path<TValues>>(path: P): FieldApi<PathValue<TValues, P>>;
  array<P extends ArrayPath<TValues> & Path<TValues>>(
    path: P,
  ): ArrayApi<ArrayItem<TValues, P>>;

  /**
   * Change notification for framework adapters; the form instance is passed
   * to the listener and an unsubscribe function is returned.
   */
  subscribe(listener: (form: FormApi<TValues, TData>) => void): () => void;
}
