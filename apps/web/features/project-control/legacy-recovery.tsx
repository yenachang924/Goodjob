import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  resolveLegacyTimer,
  type ControlData,
  type LegacyTimer,
} from '@cockpit/shared/control';
import { fromLocalDateTime, localDateTime } from './format';

export function LegacyRecovery({
  data,
  timer,
  busy,
  onSave,
  onError,
}: {
  data: ControlData;
  timer: LegacyTimer;
  busy: boolean;
  onSave(data: ControlData): Promise<boolean>;
  onError(error: string): void;
}) {
  const [end, setEnd] = useState(
    localDateTime(Math.min(Date.now(), timer.startedAt + 3_600_000)),
  );
  async function resolve(endedAt: number | null) {
    try {
      await onSave(
        resolveLegacyTimer(
          data,
          timer.date,
          endedAt,
          crypto.randomUUID(),
          Date.now(),
        ),
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '기존 타이머를 확인하지 못했습니다.',
      );
    }
  }
  return (
    <div className="recovery-actions">
      <span>
        {timer.date} · 시작 {localDateTime(timer.startedAt)}
      </span>
      <label>
        확인한 종료 시각
        <Input
          type="datetime-local"
          step="1"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </label>
      <Button
        disabled={busy}
        size="sm"
        variant="outline"
        onClick={() => void resolve(null)}
      >
        기록 없이 정리
      </Button>
      <Button
        disabled={busy}
        size="sm"
        onClick={() => void resolve(fromLocalDateTime(end))}
      >
        확인한 구간 저장
      </Button>
    </div>
  );
}
