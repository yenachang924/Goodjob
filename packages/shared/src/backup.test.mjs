import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup } from './backup.ts';
import { initialData, validData } from './planner.ts';
test('backup preserves original data without merging or rewriting', () => {
  assert.deepEqual(
    parseBackup(JSON.stringify({ data: initialData, revision: 12 }), 0),
    initialData,
  );
  assert.throws(
    () => parseBackup(JSON.stringify({ data: initialData }), 1),
    /빈/,
  );
  assert.throws(() => parseBackup('{', 0), /JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ data: {} }), 0), /형식/);
});
test('backup rejects data that cannot fit in the API request', () => {
  const data = {
    ...initialData,
    tasks: Array.from({ length: 2000 }, (_, i) => ({
      id: `task-${i}`,
      project: initialData.projects[0],
      title: '가'.repeat(200),
      minutes: 30,
      priority: 1,
      done: false,
      due: '',
    })),
  };
  assert.equal(validData(data), true);
  assert.throws(() => parseBackup(JSON.stringify({ data }), 0), /용량/);
});
