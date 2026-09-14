import { validData, type Data } from '../planner.ts';
import type { ControlData, Project } from './types.ts';
import { assertControlData, validControlData } from './validation.ts';

const hash = (value: string) => {
  let result = 2166136261;
  for (const char of value)
    result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return (result >>> 0).toString(36);
};
const projectId = (name: string, index: number) =>
  `legacy-${index}-${hash(name)}`;

export function migrateWorkspace(value: unknown): ControlData {
  if (validControlData(value)) return structuredClone(value);
  if (typeof value === 'object' && value !== null && 'version' in value)
    throw new Error('지원되지 않거나 손상된 워크스페이스 데이터입니다.');
  if (!validData(value))
    throw new Error('지원되지 않거나 손상된 워크스페이스 데이터입니다.');
  const legacy = value as Data;
  const projects: Project[] = legacy.projects.map((name, index) => ({
    id: projectId(name, index),
    name,
    description: '',
    link: '',
    archived: false,
  }));
  const ids = new Map(
    projects.map((project, index) => [legacy.projects[index], project.id]),
  );
  const result: ControlData = {
    version: 2,
    projects,
    tasks: legacy.tasks.map((task) => ({
      id: task.id,
      projectId: ids.get(task.project)!,
      parentId: null,
      milestoneId: null,
      title: task.title,
      minutes: task.minutes,
      priority: task.priority,
      due: task.due,
      status: task.done ? 'done' : 'todo',
      blockedReason: '',
      createdAt: null,
      completedAt: null,
      archived: false,
    })),
    milestones: [],
    sessions: [],
    days: Object.fromEntries(
      Object.entries(legacy.days).map(([key, day]) => [
        key,
        {
          capacity: day.capacity,
          buffer: day.buffer,
          confirmed: structuredClone(day.confirmed),
        },
      ]),
    ),
    legacyActive: Object.entries(legacy.days).flatMap(([date, day]) =>
      day.active
        ? [{ date, taskId: day.active.taskId, startedAt: day.active.startedAt }]
        : [],
    ),
  };
  assertControlData(result);
  return result;
}
