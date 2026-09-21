import { useEffect, useState } from 'react';
import {
  leafTasks,
  startTimer,
  stopTimer,
  type ControlData,
} from '@cockpit/shared/control';
import { Button } from '@/components/ui/button';
import { formatSeconds } from './format';

export function WorkspaceTimer({
  data,
  busy,
  onSave,
  onError,
}: {
  data: ControlData;
  busy: boolean;
  onSave(data: ControlData): Promise<boolean>;
  onError(message: string): void;
}) {
  const [chosen, setChosen] = useState('');
  const [tick, setTick] = useState(Date.now());
  const active = data.sessions.find((s) => s.endedAt === null);
  const task = data.tasks.find((t) => t.id === active?.taskId);
  const available = leafTasks(data).filter(
    (t) =>
      t.status !== 'done' &&
      t.status !== 'blocked' &&
      data.projects.some((p) => p.id === t.projectId && !p.archived),
  );
  const selected = available.some((t) => t.id === chosen)
    ? chosen
    : (available[0]?.id ?? '');
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active?.id]);
  async function act() {
    try {
      await onSave(
        active
          ? stopTimer(data, Date.now())
          : startTimer(data, selected, crypto.randomUUID(), Date.now()),
      );
    } catch (error) {
      onError(
        error instanceof Error ? error.message : '시간을 기록하지 못했습니다.',
      );
    }
  }
  return (
    <section
      className={`workspace-timer ${active ? 'running' : ''}`}
      aria-label="시간 측정"
    >
      {active ? (
        <>
          <div>
            <small>지금 기록 중</small>
            <strong>{task?.title}</strong>
          </div>
          <time>
            {formatSeconds(Math.max(0, (tick - active.startedAt) / 1000))}
          </time>
          {tick - active.startedAt >= 28_800_000 && (
            <small>8시간 이상 기록 중 · 확인하세요</small>
          )}
        </>
      ) : (
        <>
          <span>시간 측정</span>
          <select
            aria-label="측정할 할 일"
            value={selected}
            disabled={busy || !available.length}
            onChange={(e) => setChosen(e.target.value)}
          >
            {!available.length && (
              <option value="">할 일을 먼저 적어보세요</option>
            )}
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {data.projects.find((p) => p.id === t.projectId)?.name} ·{' '}
                {t.title}
              </option>
            ))}
          </select>
        </>
      )}
      <Button
        disabled={busy || (!active && !selected)}
        onClick={() => void act()}
        aria-label={active ? '타이머 종료' : '타이머 시작'}
      >
        {active ? '■ 종료' : '▶ 시작'}
      </Button>
    </section>
  );
}
