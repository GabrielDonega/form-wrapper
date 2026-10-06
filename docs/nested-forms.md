# Nested forms

Real forms are not flat. `form-wrapper` treats nesting as a first-class feature: any depth of objects and arrays, with every path type-checked.

## Deeply nested values

```ts
const form = createForm({
  initialValues: {
    user: {
      profile: {
        name: '',
        email: '',
      },
      address: {
        street: '',
        city: '',
      },
    },
  },
});
```

```ts
form.setValue('user.profile.name', 'Gabriel');
form.getValue('user.profile.name'); // 'Gabriel'

// whole subtrees work too
form.setValue('user.address', { street: 'Av. Paulista', city: 'São Paulo' });
form.resetField('user.profile'); // restores the subtree, siblings untouched
```

## Path type-safety

`Path<T>` enumerates every valid dotted path; `PathValue<T, P>` resolves the value type at each one. Both directions are checked:

```ts
form.setValue('user.profile.name', 'Gabriel'); // ✓ string
form.setValue('user.profile.name', 42);        // ✗ string expected
form.setValue('user.profile.nope', 'x');       // ✗ unknown path
form.getValue('user.address');                 // ✓ { street: string; city: string }

// paths into arrays use numeric indices
form.setValue('company.employees.0.profile.name', 'Ana');
```

Autocomplete works because `Path<T>` is a union of literal strings — your editor suggests `'user' | 'user.profile' | 'user.profile.name' | …`.

## Errors and touched mirror the shape

Errors, touched and every per-path API follow the same structure:

```ts
await form.validate();

form.errors;
// { user: { profile: { name: 'Name is required' } } }

form.getError('user.profile.name'); // 'Name is required'
form.field('user.profile').valid;   // false — error under this subtree
form.touched.user.profile.name;     // boolean | undefined
```

You can also attach a message to a whole node (e.g. the entire `user` object), not only leaves — see [errors](server-errors.md#whole-node-messages).

## Validation scoping

`validateField` applies the validator's result but only writes errors under the given path — useful for on-blur validation of one subtree without clobbering other fields' errors:

```ts
await form.validateField('user.address'); // only address errors are updated
```

## Next

- [Arrays](arrays.md) — nesting inside dynamic lists
- [API reference](api.md)
