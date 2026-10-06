import { createArrayApi } from './array';
import type { ArrayApi, ArrayContext } from './array';
import { deepClone, deepEqual } from './equality';
import { createFieldApi } from './field';
import type { FieldApi, FieldContext } from './field';
import { PathMap, buildNested } from './pathMap';
import { getByPath, setByPath } from './paths/operations';
import type {
  ArrayItem,
  ArrayPath,
  CreateFormOptions,
  FormApi,
  FormErrors,
  FormState,
  FormTouched,
  Path,
  PathValue,
  SubmitOutcome,
} from './types';
import { applyValidationResult } from './validation';

/**
 * Creates a headless form controller: pure state management, no framework
 * and no UI concerns. See FormApi for the public contract.
 */
export function createForm<TValues extends object, TData = void>(
  options: CreateFormOptions<TValues, TData>,
): FormApi<TValues, TData> {
  // Defensive clones: the API never mutates the caller's objects, and
  // external mutations of them can never leak into the form.
  const initialValues = deepClone(options.initialValues);
  const validator = options.validator;

  let values: TValues = deepClone(initialValues);

  // External errors (set via setError/setErrors, e.g. received from an API)
  // live apart from validation errors, which are fully owned by validate().
  const validationErrors = new PathMap<string>();
  const externalErrors = new PathMap<string>();
  const touched = new PathMap<boolean>();

  const validatingFields = new Set<string>();
  let formValidating = false;

  let isSubmitting = false;
  let isSubmitted = false;
  let submitCount = 0;
  // Set synchronously at submit() entry so concurrent calls are rejected
  // even while the first submit is still validating.
  let submitInProgress = false;

  // Bumped on every value mutation and every validation start; results from
  // stale versions are discarded instead of applied.
  let validationVersion = 0;

  const listeners = new Set<() => void>();
  function notify(): void {
    for (const listener of listeners) listener();
  }

  function getError(path: string): string | undefined {
    return externalErrors.get(path) ?? validationErrors.get(path);
  }

  function hasErrorUnder(path: string): boolean {
    return externalErrors.hasUnder(path) || validationErrors.hasUnder(path);
  }

  function isValid(): boolean {
    return validationErrors.size === 0 && externalErrors.size === 0;
  }

  function isDirty(): boolean {
    return !deepEqual(values, initialValues);
  }

  function toErrorsObject(): FormErrors<TValues> {
    if (validationErrors.size === 0 && externalErrors.size === 0) return {};
    const merged = validationErrors.entriesMap();
    for (const [path, message] of externalErrors.entriesMap()) {
      merged.set(path, message);
    }
    return buildNested(merged) as FormErrors<TValues>;
  }

  function toTouchedObject(): FormTouched<TValues> {
    if (touched.size === 0) return {};
    const map = new Map<string, boolean>();
    for (const path of touched.keys()) map.set(path, true);
    return buildNested(map) as FormTouched<TValues>;
  }

  function bumpValidationVersion(): void {
    validationVersion += 1;
  }

  function clearErrorsUnder(path: string): void {
    validationErrors.clear(path);
    externalErrors.clear(path);
  }

  /**
   * Runs the validator and applies its errors. A run whose values changed
   * (or that was superseded) mid-flight is discarded; with `maxAttempts > 1`
   * it is retried (used by submit), otherwise the current validity is
   * reported instead of applying a stale result.
   */
  async function performValidation(maxAttempts = 1): Promise<boolean> {
    if (!validator) return true;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const version = ++validationVersion;
      formValidating = true;
      notify();
      try {
        // Snapshot: the validator must not observe (or cause) live mutations.
        const result = await validator.validate(deepClone(values));
        if (version !== validationVersion) continue;

        validationErrors.clear();
        applyValidationResult(validationErrors, result?.errors);
        return result !== null && result.valid;
      } finally {
        formValidating = false;
        notify();
      }
    }
    return isValid();
  }

  async function validateField(path: string): Promise<boolean> {
    if (!validator) return true;

    const version = ++validationVersion;
    validatingFields.add(path);
    notify();
    try {
      const result = await validator.validate(deepClone(values));
      if (version !== validationVersion) return !hasErrorUnder(path);

      validationErrors.clear(path);
      applyValidationResult(validationErrors, result?.errors, path);
      return !hasErrorUnder(path);
    } finally {
      validatingFields.delete(path);
      notify();
    }
  }

  async function submit(): Promise<SubmitOutcome<TValues, TData>> {
    if (submitInProgress) return { status: 'skipped' };
    submitInProgress = true;

    submitCount += 1;
    notify();

    try {
      const valid = await performValidation(5);
      if (!valid) {
        return { status: 'invalid', errors: toErrorsObject() };
      }

      isSubmitting = true;
      notify();
      try {
        const data = await options.onSubmit?.(deepClone(values), api);
        isSubmitted = true;
        return { status: 'submitted', data: data as TData };
      } catch (error: unknown) {
        return { status: 'error', error };
      } finally {
        isSubmitting = false;
        notify();
      }
    } finally {
      submitInProgress = false;
    }
  }

  function setValue(path: string, value: unknown): void {
    values = setByPath(values, path, value);
    bumpValidationVersion();
    notify();
  }

  function reset(): void {
    values = deepClone(initialValues);
    validationErrors.clear();
    externalErrors.clear();
    touched.clear();
    isSubmitted = false;
    submitCount = 0;
    bumpValidationVersion();
    notify();
  }

  function resetField(path: string): void {
    values = setByPath(values, path, deepClone(getByPath(initialValues, path)));
    clearErrorsUnder(path);
    touched.clear(path);
    bumpValidationVersion();
    notify();
  }

  const fieldContext: FieldContext = {
    getValue: (path) => getByPath(values, path),
    getInitialValue: (path) => getByPath(initialValues, path),
    setValue,
    getError,
    setError: (path, message) => {
      externalErrors.set(path, message);
      notify();
    },
    clearError: (path) => {
      validationErrors.delete(path);
      externalErrors.delete(path);
      notify();
    },
    hasErrorUnder,
    isTouched: (path) => touched.has(path),
    touch: (path) => {
      touched.set(path, true);
      notify();
    },
    isValidatingAt: (path) => formValidating || validatingFields.has(path),
    validateField,
    resetField,
  };

  const arrayContext: ArrayContext = {
    getArray: (path) => {
      const current: unknown = getByPath(values, path);
      if (!Array.isArray(current)) {
        throw new TypeError(`Path "${path}" does not hold an array value.`);
      }
      return current;
    },
    mutateArray: (path, transform) => {
      const { next, remap } = transform(arrayContext.getArray(path));
      values = setByPath(values, path, next);
      validationErrors.remapIndices(path, remap);
      externalErrors.remapIndices(path, remap);
      touched.remapIndices(path, remap);
      bumpValidationVersion();
      notify();
    },
  };

  const fieldCache = new Map<string, unknown>();
  const arrayCache = new Map<string, unknown>();

  const api: FormApi<TValues, TData> = {
    get initialValues(): TValues {
      return initialValues;
    },
    get values(): TValues {
      return values;
    },
    get errors(): FormErrors<TValues> {
      return toErrorsObject();
    },
    get touched(): FormTouched<TValues> {
      return toTouchedObject();
    },
    get isDirty(): boolean {
      return isDirty();
    },
    get isValid(): boolean {
      return isValid();
    },
    get isSubmitting(): boolean {
      return isSubmitting;
    },
    get isValidating(): boolean {
      return formValidating || validatingFields.size > 0;
    },
    get isSubmitted(): boolean {
      return isSubmitted;
    },
    get submitCount(): number {
      return submitCount;
    },
    get state(): FormState<TValues> {
      return {
        values,
        initialValues,
        errors: toErrorsObject(),
        touched: toTouchedObject(),
        isDirty: isDirty(),
        isValid: isValid(),
        isSubmitting,
        isValidating: formValidating || validatingFields.size > 0,
        isSubmitted,
        submitCount,
      };
    },

    getValue<P extends Path<TValues>>(path: P): PathValue<TValues, P> {
      return getByPath(values, path) as PathValue<TValues, P>;
    },
    setValue,

    getError,
    setError: fieldContext.setError,
    clearError: fieldContext.clearError,
    clearErrors(path?: Path<TValues>): void {
      validationErrors.clear(path);
      externalErrors.clear(path);
      notify();
    },
    setErrors(errors: FormErrors<TValues> | null | undefined): void {
      externalErrors.clear();
      applyValidationResult(externalErrors, errors);
      notify();
    },

    touch: fieldContext.touch,

    validate: performValidation,
    validateField,

    submit,

    reset,
    resetField,

    field<P extends Path<TValues>>(path: P): FieldApi<PathValue<TValues, P>> {
      const cached: unknown = fieldCache.get(path);
      if (cached !== undefined) return cached as FieldApi<PathValue<TValues, P>>;
      const field = createFieldApi<PathValue<TValues, P>>(fieldContext, path);
      fieldCache.set(path, field);
      return field;
    },

    array<P extends ArrayPath<TValues> & Path<TValues>>(path: P): ArrayApi<ArrayItem<TValues, P>> {
      arrayContext.getArray(path); // eager check: fail fast on non-array paths
      const cached: unknown = arrayCache.get(path);
      if (cached !== undefined) return cached as ArrayApi<ArrayItem<TValues, P>>;
      const array = createArrayApi<ArrayItem<TValues, P>>(arrayContext, path);
      arrayCache.set(path, array);
      return array;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return api;
}
