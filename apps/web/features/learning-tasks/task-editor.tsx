'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toTaskInput, type LearningTask, type TaskInput } from './client';
const emptyTask = (): TaskInput => ({
  project: '',
  title: '',
  minutes: 30,
  priority: 2,
  done: false,
  due: '',
});
export function TaskEditor({
  existing,
  busy,
  onSave,
  onCancel,
}: {
  existing?: LearningTask;
  busy: boolean;
  onSave: (input: TaskInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<TaskInput>(() =>
    existing ? toTaskInput(existing) : emptyTask(),
  );
  return (
    <section className="panel">
      <h2>{existing ? '할 일 수정' : '새 할 일'}</h2>
      <form
        className="task-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await onSave({
              ...input,
              project: input.project.trim(),
              title: input.title.trim(),
            })
          )
            setInput(emptyTask());
        }}
      >
        <fieldset disabled={busy} className="learning-fields">
          <label htmlFor="learn-project">
            프로젝트
            <Input
              id="learn-project"
              required
              maxLength={100}
              value={input.project}
              onChange={(e) => setInput({ ...input, project: e.target.value })}
            />
          </label>
          <label htmlFor="learn-title">
            할 일 제목
            <Input
              id="learn-title"
              required
              maxLength={300}
              value={input.title}
              onChange={(e) => setInput({ ...input, title: e.target.value })}
            />
          </label>
          <div className="learning-input-row">
            <label htmlFor="learn-minutes">
              예상 시간 · 분
              <Input
                id="learn-minutes"
                type="number"
                required
                min={1}
                max={1440}
                value={input.minutes}
                onChange={(e) =>
                  setInput({ ...input, minutes: Number(e.target.value) })
                }
              />
            </label>
            <label htmlFor="learn-priority">
              중요도
              <select
                id="learn-priority"
                value={input.priority}
                onChange={(e) =>
                  setInput({ ...input, priority: Number(e.target.value) })
                }
              >
                <option value={1}>1 · 필수</option>
                <option value={2}>2 · 중요</option>
                <option value={3}>3 · 여유</option>
              </select>
            </label>
          </div>
          <label htmlFor="learn-due">
            마감일 · 선택
            <Input
              id="learn-due"
              type="date"
              value={input.due}
              onChange={(e) => setInput({ ...input, due: e.target.value })}
            />
          </label>
          <div className="learning-actions">
            <Button type="submit">
              {busy ? '저장 중…' : existing ? '수정 저장' : '할 일 저장'}
            </Button>
            {existing && (
              <Button type="button" variant="outline" onClick={onCancel}>
                수정 취소
              </Button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
