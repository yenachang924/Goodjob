import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recommend,
  total,
  validData,
  initialData,
  defaultDay,
} from './planner.ts';

const task = (id, extra = {}) => ({
  id,
  project: '논리회로',
  title: id,
  minutes: 30,
  priority: 2,
  done: false,
  due: '',
  ...extra,
});
test('completed work excluded and buffer preserved', () => {
  const result = recommend(
    [task('a'), task('b'), task('c', { done: true })],
    70,
    20,
  );
  assert.equal(total(result), 30);
  assert.equal(result.length, 1);
  assert.deepEqual(recommend([task('a')], 0, 0), []);
});
test('priority then due date determine recommendation', () => {
  assert.deepEqual(
    recommend(
      [task('a'), task('b', { priority: 1 }), task('c', { due: '2026-09-11' })],
      90,
      0,
    ).map((s) => s.taskId),
    ['b', 'c', 'a'],
  );
});
test('recommendations are independent immutable snapshots', () => {
  const original = Object.freeze(task('a'));
  const result = recommend(Object.freeze([original]), 60, 0);
  assert.notEqual(result[0], original);
  assert.equal(original.title, 'a');
});
test('valid state accepted and bad numbers rejected', () => {
  assert.equal(validData(initialData), true);
  assert.equal(
    validData({ ...initialData, tasks: [task('a', { minutes: NaN })] }),
    false,
  );
  assert.equal(
    validData({ ...initialData, tasks: [task('a', { minutes: -1 })] }),
    false,
  );
  assert.equal(
    validData({
      ...initialData,
      days: { '2026-09-10': { ...defaultDay(), buffer: 241 } },
    }),
    false,
  );
});
test('overbooking and duplicate tasks rejected', () => {
  assert.equal(
    validData({ ...initialData, tasks: [task('a'), task('a')] }),
    false,
  );
  const confirmed = recommend([task('a')], 30, 0);
  assert.equal(
    validData({
      ...initialData,
      days: {
        '2026-09-10': { ...defaultDay(), capacity: 30, buffer: 10, confirmed },
      },
    }),
    false,
  );
});
