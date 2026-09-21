import type { ControlData, ControlTask } from './types.ts';
import { assertControlData } from './validation.ts';
import { saveControlTask } from './tasks.ts';

export const INBOX_PROJECT_ID = 'cockpit-inbox';
export type QuickCaptureInput = {
  id: string;
  title: string;
  projectId?: string;
  parentId?: string;
  scheduledFor?: string;
};

function captureProject(data: ControlData, projectId: string): ControlData {
  const project = data.projects.find((item) => item.id === projectId);
  if (project?.archived)
    throw new Error('보관된 활동에는 작업을 추가할 수 없습니다.');
  if (project) return data;
  if (projectId !== INBOX_PROJECT_ID)
    throw new Error('활동을 찾을 수 없습니다.');
  return {
    ...data,
    projects: [
      ...data.projects,
      {
        id: INBOX_PROJECT_ID,
        name: '미분류',
        description: '',
        link: '',
        archived: false,
      },
    ],
  };
}

export function quickCaptureTask(
  data: ControlData,
  input: QuickCaptureInput,
  now: number,
): ControlData {
  assertControlData(data, now);
  if (data.tasks.some((task) => task.id === input.id))
    throw new Error('이미 등록된 작업입니다.');
  const parent =
    input.parentId === undefined
      ? undefined
      : data.tasks.find((task) => task.id === input.parentId);
  if (input.parentId !== undefined && (!parent || parent.archived))
    throw new Error('사용할 수 있는 부모 작업을 찾을 수 없습니다.');
  if (
    parent &&
    input.projectId !== undefined &&
    parent.projectId !== input.projectId
  )
    throw new Error('하위 작업은 부모의 활동을 따라야 합니다.');
  const projectId = parent?.projectId ?? input.projectId ?? INBOX_PROJECT_ID;
  const task: ControlTask = {
    id: input.id,
    projectId,
    parentId: parent?.id ?? null,
    milestoneId: parent?.milestoneId ?? null,
    title: input.title.trim(),
    minutes: 0,
    priority: 2,
    due: '',
    status: 'todo',
    blockedReason: '',
    createdAt: now,
    completedAt: null,
    archived: false,
    ...(input.scheduledFor === undefined
      ? {}
      : { scheduledFor: input.scheduledFor }),
  };
  // Return the activity and task together; callers persist this single result atomically.
  return saveControlTask(captureProject(data, projectId), task, now);
}
