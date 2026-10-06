import { deepEqual } from './equality';

/**
 * Per-path controller returned by `form.field(path)`. Reads are getters, so
 * the field is always in sync with the form — no subscription needed.
 */
export interface FieldApi<TValue> {
  readonly path: string;
  readonly value: TValue;
  readonly error: string | undefined;
  readonly touched: boolean;
  /** Deep comparison against the initial value at the same path. */
  readonly dirty: boolean;
  /** `true` when no error exists at this path or anywhere under it. */
  readonly valid: boolean;
  /** `true` while a validation covering this path is in flight. */
  readonly validating: boolean;

  setValue(value: TValue): void;
  setError(message: string): void;
  clearError(): void;
  touch(): void;
  validate(): Promise<boolean>;
  /** Restores this path (leaf, object or array) from `initialValues`. */
  reset(): void;
}

/**
 * Narrow surface the form exposes to fields — keeps field logic decoupled
 * from the form implementation without any circular imports.
 */
export interface FieldContext {
  getValue(path: string): unknown;
  getInitialValue(path: string): unknown;
  setValue(path: string, value: unknown): void;
  getError(path: string): string | undefined;
  setError(path: string, message: string): void;
  clearError(path: string): void;
  hasErrorUnder(path: string): boolean;
  isTouched(path: string): boolean;
  touch(path: string): void;
  isValidatingAt(path: string): boolean;
  validateField(path: string): Promise<boolean>;
  resetField(path: string): void;
}

export function createFieldApi<TValue>(context: FieldContext, path: string): FieldApi<TValue> {
  return {
    path,
    get value(): TValue {
      return context.getValue(path) as TValue;
    },
    get error(): string | undefined {
      return context.getError(path);
    },
    get touched(): boolean {
      return context.isTouched(path);
    },
    get dirty(): boolean {
      return !deepEqual(context.getValue(path), context.getInitialValue(path));
    },
    get valid(): boolean {
      return !context.hasErrorUnder(path);
    },
    get validating(): boolean {
      return context.isValidatingAt(path);
    },
    setValue(value: TValue): void {
      context.setValue(path, value);
    },
    setError(message: string): void {
      context.setError(path, message);
    },
    clearError(): void {
      context.clearError(path);
    },
    touch(): void {
      context.touch(path);
    },
    validate(): Promise<boolean> {
      return context.validateField(path);
    },
    reset(): void {
      context.resetField(path);
    },
  };
}
