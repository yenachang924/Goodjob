'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Clock3,
  Download,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_BACKUP_BYTES, parseBackup } from '@cockpit/shared/backup';
import { stopTimer, type ControlData } from '@cockpit/shared/control';
import { LegacyRecovery } from './legacy-recovery';
import { downloadJson, formatSeconds } from './format';
import { ProjectDetail } from './project-detail';
import { ProjectOverview } from './project-overview';
import { TimeRecords } from './time-records';
import { TodayPlan } from './today-plan';
import { UpgradePanel } from './upgrade-panel';
import { useControlWorkspace, type StorageMode } from './use-control-workspace';
import './control.css';

type View = 'all' | 'projects' | 'today' | 'time';
const tabs: { id: View; label: string; icon: typeof Clock3 }[] = [
  { id: 'all', label: '전체', icon: LayoutDashboard },
  { id: 'projects', label: '프로젝트', icon: FolderKanban },
  { id: 'today', label: '오늘', icon: ListTodo },
  { id: 'time', label: '시간 기록', icon: Clock3 },
];

export default function ControlWorkspace({
  mode = 'cloud',
}: {
  mode?: StorageMode;
}) {
  const workspace = useControlWorkspace(mode);
  const [view, setView] = useState<View>('all');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());
  const activeSessionId = workspace.control?.sessions.find(
    (session) => session.endedAt === null,
  )?.id;
  useEffect(() => {
    if (!activeSessionId) return;
    setTick(Date.now());
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSessionId]);
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
  const active = data.sessions.find((session) => session.endedAt === null);
  const activeTask =
    active && data.tasks.find((task) => task.id === active.taskId);
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
              <span>DAILY COCKPIT</span>
              <h1>프로젝트 관제판</h1>
            </div>
          </div>
          <div className="header-tools">
            <span className="cloud-state">
              {workspace.busy
                ? '저장 중…'
                : workspace.error
                  ? '저장 상태 확인 필요'
                  : workspace.notice ||
                    (mode === 'local' ? '이 브라우저에 저장' : '클라우드 연결')}
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
          </div>
        </header>
        {mode === 'local' && (
          <aside className="local-storage-notice" aria-label="로컬 저장 안내">
            <strong>로그인 없는 로컬 모드</strong>
            <p>
              기록은 이 브라우저에만 저장됩니다. 브라우저 데이터를 삭제하면
              사라질 수 있으니 내보내기로 백업하세요.
            </p>
            <p>
              다른 컴퓨터·브라우저와 자동 동기화되지 않습니다. 같은 브라우저
              프로필을 함께 쓰면 기록도 공유됩니다.
            </p>
          </aside>
        )}
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
        {active && activeTask && (
          <section className="timer-bar">
            <div className="pulse" />
            <div>
              <span>지금 기록 중</span>
              <strong>{activeTask.title}</strong>
            </div>
            <time>{formatSeconds((tick - active.startedAt) / 1000)}</time>
            {tick - active.startedAt >= 28_800_000 && (
              <span className="timer-warning">
                8시간 이상 기록 중 · 시간을 확인하세요
              </span>
            )}
            <Button
              variant="outline"
              aria-label="타이머 종료"
              disabled={workspace.busy}
              onClick={() => {
                try {
                  void workspace.save(stopTimer(data, Date.now()));
                } catch (error) {
                  workspace.setError(
                    error instanceof Error
                      ? error.message
                      : '타이머를 종료할 수 없습니다.',
                  );
                }
              }}
            >
              타이머 종료
            </Button>
          </section>
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
          <nav className="control-nav" role="tablist" aria-label="관제판 보기">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={() => {
                  setView(id);
                  if (id !== 'projects') setProjectId(null);
                }}
              >
                <Icon />
                {label}
              </button>
            ))}
          </nav>
          <div className="control-content" role="tabpanel">
            {(view === 'all' || view === 'projects') &&
              (projectId ? (
                <ProjectDetail
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
                  onOpen={(id) => {
                    setProjectId(id);
                    setView('projects');
                  }}
                />
              ))}
            {view === 'today' && (
              <TodayPlan
                data={data}
                busy={workspace.busy}
                onSave={workspace.save}
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
