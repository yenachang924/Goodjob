import { useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CirclePlay,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  leafTasks,
  INBOX_PROJECT_ID,
  moveControlTask,
  saveControlTask,
  saveMilestone,
  saveProject,
  setTaskArchived,
  setTaskStatus,
  startTimer,
  taskStatus,
  type ControlData,
  type ControlTask,
  type Milestone,
  type Project,
  type ProjectArea,
} from '@cockpit/shared/control';
import { MilestoneEditor } from './milestone-editor';
import { TaskEditor } from './task-editor';
import { QuickCapture } from './quick-capture';

const labels: Record<ControlTask['status'], string> = {
  todo: '예정',
  doing: '진행 중',
  blocked: '막힘',
  done: '완료',
};

type TaskRowProps = {
  data: ControlData;
  task: ControlTask;
  children: ControlTask[];
  child?: boolean;
  busy: boolean;
  apply(make: () => ControlData): Promise<boolean>;
  onEdit(task: ControlTask): void;
};

function TaskRow({
  data,
  task,
  children,
  child = false,
  busy,
  apply,
  onEdit,
}: TaskRowProps) {
  const status = taskStatus(data, task.id);
  const leaf = children.length === 0;
  const minutes = leaf
    ? task.minutes
    : children.reduce((sum, item) => sum + item.minutes, 0);
  return (
    <div className={`control-task ${child ? 'child' : ''}`}>
      <div className="task-main">
        <input
          type="checkbox"
          aria-label={`${task.title} 완료`}
          checked={status === 'done'}
          disabled={!leaf || busy || task.archived}
          onChange={(event) =>
            void apply(() =>
              setTaskStatus(
                data,
                task.id,
                event.target.checked ? 'done' : 'todo',
                Date.now(),
              ),
            )
          }
        />
        <div>
          <strong>{task.title}</strong>
          <small>
            {minutes ? `${minutes}분` : '예상 시간 미정'}
            {task.scheduledFor ? ` · 예정 ${task.scheduledFor}` : ''}
            {task.due ? ` · 마감 ${task.due}` : ''}
          </small>
          {status === 'blocked' && task.blockedReason && (
            <p className="blocked-reason">{task.blockedReason}</p>
          )}
        </div>
      </div>
      <div className="task-controls">
        {!child && task.projectId === INBOX_PROJECT_ID && !task.archived && (
          <select
            aria-label={`${task.title} 활동으로 이동`}
            value=""
            disabled={busy}
            onChange={(event) => {
              const destination = event.target.value;
              if (destination)
                void apply(() => moveControlTask(data, task.id, destination));
            }}
          >
            <option value="">활동 지정</option>
            {data.projects
              .filter(
                (project) =>
                  !project.archived && project.id !== INBOX_PROJECT_ID,
              )
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </select>
        )}
        <span className={`status-label ${status}`}>{labels[status]}</span>
        {leaf && status !== 'done' && !task.archived && (
          <Button
            size="sm"
            variant="outline"
            aria-label={`${task.title} 타이머 시작`}
            disabled={busy}
            onClick={() =>
              void apply(() =>
                startTimer(data, task.id, crypto.randomUUID(), Date.now()),
              )
            }
          >
            <CirclePlay />
            시작
          </Button>
        )}
        <select
          aria-label={`${task.title} 상태`}
          value={status}
          disabled={!leaf || busy}
          onChange={(event) =>
            void apply(() =>
              setTaskStatus(
                data,
                task.id,
                event.target.value as ControlTask['status'],
                Date.now(),
              ),
            )
          }
        >
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onEdit(task)}
        >
          수정
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`${task.title} ${task.archived ? '보관 해제' : '보관'}`}
          disabled={busy}
          onClick={() =>
            void apply(() => setTaskArchived(data, task.id, !task.archived))
          }
        >
          <Archive />
        </Button>
      </div>
    </div>
  );
}

