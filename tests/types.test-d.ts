/**
 * Compile-time contract tests for Path<T>, PathValue<T, P> and ArrayPath<T>.
 * Valid paths/value combinations must typecheck; invalid ones are asserted
 * with @ts-expect-error so the suite fails if the safety regresses.
 */
import { describe, expectTypeOf, it } from 'vitest';
import { createForm } from '../src/index.js';
import type { ArrayPath, Path, PathValue } from '../src/index.js';

interface UserProfile {
  name: string;
  email: string;
  age: number;
}

interface Address {
  street: string;
  number: string;
  city: string;
}

interface Employee {
  profile: { name: string };
  salary: number;
}

interface Company {
  name: string;
  employees: Employee[];
}

interface TestValues {
  name: string;
  age: number;
  active: boolean;
  user: { profile: UserProfile; address: Address };
  users: { address: Address; tags: string[] }[];
  company: Company;
  matrix: number[][];
  tags: string[];
}

describe('Path<T>', () => {
  it('accepts every valid path shape', () => {
    const paths: Path<TestValues>[] = [
      'name',
      'age',
      'active',
      // objects
      'user',
      'user.profile',
      'user.profile.name',
      'user.profile.email',
      'user.profile.age',
      'user.address.city',
      // arrays of objects
      'users',
      'users.0',
      'users.0.address.city',
      'users.3.tags',
      'users.3.tags.1',
      // arrays nested in objects
      'company',
      'company.name',
      'company.employees',
      'company.employees.0',
      'company.employees.0.profile.name',
      'company.employees.2.salary',
      // arrays of arrays
      'matrix',
      'matrix.0',
      'matrix.0.1',
      // arrays of primitives
      'tags',
      'tags.0',
    ];
    expectTypeOf(paths).toBeArray();
  });

  it('rejects nonexistent paths', () => {
    // @ts-expect-error — user.nope does not exist
    const bad1: Path<TestValues> = 'user.nope';
    // @ts-expect-error — deeper than a leaf
    const bad2: Path<TestValues> = 'name.upper';
    // @ts-expect-error — wrong segment inside an array item
    const bad3: Path<TestValues> = 'users.0.nope';
    // @ts-expect-error — negative/invalid index is still not a valid key
    const bad4: Path<TestValues> = 'users.x.name';
    expectTypeOf([bad1, bad2, bad3, bad4]).toBeArray();
  });
});

describe('PathValue<T, P>', () => {
  it('resolves leaf and branch types', () => {
    expectTypeOf<PathValue<TestValues, 'name'>>().toEqualTypeOf<string>();
    expectTypeOf<PathValue<TestValues, 'age'>>().toEqualTypeOf<number>();
    expectTypeOf<PathValue<TestValues, 'active'>>().toEqualTypeOf<boolean>();
    expectTypeOf<PathValue<TestValues, 'user.address'>>().toEqualTypeOf<Address>();
    expectTypeOf<PathValue<TestValues, 'user.profile.name'>>().toEqualTypeOf<string>();
    expectTypeOf<PathValue<TestValues, 'company.employees'>>().toEqualTypeOf<Employee[]>();
  });

  it('resolves through array indices', () => {
    expectTypeOf<PathValue<TestValues, 'users.0'>>().toEqualTypeOf<{
      address: Address;
      tags: string[];
    }>();
    expectTypeOf<PathValue<TestValues, 'users.0.address.city'>>().toEqualTypeOf<string>();
    expectTypeOf<PathValue<TestValues, 'users.0.tags'>>().toEqualTypeOf<string[]>();
    expectTypeOf<PathValue<TestValues, 'users.1.tags.2'>>().toEqualTypeOf<string>();
    expectTypeOf<PathValue<TestValues, 'company.employees.0.salary'>>().toEqualTypeOf<number>();
    expectTypeOf<PathValue<TestValues, 'matrix.0.1'>>().toEqualTypeOf<number>();
  });
});

