import type { ControlData } from './types.ts';
import { leafTasks } from './tasks.ts';
import { sessionSeconds } from './time.ts';

const KOREA_OFFSET = 9 * 60 * 60 * 1000;
const dayStart = (now: number) =>
  Math.floor((now + KOREA_OFFSET) / 86_400_000) * 86_400_000 - KOREA_OFFSET;
const weekStart = (now: number) => {
  const start = dayStart(now);
  const weekday = new Date(start + KOREA_OFFSET).getUTCDay();
  return start - ((weekday + 6) % 7) * 86_400_000;
};

export function projectSummary(
  data: ControlData,
  projectId: string,
  now: number,
) {
  const leaves = leafTasks(data, projectId);
  const confirmedSessions = data.sessions.filter(
    (session) => session.endedAt !== null,
  );
  const week = weekStart(now);
  const unfinished = leaves.filter((task) => task.status !== 'done');
  return {
    total: leaves.length,
    done: leaves.filter((task) => task.status === 'done').length,
    remaining: unfinished.length,
    blocked: leaves.filter((task) => task.status === 'blocked').length,
    overdue: unfinished.filter(
      (task) =>
        task.due !== '' &&
        task.due <
          new Date(dayStart(now) + KOREA_OFFSET).toISOString().slice(0, 10),
    ).length,
    remainingMinutes: unfinished.reduce((sum, task) => sum + task.minutes, 0),
    weekAdded: leaves.filter(
      (task) =>
        task.createdAt !== null &&
        task.createdAt >= week &&
        task.createdAt <= now,
    ).length,
    weekDone: leaves.filter(
      (task) =>
        task.status === 'done' &&
        task.completedAt !== null &&
        task.completedAt >= week &&
        task.completedAt <= now,
    ).length,
    todaySeconds: sessionSeconds(
      confirmedSessions,
      dayStart(now),
      now,
      projectId,
    ),
    weekSeconds: sessionSeconds(confirmedSessions, week, now, projectId),
  };
}
