import { useEffect, useState } from 'react';
import {
  leafTasks,
  setTaskStatus,
  startTimer,
  taskStatus,
  type ControlData,
} from '@cockpit/shared/control';
import { Button } from '@/components/ui/button';
import { todayKey } from './format';
import { QuickCapture } from './quick-capture';
import { TodayPlan } from './today-plan';
import { AREAS } from './activity-sidebar';
import { monthCells, shiftMonth, tasksOnDate } from './today-view-model';

const LAST_PROJECT_KEY = 'cockpit.capture.last-project';
export function TodayHome({
  data,
  busy,
  onSave,
  onError,
  onProject,
}: {
  data: ControlData;
  busy: boolean;
  onSave(data: ControlData): Promise<boolean>;
  onError(message: string): void;
  onProject(id: string): void;
}) {
  const [date, setDate] = useState(todayKey);
  const [month, setMonth] = useState(todayKey);
  const [area, setArea] = useState('all');
  const [project, setProject] = useState('');
  useEffect(() => {
    try {
      setProject(localStorage.getItem(LAST_PROJECT_KEY) ?? '');
    } catch {
      /* Optional preference. */
    }
  }, []);
  const selectedProject = data.projects.some(
    (p) => p.id === project && p.id !== 'cockpit-inbox' && !p.archived,
  )
    ? project
    : '';
  const filtered = {
    ...data,
    projects: data.projects.filter(
      (p) => area === 'all' || (p.area ?? '') === area,
    ),
  };
  const tasks = tasksOnDate(filtered, date);
  const leaves = new Set(leafTasks(data).map((t) => t.id));
  async function apply(make: () => ControlData) {
    try {
      await onSave(make());
    } catch (error) {
      onError(error instanceof Error ? error.message : '변경할 수 없습니다.');
    }
  }
  function chooseProject(id: string) {
    setProject(id);
    try {
      localStorage.setItem(LAST_PROJECT_KEY, id);
    } catch {
      /* Optional preference. */
    }
  }
  async function saveCapture(next: ControlData) {
    const saved = await onSave(next);
    const projectArea =
      data.projects.find((p) => p.id === selectedProject)?.area ?? '';
    if (saved && area !== 'all' && area !== projectArea) setArea('all');
    return saved;
  }
  return (
    <section className="today-home">
      <div className="view-heading">
        <div>
          <p className="eyebrow">MY DAY</p>
          <h2>{date === todayKey() ? '오늘' : date}</h2>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setDate(todayKey());
            setMonth(todayKey());
          }}
        >
          오늘로
        </Button>
      </div>
      <div className="area-filters" aria-label="오늘 영역 필터">
        {[{ id: 'all', label: '전체' }, ...AREAS].map((a) => (
          <button
            key={a.id}
            aria-pressed={area === a.id}
            onClick={() => setArea(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="today-focus-layout">
        <section className="month-calendar" aria-label="할 일 캘린더">
          <header>
            <button
              aria-label="이전 달"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              ‹
            </button>
            <h3>{month.slice(0, 7).replace('-', '년 ')}월</h3>
            <button
              aria-label="다음 달"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              ›
            </button>
          </header>
          <div className="calendar-grid">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <span key={day} className="weekday">
                {day}
              </span>
            ))}
            {monthCells(month).map((day) => {
              const dayTasks = tasksOnDate(filtered, day);
              return (
                <button
                  key={day}
                  className={`${day.slice(0, 7) !== month.slice(0, 7) ? 'outside' : ''} ${day === todayKey() ? 'is-today' : ''}`}
                  aria-label={`${day} 할 일 ${dayTasks.length}개`}
                  aria-pressed={day === date}
                  onClick={() => setDate(day)}
                >
                  <span>{Number(day.slice(-2))}</span>
                  <small>{dayTasks.length ? `${dayTasks.length}개` : ''}</small>
                </button>
              );
            })}
          </div>
        </section>
        <section className="day-task-panel" aria-label="선택한 날짜 할 일">
          <div className="task-list-heading">
            <h3>{date.slice(5).replace('-', '월 ')}일 할 일</h3>
            <span>{tasks.length}개</span>
          </div>
          <label className="capture-project">
            등록할 활동
            <select
              aria-label="빠른 기록 소속"
              value={selectedProject}
              onChange={(e) => chooseProject(e.target.value)}
            >
              <option value="">미분류</option>
              {data.projects
                .filter((p) => !p.archived && p.id !== 'cockpit-inbox')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <QuickCapture
            data={data}
            busy={busy}
            onSave={saveCapture}
            onError={onError}
            projectId={selectedProject || undefined}
            scheduledFor={date}
            inputId="workspace-quick-capture"
          />
          {tasks.length === 0 && (
            <p className="day-empty">
              아직 할 일이 없어요. 위에 한 줄만 적어보세요.
            </p>
          )}
          {tasks.map((task) => (
            <article
              key={task.id}
              className={`day-task ${taskStatus(data, task.id) === 'done' ? 'is-done' : ''}`}
            >
              <input
                type="checkbox"
                aria-label={`${task.title} 완료`}
                checked={taskStatus(data, task.id) === 'done'}
                disabled={busy || !leaves.has(task.id)}
                onChange={(e) =>
                  void apply(() =>
                    setTaskStatus(
                      data,
                      task.id,
                      e.target.checked ? 'done' : 'todo',
                      Date.now(),
                    ),
                  )
                }
              />
              <div>
                <strong>{task.title}</strong>
                <small>
                  <button onClick={() => onProject(task.projectId)}>
                    {data.projects.find((p) => p.id === task.projectId)?.name}
                  </button>{' '}
                  · {task.minutes ? `${task.minutes}분` : '예상 시간 미정'}
                  {task.due === date ? ' · 마감' : ''}
                  {task.scheduledFor === date ? ' · 예정' : ''}
                </small>
              </div>
              {leaves.has(task.id) && task.status !== 'done' && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`${task.title} 타이머 시작`}
                  disabled={busy || task.status === 'blocked'}
                  onClick={() =>
                    void apply(() =>
                      startTimer(
                        data,
                        task.id,
                        crypto.randomUUID(),
                        Date.now(),
                      ),
                    )
                  }
                >
                  ▶
                </Button>
              )}
            </article>
          ))}
        </section>
      </div>
      <details className="planning-details">
        <summary>가용시간과 시간 배치 조정</summary>
        <TodayPlan
          data={data}
          busy={busy}
          onSave={onSave}
          selectedDate={date}
          onDateChange={(value) => {
            setDate(value);
            setMonth(value);
          }}
        />
      </details>
    </section>
  );
}
