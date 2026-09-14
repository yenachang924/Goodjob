import test from 'node:test';
import assert from 'node:assert/strict';
import { initialData } from './planner.ts';
import {
  leafTasks,
  migrateWorkspace,
  projectSummary,
  resolveLegacyTimer,
  saveControlTask,
  saveMilestone,
  saveProject,
  saveTimeSession,
  sessionSeconds,
  setTaskArchived,
  setTaskStatus,
  startTimer,
  stopTimer,
  taskStatus,
  validControlData,
} from './control/index.ts';

const NOW = Date.parse('2026-09-09T03:00:00.000Z'); // Tuesday noon, Korea
const project = {
  id: 'p1',
  name: 'Project',
  description: '',
  link: 'https://example.com',
  archived: false,
};
const task = (overrides = {}) => ({
  id: 't1',
  projectId: 'p1',
  parentId: null,
  milestoneId: null,
  title: 'Task',
  minutes: 60,
  priority: 1,
  due: '',
  status: 'todo',
  blockedReason: '',
  createdAt: NOW,
  completedAt: null,
  archived: false,
  ...overrides,
});
const empty = () => ({
  version: 2,
  projects: [project],
  tasks: [],
  milestones: [],
  sessions: [],
  days: {},
  legacyActive: [],
});

test('migration preserves legacy IDs, content and plans without mutating input', () => {
  const old = structuredClone({
    ...initialData,
    projects: ['Alpha'],
    tasks: [
      {
        id: 'legacy-1',
        project: 'Alpha',
        title: 'Old task',
        minutes: 30,
        priority: 2,
        done: true,
        due: '2026-09-10',
      },
    ],
    days: {
      '2026-09-09': {
        capacity: 240,
        buffer: 30,
        confirmed: [
          {
            taskId: 'legacy-1',
            project: 'Alpha',
            title: 'Old task',
            minutes: 30,
          },
        ],
        active: { taskId: 'legacy-1', startedAt: NOW },
      },
    },
  });
  const original = structuredClone(old);
  const migrated = migrateWorkspace(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.tasks[0].id, 'legacy-1');
  assert.equal(migrated.tasks[0].title, 'Old task');
  assert.equal(migrated.tasks[0].status, 'done');
  assert.equal(migrated.tasks[0].createdAt, null);
  assert.deepEqual(
    migrated.days['2026-09-09'].confirmed,
    old.days['2026-09-09'].confirmed,
  );
  assert.equal(migrated.sessions.length, 0);
  assert.deepEqual(migrated.legacyActive, [
    { date: '2026-09-09', taskId: 'legacy-1', startedAt: NOW },
  ]);
  assert.deepEqual(old, original);
});

test('V2 migration is validated, immutable and idempotent', () => {
  const value = { ...empty(), projects: [{ ...project }] };
  const copy = structuredClone(value);
  assert.deepEqual(
    migrateWorkspace(migrateWorkspace(value)),
    migrateWorkspace(value),
  );
  assert.deepEqual(value, copy);
  assert.throws(() => migrateWorkspace({ version: 3 }), /워크스페이스/);
  assert.throws(
    () => migrateWorkspace({ version: 3, projects: [], tasks: [], days: {} }),
    /워크스페이스/,
  );
});

