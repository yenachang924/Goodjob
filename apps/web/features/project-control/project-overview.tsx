import { useState, type FormEvent } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  saveProject,
  type ControlData,
  type Project,
  type ProjectArea,
} from '@cockpit/shared/control';
import { ProjectChecklist } from './project-checklist';

const areaLabels = { class: '수업', project: '프로젝트', study: '개인공부' };

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
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    link: '',
    area: '',
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    const project: Project = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      link: draft.link.trim(),
      archived: false,
      ...(draft.area ? { area: draft.area as ProjectArea } : {}),
    };
    try {
      if (await onSave(saveProject(data, project))) {
        setAdding(false);
        setDraft({ name: '', description: '', link: '', area: '' });
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
          <h2 id="overview-title">병행 중인 활동</h2>
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
            영역
            <select
              value={draft.area}
              onChange={(event) =>
                setDraft({ ...draft, area: event.target.value })
              }
            >
              <option value="">미분류</option>
              <option value="class">수업</option>
              <option value="project">프로젝트</option>
              <option value="study">개인공부</option>
            </select>
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
        <div className="project-area-groups">
          {(['class', 'project', 'study', ''] as const).map((area) => {
            const projects = visible.filter(
              (project) => (project.area ?? '') === area,
            );
            if (!projects.length) return null;
            const label = area ? areaLabels[area] : '미분류';
            return (
              <section
                className="project-area-group"
                aria-label={`${label} 활동`}
                key={area}
              >
                <h3 className="project-area-heading">{label}</h3>
                <div className="project-cards">
                  {projects.map((project) => (
                    <ProjectChecklist
                      key={project.id}
                      data={data}
                      project={project}
                      busy={busy}
                      onSave={onSave}
                      onOpen={onOpen}
                      onError={onError}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
