import test from 'node:test';
import assert from 'node:assert/strict';
import * as control from './control/index.ts';
import { parseBackup } from './backup.ts';

const now = 1_700_000_000_000;
const empty = () => ({
  version: 2,
  projects: [],
  tasks: [],
  milestones: [],
  sessions: [],
  days: {},
  legacyActive: [],
});
const project = {
  id: 'p',
  name: '수업',
  description: '',
  link: '',
  archived: false,
};
const task = {
  id: 't',
  projectId: 'p',
  parentId: null,
  milestoneId: null,
  title: '복습',
  minutes: 30,
  priority: 2,
  due: '',
  status: 'todo',
  blockedReason: '',
  createdAt: now,
  completedAt: null,
  archived: false,
};

test('old V2 remains valid while area and scheduled date are strictly checked', () => {
  const data = { ...empty(), projects: [project], tasks: [task] };
  assert.equal(control.validControlData(data, now), true);
  for (const area of ['class', 'project', 'study'])
    assert.equal(
      control.validControlData(
        { ...data, projects: [{ ...project, area }] },
        now,
      ),
      true,
    );
  assert.equal(
    control.validControlData(
      { ...data, projects: [{ ...project, area: 'unknown' }] },
      now,
    ),
    false,
  );
  assert.equal(
    control.validControlData(
      { ...data, tasks: [{ ...task, minutes: 0, scheduledFor: '2026-09-21' }] },
      now,
    ),
    true,
  );
  for (const scheduledFor of ['2026-02-30', null, 42])
    assert.equal(
      control.validControlData(
        { ...data, tasks: [{ ...task, scheduledFor }] },
        now,
      ),
      false,
    );
  assert.equal(
    control.validControlData(
      { ...data, tasks: [{ ...task, minutes: -1 }] },
      now,
    ),
    false,
  );
});

test('title-only capture creates the inbox and task atomically without mutating source', () => {
  assert.equal(typeof control.quickCaptureTask, 'function');
  const source = empty();
  const next = control.quickCaptureTask(
    source,
    { id: 'a', title: '  읽기  ', scheduledFor: '2026-09-21' },
    now,
  );
  assert.equal(source.projects.length, 0);
  assert.equal(source.tasks.length, 0);
  assert.equal(next.projects[0].id, control.INBOX_PROJECT_ID);
  assert.equal(next.tasks[0].title, '읽기');
  assert.equal(next.tasks[0].minutes, 0);
  assert.equal(next.tasks[0].due, '');
  assert.equal(next.tasks[0].scheduledFor, '2026-09-21');
  assert.equal(control.validControlData(next, now), true);
  const again = control.quickCaptureTask(next, { id: 'b', title: '쓰기' }, now);
  assert.equal(again.projects.length, 1);
  assert.equal(again.tasks.length, 2);
  assert.throws(() =>
    control.quickCaptureTask(next, { id: 'a', title: '덮어쓰기' }, now),
  );
  assert.throws(() =>
    control.quickCaptureTask(source, { id: 'bad', title: '  ' }, now),
  );
  assert.equal(source.projects.length, 0);
});

test('capture preserves existing project and inherits parent milestone with relationship guards', () => {
  assert.equal(typeof control.quickCaptureTask, 'function');
  const data = {
    ...empty(),
    projects: [{ ...project, area: 'class' }],
    milestones: [
      { id: 'm', projectId: 'p', title: '시험', due: '', achieved: false },
    ],
    tasks: [{ ...task, milestoneId: 'm' }],
  };
  const next = control.quickCaptureTask(
    data,
    { id: 'child', title: '하위', parentId: 't' },
    now,
  );
  assert.equal(next.tasks[1].projectId, 'p');
  assert.equal(next.tasks[1].milestoneId, 'm');
  assert.equal(next.tasks[1].parentId, 't');
  assert.equal(next.projects.length, 1);
  assert.throws(() =>
    control.quickCaptureTask(
      next,
      { id: 'grandchild', title: '깊이', parentId: 'child' },
      now,
    ),
  );
  assert.throws(() =>
    control.quickCaptureTask(
      data,
      { id: 'x', title: '불일치', parentId: 't', projectId: 'other' },
      now,
    ),
  );
  assert.throws(() =>
    control.quickCaptureTask(
      data,
      { id: 'x', title: '없음', projectId: 'missing' },
      now,
    ),
  );
  assert.throws(() =>
    control.quickCaptureTask(
      { ...data, projects: [{ ...project, archived: true }] },
      { id: 'x', title: '보관', projectId: 'p' },
      now,
    ),
  );
  assert.throws(() =>
    control.quickCaptureTask(
      data,
      { id: 'x', title: '없음', parentId: 'missing' },
      now,
    ),
  );
  assert.throws(() =>
    control.quickCaptureTask(
      { ...data, tasks: [{ ...data.tasks[0], archived: true }] },
      { id: 'x', title: '보관', parentId: 't' },
      now,
    ),
  );
  assert.deepEqual(parseBackup(JSON.stringify({ data: next }), 0), next);
});