test('validation rejects duplicate and foreign IDs, bad links, dates and intervals', () => {
  assert.equal(validControlData(empty(), NOW), true);
  assert.equal(
    validControlData({ ...empty(), projects: [project, { ...project }] }, NOW),
    false,
  );
  assert.equal(
    validControlData(
      { ...empty(), projects: [{ ...project, link: 'javascript:alert(1)' }] },
      NOW,
    ),
    false,
  );
  assert.equal(
    validControlData(
      { ...empty(), tasks: [task({ projectId: 'missing' })] },
      NOW,
    ),
    false,
  );
  assert.equal(
    validControlData({ ...empty(), tasks: [task({ due: '2026-02-30' })] }, NOW),
    false,
  );
  assert.equal(
    validControlData(
      {
        ...empty(),
        sessions: [
          {
            id: 's',
            taskId: 't1',
            projectId: 'p1',
            startedAt: NOW,
            endedAt: NOW - 1,
            source: 'manual',
          },
        ],
        tasks: [task()],
      },
      NOW,
    ),
    false,
  );
  assert.equal(
    validControlData(
      {
        ...empty(),
        milestones: [
          { id: 'm1', projectId: 'p1', title: 'M', due: '', achieved: true },
        ],
        tasks: [task({ milestoneId: 'm1' })],
      },
      NOW,
    ),
    false,
  );
  assert.equal(
    validControlData(
      {
        ...empty(),
        tasks: [task()],
        sessions: [
          {
            id: 'long',
            taskId: 't1',
            projectId: 'p1',
            startedAt: NOW - 86_400_001,
            endedAt: NOW,
            source: 'manual',
          },
        ],
      },
      NOW,
    ),
    false,
  );
});

test('validation rejects invalid confirmed plans and ineligible active sessions', () => {
  const planned = (confirmed) => ({
    ...empty(),
    tasks: [task()],
    days: { '2026-09-09': { capacity: 60, buffer: 10, confirmed } },
  });
  assert.equal(
    validControlData(
      planned([
        { taskId: 't1', project: 'Project', title: 'Task', minutes: 51 },
      ]),
      NOW,
    ),
    false,
  );
  assert.equal(
    validControlData(
      planned([
        { taskId: 'missing', project: 'Project', title: 'Ghost', minutes: 10 },
      ]),
      NOW,
    ),
    false,
  );

  const active = (data, taskId = 't1') => ({
    ...data,
    sessions: [
      {
        id: 'active',
        taskId,
        projectId: 'p1',
        startedAt: NOW,
        endedAt: null,
        source: 'timer',
      },
    ],
  });
  assert.equal(
    validControlData(
      active({
        ...empty(),
        projects: [{ ...project, archived: true }],
        tasks: [task()],
      }),
      NOW,
    ),
    false,
  );
  assert.equal(
    validControlData(
      active({ ...empty(), tasks: [task({ archived: true })] }),
      NOW,
    ),
    false,
  );
  assert.equal(
    validControlData(
      active({
        ...empty(),
        tasks: [task(), task({ id: 'child', parentId: 't1' })],
      }),
      NOW,
    ),
    false,
  );

  const historical = {
    ...empty(),
    projects: [{ ...project, archived: true }],
    tasks: [task({ archived: true, status: 'done', completedAt: NOW })],
    sessions: [
      {
        id: 'past',
        taskId: 't1',
        projectId: 'p1',
        startedAt: NOW - 1_000,
        endedAt: NOW,
        source: 'timer',
      },
    ],
  };
  assert.equal(validControlData(historical, NOW), true);
});

test('relations reject cycles, third levels, mismatched milestones and invalid decomposition', () => {
  const base = {
    ...empty(),
    milestones: [
      { id: 'm1', projectId: 'p1', title: 'M', due: '', achieved: false },
    ],
  };
  assert.throws(
    () =>
      saveControlTask(
        {
          ...base,
          tasks: [
            task({ id: 'a', parentId: 'b' }),
            task({ id: 'b', parentId: 'a' }),
          ],
        },
        task({ id: 'x' }),
        NOW,
      ),
    /관계/,
  );
  const parent = task({ id: 'parent', milestoneId: 'm1' });
  const child = task({ id: 'child', parentId: 'parent', milestoneId: 'm1' });
  assert.throws(
    () =>
      saveControlTask(
        { ...base, tasks: [parent, child] },
        task({ id: 'grand', parentId: 'child', milestoneId: 'm1' }),
        NOW,
      ),
    /2단계/,
  );
  assert.throws(
    () =>
      saveControlTask(
        { ...base, tasks: [task({ id: 'plain-parent' })] },
        task({ id: 'child', parentId: 'plain-parent', milestoneId: 'm1' }),
        NOW,
      ),
    /마일스톤/,
  );
  assert.throws(
    () =>
      saveControlTask(
        {
          ...base,
          tasks: [parent],
          sessions: [
            {
              id: 's',
              taskId: 'parent',
              projectId: 'p1',
              startedAt: NOW,
              endedAt: null,
              source: 'timer',
            },
          ],
        },
        child,
        NOW,
      ),
    /실행/,
  );
  assert.throws(
    () =>
      saveControlTask(
        {
          ...base,
          tasks: [parent],
          days: {
            '2026-09-09': {
              capacity: 60,
              buffer: 0,
              confirmed: [
                {
                  taskId: 'parent',
                  project: 'Project',
                  title: 'Task',
                  minutes: 60,
                },
              ],
            },
          },
        },
        child,
        NOW,
      ),
    /계획/,
  );
});

