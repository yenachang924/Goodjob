import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Slot } from '@cockpit/shared';
import {
  leafTasks,
  sessionSeconds,
  type ControlData,
  type ControlDay,
} from '@cockpit/shared/control';
import { formatMinutes, formatSeconds, todayKey } from './format';

type PlanProps = {
  data: ControlData;
  busy: boolean;
  onSave(next: ControlData): Promise<boolean>;
  selectedDate?: string;
  onDateChange?(date: string): void;
};

export function TodayPlan(props: PlanProps) {
  const [localDate, setDate] = useState(todayKey);
  const date = props.selectedDate ?? localDate;
  return (
    <>
      <label>
        계획 날짜
        <Input
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          value={date}
          disabled={props.busy}
          onChange={(event) => {
            const value = event.target.value;
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
              if (props.onDateChange) props.onDateChange(value);
              else setDate(value);
            }
          }}
        />
      </label>
      <p className="muted">
        날짜를 바꾸면 저장하지 않은 초안은 취소됩니다. 과거의 확정 계획도 직접
        조정할 수 있어요.
      </p>
      <DayPlan key={date} {...props} date={date} />
    </>
  );
}

function DayPlan({
  data,
  busy,
  onSave,
  date: key,
}: PlanProps & { date: string }) {
  const day = data.days[key] ?? { capacity: 240, buffer: 30, confirmed: null };
  const [capacity, setCapacity] = useState(day.capacity);
  const [buffer, setBuffer] = useState(day.buffer);
  const [draft, setDraft] = useState<Slot[] | null>(null);
  const visibleProjects = new Set(
    data.projects
      .filter((project) => !project.archived)
      .map((project) => project.id),
  );
  const leaf = leafTasks(data).filter(
    (task) =>
      visibleProjects.has(task.projectId) &&
      task.status !== 'done' &&
      task.status !== 'blocked',
  );
  const plan = draft ?? day.confirmed ?? [];
  const plannedMinutes = plan.reduce((sum, item) => sum + item.minutes, 0);
  const unallocated = capacity - buffer - plannedMinutes;
  const todayStart = new Date(`${key}T00:00:00+09:00`).getTime();
  const tracked = sessionSeconds(
    data.sessions.filter((session) => session.endedAt !== null),
    todayStart,
    Math.max(todayStart, Math.min(Date.now(), todayStart + 86_400_000)),
  );
  const criteriaChanged = capacity !== day.capacity || buffer !== day.buffer;
  function propose() {
    let remaining = Math.max(0, capacity - buffer);
    const next = leaf
      .toSorted(
        (a, b) =>
          a.priority - b.priority ||
          (a.due || '9999').localeCompare(b.due || '9999'),
      )
      .reduce<Slot[]>((slots, task) => {
        if (task.minutes === 0 || task.minutes > remaining) return slots;
        remaining -= task.minutes;
        const project = data.projects.find(
          (item) => item.id === task.projectId,
        );
        return [
          ...slots,
          {
            taskId: task.id,
            title: task.title,
            project: project?.name ?? '',
            minutes: task.minutes,
          },
        ];
      }, []);
    setDraft(next);
  }
  async function confirm() {
    const nextDay: ControlDay = { capacity, buffer, confirmed: plan };
    if (await onSave({ ...data, days: { ...data.days, [key]: nextDay } }))
      setDraft(null);
  }
  return (
    <section>
      <div className="view-heading">
        <div>
          <p className="eyebrow">PLAN · {key}</p>
          <h2>{key === todayKey() ? '오늘 계획' : `${key} 계획`}</h2>
          <p>등록한 가용시간 안에서 초안을 조정하고 확정하세요.</p>
        </div>
      </div>
      <div className="time-summary today-summary">
        <article>
          <span>등록한 가용시간</span>
          <strong>{formatMinutes(capacity)}</strong>
        </article>
        <article>
          <span>완충 제외 미배치</span>
          <strong>{formatMinutes(unallocated)}</strong>
        </article>
        <article>
          <span>선택한 날짜 실제 기록</span>
          <strong>{formatSeconds(tracked)}</strong>
        </article>
      </div>
      <div className="today-grid">
        <div className="control-panel">
          <h3>계획 기준</h3>
          <div className="control-form-grid">
            <label>
              등록한 가용시간 · 분
              <Input
                type="number"
                min={0}
                max={1440}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </label>
            <label>
              완충시간 · 분
              <Input
                type="number"
                min={0}
                max={capacity}
                value={buffer}
                onChange={(e) => setBuffer(Number(e.target.value))}
              />
            </label>
          </div>
          <Button variant="outline" onClick={propose}>
            우선순위로 초안 만들기
          </Button>
          <p className="muted">
            예상 시간이 미정인 작업은 시간을 입력한 뒤 배치할 수 있습니다.
            시계에 따라 줄어드는 시간이 아니라 직접 등록한 작업 예산입니다. 막힌
            작업과 보관된 프로젝트는 추천에서 제외합니다.
          </p>
        </div>
        <div className="control-panel">
          <div className="task-list-heading">
            <h3>
              {draft
                ? '추천 초안'
                : day.confirmed
                  ? '확정된 계획'
                  : '계획 대기'}
            </h3>
            <span>{formatMinutes(plannedMinutes)}</span>
          </div>
          {plan.length === 0 ? (
            <div className="control-empty small">
              <p>
                미완료 실행 작업 {leaf.length}개가 있습니다. 초안을 만들거나
                아래에서 직접 선택하세요.
              </p>
            </div>
          ) : (
            plan.map((slot, index) => (
              <div className="plan-row" key={slot.taskId}>
                <span>{index + 1}</span>
                <div>
                  <strong>{slot.title}</strong>
                  <small>
                    {slot.project} · {slot.minutes}분
                  </small>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft(plan.filter((item) => item.taskId !== slot.taskId))
                  }
                >
                  제외
                </Button>
              </div>
            ))
          )}
          <div className="plan-picker">
            {leaf
              .filter((task) => !plan.some((slot) => slot.taskId === task.id))
              .map((task) => (
                <Button
                  key={task.id}
                  size="sm"
                  variant="outline"
                  disabled={task.minutes === 0}
                  onClick={() => {
                    const project = data.projects.find(
                      (item) => item.id === task.projectId,
                    );
                    setDraft([
                      ...plan,
                      {
                        taskId: task.id,
                        title: task.title,
                        project: project?.name ?? '',
                        minutes: task.minutes,
                      },
                    ]);
                  }}
                >
                  + {task.title}
                </Button>
              ))}
          </div>
          <Button
            disabled={busy || (!draft && !criteriaChanged)}
            onClick={() => void confirm()}
          >
            이 계획 확정
          </Button>
        </div>
      </div>
    </section>
  );
}
