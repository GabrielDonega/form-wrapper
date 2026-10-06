# @donega/form-wrapper-zod

[Zod](https://zod.dev) adapter for [`@donega/form-wrapper`](../../README.md). The core never imports Zod — this package implements its `FormValidator` contract on top of any schema.

```bash
npm install @donega/form-wrapper @donega/form-wrapper-zod
```

## Usage

```ts
import { createForm } from '@donega/form-wrapper';
import { zodValidator } from '@donega/form-wrapper-zod';
import { z } from 'zod';

const form = createForm({
  initialValues: { name: '', email: '' },
  validator: zodValidator(
    z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid e-mail'),
    }),
  ),
});

await form.validate();
form.getError('email'); // 'Invalid e-mail'
```

## Behavior

- `safeParse` decides validity; issues are folded into the nested `FormErrors` structure (`{ user: { profile: { name: '…' } } }`).
- Array indices in issue paths become numeric segments (`users.1.email`), matching the core's path convention.
- When one path has multiple issues, the first message wins.
- Works with Zod v3 (`^3.24`) and v4.
- `errorsFromZod(error)` is exported for custom flows.
