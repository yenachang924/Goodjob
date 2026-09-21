import test from 'node:test';
import assert from 'node:assert/strict';
import * as control from './control/index.ts';

const now = 1_700_000_000_000;
function fixture() {
  const project = {
    name: '미분류',
    description: '',
    link: '',
    archived: false,
  };
  const task = {
    projectId: 'inbox',
    milestoneId: 'm',
    title: '복습',
    minutes: 0,
    priority: 2,
    due: '',
    scheduledFor: '2026-09-21',
    status: 'todo',
    blockedReason: '',
    createdAt: now - 100000,
    completedAt: null,
    archived: false,
  };
  return {
    version: 2,
    projects: [
      { ...project, id: 'inbox' },
      { ...project, id: 'class', name: '논리회로', area: 'class' },
    ],
    tasks: [
      { ...task, id: 'parent', parentId: null },
      { ...task, id: 'child', parentId: 'parent' },
    ],
    milestones: [
      {
        id: 'm',
        projectId: 'inbox',
        title: '기존 마일스톤',
        due: '',
        achieved: false,
      },
    ],
    sessions: [
      {
        id: 's',
        taskId: 'child',
        projectId: 'inbox',
        startedAt: now - 60001,
        endedAt: now - 1,
        source: 'timer',
      },
    ],
    days: {
      '2026-09-21': {
        capacity: 60,
        buffer: 0,
        confirmed: [
          { taskId: 'child', title: '복습', project: '미분류', minutes: 30 },
        ],
      },
    },
    legacyActive: [],
  };
}

test('moves an entire task subtree with sessions and plans without changing identifiers or timestamps', () => {
  assert.equal(typeof control.moveControlTask, 'function');
  const source = fixture();
  const before = structuredClone(source);
  const next = control.moveControlTask(source, 'parent', 'class');
  assert.deepEqual(source, before);
  assert.deepEqual(
    next.tasks,
    before.tasks.map((task) => ({
      ...task,
      projectId: 'class',
      milestoneId: null,
    })),
  );
  assert.deepEqual(
    next.sessions,
    before.sessions.map((session) => ({ ...session, projectId: 'class' })),
  );
  assert.equal(next.days['2026-09-21'].confirmed[0].project, '논리회로');
  assert.equal(control.validControlData(next, now), true);
  assert.deepEqual(next.milestones, before.milestones);
});

test('rejects missing, child-only or archived moves and preserves active sessions when moving a root', () => {
  assert.equal(typeof control.moveControlTask, 'function');
  const source = fixture();
  assert.throws(() => control.moveControlTask(source, 'missing', 'class'));
  assert.throws(() => control.moveControlTask(source, 'parent', 'missing'));
  assert.throws(() => control.moveControlTask(source, 'child', 'class'));
  const archivedDestination = {
    ...source,
    projects: source.projects.map((project) =>
      project.id === 'class' ? { ...project, archived: true } : project,
    ),
  };
  assert.throws(() =>
    control.moveControlTask(archivedDestination, 'parent', 'class'),
  );
  const archivedTask = {
    ...source,
    tasks: source.tasks.map((task) =>
      task.id === 'parent' ? { ...task, archived: true } : task,
    ),
  };
  assert.throws(() => control.moveControlTask(archivedTask, 'parent', 'class'));
  const active = {
    ...source,
    sessions: [{ ...source.sessions[0], endedAt: null }],
  };
  const next = control.moveControlTask(active, 'parent', 'class');
  assert.equal(next.sessions[0].endedAt, null);
  assert.equal(control.validControlData(next, now), true);
});

test('reserved inbox cannot be archived while ordinary activities can be', () => {
  const data = control.quickCaptureTask(
    {
      version: 2,
      projects: [],
      tasks: [],
      milestones: [],
      sessions: [],
      days: {},
      legacyActive: [],
    },
    { id: 't', title: '분류 예정' },
    now,
  );
  assert.throws(
    () => control.saveProject(data, { ...data.projects[0], archived: true }),
    /미분류/,
  );
  const ordinary = fixture();
  assert.equal(
    control.saveProject(ordinary, { ...ordinary.projects[1], archived: true })
      .projects[1].archived,
    true,
  );
});
