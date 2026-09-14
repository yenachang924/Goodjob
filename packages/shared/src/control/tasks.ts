import type { ControlData, ControlTask } from './types.ts';
import { assertControlData } from './validation.ts';
import { closeActiveSessions } from './time.ts';

const childrenOf = (data: ControlData, id: string) =>
  data.tasks.filter((task) => task.parentId === id && !task.archived);
const reopenMilestone = (data: ControlData, task: ControlTask) =>
  task.milestoneId === null
    ? data.milestones
    : data.milestones.map((milestone) =>
        milestone.id === task.milestoneId
          ? { ...milestone, achieved: false }
          : milestone,
      );

export function leafTasks(
  data: ControlData,
  projectId?: string,
): ControlTask[] {
  const hiddenParents = new Set(
    data.tasks.filter((task) => task.archived).map((task) => task.id),
  );
  const liveParentIds = new Set(
    data.tasks
      .filter((task) => !task.archived && task.parentId !== null)
      .map((task) => task.parentId),
  );
  return data.tasks.filter(
    (task) =>
      !task.archived &&
      !hiddenParents.has(task.parentId ?? '') &&
      (projectId === undefined || task.projectId === projectId) &&
      !liveParentIds.has(task.id),
  );
}

export function taskStatus(
  data: ControlData,
  id: string,
): ControlTask['status'] {
  const task = data.tasks.find((candidate) => candidate.id === id);
  if (!task) throw new Error('작업을 찾을 수 없습니다.');
  const children = childrenOf(data, id);
  if (children.length === 0) return task.status;
  const statuses = children.map((child) => taskStatus(data, child.id));
  if (statuses.every((status) => status === 'done')) return 'done';
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('doing') || statuses.includes('done')) return 'doing';
  return 'todo';
}

export function saveControlTask(
  data: ControlData,
  input: ControlTask,
  now: number,
): ControlData {
  assertControlData(data, now);
  const existing = data.tasks.find((task) => task.id === input.id);
  if (
    !existing &&
    data.tasks.some(
      (task) => task.id === input.parentId && task.parentId !== null,
    )
  )
    throw new Error('작업은 부모와 자식의 2단계까지만 허용됩니다.');
  if (!existing && input.parentId !== null) {
    const parent = data.tasks.find((task) => task.id === input.parentId);
    if (parent && parent.milestoneId !== input.milestoneId)
      throw new Error('하위 작업은 부모의 마일스톤을 따라야 합니다.');
    if (
      data.sessions.some(
        (session) =>
          session.taskId === input.parentId && session.endedAt === null,
      )
    )
      throw new Error('실행 중인 부모 작업을 먼저 종료해야 합니다.');
    if (
      Object.values(data.days).some((day) =>
        day.confirmed?.some((slot) => slot.taskId === input.parentId),
      )
    )
      throw new Error('확정 계획에서 부모 작업을 먼저 조정해야 합니다.');
    if (parent?.status === 'done')
      throw new Error('완료한 부모 작업을 먼저 다시 열어야 합니다.');
  }
  const completing = input.status === 'done' && existing?.status !== 'done';
  const saved = {
    ...input,
    completedAt: completing
      ? now
      : input.status === 'done'
        ? input.completedAt
        : null,
  };
  const milestoneChanged =
    existing !== undefined && existing.milestoneId !== saved.milestoneId;
  const tasks = existing
    ? data.tasks.map((task) => {
        if (task.id === input.id) return saved;
        if (milestoneChanged && task.parentId === input.id)
          return { ...task, milestoneId: saved.milestoneId };
        return task;
      })
    : [...data.tasks, saved];
  const sessions = completing
    ? closeActiveSessions(data, (session) => session.taskId === input.id, now)
    : data.sessions;
  const shouldReopen =
    input.milestoneId !== null &&
    (!existing ||
      input.status !== 'done' ||
      existing.milestoneId !== input.milestoneId);
  const next = {
    ...data,
    tasks,
    sessions,
    milestones: shouldReopen ? reopenMilestone(data, saved) : data.milestones,
  };
  try {
    assertControlData(next, now);
  } catch {
    throw new Error('작업 입력 또는 관계가 올바르지 않습니다.');
  }
  return next;
}

export function setTaskStatus(
  data: ControlData,
  id: string,
  status: ControlTask['status'],
  now: number,
): ControlData {
  assertControlData(data, now);
  const target = data.tasks.find((task) => task.id === id);
  if (!target) throw new Error('작업을 찾을 수 없습니다.');
  if (childrenOf(data, id).length > 0)
    throw new Error('부모 상태는 하위 작업에서 계산됩니다.');
  const updated = {
    ...target,
    status,
    completedAt:
      status === 'done'
        ? target.status === 'done'
          ? target.completedAt
          : now
        : null,
  };
  const sessions =
    status === 'done'
      ? closeActiveSessions(data, (session) => session.taskId === id, now)
      : data.sessions;
  const next = {
    ...data,
    tasks: data.tasks.map((task) => (task.id === id ? updated : task)),
    sessions,
    milestones:
      status === 'done' ? data.milestones : reopenMilestone(data, updated),
  };
  assertControlData(next, now);
  return next;
}

export function setTaskArchived(
  data: ControlData,
  id: string,
  archived: boolean,
): ControlData {
  assertControlData(data);
  const childIds = new Set(
    data.tasks.filter((task) => task.parentId === id).map((task) => task.id),
  );
  if (
    archived &&
    data.sessions.some(
      (session) =>
        (session.taskId === id || childIds.has(session.taskId)) &&
        session.endedAt === null,
    )
  )
    throw new Error('실행 중인 작업은 보관할 수 없습니다.');
  const next = {
    ...data,
    tasks: data.tasks.map((task) =>
      task.id === id ? { ...task, archived } : task,
    ),
  };
  assertControlData(next);
  return next;
}
