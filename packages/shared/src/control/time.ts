import type { ControlData, TimeSession } from './types.ts';
import { assertControlData } from './validation.ts';

const overlaps = (a: TimeSession, b: TimeSession) =>
  a.startedAt < (b.endedAt ?? Infinity) &&
  b.startedAt < (a.endedAt ?? Infinity);
const MAX_SESSION_MS = 86_400_000;
const MAX_SESSIONS = 10_000;

const segmentId = (originalId: string, index: number, used: Set<string>) => {
  let attempt = 0;
  while (true) {
    const suffix = attempt === 0 ? `~${index}` : `~${index}-${attempt}`;
    const candidate = `${originalId.slice(0, 100 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
    attempt += 1;
  }
};

export function closeActiveSessions(
  data: ControlData,
  shouldClose: (session: TimeSession) => boolean,
  now: number,
  reservedIds: string[] = [],
): TimeSession[] {
  const activeIds = new Set(
    data.sessions
      .filter((session) => session.endedAt === null && shouldClose(session))
      .map((session) => session.id),
  );
  const used = new Set(
    data.sessions
      .filter((session) => !activeIds.has(session.id))
      .map((session) => session.id),
  );
  for (const id of reservedIds) used.add(id);
  const sessions = data.sessions.flatMap((session) => {
    if (session.endedAt !== null || !shouldClose(session)) return [session];
    if (session.startedAt === now) return [];
    const parts: TimeSession[] = [];
    let startedAt = session.startedAt;
    let index = 0;
    while (startedAt < now) {
      const endedAt = Math.min(startedAt + MAX_SESSION_MS, now);
      const id = index === 0 ? session.id : segmentId(session.id, index, used);
      used.add(id);
      parts.push({ ...session, id, startedAt, endedAt });
      startedAt = endedAt;
      index += 1;
    }
    return parts;
  });
  if (sessions.length + reservedIds.length > MAX_SESSIONS)
    throw new Error(
      '시간 기록 한도를 초과하여 작업을 완료할 수 없습니다. 기록을 내보내고 보관해 주세요.',
    );
  return sessions;
}

export function startTimer(
  data: ControlData,
  taskId: string,
  sessionId: string,
  now: number,
): ControlData {
  assertControlData(data, now);
  const task = data.tasks.find((candidate) => candidate.id === taskId);
  if (!task || task.archived || task.status === 'done')
    throw new Error('이 작업에는 타이머를 시작할 수 없습니다.');
  if (data.projects.find((project) => project.id === task.projectId)?.archived)
    throw new Error('보관된 프로젝트에는 타이머를 시작할 수 없습니다.');
  if (
    data.tasks.some(
      (candidate) => candidate.parentId === taskId && !candidate.archived,
    )
  )
    throw new Error('하위 작업이 있는 부모에는 타이머를 시작할 수 없습니다.');
  if (data.sessions.some((session) => session.id === sessionId))
    throw new Error('이미 사용 중인 세션 ID입니다.');
  const closed = closeActiveSessions(data, () => true, now, [sessionId]);
  const sessions = [
    ...closed,
    {
      id: sessionId,
      taskId,
      projectId: task.projectId,
      startedAt: now,
      endedAt: null,
      source: 'timer' as const,
    },
  ];
  const next = { ...data, sessions };
  assertControlData(next, now);
  return next;
}

export function stopTimer(data: ControlData, now: number): ControlData {
  assertControlData(data, now);
  const next = {
    ...data,
    sessions: closeActiveSessions(data, () => true, now),
  };
  assertControlData(next, now);
  return next;
}

export function saveTimeSession(
  data: ControlData,
  input: TimeSession,
  now: number,
): ControlData {
  assertControlData(data, now);
  if (input.startedAt > now || (input.endedAt !== null && input.endedAt > now))
    throw new Error('미래 시간은 기록할 수 없습니다.');
  if (input.endedAt === null || input.endedAt <= input.startedAt)
    throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.');
  if (input.endedAt - input.startedAt > 86_400_000)
    throw new Error('단일 기록은 24시간을 넘을 수 없습니다.');
  if (input.source !== 'manual')
    throw new Error('수동 기록의 출처가 올바르지 않습니다.');
  if (
    data.sessions.some(
      (session) => session.id !== input.id && overlaps(session, input),
    )
  )
    throw new Error('다른 시간 기록과 겹칩니다.');
  const exists = data.sessions.some((session) => session.id === input.id);
  const next = {
    ...data,
    sessions: exists
      ? data.sessions.map((session) =>
          session.id === input.id ? { ...input } : session,
        )
      : [...data.sessions, { ...input }],
  };
  try {
    assertControlData(next, now);
  } catch {
    throw new Error('시간 기록 입력이 올바르지 않습니다.');
  }
  return next;
}

export function resolveLegacyTimer(
  data: ControlData,
  date: string,
  endedAt: number | null,
  sessionId: string,
  now: number,
): ControlData {
  assertControlData(data, now);
  const candidate = data.legacyActive.find((timer) => timer.date === date);
  if (!candidate) throw new Error('복구할 기존 타이머를 찾을 수 없습니다.');
  const without = {
    ...data,
    legacyActive: data.legacyActive.filter((timer) => timer.date !== date),
  };
  if (endedAt === null) return without;
  const task = data.tasks.find((item) => item.id === candidate.taskId);
  if (!task) throw new Error('기존 타이머의 작업을 찾을 수 없습니다.');
  return saveTimeSession(
    without,
    {
      id: sessionId,
      taskId: task.id,
      projectId: task.projectId,
      startedAt: candidate.startedAt,
      endedAt,
      source: 'manual',
    },
    now,
  );
}

export function sessionSeconds(
  sessions: TimeSession[],
  from: number,
  until: number,
  projectId?: string,
): number {
  if (!Number.isFinite(from) || !Number.isFinite(until) || until < from)
    throw new Error('집계 시간 범위가 올바르지 않습니다.');
  return Math.floor(
    sessions.reduce((total, session) => {
      if (projectId !== undefined && session.projectId !== projectId)
        return total;
      const end = session.endedAt ?? until;
      return (
        total +
        Math.max(0, Math.min(end, until) - Math.max(session.startedAt, from))
      );
    }, 0) / 1000,
  );
}
