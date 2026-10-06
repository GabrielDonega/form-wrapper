# Recipe: multi-step

One form, several steps. Keep **one** form instance for the whole wizard and validate per-step subtrees — no state juggling between steps, reset works for free.

## The setup

```ts
import { createForm } from '@donega/form-wrapper';

const form = createForm({
  initialValues: {
    account: { email: '', password: '' },
    profile: { name: '', bio: '' },
  },
  validator,
  onSubmit: async (values) => api.register(values), // runs on the LAST step
});
```

## Step navigation

Each step validates only its own subtree:

```ts
const steps = ['account', 'profile'] as const;
let current = 0;

async function next(): Promise<void> {
  const step = steps[current];
  const ok = await form.validateField(step); // scoped to this subtree
  if (ok) current += 1;
}

function back(): void {
  if (current > 0) current -= 1;
}
```

`validateField('account')` applies errors only under `account`, so `profile` never shows premature errors — even though the validator sees the whole values object and may return errors for both steps.

## The validator knows about steps too

Optional per step: let the validator skip not-yet-visited subtrees by tracking progress outside the form:

```ts
let maxVisitedStep = 0;

const validator = {
  validate: (values) => {
    const errors: Record<string, unknown> = {};
    let valid = true;

    if (maxVisitedStep >= 0) {
      const accountErrors: Record<string, string> = {};
      if (!values.account.email.includes('@')) {
        accountErrors.email = 'Invalid e-mail'; valid = false;
      }
      if (accountErrors.email) errors.account = accountErrors;
    }
    if (maxVisitedStep >= 1) {
      const profileErrors: Record<string, string> = {};
      if (values.profile.name === '') {
        profileErrors.name = 'Required'; valid = false;
      }
      if (profileErrors.name) errors.profile = profileErrors;
    }

    return { valid, errors: valid ? null : errors };
  },
};
```

Bump `maxVisitedStep` when the user advances. `submit()` on the last step validates everything, since every subtree has been visited.

## Why one form (not one per step)

- `form.values` always holds the whole wizard — `onSubmit` receives it complete;
- "back then forward" preserves everything automatically;
- `form.reset()` resets the entire wizard in one call;
- `isDirty` tells you if the user is abandoning unsaved work (`beforeunload`, route guards).

## Final step

```ts
async function finish(): Promise<void> {
  const result = await form.submit();
  if (result.status === 'invalid') {
    // jump to the first step that has errors
    if (form.getError('account.email')) current = 0;
  }
}
```

More: [Nested forms](../nested-forms.md) · [Validation](../validation.md)