test('parent visibility and status are derived from live children', () => {
  const parent = task({ id: 'parent', status: 'done' });
  const a = task({ id: 'a', parentId: 'parent', status: 'done' });
  const b = task({
    id: 'b',
    parentId: 'parent',
    status: 'blocked',
    blockedReason: 'wait',
  });
  const data = { ...empty(), tasks: [parent, a, b] };
  assert.deepEqual(
    leafTasks(data).map(({ id }) => id),
    ['a', 'b'],
  );
  assert.equal(taskStatus(data, 'parent'), 'blocked');
  assert.deepEqual(leafTasks(setTaskArchived(data, 'parent', true)), []);
});

test('reopening work reopens its milestone', () => {
  const data = {
    ...empty(),
    milestones: [
      { id: 'm1', projectId: 'p1', title: 'M', due: '', achieved: true },
    ],
    tasks: [task({ milestoneId: 'm1', status: 'done', completedAt: NOW })],
  };
  const reopened = setTaskStatus(data, 't1', 'doing', NOW + 1);
  assert.equal(reopened.tasks[0].completedAt, null);
  assert.equal(reopened.milestones[0].achieved, false);
  assert.throws(
    () => saveMilestone(reopened, { ...data.milestones[0], achieved: true }),
    /미완료/,
  );
});

test('adding any task reopens an achieved milestone', () => {
  const data = {
    ...empty(),
    milestones: [
      { id: 'm1', projectId: 'p1', title: 'M', due: '', achieved: true },
    ],
  };
  const next = saveControlTask(
    data,
    task({ milestoneId: 'm1', status: 'done', completedAt: NOW }),
    NOW,
  );
  assert.equal(next.milestones[0].achieved, false);
});

test('direct task completion stamps transition and atomically closes its timer', () => {
  const data = startTimer({ ...empty(), tasks: [task()] }, 't1', 's1', NOW);
  const input = task({ status: 'done', completedAt: null });
  const completed = saveControlTask(data, input, NOW + 60_000);
  assert.equal(completed.tasks[0].completedAt, NOW + 60_000);
  assert.equal(completed.sessions[0].endedAt, NOW + 60_000);
  assert.equal(input.completedAt, null);

  const legacy = {
    ...empty(),
    tasks: [task({ status: 'done', completedAt: null })],
  };
  assert.equal(
    saveControlTask(
      legacy,
      task({ title: 'Renamed', status: 'done', completedAt: null }),
      NOW,
    ).tasks[0].completedAt,
    null,
  );
  assert.equal(
    setTaskStatus(legacy, 't1', 'done', NOW).tasks[0].completedAt,
    null,
  );
  const known = {
    ...empty(),
    tasks: [task({ status: 'done', completedAt: NOW - 1 })],
  };
  assert.equal(
    setTaskStatus(known, 't1', 'done', NOW).tasks[0].completedAt,
    NOW - 1,
  );
  const reopened = saveControlTask(
    known,
    task({ status: 'todo', completedAt: NOW - 1 }),
    NOW,
  );
  assert.equal(reopened.tasks[0].completedAt, null);
});

