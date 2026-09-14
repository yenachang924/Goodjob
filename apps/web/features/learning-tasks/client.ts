import { validTask, type Task } from '@cockpit/shared';
export type LearningTask = Task & { revision: number };
export type TaskInput = Omit<Task, 'id'>;
export function toTaskInput(task: LearningTask): TaskInput {
  const { project, title, minutes, priority, done, due } = task;
  return { project, title, minutes, priority, done, due };
}
export type TaskPage = {
  tasks: LearningTask[];
  total: number;
  page: number;
  limit: number;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
export function basicAuthorization(username: string, password: string): string {
  if (
    !username.trim() ||
    username.includes(':') ||
    username.length > 100 ||
    !password ||
    password.length > 256
  )
    throw new Error('학습 계정과 비밀번호를 확인하세요.');
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}
function isTask(value: unknown): value is LearningTask {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id) &&
    Number.isSafeInteger(value.revision) &&
    Number(value.revision) >= 1 &&
    validTask(value)
  );
}
export function parseTaskPage(value: unknown): TaskPage {
  if (
    !record(value) ||
    value.success !== true ||
    !Array.isArray(value.data) ||
    !value.data.every(isTask) ||
    !record(value.meta)
  )
    throw new Error('서버 응답 형식을 확인하세요.');
  const { total, page, limit } = value.meta;
  if (
    ![total, page, limit].every(Number.isSafeInteger) ||
    Number(total) < 0 ||
    Number(page) < 0 ||
    Number(limit) < 1 ||
    Number(limit) > 100 ||
    value.data.length > Number(limit)
  )
    throw new Error('서버 목록 정보를 확인하세요.');
  return {
    tasks: value.data,
    total: Number(total),
    page: Number(page),
    limit: Number(limit),
  };
}
async function apiRequest(
  auth: string,
  suffix: string,
  options?: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/learn/tasks${suffix}`, {
      ...options,
      headers: { authorization: auth, 'content-type': 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('학습 서버에 연결하지 못했습니다. 실행 상태를 확인하세요.');
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error('서버 응답을 읽지 못했습니다. 잠시 후 다시 시도하세요.');
  }
  if (!response.ok || !record(value) || value.success !== true) {
    const message =
      record(value) &&
      record(value.error) &&
      typeof value.error.message === 'string'
        ? value.error.message
        : '요청을 처리하지 못했습니다.';
    throw new Error(message);
  }
  return value;
}
export async function loadTasks(auth: string, page = 0): Promise<TaskPage> {
  return parseTaskPage(await apiRequest(auth, `?page=${page}&size=20`));
}
export async function saveTask(
  auth: string,
  input: TaskInput,
  existing?: LearningTask,
): Promise<void> {
  const value = await apiRequest(auth, existing ? `/${existing.id}` : '', {
    method: existing ? 'PUT' : 'POST',
    body: JSON.stringify(
      existing ? { ...input, revision: existing.revision } : input,
    ),
  });
  if (!record(value) || !isTask(value.data))
    throw new Error('저장 응답이 올바르지 않습니다. 목록을 새로고침하세요.');
}
