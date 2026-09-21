import { useEffect, useState } from 'react';
import type { ControlData } from '@cockpit/shared/control';

export const AREAS = [
  { id: 'class', label: '수업' },
  { id: 'project', label: '프로젝트' },
  { id: 'study', label: '개인공부' },
  { id: '', label: '미분류' },
] as const;
const PREF_KEY = 'cockpit.navigation.collapsed';

export function ActivitySidebar({
  data,
  view,
  projectId,
  onView,
  onProject,
}: {
  data: ControlData;
  view: string;
  projectId: string | null;
  onView(view: 'today' | 'projects' | 'time'): void;
  onProject(id: string): void;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(PREF_KEY) ?? '[]');
      if (Array.isArray(saved))
        setCollapsed(saved.filter((v): v is string => typeof v === 'string'));
    } catch {
      /* Navigation preferences must never prevent access to records. */
    }
  }, []);
  function toggle(id: string) {
    const next = collapsed.includes(id)
      ? collapsed.filter((item) => item !== id)
      : [...collapsed, id];
    setCollapsed(next);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
    } catch {
      /* Optional preference only. */
    }
  }
  return (
    <aside className="activity-sidebar">
      <button
        className="mobile-navigation-toggle"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        프로젝트 목록 {mobileOpen ? '접기' : '펼치기'}
      </button>
      <nav
        className={`activity-tree ${mobileOpen ? 'is-open' : ''}`}
        aria-label="프로젝트 탐색"
      >
        <button
          className="capture-shortcut"
          aria-current={view === 'projects' && !projectId ? 'page' : undefined}
          onClick={() => {
            onView('projects');
            setMobileOpen(false);
          }}
        >
          전체 프로젝트
        </button>
        <div
          role="tablist"
          aria-label="관제판 보기"
          aria-orientation="vertical"
          onKeyDown={(event) => {
            const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]',
              ),
            );
            const current = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const index =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? buttons.length - 1
                  : (current +
                      (event.key === 'ArrowDown' ? 1 : -1) +
                      buttons.length) %
                    buttons.length;
            buttons[index]?.focus();
          }}
        >
          {(
            [
              { id: 'today', label: '오늘' },
              { id: 'time', label: '시간 기록' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`workspace-tab-${tab.id}`}
              aria-controls="workspace-panel"
              aria-selected={view === tab.id}
              tabIndex={
                view === tab.id || (view === 'projects' && tab.id === 'today')
                  ? 0
                  : -1
              }
              onClick={() => {
                onView(tab.id);
                setMobileOpen(false);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {AREAS.map((area) => (
          <section key={area.id}>
            <button
              className="area-toggle"
              aria-expanded={!collapsed.includes(area.id)}
              onClick={() => toggle(area.id)}
            >
              <span aria-hidden="true">
                {collapsed.includes(area.id) ? '▸' : '▾'}
              </span>
              {area.label}
            </button>
            {!collapsed.includes(area.id) && (
              <div className="area-children">
                {data.projects
                  .filter((p) => !p.archived && (p.area ?? '') === area.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      aria-label={`${p.name} 열기`}
                      aria-current={projectId === p.id ? 'page' : undefined}
                      onClick={() => {
                        onProject(p.id);
                        setMobileOpen(false);
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                {!data.projects.some(
                  (p) => !p.archived && (p.area ?? '') === area.id,
                ) && <span className="sidebar-empty">등록된 활동 없음</span>}
              </div>
            )}
          </section>
        ))}
      </nav>
    </aside>
  );
}