export function ProjectDetail({
  data,
  projectId,
  busy,
  onBack,
  onSave,
  onError,
}: {
  data: ControlData;
  projectId: string;
  busy: boolean;
  onBack(): void;
  onSave(next: ControlData): Promise<boolean>;
  onError(message: string): void;
}) {
  const project = data.projects.find((item) => item.id === projectId);
  const [taskEditor, setTaskEditor] = useState<ControlTask | 'new' | null>(
    null,
  );
  const [milestoneEditor, setMilestoneEditor] = useState<
    Milestone | 'new' | null
  >(null);
  const [editingProject, setEditingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState<Project>(
    () =>
      project ?? {
        id: projectId,
        name: '',
        description: '',
        link: '',
        archived: false,
      },
  );
  const [showArchived, setShowArchived] = useState(false);
  const editorOpen =
    editingProject || taskEditor !== null || milestoneEditor !== null;
  if (!project) return null;
  const milestones = data.milestones.filter(
    (item) => item.projectId === projectId,
  );
  const tasks = data.tasks.filter(
    (item) => item.projectId === projectId && (showArchived || !item.archived),
  );
  const parents = tasks.filter((item) => item.parentId === null);
  const groups = [
    { id: null, title: '마일스톤 미지정' },
    ...milestones.map((item) => ({ id: item.id, title: item.title })),
  ];

  async function apply(make: () => ControlData) {
    try {
      return await onSave(make());
    } catch (error) {
      onError(error instanceof Error ? error.message : '변경할 수 없습니다.');
      return false;
    }
  }
  async function saveProjectDraft() {
    const saved = await apply(() =>
      saveProject(data, {
        ...projectDraft,
        archived: project?.archived ?? projectDraft.archived,
        name: projectDraft.name.trim(),
        description: projectDraft.description.trim(),
        link: projectDraft.link.trim(),
      }),
    );
    if (saved) setEditingProject(false);
  }

  return (
    <section>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft />
        내 활동
      </button>
      <div className="project-detail-head">
        <div>
          <p className="eyebrow">PROJECT</p>
          <h2>{project.name}</h2>
          <p>{project.description || '프로젝트 설명이 없습니다.'}</p>
          {project.link && (
            <a href={project.link} target="_blank" rel="noreferrer">
              외부 노트 열기 <ExternalLink />
            </a>
          )}
        </div>
        <div className="header-actions">
          <Button
            variant="ghost"
            disabled={busy || editorOpen}
            onClick={() => {
              setProjectDraft(project);
              setEditingProject(true);
            }}
          >
            프로젝트 수정
          </Button>
          <Button
            variant="ghost"
            disabled={busy || editorOpen || project.id === INBOX_PROJECT_ID}
            onClick={() =>
              void apply(() =>
                saveProject(data, { ...project, archived: !project.archived }),
              )
            }
          >
            {project.archived ? '프로젝트 보관 해제' : '프로젝트 보관'}
          </Button>
          <Button
            disabled={busy || editorOpen}
            variant="outline"
            onClick={() => setMilestoneEditor('new')}
          >
            <Plus />
            마일스톤
          </Button>
          <Button
            disabled={busy || editorOpen}
            onClick={() => setTaskEditor('new')}
          >
            <Plus />
            작업 추가
          </Button>
        </div>
      </div>
      {!project.archived && (
        <QuickCapture
          key={projectId}
          inputId="activity-quick-capture"
          data={data}
          projectId={projectId}
          busy={busy || editorOpen}
          onSave={onSave}
          onError={onError}
        />
      )}
      {editingProject && (
        <form
          className="control-form project-create"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProjectDraft();
          }}
        >
          <h3>프로젝트 수정</h3>
          <label>
            프로젝트 이름
            <Input
              required
              value={projectDraft.name}
              onChange={(event) =>
                setProjectDraft({ ...projectDraft, name: event.target.value })
              }
            />
          </label>
          <label>
            영역
            <select
              value={projectDraft.area ?? ''}
              disabled={projectId === INBOX_PROJECT_ID}
              onChange={(event) =>
                setProjectDraft({
                  ...projectDraft,
                  area: event.target.value
                    ? (event.target.value as ProjectArea)
                    : undefined,
                })
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
              value={projectDraft.description}
              onChange={(event) =>
                setProjectDraft({
                  ...projectDraft,
                  description: event.target.value,
                })
              }
            />
          </label>
          <label>
            노트 링크
            <Input
              type="url"
              value={projectDraft.link}
              onChange={(event) =>
                setProjectDraft({ ...projectDraft, link: event.target.value })
              }
            />
          </label>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingProject(false)}
            >
              취소
            </Button>
            <Button type="submit">프로젝트 저장</Button>
          </div>
        </form>
      )}
      {(taskEditor || milestoneEditor) && (
        <fieldset
          className="editor-drawer"
          disabled={busy}
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          {taskEditor && (
            <TaskEditor
              key={taskEditor === 'new' ? 'new-task' : taskEditor.id}
              projectId={projectId}
              milestones={milestones}
              parents={parents}
              initial={taskEditor === 'new' ? undefined : taskEditor}
              busy={busy}
              onCancel={() => {
                if (!busy) setTaskEditor(null);
              }}
              onSave={(task) =>
                apply(() => saveControlTask(data, task, Date.now()))
              }
            />
          )}
          {milestoneEditor && (
            <MilestoneEditor
              key={
                milestoneEditor === 'new' ? 'new-milestone' : milestoneEditor.id
              }
              projectId={projectId}
              initial={milestoneEditor === 'new' ? undefined : milestoneEditor}
              busy={busy}
              onCancel={() => {
                if (!busy) setMilestoneEditor(null);
              }}
              onSave={(item) => apply(() => saveMilestone(data, item))}
            />
          )}
        </fieldset>
      )}
      <details className="project-secondary">
        <summary>마일스톤 · {milestones.length}개</summary>
        <div className="milestone-strip">
          {milestones.length === 0 ? (
            <p>마일스톤은 선택 사항입니다. 작업부터 바로 등록해도 괜찮아요.</p>
          ) : (
            milestones.map((item) => {
              const linked = leafTasks(data, projectId).filter(
                (task) => task.milestoneId === item.id,
              );
              const done = linked.filter(
                (task) => taskStatus(data, task.id) === 'done',
              ).length;
              const canAchieve = linked.length === 0 || done === linked.length;
              return (
                <article key={item.id}>
                  <span>
                    {item.achieved ? '달성 확인' : item.due || '목표일 없음'}
                  </span>
                  <strong>{item.title}</strong>
                  <small>
                    {done}/{linked.length} 실행 작업 완료
                  </small>
                  <div className="header-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || editorOpen}
                      onClick={() => setMilestoneEditor(item)}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        busy || editorOpen || (!canAchieve && !item.achieved)
                      }
                      onClick={() =>
                        void apply(() =>
                          saveMilestone(data, {
                            ...item,
                            achieved: !item.achieved,
                          }),
                        )
                      }
                    >
                      {item.achieved ? '다시 진행' : '달성 확인'}
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </details>
      <div className="task-list-heading">
        <h3>작업</h3>
        <label className="archive-filter">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          보관된 작업 포함
        </label>
      </div>
      {parents.length === 0 ? (
        <div className="control-empty small">
          <h3>실행할 작업을 적어보세요</h3>
          <p>마일스톤 미지정 작업도 바로 타이머를 시작할 수 있습니다.</p>
        </div>
      ) : (
        groups.map((group) => {
          const grouped = parents.filter(
            (task) => task.milestoneId === group.id,
          );
          if (grouped.length === 0) return null;
          return (
            <section key={group.id ?? 'unassigned'} aria-label={group.title}>
              <h3>{group.title}</h3>
              <div className="control-task-list">
                {grouped.map((parent) => {
                  const children = tasks.filter(
                    (item) => item.parentId === parent.id,
                  );
                  return (
                    <div key={parent.id}>
                      <TaskRow
                        data={data}
                        task={parent}
                        children={children}
                        busy={busy || editorOpen}
                        apply={apply}
                        onEdit={setTaskEditor}
                      />
                      {children.map((child) => (
                        <TaskRow
                          key={child.id}
                          data={data}
                          task={child}
                          children={[]}
                          child
                          busy={busy || editorOpen}
                          apply={apply}
                          onEdit={setTaskEditor}
                        />
                      ))}
                      {!parent.archived &&
                        !project.archived &&
                        taskStatus(data, parent.id) !== 'done' && (
                          <div className="task-children-capture">
                            <QuickCapture
                              data={data}
                              projectId={projectId}
                              parentId={parent.id}
                              busy={busy || editorOpen}
                              onSave={onSave}
                              onError={onError}
                              label={`${parent.title} 하위 할 일 입력`}
                              placeholder="하위 할 일을 입력하고 Enter"
                            />
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </section>
  );
}
