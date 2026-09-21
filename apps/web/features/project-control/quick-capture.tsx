import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { quickCaptureTask, type ControlData } from '@cockpit/shared/control';

type Props = {
  data: ControlData;
  busy: boolean;
  onSave(next: ControlData): Promise<boolean>;
  onError(message: string): void;
  projectId?: string;
  parentId?: string;
  scheduledFor?: string;
  inputId?: string;
  label?: string;
  placeholder?: string;
};

export function QuickCapture({
  data,
  busy,
  onSave,
  onError,
  projectId,
  parentId,
  scheduledFor,
  inputId,
  label = '빠른 할 일 입력',
  placeholder = '해야 할 일을 입력하고 Enter',
}: Props) {
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [focusVersion, setFocusVersion] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const submitting = useRef(false);
  const restoreFocus = useRef(false);

  // Wait for both this form and the workspace fieldset to become editable again.
  useEffect(() => {
    if (busy || pending || !restoreFocus.current) return;
    restoreFocus.current = false;
    input.current?.focus();
  }, [busy, pending, focusVersion]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (composing.current || submitting.current || busy || !title.trim())
      return;
    submitting.current = true;
    setPending(true);
    try {
      const next = quickCaptureTask(
        data,
        {
          id: crypto.randomUUID(),
          title,
          projectId,
          parentId,
          scheduledFor,
        },
        Date.now(),
      );
      if (await onSave(next)) setTitle('');
    } catch (error) {
      onError(
        error instanceof Error ? error.message : '할 일을 저장하지 못했습니다.',
      );
    } finally {
      submitting.current = false;
      restoreFocus.current = true;
      setPending(false);
      setFocusVersion((version) => version + 1);
    }
  }

  return (
    <form
      className={`quick-capture${parentId ? ' child-capture' : ''}`}
      onSubmit={submit}
      aria-label={label}
    >
      <input
        ref={input}
        id={inputId}
        aria-label={label}
        placeholder={placeholder}
        maxLength={300}
        value={title}
        disabled={busy || pending}
        autoComplete="off"
        onChange={(event) => setTitle(event.target.value)}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            (composing.current ||
              event.nativeEvent.isComposing ||
              event.keyCode === 229)
          ) {
            event.preventDefault();
          }
        }}
      />
      <Button
        type="submit"
        size="sm"
        disabled={busy || pending || !title.trim()}
        aria-label={`${label} 추가`}
      >
        <Plus aria-hidden="true" />
        추가
      </Button>
    </form>
  );
}
