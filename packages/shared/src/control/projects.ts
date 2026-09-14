import type { ControlData, Milestone, Project } from './types.ts';
import { assertControlData, milestoneHasIncompleteWork } from './validation.ts';

export function saveProject(data: ControlData, input: Project): ControlData {
  assertControlData(data);
  if (
    input.archived &&
    data.sessions.some(
      (session) => session.projectId === input.id && session.endedAt === null,
    )
  )
    throw new Error('실행 중인 작업이 있는 프로젝트는 보관할 수 없습니다.');
  const exists = data.projects.some((project) => project.id === input.id);
  const next = {
    ...data,
    projects: exists
      ? data.projects.map((project) =>
          project.id === input.id ? { ...input } : project,
        )
      : [...data.projects, { ...input }],
  };
  try {
    assertControlData(next);
  } catch {
    throw new Error('프로젝트 입력이 올바르지 않습니다.');
  }
  return next;
}

export function saveMilestone(
  data: ControlData,
  input: Milestone,
): ControlData {
  assertControlData(data);
  if (input.achieved && milestoneHasIncompleteWork(data, input.id))
    throw new Error('미완료 작업이 있는 마일스톤은 달성 처리할 수 없습니다.');
  const exists = data.milestones.some((milestone) => milestone.id === input.id);
  const next = {
    ...data,
    milestones: exists
      ? data.milestones.map((milestone) =>
          milestone.id === input.id ? { ...input } : milestone,
        )
      : [...data.milestones, { ...input }],
  };
  try {
    assertControlData(next);
  } catch {
    throw new Error('마일스톤 입력이 올바르지 않습니다.');
  }
  return next;
}
