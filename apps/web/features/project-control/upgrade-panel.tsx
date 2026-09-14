import { useState, type ChangeEvent } from 'react';
import { Download, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Data } from '@cockpit/shared';
import { downloadJson } from './format';

export function UpgradePanel({
  data,
  revision,
  busy,
  error,
  onUpgrade,
  onImport,
}: {
  data: Data;
  revision: number;
  busy: boolean;
  error: string;
  onUpgrade(): Promise<boolean>;
  onImport(event: ChangeEvent<HTMLInputElement>): Promise<void>;
}) {
  const empty =
    revision === 0 &&
    data.tasks.length === 0 &&
    Object.keys(data.days).length === 0;
  const [downloaded, setDownloaded] = useState(false);
  return (
    <main className="control-shell upgrade-shell">
      <section className="upgrade-card">
        <div className="upgrade-icon">
          <ShieldCheck />
        </div>
        <p className="eyebrow">SAFE UPGRADE</p>
        <h1>
          {empty
            ? '프로젝트 관제판을 시작할까요?'
            : '기존 관제판을 안전하게 확장합니다'}
        </h1>
        <p>
          {empty
            ? '새 프로젝트, 마일스톤, 하위 작업과 실제 시간 기록을 한곳에서 관리합니다.'
            : `기존 프로젝트 ${data.projects.length}개와 작업 ${data.tasks.length}개를 그대로 옮깁니다. 실행 중이던 타이머는 시간을 추측하지 않고 복구 단계에서 확인합니다.`}
        </p>
        {error && (
          <p className="control-alert" role="alert">
            {error}
          </p>
        )}
        {empty && (
          <label className="import-button upgrade-import">
            <Upload />
            백업에서 시작
            <input
              aria-label="백업 JSON 파일"
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => void onImport(event)}
            />
          </label>
        )}
        {!empty && (
          <Button
            variant="outline"
            onClick={() => {
              downloadJson(
                data,
                `cockpit-v1-backup-${new Date().toISOString().slice(0, 10)}.json`,
              );
              setDownloaded(true);
            }}
          >
            <Download />
            1. 기존 데이터 백업 다운로드
          </Button>
        )}
        <Button
          disabled={busy || (!empty && !downloaded)}
          onClick={() => void onUpgrade()}
        >
          {empty ? '새 워크스페이스 시작' : '2. 확인하고 변환 저장'}
        </Button>
        {!empty && !downloaded && (
          <small>
            변환 저장 전에 복구 가능한 JSON 백업을 먼저 내려받아야 합니다.
          </small>
        )}
      </section>
    </main>
  );
}
