import { test } from 'node:test';
import assert from 'node:assert/strict';

test('calendar and today selector merge planned and due tasks without duplicates', async () => {
  const helpers =
    await import('../apps/web/features/project-control/today-view-model.ts');
  const data = {
    projects: [{ id: 'p', archived: false }],
    tasks: [
      {
        id: 'a',
        projectId: 'p',
        parentId: null,
        archived: false,
        scheduledFor: '2026-09-21',
        due: '2026-09-21',
      },
      {
        id: 'b',
        projectId: 'p',
        parentId: null,
        archived: false,
        due: '2026-09-21',
      },
      { id: 'c', projectId: 'p', parentId: null, archived: false },
      {
        id: 'd',
        projectId: 'p',
        parentId: null,
        archived: true,
        due: '2026-09-21',
      },
    ],
    days: { '2026-09-21': { confirmed: [{ taskId: 'a' }, { taskId: 'c' }] } },
  };
  assert.deepEqual(
    helpers.tasksOnDate(data, '2026-09-21').map((t) => t.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    helpers.tasksOnDate(
      { ...data, projects: [{ id: 'p', archived: true }] },
      '2026-09-21',
    ),
    [],
  );
});

test('month grid uses complete weeks and changes months across year boundary', async () => {
  const { monthCells, shiftMonth } =
    await import('../apps/web/features/project-control/today-view-model.ts');
  const cells = monthCells('2026-02-15');
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.filter((day) => day.startsWith('2026-02')).length, 28);
  assert.equal(shiftMonth('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftMonth('2026-01-31', -1), '2025-12-01');
});
