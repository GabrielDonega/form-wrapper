# Recipe: async validation

Checking e-mail availability while the user types — the classic async race, handled by the core.

## The validator

```ts
import { createForm } from '@donega/form-wrapper';

const form = createForm({
  initialValues: { email: '' },
  validator: {
    validate: async (values) => {
      if (!values.email.includes('@')) {
        return { valid: false, errors: { email: 'Invalid e-mail' } };
      }
      const taken = await api.emailExists(values.email); // 300ms, say
      return taken
        ? { valid: false, errors: { email: 'Already registered' } }
        : { valid: true, errors: null };
    },
  },
});
```

## Triggering it while typing

Trigger on input (or blur) in your UI layer:

```ts
function onEmailInput(value: string): void {
  form.setValue('email', value);
  void form.validateField('email'); // async; don't await in the input handler
}
```

## Why the race is handled

Timeline without protection: user types `ana@` → request A out → types `ana@mail.com` → request B out → B resolves "available" → **A resolves "taken" and wins** — wrong, it describes stale input.

With the core's validation versioning:

- `setValue` bumps the validation version, marking A stale;
- when A finally resolves, its result is **discarded** — never applied;
- only B's result (about the current value) can land.

You can observe the in-flight state for your spinner:

```ts
form.isValidating;              // any validation running
form.field('email').validating; // one covering this path
```

## Submitting is safe too

`submit()` validates before calling `onSubmit` and **retries** if values changed during its async validation (up to 5 attempts) — the handler never runs against values that differ from what was validated.

## Debouncing

The core gives correctness, not request throttling. Debounce in the UI layer if needed:

```ts
let timer: ReturnType<typeof setTimeout>;
function onEmailInput(value: string): void {
  form.setValue('email', value);
  clearTimeout(timer);
  timer = setTimeout(() => void form.validateField('email'), 300);
}
```

More: [Validation guide](../validation.md#async-validation-and-races)
