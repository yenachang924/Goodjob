export type Task = {
  id: string;
  project: string;
  title: string;
  minutes: number;
  priority: number;
  done: boolean;
  due: string;
};
export type Slot = {
  taskId: string;
  project: string;
  title: string;
  minutes: number;
};
export type Day = {
  capacity: number;
  buffer: number;
  confirmed: Slot[] | null;
  active: { taskId: string; startedAt: number } | null;
};
export type Data = {
  projects: string[];
  tasks: Task[];
  days: Record<string, Day>;
};
export const initialData: Data = {
  projects: [
    '논리회로',
    '일반수학2',
    '디지털자산과 시장 인프라',
    '객체지향프로그래밍2',
    '이산구조',
    '인하밥길',
    '곧감',
    'Popkemon',
    '오늘의 노래 추천',
  ],
  tasks: [],
  days: {},
};
export const defaultDay = (): Day => ({
  capacity: 240,
  buffer: 30,
  confirmed: null,
  active: null,
});
export const total = (plan: Slot[]) =>
  plan.reduce((sum, slot) => sum + slot.minutes, 0);
export function recommend(
  tasks: Task[],
  capacity: number,
  buffer: number,
): Slot[] {
  const sorted = tasks
    .filter((t) => !t.done)
    .toSorted(
      (a, b) =>
        a.priority - b.priority ||
        (a.due || '9999').localeCompare(b.due || '9999'),
    );
  return sorted.reduce<Slot[]>(
    (plan, t) =>
      total(plan) + t.minutes <= capacity - buffer
        ? [
            ...plan,
            {
              taskId: t.id,
              project: t.project,
              title: t.title,
              minutes: t.minutes,
            },
          ]
        : plan,
    [],
  );
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const date = (v: unknown) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(v).toISOString().slice(0, 10) === v;
function validDay(v: unknown): boolean {
  if (
    !record(v) ||
    !integer(v.capacity, 0, 1440) ||
    !integer(v.buffer, 0, v.capacity)
  )
    return false;
  if (
    v.active !== null &&
    (!record(v.active) ||
      !text(v.active.taskId, 100) ||
      !integer(v.active.startedAt, 0, 9999999999999))
  )
    return false;
  if (v.confirmed === null) return v.active === null;
  if (!Array.isArray(v.confirmed) || v.confirmed.length > 500) return false;
  if (
    !v.confirmed.every(
      (s) =>
        record(s) &&
        text(s.taskId, 100) &&
        text(s.project, 100) &&
        text(s.title, 300) &&
        integer(s.minutes, 1, 1440),
    )
  )
    return false;
  const slots = v.confirmed as Slot[];
  return (
    total(slots) + v.buffer <= v.capacity &&
    new Set(slots.map((s) => s.taskId)).size === slots.length &&
    (v.active === null ||
      slots.some((s) => s.taskId === (v.active as { taskId: string }).taskId))
  );
}
export function validData(v: unknown): v is Data {
  try {
    if (
      !record(v) ||
      !Array.isArray(v.projects) ||
      v.projects.length > 100 ||
      !v.projects.every((p) => text(p, 100)) ||
      new Set(v.projects).size !== v.projects.length
    )
      return false;
    const projects = v.projects;
    if (
      !Array.isArray(v.tasks) ||
      v.tasks.length > 2000 ||
      !v.tasks.every(
        (t) =>
          record(t) &&
          text(t.id, 100) &&
          text(t.title, 300) &&
          typeof t.project === 'string' &&
          projects.includes(t.project) &&
          integer(t.minutes, 1, 1440) &&
          integer(t.priority, 1, 3) &&
          typeof t.done === 'boolean' &&
          (t.due === '' || date(t.due)),
      )
    )
      return false;
    if (new Set(v.tasks.map((t) => t.id)).size !== v.tasks.length) return false;
    return (
      record(v.days) &&
      Object.keys(v.days).length <= 3660 &&
      Object.entries(v.days).every(([k, d]) => date(k) && validDay(d))
    );
  } catch {
    return false;
  }
}
