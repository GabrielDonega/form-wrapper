# Recipe: registration

Nested values + schema validation (Zod) + server-side uniqueness check.

```ts
import { createForm } from '@donega/form-wrapper';
import { zodValidator } from '@donega/form-wrapper-zod';
import { z } from 'zod';

const schema = z.object({
  user: z.object({
    profile: z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid e-mail'),
    }),
    password: z.string().min(8, 'At least 8 characters'),
  }),
});

const form = createForm({
  initialValues: {
    user: {
      profile: { name: '', email: '' },
      password: '',
    },
  },
  validator: zodValidator(schema),
  onSubmit: async (values) => {
    const response = await api.register(values);
    if (response.status === 422) {
      // map API field errors — nested, same shape as the values
      form.setErrors({
        user: { profile: { email: 'This e-mail is already registered' } },
      });
      throw new Error('Unprocessable Entity');
    }
    return response.body;
  },
});
```

Why this works well:

- **paths stay typed through the nesting**: `form.setValue('user.profile.email', …)` is checked against the schema's inferred shape;
- **Zod messages become field errors** at the right paths (`user.profile.name`), thanks to the adapter's issue mapping;
- **the server error wins** over any later re-validation until you clear it — see [precedence](../server-errors.md#two-channels-clear-precedence);
- `onSubmit` both records the server error **and** throws, so the caller sees `status: 'error'` while the fields show *why*.

Displaying state:

```ts
form.state.isValid;      // schema + server channels are clean
form.errors;             // { user: { profile: { email: '…' } } }
form.field('user.profile.email').error;
```

Variants: [login](login.md) (smaller) · [async validation](async-validation.md) (check availability while typing)
