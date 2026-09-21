'use client';

import { useState, type ChangeEvent } from 'react';
import { Clock3, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_BACKUP_BYTES, parseBackup } from '@cockpit/shared/backup';
import { type ControlData } from '@cockpit/shared/control';
import { LegacyRecovery } from './legacy-recovery';
import { downloadJson, todayKey } from './format';
import { ProjectDetail } from './project-detail';
import { ProjectOverview } from './project-overview';
import { TimeRecords } from './time-records';
import { TodayHome } from './today-home';
import { ActivitySidebar } from './activity-sidebar';
import { WorkspaceTimer } from './workspace-timer';
import { UpgradePanel } from './upgrade-panel';
import { useControlWorkspace, type StorageMode } from './use-control-workspace';
import './control.css';
import './fast-workspace.css';

type View = 'projects' | 'today' | 'time';

export default function ControlWorkspace({
  mode = 'cloud',
}: {
  mode?: StorageMode;
}) {
  const workspace = useControlWorkspace(mode);
  const [view, setView] = useState<View>('projects');
  const [projectId, setProjectId] = useState<string | null>(null);
  if (workspace.loading)
    return (
      <main className="control-shell">
        <div className="loading-card">
          <span className="loading-dot" />
          <h1>프로젝트를 불러오는 중</h1>
          <p>
            {mode === 'local'
              ? '이 브라우저의 기록을 확인하고 있어요.'
              : '클라우드에 저장된 워크스페이스를 확인하고 있어요.'}
          </p>
        </div>
      </main>
    );
  if (!workspace.data)
    return (
      <main className="control-shell">
        <div className="error-card" role="alert">
          <h1>워크스페이스를 열 수 없습니다</h1>
          <p>{workspace.error}</p>
          <Button onClick={() => void workspace.load()}>다시 불러오기</Button>
        </div>
      </main>
    );
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error('백업 파일 크기가 저장 한도를 초과했습니다.');
      await workspace.importData(
        parseBackup(await file.text(), workspace.revision),
      );
    } catch (error) {
      workspace.setError(
        error instanceof Error
          ? error.message
          : 'JSON 백업 파일을 읽을 수 없습니다.',
      );
    }
    event.target.value = '';
  }
  if (workspace.legacy)
    return (
      <UpgradePanel
        data={workspace.legacy}
        revision={workspace.revision}
        busy={workspace.busy}
        error={workspace.error}
        onUpgrade={workspace.upgrade}
        onImport={importFile}
      />
    );
  const data = workspace.control as ControlData;
  function openProject(id: string) {
    setProjectId(id);
    setView('projects');
    try {
      localStorage.setItem('cockpit.capture.last-project', id);
    } catch {
      /* Optional preference. */
    }
  }
  function openView(next: View) {
    setProjectId(null);
    setView(next);
  }
  return (
    <main className="control-shell">
      <fieldset
        disabled={workspace.busy}
        className="control-save-boundary"
        aria-label="워크스페이스 편집"
      >
        <header className="control-header">
          <div className="control-brand">
            <div className="brand-mark">
              <Clock3 />
            </div>
            <div>
              <span>{todayKey()}</span>
              <h1>프로젝트 관제판</h1>
            </div>
          </div>
          <div className="header-tools">
            <details className="storage-tools">
              <summary>저장 · 백업</summary>
              <div>
                <span className="cloud-state">
                  {workspace.busy
                    ? '저장 중…'
                    : workspace.error
                      ? '저장 상태 확인 필요'
                      : workspace.notice ||
                        (mode === 'local'
                          ? '이 브라우저에 저장'
                          : '클라우드 연결')}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    downloadJson(
                      data,
                      `project-control-${new Date().toISOString().slice(0, 10)}.json`,
                    )
                  }
                >
                  <Download />
                  내보내기
                </Button>
                <label className="import-button">
                  <Upload />
                  가져오기
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => void importFile(event)}
                  />
                </label>
                {mode === 'local' && (
                  <small>
                    기록은 이 브라우저에 저장됩니다. 사이트 데이터 삭제 전
                    내보내기로 백업하세요.
                  </small>
                )}
              </div>
            </details>
          </div>
        </header>
        <WorkspaceTimer
          data={data}
          busy={workspace.busy}
          onSave={workspace.save}
          onError={workspace.setError}
        />
        {workspace.error && (
          <div className="control-alert" role="alert">
            <span>{workspace.error}</span>
            {workspace.conflict && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void workspace.load()}
              >
                저장본 새로고침
              </Button>
            )}
          </div>
        )}
        {data.legacyActive.length > 0 && (
          <section className="legacy-recovery" role="status">
            <div>
              <strong>
                기존 타이머 {data.legacyActive.length}개를 확인해 주세요
              </strong>
              <p>
                종료 시각을 확인한 뒤 저장하세요. 단일 구간은 최대 24시간입니다.
              </p>
            </div>
            {data.legacyActive.map((timer) => (
              <LegacyRecovery
                key={`${timer.date}-${timer.taskId}`}
                data={data}
                timer={timer}
                busy={workspace.busy}
                onSave={workspace.save}
                onError={workspace.setError}
              />
            ))}
          </section>
        )}
        <div className="control-layout">
          <ActivitySidebar
            data={data}
            view={view}
            projectId={projectId}
            onView={openView}
            onProject={openProject}
          />
          <div
            className="control-content"
            role={view === 'projects' ? 'region' : 'tabpanel'}
            id="workspace-panel"
            aria-label={view === 'projects' ? '프로젝트' : undefined}
            aria-labelledby={
              view === 'projects' ? undefined : `workspace-tab-${view}`
            }
          >
            {view === 'projects' &&
              (projectId ? (
                <ProjectDetail
                  key={projectId}
                  data={data}
                  projectId={projectId}
                  busy={workspace.busy}
                  onBack={() => setProjectId(null)}
                  onSave={workspace.save}
                  onError={workspace.setError}
                />
              ) : (
                <ProjectOverview
                  data={data}
                  busy={workspace.busy}
                  onError={workspace.setError}
                  onSave={workspace.save}
                  onOpen={openProject}
                />
              ))}
            {view === 'today' && (
              <TodayHome
                data={data}
                busy={workspace.busy}
                onSave={workspace.save}
                onError={workspace.setError}
                onProject={openProject}
              />
            )}
            {view === 'time' && (
              <TimeRecords
                data={data}
                busy={workspace.busy}
                onSave={workspace.save}
                onError={workspace.setError}
              />
            )}
          </div>
        </div>
      </fieldset>
    </main>
  );
}
