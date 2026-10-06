# Arrays / dynamic fields

Lists of unknown length — contacts, line items, tags — where the user adds, removes and reorders rows. `form.array(path)` is the controller for that, and its defining feature: **errors and touched state follow their items** when the list changes.

## The array controller

```ts
const form = createForm({
  initialValues: {
    users: [{ name: '', email: '' }],
  },
});

const users = form.array('users'); // typed: ArrayApi<{ name: string; email: string }>
```

| Operation | Effect on indices |
|---|---|
| `users.append(item)` | existing indices unchanged |
| `users.prepend(item)` | everything shifts **+1** |
| `users.insert(i, item)` | indices ≥ i shift **+1** |
| `users.remove(i)` | index i's errors/touched are **dropped**; indices > i shift **−1** |
| `users.replace(i, item)` | unchanged |
| `users.move(from, to)` | every item lands on its new index — errors/touched **follow** |
| `users.clear()` | all errors/touched under the path are dropped |

```ts
users.append({ name: 'Ana', email: 'ana@mail.com' });
users.length;      // 2
users.value;       // live array
```

Reads/writes per row use the typed indexed path:

```ts
form.setValue('users.1.name', 'Gabriel');
form.getError('users.1.email');
```

## Why remapping matters

Without it, removing a row leaves every error attached to the wrong item. With it:

```ts
const form = createForm({ initialValues: { tags: ['a', 'b', 'c'] } });
form.setError('tags.2', 'Too short');

form.array('tags').remove(0);

form.getError('tags.1'); // 'Too short' — the message followed its item
```

The same happens for `touched`, and nested structures inside items are remapped too (`users.2.profile.name` becomes `users.1.profile.name`).

## Real case: a contact list

```ts
const form = createForm({
  initialValues: { contacts: [{ name: '', phone: '' }] },
  validator: {
    validate: (values) => {
      const errors: { contacts: { name?: string }[] } = { contacts: [] };
      let valid = true;
      for (const [index, contact] of values.contacts.entries()) {
        errors.contacts[index] = {};
        if (contact.name === '') {
          errors.contacts[index]!.name = 'Required';
          valid = false;
        }
      }
      return { valid, errors: valid ? null : errors };
    },
  },
});

const contacts = form.array('contacts');

// in your UI layer, per rendered row:
contacts.append({ name: '', phone: '' });   // "+ add contact"
contacts.remove(rowIndex);                  // row's × button — errors stay correct
contacts.move(2, 0);                        // drag-and-drop reorder
```

After any of these, `form.errors.contacts[i]` still points at the row the user sees.

## Edge behavior

- **Cloning**: items you pass to `append`/`prepend`/`insert`/`replace` are deep-cloned — later mutations of your object can't leak in.
- **Bounds**: out-of-bounds indices throw `RangeError`; a non-array path throws `TypeError` (fail fast, at the call site).
- **Sparse exposure**: if items `0` and `2` have errors but `1` doesn't, the exposed `form.errors.users` array has a hole at index `1` — iteration with `for…of` skips holes; prefer per-path reads or index loops.
- **Dirty tracking**: structural — a list of `[a, b]` vs `[b, a]` is dirty; removing and re-adding an equal item returns to not-dirty.

## Next

- [Recipe: dynamic fields](recipes/dynamic-fields.md)
- [Nested forms](nested-forms.md)
