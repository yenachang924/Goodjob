import { useState, type FormEvent } from 'react';
import { ArrowRight, FolderKanban, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  projectSummary,
  saveProject,
  type ControlData,
  type Project,
} from '@cockpit/shared/control';
import { formatMinutes } from './format';

export function ProjectOverview({
  data,
  busy,
  onSave,
  onOpen,
  onError = (value) => window.alert(value),
}: {
  data: ControlData;
  busy: boolean;
  onSave(next: ControlData): Promise<boolean>;
  onOpen(id: string): void;
  onError?(message: string): void;
}) {
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', link: '' });
  async function submit(event: FormEvent) {
    event.preventDefault();
    const project: Project = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      link: draft.link.trim(),
      archived: false,
    };
    try {
      if (await onSave(saveProject(data, project))) {
        setAdding(false);
        setDraft({ name: '', description: '', link: '' });
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '프로젝트를 저장할 수 없습니다.',
      );
    }
  }
  const visible = data.projects.filter(
    (project) => showArchived || !project.archived,
  );
  return (
    <section aria-labelledby="overview-title">
      <label className="archive-filter">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        보관된 프로젝트 포함
      </label>
      <div className="view-heading">
        <div>
          <p className="eyebrow">WORKSPACE OVERVIEW</p>
          <h2 id="overview-title">전체 프로젝트</h2>
          <p>남은 규모와 이번 주 흐름을 한눈에 확인하세요.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus />
          프로젝트 추가
        </Button>
      </div>
      {adding && (
        <form className="control-form project-create" onSubmit={submit}>
          <h3>새 프로젝트</h3>
          <label>
            프로젝트 이름
            <Input
              required
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            프로젝트 설명
            <Input
              maxLength={500}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <label>
            노트 링크
            <Input
              type="url"
              placeholder="https://"
              value={draft.link}
              onChange={(e) => setDraft({ ...draft, link: e.target.value })}
            />
          </label>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdding(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={busy}>
              프로젝트 저장
            </Button>
          </div>
        </form>
      )}
      {visible.length === 0 ? (
        <div className="control-empty">
          <FolderKanban />
          <h3>첫 프로젝트를 만들어 보세요</h3>
          <p>
            할 일을 프로젝트에 모으면 남은 규모와 실제 시간을 함께 볼 수 있어요.
          </p>
        </div>
      ) : (
        <div className="project-cards">
          {visible.map((project) => {
            const summary = projectSummary(data, project.id, Date.now());
            const nextMilestone = data.milestones
              .filter((item) => item.projectId === project.id && !item.achieved)
              .toSorted((a, b) =>
                (a.due || '9999').localeCompare(b.due || '9999'),
              )[0];
            return (
              <article className="project-card" key={project.id}>
                <div className="project-card-top">
                  <div className="project-icon">
                    <FolderKanban />
                  </div>
                  <span>
                    {summary.total
                      ? `${Math.round((summary.done / summary.total) * 100)}%`
                      : '시작 전'}
                  </span>
                </div>
                <h3>{project.name}</h3>
                <p>{project.description || '프로젝트 메모가 아직 없습니다.'}</p>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${summary.total ? (summary.done / summary.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <strong>
                  {summary.total
                    ? `${summary.done} / ${summary.total} 완료`
                    : '등록된 작업 없음'}
                </strong>
                <dl className="project-stats">
                  <div>
                    <dt>남은 작업</dt>
                    <dd>{summary.remaining}</dd>
                  </div>
                  <div>
                    <dt>막힘 · 지연</dt>
                    <dd>
                      {summary.blocked} · {summary.overdue}
                    </dd>
                  </div>
                  <div>
                    <dt>남은 예상</dt>
                    <dd>{formatMinutes(summary.remainingMinutes)}</dd>
                  </div>
                  <div>
                    <dt>이번 주</dt>
                    <dd>
                      +{summary.weekAdded} / ✓{summary.weekDone}
                    </dd>
                  </div>
                </dl>
                <div className="next-milestone">
                  <span>다음 마일스톤</span>
                  <strong>{nextMilestone?.title ?? '미등록'}</strong>
                </div>
                <Button
                  variant="outline"
                  aria-label={`${project.name} 열기`}
                  onClick={() => onOpen(project.id)}
                >
                  상세 보기
                  <ArrowRight />
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
