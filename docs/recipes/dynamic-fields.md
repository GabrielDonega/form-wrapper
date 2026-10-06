# Recipe: dynamic fields

A contact list where rows are added, removed and reordered — the case array remapping was built for.

```ts
import { createForm } from '@donega/form-wrapper';

const form = createForm({
  initialValues: {
    contacts: [{ name: '', phone: '' }],
  },
  validator: {
    validate: (values) => {
      let valid = true;
      const contacts = values.contacts.map((contact) => {
        const errors: { name?: string; phone?: string } = {};
        if (contact.name === '') { errors.name = 'Required'; valid = false; }
        if (contact.phone === '') { errors.phone = 'Required'; valid = false; }
        return errors;
      });
      return { valid, errors: valid ? null : { contacts } };
    },
  },
  onSubmit: async (values) => api.saveContacts(values.contacts),
});

const contacts = form.array('contacts');
```

Operations from your UI layer:

```ts
contacts.append({ name: '', phone: '' });  // "+ add"
contacts.remove(2);                        // row × button
contacts.move(0, 3);                       // drag-and-drop
contacts.replace(1, { name: 'Ana', phone: '…' }); // "import contact"
```

The guarantee that makes this safe: after `remove(0)`, the error that pointed at `contacts.0.name` moves to `contacts.0`'s *successor* — messages stay on the row the user sees, never shift onto the wrong row:

```ts
form.setValue('contacts.1.name', '');     // leaves it invalid
await form.validate();
form.getError('contacts.1.name');         // 'Required'

form.array('contacts').remove(0);
form.getError('contacts.0.name');         // 'Required' — followed its row
```

Per-row reads use typed index paths:

```ts
form.field(`contacts.${rowIndex}.name`);  // value, error, touched…
form.getValue(`contacts.${rowIndex}.phone`);
```

Caveats to know:

- index paths are **positional** — after a reorder, read the row again (in a UI that re-renders per state change, this is automatic);
- items you append/insert/replace are deep-cloned;
- `contacts.clear()` empties the list **and** drops every error/touched under `contacts`.

More: [Arrays guide](../arrays.md) · [Vue example with per-row components](../../../examples/vue)
