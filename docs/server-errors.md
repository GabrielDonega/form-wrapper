# Server errors

Validation catches what you can predict. The API catches the rest — e-mail already registered, session expired, rate limits. Those errors belong on the fields too, and they need to **survive the next validation run**.

## The flow

```ts
try {
  const result = await form.submit();

  if (result.status === 'error') {
    // onSubmit threw — map the API response onto fields
    form.setErrors(mapApiErrors(result.error));
  }
} finally {
  // form.isSubmitting is already false
}
```

Or inside `onSubmit` itself, if your client resolves non-2xx:

```ts
onSubmit: async (values) => {
  const response = await api.signup(values);
  if (!response.ok) {
    form.setErrors({
      email: 'This e-mail is already registered',
    });
  }
}
```

`setErrors(nested)` takes the same nested shape as your values — or `null` to clear the channel:

```ts
form.setErrors({
  user: {
    profile: { email: 'Invalid domain' },
    addresses: [{ street: 'Unknown street' }],
  },
});
```

## Two channels, clear precedence

| | Validation errors | Server errors |
|---|---|---|
| Written by | `validate()` / `validateField()` | `setError()` / `setErrors()` |
| Replaced by | the next validation run | the next `setErrors()` call |
| Precedence when both exist | — | **server wins** |

So this works the way you want:

```ts
form.setErrors({ email: 'Already registered' }); // from the API
await form.validate();                            // user edits; re-validation runs
form.getError('email');                           // 'Already registered' — still there
form.clearError('email');                         // or clearErrors() to wipe the channel
```

`isValid` considers both: a form with a lingering server error is not valid, and `submit()` will refuse to run `onSubmit` until the server channel is clear or the validator passes and no external errors remain — plan to `clearErrors()` (or re-`setErrors`) as part of your retry flow.

## Distinguishing the two in `form.errors`

Both channels merge into one nested structure; the per-path read is the same `getError`. If your UI needs to know *which kind* an error is, tag it in the message or keep a parallel signal from the moment you call `setErrors` — the core merges, it does not annotate.

## Whole-node messages

Any path accepts a message — not only leaves:

```ts
form.setErrors({
  user: 'Check the profile section',   // a whole object
  tags: 'At least one tag is required' // a whole array
});
```

Validation results can do the same, which is how schema validators express object-level rules.

## Per-path tools

```ts
form.setError('email', 'Taken');  // one path
form.clearError('email');         // one path, both channels
form.clearErrors('user');         // subtree
form.clearErrors();               // everything
```
