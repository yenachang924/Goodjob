import type { ControlData } from './types.ts';
import { assertControlData } from './validation.ts';

export function moveControlTask(
  data: ControlData,
  taskId: string,
  projectId: string,
): ControlData {
  assertControlData(data);
  const task = data.tasks.find((item) => item.id === taskId);
  const destination = data.projects.find((item) => item.id === projectId);
  if (!task || task.archived)
    throw new Error('이동할 할 일을 찾을 수 없습니다.');
  if (task.parentId !== null)
    throw new Error('하위 할 일은 상위 할 일과 함께 이동하세요.');
  if (!destination || destination.archived)
    throw new Error('이동할 활동을 찾을 수 없습니다.');
  if (data.projects.find((item) => item.id === task.projectId)?.archived)
    throw new Error('보관된 활동을 먼저 다시 열어주세요.');
  if (task.projectId === projectId) return data;
  const movedIds = new Set([
    taskId,
    ...data.tasks
      .filter((item) => item.parentId === taskId)
      .map((item) => item.id),
  ]);
  const next: ControlData = {
    ...data,
    tasks: data.tasks.map((item) =>
      movedIds.has(item.id) ? { ...item, projectId, milestoneId: null } : item,
    ),
    sessions: data.sessions.map((session) =>
      movedIds.has(session.taskId) ? { ...session, projectId } : session,
    ),
    days: Object.fromEntries(
      Object.entries(data.days).map(([date, day]) => [
        date,
        {
          ...day,
          confirmed:
            day.confirmed?.map((slot) =>
              movedIds.has(slot.taskId)
                ? { ...slot, project: destination.name }
                : slot,
            ) ?? null,
        },
      ]),
    ),
  };
  assertControlData(next);
  return next;
}
