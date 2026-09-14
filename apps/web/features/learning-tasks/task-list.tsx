'use client';

import { Button } from '@/components/ui/button';
import {
  toTaskInput,
  type LearningTask,
  type TaskInput,
  type TaskPage,
} from './client';

export function TaskList({
  result,
  busy,
  notice,
  onEdit,
  onSave,
  onRefresh,
}: {
  result: TaskPage;
  busy: boolean;
  notice: string;
  onEdit: (task: LearningTask) => void;
  onSave: (input: TaskInput, existing: LearningTask) => Promise<boolean>;
  onRefresh: (page?: number) => Promise<void>;
}) {
  return (
    <section className="panel learning-list" aria-busy={busy}>
      <h2>학습 할 일</h2>
      <p role="status">{notice}</p>
      {!result.tasks.length && (
        <p className="empty">등록된 할 일이 없습니다.</p>
      )}
      {result.tasks.map((task) => (
        <article key={task.id} className="learning-task">
          <div>
            <span className="eyebrow">{task.project}</span>
            <h3 className={task.done ? 'done' : ''}>{task.title}</h3>
            <p>
              {task.minutes}분 · {['', '필수', '중요', '여유'][task.priority]}
              {task.due && ` · ${task.due} 마감`}
            </p>
            <small>
              {task.done ? '완료됨' : '진행 전'} · revision {task.revision}
            </small>
          </div>
          <div className="learning-actions">
            <Button
              variant="outline"
              disabled={busy}
              aria-label={`${task.title} 수정`}
              onClick={() => onEdit(task)}
            >
              수정
            </Button>
            <Button
              variant={task.done ? 'ghost' : 'default'}
              disabled={busy}
              aria-label={`${task.title} ${task.done ? '완료 취소' : '완료 처리'}`}
              onClick={() =>
                void onSave(
                  {
                    ...toTaskInput(task),
                    done: !task.done,
                  },
                  task,
                )
              }
            >
              {task.done ? '완료 취소' : '완료 처리'}
            </Button>
          </div>
        </article>
      ))}
      <nav className="learning-pagination" aria-label="할 일 목록 페이지">
        <Button
          variant="outline"
          disabled={busy || result.page === 0}
          onClick={() => void onRefresh(result.page - 1)}
        >
          이전
        </Button>
        <span>
          {result.page + 1} /{' '}
          {Math.max(1, Math.ceil(result.total / result.limit))}
        </span>
        <Button
          variant="outline"
          disabled={busy || (result.page + 1) * result.limit >= result.total}
          onClick={() => void onRefresh(result.page + 1)}
        >
          다음
        </Button>
      </nav>
    </section>
  );
}
