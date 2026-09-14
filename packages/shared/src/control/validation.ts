import type { ControlData, ControlTask, TimeSession } from './types.ts';

const LIMITS = {
  projects: 100,
  tasks: 2000,
  milestones: 2000,
  sessions: 10000,
  days: 3660,
  legacy: 3660,
} as const;
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number, empty = false): v is string =>
  typeof v === 'string' && v.length <= max && (empty || v.trim().length > 0);
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const timestamp = (v: unknown, now: number): v is number =>
  integer(v, 0, 9_999_999_999_999) && v <= now;
const nullableTimestamp = (v: unknown, now: number): v is number | null =>
  v === null || timestamp(v, now);
const date = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const optionalDate = (v: unknown): v is string => v === '' || date(v);
const unique = <T>(items: T[], id: (item: T) => string) =>
  new Set(items.map(id)).size === items.length;

const validProject = (v: unknown) =>
  object(v) &&
  text(v.id, 100) &&
  text(v.name, 100) &&
  text(v.description, 2000, true) &&
  text(v.link, 2000, true) &&
  (v.link === '' || safeLink(v.link)) &&
  typeof v.archived === 'boolean';
const safeLink = (link: unknown) => {
  if (typeof link !== 'string') return false;
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};
const validMilestone = (v: unknown) =>
  object(v) &&
  text(v.id, 100) &&
  text(v.projectId, 100) &&
  text(v.title, 300) &&
  optionalDate(v.due) &&
  typeof v.achieved === 'boolean';
const validTaskShape = (v: unknown, now: number): v is ControlTask =>
  object(v) &&
  text(v.id, 100) &&
  text(v.projectId, 100) &&
  (v.parentId === null || text(v.parentId, 100)) &&
  (v.milestoneId === null || text(v.milestoneId, 100)) &&
  text(v.title, 300) &&
  integer(v.minutes, 1, 1440) &&
  integer(v.priority, 1, 3) &&
  optionalDate(v.due) &&
  ['todo', 'doing', 'blocked', 'done'].includes(v.status as string) &&
  text(v.blockedReason, 1000, true) &&
  nullableTimestamp(v.createdAt, now) &&
  nullableTimestamp(v.completedAt, now) &&
  typeof v.archived === 'boolean' &&
  (v.status === 'done' || v.completedAt === null);
const validSessionShape = (v: unknown, now: number): v is TimeSession => {
  if (
    !object(v) ||
    !text(v.id, 100) ||
    !text(v.taskId, 100) ||
    !text(v.projectId, 100) ||
    !timestamp(v.startedAt, now) ||
    !['timer', 'manual'].includes(v.source as string)
  )
    return false;
  const startedAt = v.startedAt;
  if (v.endedAt === null) return v.source === 'timer';
  if (!timestamp(v.endedAt, now)) return false;
  return v.endedAt > startedAt && v.endedAt - startedAt <= 86_400_000;
};
const validSlot = (v: unknown) =>
  object(v) &&
  text(v.taskId, 100) &&
  text(v.project, 100) &&
  text(v.title, 300) &&
  integer(v.minutes, 1, 1440);

