import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  leafTasks,
  saveTimeSession,
  sessionSeconds,
  type ControlData,
  type TimeSession,
} from '@cockpit/shared/control';
import { fromLocalDateTime, localDateTime, todayKey } from './format';
import { editedDurationRange, trackedDuration } from './time-duration';

export function TimeRecords({
  data,
  busy,
  onSave,
  onError,
}: {
  data: ControlData;
  busy: boolean;
  onSave(next: ControlData): Promise<boolean>;
  onError(message: string): void;
}) {
  const now = Date.now();
  const [editing, setEditing] = useState<TimeSession | 'new' | null>(null);
  const initial =
    editing === 'new'
      ? {
          id: '',
          taskId: '',
          projectId: '',
          startedAt: now - 1_800_000,
          endedAt: now,
          source: 'manual' as const,
        }
      : editing;
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [date, setDate] = useState(todayKey());
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [durationChanged, setDurationChanged] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const todayStart = new Date(`${todayKey()}T00:00:00+09:00`).getTime();
  const calendarDay = new Date(`${todayKey()}T00:00:00Z`);
  calendarDay.setUTCDate(
    calendarDay.getUTCDate() - ((calendarDay.getUTCDay() + 6) % 7),
  );
  const monday = new Date(
    `${calendarDay.toISOString().slice(0, 10)}T00:00:00+09:00`,
  );
  const sessions = data.sessions.toSorted((a, b) => b.startedAt - a.startedAt);
  const closedSessions = data.sessions.filter(
    (session) => session.endedAt !== null,
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!initial || !initial.taskId) {
      onError('기록할 작업을 선택하세요.');
      return;
    }
    const task = data.tasks.find((item) => item.id === initial.taskId);
    if (!task) return;
    const originalStart =
      initial.id && start === localDateTime(initial.startedAt)
        ? initial.startedAt
        : fromLocalDateTime(start);
    const originalEnd =
      initial.id &&
      initial.endedAt !== null &&
      end === localDateTime(initial.endedAt)
        ? initial.endedAt
        : fromLocalDateTime(end);
    try {
      const range = advanced
        ? { startedAt: originalStart, endedAt: originalEnd }
        : editedDurationRange(
            initial.id && initial.endedAt !== null
              ? { startedAt: initial.startedAt, endedAt: initial.endedAt }
              : null,
            date,
            hours,
            minutes,
            durationChanged,
            Date.now(),
          );
      const value = {
        ...initial,
        id: initial.id || crypto.randomUUID(),
        projectId: task.projectId,
        ...range,
        source: 'manual' as const,
      };
      if (await onSave(saveTimeSession(data, value, Date.now())))
        setEditing(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '시간 기록을 저장할 수 없습니다.',
      );
    }
  }
  function open(value: TimeSession | 'new') {
    const record =
      value === 'new' ? { startedAt: now - 1_800_000, endedAt: now } : value;
    setStart(localDateTime(record.startedAt));
    setEnd(localDateTime(record.endedAt ?? now));
    setDate(
      value === 'new'
        ? todayKey()
        : localDateTime(record.startedAt).slice(0, 10),
    );
    const totalMinutes = Math.floor(
      ((record.endedAt ?? now) - record.startedAt) / 60_000,
    );
    setHours(value === 'new' ? '' : String(Math.floor(totalMinutes / 60)));
    setMinutes(value === 'new' ? '' : String(totalMinutes % 60));
    setDurationChanged(false);
    setAdvanced(false);
    setEditing(value);
  }
  return (
    <section>
      <div className="view-heading">
        <div>
          <p className="eyebrow">TIME RECORDS</p>
          <h2>시간 기록</h2>
          <p>타이머와 수동 기록을 프로젝트별로 비교합니다.</p>
        </div>
        <Button onClick={() => open('new')}>수동 기록 추가</Button>
      </div>
      <div className="time-summary">
        <article>
          <span>오늘 기록</span>
          <strong>
            {trackedDuration(sessionSeconds(closedSessions, todayStart, now))}
          </strong>
        </article>
        <article>
          <span>이번 주 기록</span>
          <strong>
            {trackedDuration(
              sessionSeconds(closedSessions, monday.getTime(), now),
            )}
          </strong>
        </article>
        <article>
          <span>완료된 세션</span>
          <strong>{closedSessions.length}개</strong>
        </article>
      </div>
      {editing && initial && (
        <form className="control-form time-editor" onSubmit={submit}>
          <h3>{initial.id ? '기록 수정' : '수동 기록 추가'}</h3>
          {!advanced && (
            <>
              <label>
                기록 날짜
                <Input
                  type="date"
                  required
                  max={todayKey()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <div className="duration-inputs">
                <label>
                  기록 시간
                  <Input
                    aria-label="기록 시간"
                    type="number"
                    min="0"
                    max="24"
                    step="1"
                    placeholder="0"
                    value={hours}
                    onChange={(e) => {
                      setHours(e.target.value);
                      setDurationChanged(true);
                    }}
                  />
                  시간
                </label>
                <label>
                  기록 분
                  <Input
                    aria-label="기록 분"
                    type="number"
                    min="0"
                    max="59"
                    step="1"
                    placeholder="0"
                    value={minutes}
                    onChange={(e) => {
                      setMinutes(e.target.value);
                      setDurationChanged(true);
                    }}
                  />
                  분
                </label>
              </div>
              <p className="form-hint">
                오늘은 저장 시각, 지난 날짜는 그날 자정을 종료 시각으로
                계산합니다. 기존 기록과 겹치면 시작·종료를 직접 지정하세요.
              </p>
            </>
          )}
          <label>
            <input
              type="checkbox"
              checked={advanced}
              onChange={(e) => setAdvanced(e.target.checked)}
            />
            시작·종료 직접 지정
          </label>
          <label>
            작업
            <select
              required
              value={initial.taskId}
              onChange={(e) =>
                setEditing({ ...initial, taskId: e.target.value })
              }
            >
              <option value="">선택</option>
              {data.tasks
                .filter(
                  (task) =>
                    task.parentId !== null ||
                    !data.tasks.some((child) => child.parentId === task.id),
                )
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
            </select>
          </label>
          {advanced && (
            <>
              <label>
                시작
                <Input
                  type="datetime-local"
                  step="1"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                종료
                <Input
                  type="datetime-local"
                  step="1"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              취소
            </Button>
            <Button type="submit" disabled={busy}>
              기록 저장
            </Button>
          </div>
        </form>
      )}
      <div className="records-layout">
        <div className="records-list">
          <h3>최근 세션</h3>
          {sessions.length === 0 ? (
            <div className="control-empty small">
              <p>아직 기록된 시간이 없습니다.</p>
            </div>
          ) : (
            sessions.map((session) => {
              const task = data.tasks.find(
                (item) => item.id === session.taskId,
              );
              const project = data.projects.find(
                (item) => item.id === session.projectId,
              );
              return (
                <button
                  key={session.id}
                  className="record-row"
                  disabled={session.endedAt === null}
                  onClick={() => open(session)}
                >
                  <div>
                    <strong>{task?.title ?? '보관된 작업'}</strong>
                    <span>
                      {project?.name ?? '보관된 프로젝트'} ·{' '}
                      {session.source === 'manual' ? '수동' : '타이머'}
                    </span>
                  </div>
                  <span>
                    {session.endedAt
                      ? trackedDuration(
                          (session.endedAt - session.startedAt) / 1000,
                        )
                      : '진행 중'}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="project-time">
          <h3>프로젝트 비교</h3>
          {data.projects
            .filter((project) => !project.archived)
            .map((project) => {
              const estimated = leafTasks(data, project.id).reduce(
                (sum, task) => sum + task.minutes,
                0,
              );
              const actual = sessionSeconds(closedSessions, 0, now, project.id);
              return (
                <div key={project.id}>
                  <span>{project.name}</span>
                  <strong>
                    {estimated > 0 ? `${estimated}분` : '미정'} 예상 ·{' '}
                    {trackedDuration(actual)} 기록
                  </strong>
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
}
