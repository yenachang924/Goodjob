import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Milestone } from '@cockpit/shared/control';

export function MilestoneEditor({
  projectId,
  initial,
  busy,
  onCancel,
  onSave,
}: {
  projectId: string;
  initial?: Milestone;
  busy: boolean;
  onCancel(): void;
  onSave(value: Milestone): Promise<boolean>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [due, setDue] = useState(initial?.due ?? '');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = {
      id: initial?.id ?? crypto.randomUUID(),
      projectId,
      title: title.trim(),
      due,
      achieved: initial?.achieved ?? false,
    };
    if (await onSave(value)) onCancel();
  }
  return (
    <form className="control-form compact" onSubmit={submit}>
      <h3>{initial ? '마일스톤 수정' : '새 마일스톤'}</h3>
      <label>
        마일스톤 이름
        <Input
          required
          maxLength={300}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        목표일
        <Input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </label>
      <div className="form-actions">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={busy}>
          마일스톤 저장
        </Button>
      </div>
    </form>
  );
}
