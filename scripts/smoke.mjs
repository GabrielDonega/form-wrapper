// Consumer smoke test: imports the built package exactly the way a
// downstream project would (through package.json `exports`) and exercises
// the public API in plain Node. Run after `npm run build`.
import assert from 'node:assert/strict';
import { createForm } from '../dist/index.js';

const form = createForm({
  initialValues: { name: '', tags: ['a'] },
  validator: {
    validate: (values) => ({
      valid: values.name !== '',
      errors: values.name === '' ? { name: 'required' } : null,
    }),
  },
  onSubmit: async (values) => ({ saved: values }),
});

// values / typed paths
assert.equal(form.getValue('name'), '');
form.setValue('name', 'Gabriel');
assert.equal(form.getValue('name'), 'Gabriel');
assert.equal(form.isDirty, true);

// reference-stable snapshot between notifications (React adapters rely on it)
const s1 = form.state;
assert.equal(form.state, s1, 'state getter must be reference-stable');
form.setValue('name', 'Donega');
assert.notEqual(form.state, s1, 'state must be a new object after a mutation');

// subscribe receives the form and returns an unsubscribe fn
let notified = null;
const unsub = form.subscribe((f) => {
  notified = f;
});
form.touch('name');
assert.equal(notified, form);
unsub();

// validation + submit outcome
assert.equal(await form.validate(), true);
const outcome = await form.submit();
assert.equal(outcome.status, 'submitted');
assert.deepEqual(outcome.data, { saved: { name: 'Donega', tags: ['a'] } });

// field + array controllers
form.array('tags').append('b');
assert.deepEqual(form.getValue('tags'), ['a', 'b']);

// reset
form.reset();
assert.equal(form.isDirty, false);
assert.equal(form.submitCount, 0);

console.log('smoke: @donega/form-wrapper imports and works in plain Node ✓');
