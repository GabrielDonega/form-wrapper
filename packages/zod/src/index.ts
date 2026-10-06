/**
 * Zod adapter for @donega/form-wrapper.
 *
 * The core defines validation through the `FormValidator` interface and never
 * imports Zod itself. This package implements that contract on top of any
 * Zod schema: `safeParse` decides validity, and the issues are folded into
 * the nested `FormErrors` structure the core expects.
 */
import type { FormErrors, FormValidator, ValidationResult } from '@donega/form-wrapper';
import type { ZodType, ZodError } from 'zod';

export type { FormValidator };

/**
 * Wraps a Zod schema as a `FormValidator` for `createForm`.
 *
 * ```ts
 * const form = createForm({
 *   initialValues: { name: '', email: '' },
 *   validator: zodValidator(z.object({ name: z.string().min(1), email: z.string().email() })),
 * });
 * ```
 *
 * When a path receives more than one issue, the first message wins.
 */
export function zodValidator<S extends ZodType>(schema: S): FormValidator<S['_output']> {
  return {
    validate(values: S['_output']): ValidationResult<S['_output']> {
      const result = schema.safeParse(values);
      if (result.success) {
        return { valid: true, errors: null };
      }
      return { valid: false, errors: errorsFromZod(result.error) };
    },
  };
}

/**
 * Folds a `ZodError` into the nested error structure mirroring the values
 * shape (`{ user: { profile: { name: '…' } } }`). Array indices become
 * numeric path segments, matching the core's path convention.
 */
export function errorsFromZod<S extends ZodType>(error: ZodError<S['_output']>): FormErrors<S['_output']> {
  const root: Record<string, unknown> = {};

  for (const issue of error.issues) {
    if (issue.path.length === 0) continue; // form-level issues have no field target

    let node: Record<string, unknown> = root;
    for (let index = 0; index < issue.path.length - 1; index += 1) {
      const segment = String(issue.path[index]);
      const nextIsIndex = typeof issue.path[index + 1] === 'number';
      const existing: unknown = node[segment];
      if (existing === null || typeof existing !== 'object') {
        node[segment] = nextIsIndex ? [] : {};
      }
      node = node[segment] as Record<string, unknown>;
    }

    const leaf = String(issue.path[issue.path.length - 1]);
    if (!(leaf in node)) node[leaf] = issue.message;
  }

  return root as FormErrors<S['_output']>;
}