test('achieved milestones use derived leaf status instead of stored parent status', () => {
  const milestone = {
    id: 'm1',
    projectId: 'p1',
    title: 'M',
    due: '',
    achieved: true,
  };
  const completeTree = {
    ...empty(),
    milestones: [milestone],
    tasks: [
      task({ id: 'parent', milestoneId: 'm1', status: 'todo' }),
      task({
        id: 'child',
        parentId: 'parent',
        milestoneId: 'm1',
        status: 'done',
        completedAt: NOW,
      }),
    ],
  };
  assert.equal(validControlData(completeTree, NOW), true);
  assert.doesNotThrow(() => saveMilestone(completeTree, milestone));
});

test('editing a parent milestone propagates atomically to its children', () => {
  const milestones = [
    { id: 'm1', projectId: 'p1', title: 'One', due: '', achieved: false },
    { id: 'm2', projectId: 'p1', title: 'Two', due: '', achieved: true },
  ];
  const parent = task({ id: 'parent', milestoneId: 'm1' });
  const child = task({
    id: 'child',
    parentId: 'parent',
    milestoneId: 'm1',
    status: 'done',
    completedAt: NOW,
  });
  const input = { ...parent, milestoneId: 'm2' };
  const next = saveControlTask(
    { ...empty(), milestones, tasks: [parent, child] },
    input,
    NOW,
  );
  assert.deepEqual(
    next.tasks.map(({ milestoneId }) => milestoneId),
    ['m2', 'm2'],
  );
  assert.equal(next.milestones.find(({ id }) => id === 'm2').achieved, false);
  assert.equal(child.milestoneId, 'm1');
});

test('timer switching, stopping and completion are atomic and immutable', () => {
  const data = { ...empty(), tasks: [task(), task({ id: 't2' })] };
  const first = startTimer(data, 't1', 's1', NOW);
  const second = startTimer(first, 't2', 's2', NOW + 60_000);
  assert.equal(second.sessions.filter((s) => s.endedAt === null).length, 1);
  assert.equal(
    second.sessions.find((s) => s.id === 's1').endedAt,
    NOW + 60_000,
  );
  assert.equal(data.sessions.length, 0);
  const completed = setTaskStatus(second, 't2', 'done', NOW + 120_000);
  assert.equal(
    completed.sessions.find((s) => s.id === 's2').endedAt,
    NOW + 120_000,
  );
  assert.equal(stopTimer(completed, NOW + 180_000).sessions.length, 2);
});

test('zero-length timers are discarded and long timer history can be stopped', () => {
  const data = { ...empty(), tasks: [task()] };
  assert.equal(
    stopTimer(startTimer(data, 't1', 'zero', NOW), NOW).sessions.length,
    0,
  );
  const switched = startTimer(
    startTimer(data, 't1', 'zero', NOW),
    't1',
    'next',
    NOW,
  );
  assert.deepEqual(
    switched.sessions.map((session) => session.id),
    ['next'],
  );
  const longData = {
    ...empty(),
    tasks: [task({ createdAt: NOW - 86_400_001 })],
  };
  const long = stopTimer(
    startTimer(longData, 't1', 'long', NOW - 86_400_001),
    NOW,
  );
  assert.equal(long.sessions.length, 2);
  assert.equal(
    long.sessions.reduce(
      (total, session) => total + session.endedAt - session.startedAt,
      0,
    ),
    86_400_001,
  );
  assert.equal(
    long.sessions.every(
      (session) => session.endedAt - session.startedAt <= 86_400_000,
    ),
    true,
  );
  assert.equal(long.sessions[0].endedAt, long.sessions[1].startedAt);
  assert.notEqual(long.sessions[0].id, long.sessions[1].id);
  assert.equal(validControlData(long, NOW), true);
});

test('validation permits long active timers but rejects every closed record over 24 hours', () => {
  const base = { ...empty(), tasks: [task({ createdAt: NOW - 86_400_001 })] };
  const active = {
    ...base,
    sessions: [
      {
        id: 'long',
        taskId: 't1',
        projectId: 'p1',
        startedAt: NOW - 86_400_001,
        endedAt: null,
        source: 'timer',
      },
    ],
  };
  assert.equal(validControlData(active, NOW), true);
  assert.equal(
    validControlData(
      { ...active, sessions: [{ ...active.sessions[0], endedAt: NOW }] },
      NOW,
    ),
    false,
  );
});

