'use client';
import { useState } from 'react';
import type { Data } from '@cockpit/shared';
import { MAX_BACKUP_BYTES, parseBackup } from '@cockpit/shared/backup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function BackupControls({
  data,
  revision,
  disabled,
  onImport,
}: {
  data: Data;
  revision: number;
  disabled: boolean;
  onImport: (data: Data) => Promise<boolean>;
}) {
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify({
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            data,
            revision,
          }),
        ],
        { type: 'application/json' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `cockpit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <details className="backup-controls">
      <summary>데이터 백업·이전</summary>
      <Button
        variant="outline"
        disabled={disabled || importing}
        onClick={download}
      >
        백업 다운로드
      </Button>
      <p>
        가져오기는 저장 이력이 없는 새 워크스페이스에서만 가능합니다. 기존
        데이터를 덮어쓰지 않습니다.
      </p>
      <label htmlFor="backup-file">
        백업 JSON 파일
        <Input
          id="backup-file"
          type="file"
          accept="application/json,.json"
          disabled={disabled || importing || revision !== 0}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setImporting(true);
            setError('');
            try {
              if (file.size > MAX_BACKUP_BYTES)
                throw new Error('백업 파일의 허용 용량을 초과했습니다.');
              const next = parseBackup(await file.text(), revision);
              if (await onImport(next)) location.reload();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : '가져오기에 실패했습니다.',
              );
            } finally {
              setImporting(false);
            }
          }}
        />
      </label>
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
    </details>
  );
}
