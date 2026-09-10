'use client';
import { useEffect, useState } from 'react';
import { workspaceRequest } from '@/features/auth/client';
import { BackupControls } from './backup-controls';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Clock3,
  MessageSquare,
  Plus,
  ArrowUp,
  ArrowDown,
  Check,
  Play,
  Pause,
  Pencil,
  X,
} from 'lucide-react';
import {
  defaultDay,
  initialData,
  recommend,
  total,
  validData,
  type Data,
  type Day,
  type Slot,
  type Task,
} from '@cockpit/shared';
const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(
    new Date(),
  );
const duration = (n: number) =>
  `${Math.floor(Math.abs(n) / 60)}시간 ${Math.abs(n) % 60}분${n < 0 ? ' 초과' : ''}`;
const blankTask = (): Task => ({
  id: '',
  project: initialData.projects[0],
  title: '',
  minutes: 30,
  priority: 2,
  done: false,
  due: '',
});
export default function Page() {
  const [data, setData] = useState<Data>(initialData),
    [revision, setRevision] = useState(0),
    [date, setDate] = useState('');
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [draft, setDraft] = useState<Slot[] | null>(null),
    [capacity, setCapacity] = useState(240),
    [buffer, setBuffer] = useState(30);
  const [task, setTask] = useState<Task>(blankTask),
    [editing, setEditing] = useState(false),
    [chat, setChat] = useState(false);
  const [tick, setTick] = useState(0),
    [notice, setNotice] = useState('');
  const day: Day = data.days[date] || defaultDay(),
    plan = draft ?? day.confirmed ?? [],
    planned = total(plan),
    over = planned + buffer > capacity;
  const pending = data.tasks.filter((t) => !t.done);
  useEffect(() => {
    workspaceRequest()
      .then(async (response) => {
        const r = (await response.json()) as {
          data: unknown;
          revision: number;
          error?: string;
        };
        if (!response.ok || !validData(r.data))
          throw new Error(r.error || '데이터를 확인할 수 없습니다.');
        setData(r.data);
        setDate(today());
        setTick(Date.now());
        setRevision(r.revision);
        const d = r.data.days[today()] || defaultDay();
        setCapacity(d.capacity);
        setBuffer(d.buffer);
        setReady(true);
      })
      .catch((e) => setError(e.message));
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!date || today() === date || busy) return;
    const timer = setTimeout(() => {
      const next = today();
      const nextDay = data.days[next] || defaultDay();
      setDate(next);
      setCapacity(nextDay.capacity);
      setBuffer(nextDay.buffer);
      setDraft(null);
      setNotice('날짜가 바뀌어 오늘의 계획으로 전환했습니다.');
    }, 0);
    return () => clearTimeout(timer);
  }, [tick, date, busy, data.days]);
  async function save(next: Data) {
    if (busy || !ready) return false;
    if (!validData(next)) {
      setError('가용시간, 완충시간과 작업 입력을 확인하세요.');
      return false;
    }
    setBusy(true);
    setError('');
    try {
      const response = await workspaceRequest({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: next, revision }),
      });
      const r = (await response.json()) as { revision: number; error?: string };
      if (!response.ok) throw new Error(r.error);
      setData(next);
      setRevision(r.revision);
      setNotice('저장됨');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const saveDay = (next: Day) =>
    save({ ...data, days: { ...data.days, [date]: next } });
  function propose() {
    if (
      !Number.isInteger(capacity) ||
      !Number.isInteger(buffer) ||
      capacity < 0 ||
      capacity > 1440 ||
      buffer < 0 ||
      buffer > capacity
    ) {
      setError('가용시간은 0~1440분, 완충시간은 가용시간 이내로 입력하세요.');
      return;
    }
    setError('');
    setDraft(recommend(data.tasks, capacity, buffer));
    setNotice(
      '중요도 → 마감 순으로 배치한 초안입니다. 확정 전에는 기존 계획이 유지됩니다.',
    );
  }
  function toggle(t: Task) {
    setDraft(
      plan.some((s) => s.taskId === t.id)
        ? plan.filter((s) => s.taskId !== t.id)
        : [
            ...plan,
            {
              taskId: t.id,
              title: t.title,
              project: t.project,
              minutes: t.minutes,
            },
          ],
    );
  }
  function move(index: number, offset: number) {
    const other = index + offset;
    if (other < 0 || other >= plan.length) return;
    setDraft(
      plan.map((s, i) =>
        i === index ? plan[other] : i === other ? plan[index] : s,
      ),
    );
  }
  async function submitTask(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      ...task,
      id: task.id || crypto.randomUUID(),
      title: task.title.trim(),
      project: task.project.trim(),
    };
    const tasks = task.id
      ? data.tasks.map((t) => (t.id === task.id ? next : t))
      : [...data.tasks, next];
    const projects = data.projects.includes(next.project)
      ? data.projects
      : [...data.projects, next.project];
    if (await save({ ...data, projects, tasks })) {
      setEditing(false);
      setTask(blankTask());
    }
  }
  async function complete(id: string) {
    const nextDay = {
      ...day,
      active: day.active?.taskId === id ? null : day.active,
    };
    await save({
      ...data,
      tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      days: { ...data.days, [date]: nextDay },
    });
  }
  const active =
    day.active && day.confirmed?.find((s) => s.taskId === day.active?.taskId);
  const elapsed = day.active
    ? Math.max(0, Math.floor((tick - day.active.startedAt) / 1000))
    : 0;
  const dateLabel = date
    ? new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'full',
        timeZone: 'Asia/Seoul',
      }).format(new Date(`${date}T12:00:00+09:00`))
    : '오늘';
  return (
    <main className="workspace">
      <header className="topline">
        <div className="brand">
          <Clock3 size={20} /> 오늘의 관제판
        </div>
        <span className="save-status">
          {busy ? '저장 중…' : ready ? '클라우드 저장' : '불러오는 중…'}
        </span>
      </header>
      <section className="page-heading">
        <div>
          <p className="eyebrow">MY WORKSPACE</p>
          <h1>{dateLabel}</h1>
        </div>
        <Button
          disabled={!ready || busy}
          onClick={() => {
            setEditing(true);
            setTask(blankTask());
          }}
        >
          <Plus size={16} /> 할 일 추가
        </Button>
      </section>
      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <Button variant="outline" onClick={() => location.reload()}>
            새로고침
          </Button>
        </div>
      )}
      {!ready ? (
        <section className="panel">
          {error
            ? '연결을 복구한 뒤 저장된 작업을 불러옵니다.'
            : '저장된 프로젝트를 불러오고 있어요.'}
        </section>
      ) : (
        <>
          <section className="summary">
            <div>
              <span>등록한 오늘 가용시간</span>
              <strong>{duration(capacity)}</strong>
            </div>
            <div>
              <span>{draft ? '초안에 배치' : '확정된 작업시간'}</span>
              <strong>{duration(planned)}</strong>
            </div>
            <div>
              <span>완충 제외 미배치 여유</span>
              <strong className={over ? 'danger' : ''}>
                {duration(capacity - buffer - planned)}
              </strong>
            </div>
          </section>
          {active && (
            <section className="focus">
              <div>
                <span className="eyebrow">지금 진행 중</span>
                <h2>
                  {active.project} : {active.title}
                </h2>
              </div>
              <strong>
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
                {String(elapsed % 60).padStart(2, '0')}
              </strong>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => saveDay({ ...day, active: null })}
              >
                <Pause size={16} /> 종료
              </Button>
            </section>
          )}
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <div className="content-grid">
              <section className="panel">
                <div className="section-heading">
                  <h2>프로젝트 관제</h2>
                  <span>{pending.length}개 남음</span>
                </div>
                {data.tasks.length === 0 && (
                  <div className="empty">
                    <h3>오늘 해야 할 일부터 적어보세요.</h3>
                    <p>
                      과목과 프로젝트는 준비해뒀어요. 실제 할 일을 추가하면
                      시간에 맞춰 추천할게요.
                    </p>
                  </div>
                )}
                {data.projects.map((project) => {
                  const tasks = data.tasks.filter((t) => t.project === project),
                    done = tasks.filter((t) => t.done).length;
                  return (
                    <div className="project" key={project}>
                      <div className="project-heading">
                        <h3>{project}</h3>
                        <span>
                          {done}/{tasks.length} 완료
                        </span>
                      </div>
                      {tasks.length === 0 ? (
                        <p className="muted">등록된 할 일 없음</p>
                      ) : (
                        tasks.map((t) => (
                          <div className="task" key={t.id}>
                            <Checkbox
                              aria-label={`${t.title} 오늘 배치`}
                              disabled={busy || t.done}
                              checked={plan.some((s) => s.taskId === t.id)}
                              onCheckedChange={() => toggle(t)}
                            />
                            <div className="task-text">
                              <span className={t.done ? 'done' : ''}>
                                {t.title}
                              </span>
                              <small>
                                {t.minutes}분 ·{' '}
                                {['', '필수', '중요', '여유'][t.priority]}
                                {t.due ? ` · ${t.due} 마감` : ''}
                              </small>
                            </div>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              disabled={busy}
                              aria-label={`${t.title} 수정`}
                              onClick={() => {
                                setTask(t);
                                setEditing(true);
                              }}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              disabled={busy}
                              aria-label={t.done ? '완료 취소' : '완료 처리'}
                              onClick={() => complete(t.id)}
                            >
                              <Check size={16} />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </section>
              <aside className="panel schedule">
                <div className="section-heading">
                  <h2>{draft ? '추천안 조정' : '오늘의 계획'}</h2>
                  <span className="badge">
                    {draft ? '확정 대기' : day.confirmed ? '확정됨' : '미정'}
                  </span>
                </div>
                <div className="time-inputs">
                  <label htmlFor="capacity">
                    가용시간 · 분
                    <Input
                      id="capacity"
                      type="number"
                      min={0}
                      max={1440}
                      value={capacity}
                      onChange={(e) => {
                        setCapacity(Number(e.target.value));
                        setDraft(plan);
                      }}
                    />
                  </label>
                  <label htmlFor="buffer">
                    완충시간 · 분
                    <Input
                      id="buffer"
                      type="number"
                      min={0}
                      max={capacity}
                      value={buffer}
                      onChange={(e) => {
                        setBuffer(Number(e.target.value));
                        setDraft(plan);
                      }}
                    />
                  </label>
                </div>
                <Button variant="outline" disabled={busy} onClick={propose}>
                  시간에 맞춰 추천안 만들기
                </Button>
                <p className="muted">규칙 기반 추천 · 중요도와 마감 기준</p>
                {plan.length === 0 && (
                  <div className="empty">
                    왼쪽에서 할 일을 선택하거나 추천안을 만들어주세요.
                  </div>
                )}
                {plan.map((s, index) => (
                  <div className="slot" key={s.taskId}>
                    <div className="slot-number">{index + 1}</div>
                    <div className="slot-main">
                      <strong>{s.project}</strong>
                      <p>{s.title}</p>
                      <div className="slot-actions">
                        <label className="minutes" htmlFor={`slot-${s.taskId}`}>
                          <Input
                            id={`slot-${s.taskId}`}
                            type="number"
                            aria-label={`${s.title} 배치 시간`}
                            min={1}
                            max={1440}
                            value={s.minutes}
                            onChange={(e) =>
                              setDraft(
                                plan.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        minutes: Number(e.target.value),
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                          분
                        </label>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="위로"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="아래로"
                          disabled={index === plan.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="배치 제외"
                          onClick={() =>
                            setDraft(
                              plan.filter((item) => item.taskId !== s.taskId),
                            )
                          }
                        >
                          <X size={14} />
                        </Button>
                      </div>
                      {draft === null &&
                        !data.tasks.find((t) => t.id === s.taskId)?.done && (
                          <Button
                            variant="outline"
                            disabled={busy || !!day.active}
                            onClick={() =>
                              saveDay({
                                ...day,
                                active: {
                                  taskId: s.taskId,
                                  startedAt: Date.now(),
                                },
                              })
                            }
                          >
                            <Play size={14} /> 시작
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
                <div className="budget">
                  작업 {planned}분 + 완충 {buffer}분 / 가용 {capacity}분
                </div>
                {over && (
                  <p className="danger">
                    시간이 부족해요. 배치할 작업이나 시간을 줄여주세요.
                  </p>
                )}
                <Button
                  className="confirm"
                  disabled={
                    busy ||
                    over ||
                    (draft === null && day.confirmed !== null) ||
                    plan.some(
                      (s) => !Number.isInteger(s.minutes) || s.minutes < 1,
                    )
                  }
                  onClick={async () => {
                    if (
                      await saveDay({
                        capacity,
                        buffer,
                        confirmed: plan.map((s) => ({ ...s })),
                        active: null,
                      })
                    )
                      setDraft(null);
                  }}
                >
                  {day.confirmed ? '변경안 적용' : '오늘 계획 확정'}
                </Button>
                {draft && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDraft(null);
                      setCapacity(day.capacity);
                      setBuffer(day.buffer);
                    }}
                  >
                    변경 취소
                  </Button>
                )}
                <p className="muted" aria-live="polite">
                  {notice}
                </p>
              </aside>
            </div>
          </fieldset>
        </>
      )}
      {ready && (
        <BackupControls
          data={data}
          revision={revision}
          disabled={busy}
          onImport={save}
        />
      )}
      <Button className="chat-launcher" onClick={() => setChat(true)}>
        <MessageSquare size={17} /> 작업 도우미
      </Button>
      <Sheet open={chat} onOpenChange={setChat}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>작업 도우미</SheetTitle>
            <SheetDescription>LLM API 연결 준비 중</SheetDescription>
          </SheetHeader>
          <div className="assistant-body">
            <p>질문과 자연어 계획 조정은 API 연결 후 사용할 수 있어요.</p>
            <div className="assistant-context">
              <strong>현재 작업 현황</strong>
              <p>
                미완료 {pending.length}개 · 가용시간 {capacity}분
              </p>
              <p>
                배치 {planned}분 · 완충 {buffer}분
              </p>
            </div>
            <Button
              disabled={!ready || busy}
              onClick={() => {
                propose();
                setChat(false);
              }}
            >
              규칙 기반 추천안 만들기
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{task.id ? '할 일 수정' : '할 일 추가'}</SheetTitle>
            <SheetDescription>
              한 번에 끝낼 수 있는 크기로 적어주세요.
            </SheetDescription>
          </SheetHeader>
          <form className="task-form" onSubmit={submitTask}>
            <label htmlFor="task-project">
              프로젝트
              <Input
                id="task-project"
                required
                list="projects"
                maxLength={100}
                value={task.project}
                onChange={(e) => setTask({ ...task, project: e.target.value })}
              />
              <datalist id="projects">
                {data.projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </datalist>
            </label>
            <label htmlFor="task-title">
              해야 할 일
              <Input
                id="task-title"
                required
                maxLength={300}
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
              />
            </label>
            <label htmlFor="task-minutes">
              예상 시간 · 분
              <Input
                id="task-minutes"
                required
                type="number"
                min={1}
                max={1440}
                value={task.minutes}
                onChange={(e) =>
                  setTask({ ...task, minutes: Number(e.target.value) })
                }
              />
            </label>
            <label htmlFor="task-priority">
              중요도 · 1 필수 / 2 중요 / 3 여유
              <Input
                id="task-priority"
                required
                type="number"
                min={1}
                max={3}
                value={task.priority}
                onChange={(e) =>
                  setTask({ ...task, priority: Number(e.target.value) })
                }
              />
            </label>
            <label htmlFor="task-due">
              마감일 · 선택
              <Input
                id="task-due"
                type="date"
                value={task.due}
                onChange={(e) => setTask({ ...task, due: e.target.value })}
              />
            </label>
            <Button disabled={busy} type="submit">
              저장
            </Button>
            {error && (
              <p role="alert" className="danger">
                {error}
              </p>
            )}
          </form>
        </SheetContent>
      </Sheet>
    </main>
  );
}
