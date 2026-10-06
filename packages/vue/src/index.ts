/**
 * Vue 3 adapter for @donega/form-wrapper.
 *
 * The core is not reactive — by design. This package is the bridge: it
 * replays the core's `subscribe()` notifications into Vue's reactivity
 * through a shallow ref, so `computed`/templates re-render on every form
 * mutation. It creates no components and owns no UI: you bind values to
 * whatever markup you want.
 */
import {
  computed,
  getCurrentScope,
  onScopeDispose,
  shallowRef,
  triggerRef,
  type ComputedRef,
  type WritableComputedRef,
} from 'vue';
import { createForm } from '@donega/form-wrapper';
import type { CreateFormOptions, FormApi, FormState, Path, PathValue } from '@donega/form-wrapper';

/** Wires a form's `subscribe()` into a ref that bumps on every mutation. */
function wireSource<TValues extends object, TData>(
  form: FormApi<TValues, TData>,
): ComputedRef<FormState<TValues>> {
  const source = shallowRef(form);
  const unsubscribe = form.subscribe(() => triggerRef(source));
  if (getCurrentScope()) onScopeDispose(unsubscribe);

  // Reading source.value registers the dependency; the state snapshot
  // itself is reference-stable between mutations.
  return computed(() => {
    void source.value;
    return form.state;
  });
}

export interface UseFormReturn<TValues extends object, TData> {
  /** The headless form controller. Actions and writes go through it. */
  form: FormApi<TValues, TData>;
  /** Reactive snapshot of `form.state`, updated on every form mutation. */
  state: ComputedRef<FormState<TValues>>;
}

/**
 * Creates a form wired into Vue's reactivity. Call it inside `setup()` —
 * the internal subscription is released when the component's scope is
 * disposed (SSR included: no browser APIs are involved).
 *
 * ```ts
 * const { form, state } = useForm({ initialValues: { name: '' } });
 * ```
 *
 * Reads in templates/computeds must go through reactive bindings
 * (`useField` or `state`); writes and actions go through `form`:
 *
 * ```ts
 * const name = useField(form, 'name');   // read + v-model
 * form.submit();                          // action
 * ```
 */
export function useForm<TValues extends object, TData = void>(
  options: CreateFormOptions<TValues, TData>,
): UseFormReturn<TValues, TData> {
  const form = createForm(options);
  return { form, state: wireSource(form) };
}

/**
 * Reactive snapshot of any form's `state` — useful when the form was created
 * outside of `setup()` (a store, a parent component) and you only need the
 * state-level flags (`isValid`, `isSubmitting`…).
 */
export function useFormState<TValues extends object, TData>(
  form: FormApi<TValues, TData>,
): ComputedRef<FormState<TValues>> {
  return wireSource(form);
}

export interface UseFieldReturn<TValue> {
  /** Writable computed — bind it directly with `v-model="name.value"`. */
  value: WritableComputedRef<TValue>;
  error: ComputedRef<string | undefined>;
  touched: ComputedRef<boolean>;
  dirty: ComputedRef<boolean>;
  valid: ComputedRef<boolean>;
  validating: ComputedRef<boolean>;
}

/**
 * Reactive binding for a single field path — including paths inside dynamic
 * arrays (`users.${index}.name`). The binding carries its own subscription,
 * so every mutation of the form (even from array operations elsewhere)
 * keeps it in sync. Safe to call inside `setup()`.
 *
 * ```vue
 * const name = useField(form, 'name');
 * <input v-model="name.value" />
 * <span v-if="name.error">{{ name.error }}</span>
 * ```
 */
export function useField<TValues extends object, TData, P extends Path<TValues>>(
  form: FormApi<TValues, TData>,
  path: P,
): UseFieldReturn<PathValue<TValues, P>> {
  const source = shallowRef(form);
  const unsubscribe = form.subscribe(() => triggerRef(source));
  if (getCurrentScope()) onScopeDispose(unsubscribe);

  // Every getter touches source.value first so the computed depends on the
  // form's change signal, then reads the live value from the core.
  const track = () => void source.value;
  type TValue = PathValue<TValues, P>;

  return {
    value: computed<TValue>({
      get: () => {
        track();
        return form.getValue(path);
      },
      set: (next) => form.setValue(path, next),
    }),
    error: computed(() => {
      track();
      return form.getError(path);
    }),
    touched: computed(() => {
      track();
      return form.field(path).touched;
    }),
    dirty: computed(() => {
      track();
      return form.field(path).dirty;
    }),
    valid: computed(() => {
      track();
      return form.field(path).valid;
    }),
    validating: computed(() => {
      track();
      return form.field(path).validating;
    }),
  };
}
