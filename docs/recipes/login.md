# Recipe: login

The smallest complete form: two fields, validation, submit with server errors.

```ts
import { createForm } from '@donega/form-wrapper';
import type { FormValidator } from '@donega/form-wrapper';

const validator: FormValidator<{ email: string; password: string }> = {
  validate: (values) => {
    const errors: { email?: string; password?: string } = {};
    if (!values.email.includes('@')) errors.email = 'Enter a valid e-mail';
    if (values.password.length < 8) errors.password = 'At least 8 characters';
    return {
      valid: Object.keys(errors).length === 0,
      errors: Object.keys(errors).length === 0 ? null : errors,
    };
  },
};

const form = createForm({
  initialValues: { email: '', password: '' },
  validator,
  onSubmit: async (values) => {
    const response = await api.login(values); // may reject 401
    return response.token;
  },
});
```

Wiring it in your UI layer (blur → touch + field validation, submit → map 401 to a server error):

```ts
form.field('email').touch();
await form.validateField('email');

const result = await form.submit();
if (result.status === 'error') {
  if (isUnauthorized(result.error)) {
    form.setError('password', 'Wrong e-mail or password'); // server channel
  }
}
```

Notes:

- the server error on `password` **survives** the next `validateField` — validation never touches the external channel;
- concurrent clicks on "Sign in" are safe: the second `submit()` returns `{ status: 'skipped' }` while the first is in flight;
- `form.state.isSubmitting` drives the button's disabled state.

Full API: [API reference](../api.md) · [Server errors](../server-errors.md)
