import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ControlTask, Milestone } from '@cockpit/shared/control';

type Props = {
  projectId: string;
  milestones: Milestone[];
  parents: ControlTask[];
  initial?: ControlTask;
  busy: boolean;
  onCancel(): void;
  onSave(task: ControlTask): Promise<boolean>;
};

export function TaskEditor({
  projectId,
  milestones,
  parents,
  initial,
  busy,
  onCancel,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<ControlTask>(
    () =>
      initial ?? {
        id: '',
        projectId,
        parentId: null,
        milestoneId: null,
        title: '',
        minutes: 30,
        priority: 2,
        due: '',
        status: 'todo',
        blockedReason: '',
        createdAt: null,
        completedAt: null,
        archived: false,
      },
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      title: draft.title.trim(),
      createdAt: initial ? draft.createdAt : Date.now(),
    };
    if (await onSave(next)) onCancel();
  }
  return (
    <form className="control-form" onSubmit={submit}>
      <h3>{initial ? '작업 수정' : '새 작업'}</h3>
      <label>
        작업 이름
        <Input
          required
          maxLength={300}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <div className="control-form-grid">
        <label>
          예상 시간
          <Input
            aria-label="예상 시간"
            required
            type="number"
            min={1}
            max={1440}
            value={draft.minutes}
            onChange={(e) =>
              setDraft({ ...draft, minutes: Number(e.target.value) })
            }
          />
        </label>
        <label>
          중요도
          <Input
            required
            type="number"
            min={1}
            max={3}
            value={draft.priority}
            onChange={(e) =>
              setDraft({ ...draft, priority: Number(e.target.value) })
            }
          />
        </label>
      </div>
      <label>
        마감일
        <Input
          type="date"
          value={draft.due}
          onChange={(e) => setDraft({ ...draft, due: e.target.value })}
        />
      </label>
      <label>
        마일스톤
        <select
          value={draft.milestoneId ?? ''}
          disabled={draft.parentId !== null}
          onChange={(e) =>
            setDraft({ ...draft, milestoneId: e.target.value || null })
          }
        >
          <option value="">미지정</option>
          {milestones.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      {!initial?.parentId && (
        <label>
          상위 작업
          <select
            value={draft.parentId ?? ''}
            onChange={(e) => {
              const parent = parents.find((item) => item.id === e.target.value);
              setDraft({
                ...draft,
                parentId: parent?.id ?? null,
                milestoneId: parent ? parent.milestoneId : draft.milestoneId,
              });
            }}
          >
            <option value="">없음</option>
            {parents
              .filter((item) => item.id !== draft.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
          </select>
        </label>
      )}
      <label>
        상태
        <select
          value={draft.status}
          onChange={(e) =>
            setDraft({
              ...draft,
              status: e.target.value as ControlTask['status'],
            })
          }
        >
          <option value="todo">예정</option>
          <option value="doing">진행 중</option>
          <option value="blocked">막힘</option>
          <option value="done">완료</option>
        </select>
      </label>
      {draft.status === 'blocked' && (
        <label>
          막힌 이유
          <Input
            maxLength={300}
            value={draft.blockedReason}
            onChange={(e) =>
              setDraft({ ...draft, blockedReason: e.target.value })
            }
          />
        </label>
      )}
      <div className="form-actions">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button disabled={busy} type="submit">
          작업 저장
        </Button>
      </div>
    </form>
  );
}