test('timer switching reserves the incoming ID from generated segment IDs', () => {
  const startedAt = NOW - 86_400_001;
  const data = startTimer(
    {
      ...empty(),
      tasks: [
        task({ createdAt: startedAt }),
        task({ id: 't2', createdAt: startedAt }),
      ],
    },
    't1',
    'a',
    startedAt,
  );
  const switched = startTimer(data, 't2', 'a~1', NOW);
  assert.equal(new Set(switched.sessions.map(({ id }) => id)).size, 3);
  assert.equal(
    switched.sessions.find(({ endedAt }) => endedAt === null).id,
    'a~1',
  );
  assert.equal(validControlData(switched, NOW), true);
});

test('long timer splitting is atomic when the record limit would be exceeded', () => {
  const startedAt = NOW - 86_400_001;
  const history = Array.from({ length: 9_999 }, (_, index) => ({
    id: `h${index}`,
    taskId: 't1',
    projectId: 'p1',
    startedAt: index * 2,
    endedAt: index * 2 + 1,
    source: 'timer',
  }));
  const data = {
    ...empty(),
    tasks: [task({ createdAt: 0 })],
    sessions: [
      ...history,
      {
        id: 'active',
        taskId: 't1',
        projectId: 'p1',
        startedAt,
        endedAt: null,
        source: 'timer',
      },
    ],
  };
  const before = structuredClone(data);
  assert.throws(() => stopTimer(data, NOW), /한도/);
  assert.deepEqual(data, before);
});

test('timers cannot start for completed, archived, or parent tasks', () => {
  for (const bad of [
    task({ status: 'done', completedAt: NOW }),
    task({ archived: true }),
  ]) {
    assert.throws(
      () => startTimer({ ...empty(), tasks: [bad] }, 't1', 's', NOW + 1),
      /타이머/,
    );
  }
  assert.throws(
    () =>
      startTimer(
        { ...empty(), tasks: [task(), task({ id: 'child', parentId: 't1' })] },
        't1',
        's',
        NOW,
      ),
    /하위/,
  );
  assert.throws(
    () =>
      startTimer(
        {
          ...empty(),
          projects: [{ ...project, archived: true }],
          tasks: [task()],
        },
        't1',
        's',
        NOW,
      ),
    /보관/,
  );
});

test('manual sessions reject future, reversed, over-24h and overlapping intervals', () => {
  const data = {
    ...empty(),
    tasks: [task()],
    sessions: [
      {
        id: 'old',
        taskId: 't1',
        projectId: 'p1',
        startedAt: NOW - 60_000,
        endedAt: NOW,
        source: 'manual',
      },
    ],
  };
  const input = (start, end) => ({
    id: 'new',
    taskId: 't1',
    projectId: 'p1',
    startedAt: start,
    endedAt: end,
    source: 'manual',
  });
  assert.throws(
    () => saveTimeSession(data, input(NOW + 1, NOW + 2), NOW),
    /미래/,
  );
  assert.throws(() => saveTimeSession(data, input(NOW, NOW - 1), NOW), /종료/);
  assert.throws(
    () => saveTimeSession(empty(), input(NOW - 86_400_001, NOW), NOW),
    /24시간/,
  );
  assert.throws(
    () => saveTimeSession(data, input(NOW - 30_000, NOW + 1), NOW + 1),
    /겹/,
  );
});

test('legacy timer resolution creates only confirmed history or discards candidate', () => {
  const data = {
    ...empty(),
    tasks: [task()],
    legacyActive: [
      { date: '2026-09-09', taskId: 't1', startedAt: NOW - 60_000 },
    ],
  };
  const discarded = resolveLegacyTimer(
    data,
    '2026-09-09',
    null,
    'ignored',
    NOW,
  );
  assert.equal(discarded.sessions.length, 0);
  assert.equal(discarded.legacyActive.length, 0);
  const resolved = resolveLegacyTimer(data, '2026-09-09', NOW, 's1', NOW);
  assert.equal(resolved.sessions[0].source, 'manual');
});