describe('ArrayPath<T>', () => {
  it('contains only paths whose value is an array', () => {
    const paths: ArrayPath<TestValues>[] = [
      'users',
      'users.0.tags',
      'company.employees',
      'matrix',
      'matrix.0',
      'tags',
    ];
    expectTypeOf(paths).toBeArray();

    // @ts-expect-error — points at a string
    const bad1: ArrayPath<TestValues> = 'users.0.tags.0';
    // @ts-expect-error — points at an object
    const bad2: ArrayPath<TestValues> = 'user.profile';
    // NOTE: 'matrix.0.1' is (surprisingly) accepted: the `${number}` index
    // pattern also matches the numeric string '0.1'. That is a documented
    // trade-off of typing indices as `${number}` — see README limitations.
    expectTypeOf([bad1, bad2]).toBeArray();
  });
});

describe('createForm API type safety', () => {
  const form = createForm({
    initialValues: {
      name: '',
      age: 0,
      user: { profile: { name: '', email: '' }, address: { street: '', number: '', city: '' } },
      users: [{ name: '', tags: [''] }],
    },
    onSubmit: async (values) => values.name,
  });

  it('types getValue with the value at the path', () => {
    expectTypeOf(form.getValue('name')).toBeString();
    expectTypeOf(form.getValue('age')).toBeNumber();
    expectTypeOf(form.getValue('user.profile.email')).toBeString();
    expectTypeOf(form.getValue('users.0.tags')).toBeArray();
  });

  it('accepts compatible values and rejects incompatible ones', () => {
    form.setValue('name', 'Gabriel');
    form.setValue('age', 30);
    form.setValue('user.address.city', 'Londrina');

    // @ts-expect-error — string into a number field
    form.setValue('age', '30');
    // @ts-expect-error — number into a string field
    form.setValue('name', 42);
    // @ts-expect-error — wrong shape for a branch
    form.setValue('user.address', { nope: 1 });
    // @ts-expect-error — wrong item type for a nested array
    form.setValue('users.0.tags', 123);
  });

  it('rejects unknown paths across the API', () => {
    // @ts-expect-error
    form.getValue('user.nope');
    // @ts-expect-error
    form.setValue('user.nope', 1);
    // @ts-expect-error
    form.touch('nope');
    // @ts-expect-error
    form.resetField('user.nope');
    // @ts-expect-error
    form.validateField('nope');
  });

  it('types field() with the value at the path', () => {
    expectTypeOf(form.field('name').value).toBeString();
    expectTypeOf(form.field('age').value).toBeNumber();
    expectTypeOf(form.field('users.0.tags').value).toBeArray();

    // @ts-expect-error — field of an unknown path
    form.field('user.nope');
  });

  it('types array() with the item type of the target array', () => {
    const users = form.array('users');
    expectTypeOf(users.value).toBeArray();
    users.append({ name: 'a', tags: ['x'] });
    users.replace(0, { name: 'b', tags: [] });

    const tags = form.array('users.0.tags');
    tags.append('x');
    // @ts-expect-error — item type mismatch
    tags.append(42);

    // @ts-expect-error — not an array path
    form.array('name');
    // @ts-expect-error — not an array path (object)
    form.array('user');
  });

  it('types submit() results per status', async () => {
    const result = await form.submit();
    if (result.status === 'submitted') {
      expectTypeOf(result.data).toBeString();
    } else if (result.status === 'invalid') {
      expectTypeOf(result.errors).toBeObject();
    } else if (result.status === 'error') {
      expectTypeOf(result.error).toBeUnknown();
    } else {
      expectTypeOf(result.status).toEqualTypeOf<'skipped'>();
    }
  });

  it('types onSubmit values as the full nested structure', () => {
    createForm({
      initialValues: { user: { profile: { name: '' } } },
      onSubmit: (values) => {
        expectTypeOf(values).toEqualTypeOf<{ user: { profile: { name: string } } }>();
        expectTypeOf(values.user.profile.name).toBeString();
      },
    });
  });
});