function validRelations(data: ControlData): boolean {
  const projects = new Map(data.projects.map((p) => [p.id, p]));
  const milestones = new Map(data.milestones.map((m) => [m.id, m]));
  const tasks = new Map(data.tasks.map((t) => [t.id, t]));
  if (data.milestones.some((m) => !projects.has(m.projectId))) return false;
  for (const task of data.tasks) {
    if (!projects.has(task.projectId)) return false;
    const milestone =
      task.milestoneId === null ? null : milestones.get(task.milestoneId);
    if (
      task.milestoneId !== null &&
      (!milestone || milestone.projectId !== task.projectId)
    )
      return false;
    if (task.parentId !== null) {
      const parent = tasks.get(task.parentId);
      if (
        !parent ||
        parent.id === task.id ||
        parent.parentId !== null ||
        parent.projectId !== task.projectId ||
        parent.milestoneId !== task.milestoneId
      )
        return false;
    }
  }
  if (
    data.milestones.some(
      (milestone) =>
        milestone.achieved && milestoneHasIncompleteWork(data, milestone.id),
    )
  )
    return false;
  if (data.sessions.some((s) => tasks.get(s.taskId)?.projectId !== s.projectId))
    return false;
  if (data.legacyActive.some((a) => !tasks.has(a.taskId))) return false;
  if (data.sessions.filter((s) => s.endedAt === null).length > 1) return false;
  const active = data.sessions.find((session) => session.endedAt === null);
  if (active) {
    const activeTask = tasks.get(active.taskId)!;
    const activeParent =
      activeTask.parentId === null ? null : tasks.get(activeTask.parentId);
    if (
      activeTask.archived ||
      activeParent?.archived ||
      projects.get(active.projectId)?.archived ||
      data.tasks.some(
        (task) => task.parentId === active.taskId && !task.archived,
      )
    )
      return false;
  }
  for (const day of Object.values(data.days)) {
    if (day.confirmed === null) continue;
    if (
      day.confirmed.reduce((total, slot) => total + slot.minutes, 0) +
        day.buffer >
      day.capacity
    )
      return false;
    if (day.confirmed.some((slot) => !tasks.has(slot.taskId))) return false;
  }
  const ordered = [...data.sessions].sort((a, b) => a.startedAt - b.startedAt);
  return ordered.every(
    (session, index) =>
      index === 0 ||
      (ordered[index - 1].endedAt ?? Infinity) <= session.startedAt,
  );
}

export function milestoneHasIncompleteWork(
  data: ControlData,
  milestoneId: string,
): boolean {
  const archivedParents = new Set(
    data.tasks.filter((task) => task.archived).map((task) => task.id),
  );
  return data.tasks.some(
    (task) =>
      task.milestoneId === milestoneId &&
      !task.archived &&
      !archivedParents.has(task.parentId ?? '') &&
      !data.tasks.some(
        (child) => child.parentId === task.id && !child.archived,
      ) &&
      task.status !== 'done',
  );
}

export function validControlData(
  value: unknown,
  now = Date.now(),
): value is ControlData {
  try {
    if (
      !object(value) ||
      value.version !== 2 ||
      !Array.isArray(value.projects) ||
      value.projects.length > LIMITS.projects ||
      !value.projects.every(validProject) ||
      !unique(value.projects, (p) => p.id as string)
    )
      return false;
    if (
      !Array.isArray(value.milestones) ||
      value.milestones.length > LIMITS.milestones ||
      !value.milestones.every(validMilestone) ||
      !unique(value.milestones, (m) => m.id as string)
    )
      return false;
    if (
      !Array.isArray(value.tasks) ||
      value.tasks.length > LIMITS.tasks ||
      !value.tasks.every((t) => validTaskShape(t, now)) ||
      !unique(value.tasks, (t) => t.id)
    )
      return false;
    if (
      !Array.isArray(value.sessions) ||
      value.sessions.length > LIMITS.sessions ||
      !value.sessions.every((s) => validSessionShape(s, now)) ||
      !unique(value.sessions, (s) => s.id)
    )
      return false;
    if (
      !object(value.days) ||
      Object.keys(value.days).length > LIMITS.days ||
      !Object.entries(value.days).every(
        ([key, day]) =>
          date(key) &&
          object(day) &&
          integer(day.capacity, 0, 1440) &&
          integer(day.buffer, 0, day.capacity as number) &&
          (day.confirmed === null ||
            (Array.isArray(day.confirmed) &&
              day.confirmed.length <= 500 &&
              day.confirmed.every(validSlot) &&
              unique(day.confirmed, (s) => s.taskId as string))),
      )
    )
      return false;
    if (
      !Array.isArray(value.legacyActive) ||
      value.legacyActive.length > LIMITS.legacy ||
      !value.legacyActive.every(
        (a) =>
          object(a) &&
          date(a.date) &&
          text(a.taskId, 100) &&
          timestamp(a.startedAt, now),
      ) ||
      !unique(value.legacyActive, (a) => a.date as string)
    )
      return false;
    return validRelations(value as ControlData);
  } catch {
    return false;
  }
}

export function assertControlData(
  value: unknown,
  now = Date.now(),
): asserts value is ControlData {
  if (!validControlData(value, now))
    throw new Error('워크스페이스 데이터 관계 또는 값이 올바르지 않습니다.');
}
