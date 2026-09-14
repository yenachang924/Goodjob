'use client';

import { Button } from '@/components/ui/button';
import type { LearningTask, TaskInput, TaskPage } from './client';
import { TaskEditor } from './task-editor';
import { TaskList } from './task-list';

export function TaskWorkspace({
  result,
  editing,
  busy,
  notice,
  formKey,
  onEdit,
  onSave,
  onCancelEdit,
  onRefresh,
  onDisconnect,
}: {
  result: TaskPage;
  editing?: LearningTask;
  busy: boolean;
  notice: string;
  formKey: number;
  onEdit: (task: LearningTask) => void;
  onSave: (
    input: TaskInput,
    existing?: LearningTask,
    source?: 'editor' | 'list',
  ) => Promise<boolean>;
  onCancelEdit: () => void;
  onRefresh: (page?: number) => Promise<void>;
  onDisconnect: () => void;
}) {
  return (
    <>
      <div className="learning-toolbar">
        <strong>전체 {result.total}개</strong>
        <div className="learning-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void onRefresh()}
          >
            새로고침
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onDisconnect}>
            연결 해제
          </Button>
        </div>
      </div>
      <div className="learning-grid">
        <TaskEditor
          key={`${editing?.id ?? 'new'}-${formKey}`}
          existing={editing}
          busy={busy}
          onSave={(input) => onSave(input, editing)}
          onCancel={onCancelEdit}
        />
        <TaskList
          result={result}
          busy={busy}
          notice={notice}
          onEdit={onEdit}
          onSave={(input, task) => onSave(input, task, 'list')}
          onRefresh={onRefresh}
        />
      </div>
    </>
  );
}