test('summaries use leaf-only work, ignore unknown timestamps and handle zero tasks', () => {
  const zero = projectSummary(empty(), 'p1', NOW);
  assert.deepEqual(
    { total: zero.total, done: zero.done },
    { total: 0, done: 0 },
  );
  const parent = task({ id: 'parent', minutes: 999 });
  const a = task({
    id: 'a',
    parentId: 'parent',
    minutes: 30,
    status: 'done',
    completedAt: NOW,
    createdAt: null,
  });
  const b = task({
    id: 'b',
    parentId: 'parent',
    minutes: 45,
    status: 'blocked',
    due: '2026-09-08',
    createdAt: NOW,
  });
  const summary = projectSummary(
    { ...empty(), tasks: [parent, a, b] },
    'p1',
    NOW,
  );
  assert.deepEqual(
    {
      total: summary.total,
      done: summary.done,
      remaining: summary.remaining,
      blocked: summary.blocked,
      overdue: summary.overdue,
      remainingMinutes: summary.remainingMinutes,
      weekAdded: summary.weekAdded,
      weekDone: summary.weekDone,
    },
    {
      total: 2,
      done: 1,
      remaining: 1,
      blocked: 1,
      overdue: 1,
      remainingMinutes: 45,
      weekAdded: 1,
      weekDone: 1,
    },
  );
});

test('session aggregation clips Korea midnight and Monday week boundaries', () => {
  const start = Date.parse('2026-09-06T14:59:30Z'); // Sunday 23:59:30 Korea
  const end = Date.parse('2026-09-06T15:00:30Z'); // Monday 00:00:30 Korea
  const sessions = [
    {
      id: 's',
      taskId: 't1',
      projectId: 'p1',
      startedAt: start,
      endedAt: end,
      source: 'manual',
    },
  ];
  assert.equal(sessionSeconds(sessions, end - 30_000, end, 'p1'), 30);
  const summary = projectSummary(
    { ...empty(), tasks: [task()], sessions },
    'p1',
    end,
  );
  assert.equal(summary.todaySeconds, 30);
  assert.equal(summary.weekSeconds, 30);
});

test('project summary excludes ongoing elapsed time from confirmed totals', () => {
  const active = [
    {
      id: 'active',
      taskId: 't1',
      projectId: 'p1',
      startedAt: NOW - 60_000,
      endedAt: null,
      source: 'timer',
    },
  ];
  const data = { ...empty(), tasks: [task()], sessions: active };
  assert.equal(sessionSeconds(active, NOW - 60_000, NOW, 'p1'), 60);
  assert.equal(projectSummary(data, 'p1', NOW).todaySeconds, 0);
  assert.equal(projectSummary(data, 'p1', NOW).weekSeconds, 0);
});

test('project and task save reject invalid input without mutating caller', () => {
  const data = empty();
  const before = structuredClone(data);
  assert.throws(() => saveProject(data, { ...project, id: '' }), /프로젝트/);
  assert.throws(
    () => saveControlTask(data, task({ minutes: 1.5 }), NOW),
    /작업/,
  );
  assert.deepEqual(data, before);
});

test('archiving rejects active work anywhere in the project or task subtree', () => {
  const parent = task({ id: 'parent' });
  const child = task({ id: 'child', parentId: 'parent' });
  const data = startTimer(
    { ...empty(), tasks: [parent, child] },
    'child',
    'active',
    NOW,
  );
  assert.throws(() => setTaskArchived(data, 'parent', true), /실행/);
  assert.throws(
    () => saveProject(data, { ...project, archived: true }),
    /실행/,
  );
  assert.equal(
    validControlData(
      {
        ...data,
        tasks: data.tasks.map((item) =>
          item.id === 'parent' ? { ...item, archived: true } : item,
        ),
      },
      NOW,
    ),
    false,
  );
});
