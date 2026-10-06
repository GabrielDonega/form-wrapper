// Vanilla example: the core with no framework at all. Reads happen in a
// render() function called from subscribe(); writes go through the API.
import { createForm } from '../../dist/index.js';

const form = createForm({
  initialValues: {
    name: '',
    tags: ['headless'],
  },
  validator: {
    validate: (values) =>
      values.name.trim() === ''
        ? { valid: false, errors: { name: 'Name is required' } }
        : { valid: true, errors: null },
  },
  onSubmit: async (values) => {
    // Simulated API latency; a real 422 would call form.setErrors(...) here.
    await new Promise((resolve) => setTimeout(resolve, 400));
    console.log('submitted', values);
  },
});

const $ = (id) => document.getElementById(id);

// --- writes -------------------------------------------------------------

$('name').addEventListener('input', (event) => {
  form.setValue('name', event.target.value);
});
$('name').addEventListener('blur', () => form.touch('name'));

$('add-tag').addEventListener('click', () => {
  form.array('tags').append(`tag-${form.array('tags').length + 1}`);
});

document.querySelectorAll('[data-remove-tag]').forEach((button) => {
  button.addEventListener('click', () => {
    form.array('tags').remove(Number(button.dataset.removeTag));
  });
});

$('signup').addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = await form.submit();
  if (result.status === 'invalid') console.log('invalid', result.errors);
  if (result.status === 'error') console.log('error', result.error);
  if (result.status === 'submitted') console.log('submitted', result.data);
});

$('reset').addEventListener('click', () => form.reset());

// --- reads --------------------------------------------------------------

let renderedTags = '';

function renderInput() {
  const input = $('name');
  if (document.activeElement !== input && input.value !== form.getValue('name')) {
    input.value = form.getValue('name');
  }
}

function renderTags() {
  const tags = form.array('tags');
  const html = tags.value
    .map((tag, index) => `<li>${tag} <button type="button" data-remove-tag="${index}">×</button></li>`)
    .join('');
  if (html !== renderedTags) {
    renderedTags = html;
    $('tags').innerHTML = html;
    document.querySelectorAll('[data-remove-tag]').forEach((button) => {
      button.addEventListener('click', () => {
        form.array('tags').remove(Number(button.dataset.removeTag));
      });
    });
  }
}

function renderState() {
  const { isDirty, isValid, isSubmitting, isValidating, submitCount } = form.state;
  $('state').textContent = JSON.stringify(
    { isDirty, isValid, isSubmitting, isValidating, submitCount, errors: form.errors },
    null,
    2,
  );
}

function render() {
  renderInput();
  renderTags();
  $('name-error').textContent = form.field('name').touched ? (form.getError('name') ?? '') : '';
  $('submit').disabled = form.isSubmitting;
  renderState();
}

form.subscribe(render);
render();
