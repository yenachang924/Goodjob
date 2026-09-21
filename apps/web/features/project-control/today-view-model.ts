import type { ControlData } from '@cockpit/shared/control';

const DAY_MS = 86_400_000;
const iso = (value: number) => new Date(value).toISOString().slice(0, 10);

export function tasksOnDate(data: ControlData, date: string) {
  const planned = new Set(
    data.days[date]?.confirmed?.map((slot) => slot.taskId) ?? [],
  );
  const visibleProjects = new Set(
    data.projects.filter((p) => !p.archived).map((p) => p.id),
  );
  const hiddenParents = new Set(
    data.tasks.filter((t) => t.archived).map((t) => t.id),
  );
  return data.tasks.filter(
    (task) =>
      !task.archived &&
      visibleProjects.has(task.projectId) &&
      !hiddenParents.has(task.parentId ?? '') &&
      (task.scheduledFor === date || task.due === date || planned.has(task.id)),
  );
}

export function monthCells(date: string) {
  const first = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(first);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const count = Math.round((end.getTime() - first.getTime()) / DAY_MS);
  const offset = first.getUTCDay();
  return Array.from(
    { length: Math.ceil((offset + count) / 7) * 7 },
    (_, index) => iso(first.getTime() + (index - offset) * DAY_MS),
  );
}

export function shiftMonth(date: string, offset: number) {
  const first = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() + offset);
  return iso(first.getTime());
}
