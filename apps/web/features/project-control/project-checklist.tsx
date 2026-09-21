import {
  INBOX_PROJECT_ID,
  saveProject,
  setTaskStatus,
  taskStatus,
  type ControlData,
  type ControlTask,
  type Project,
  type ProjectArea,
} from '@cockpit/shared/control';
import { QuickCapture } from './quick-capture';
import './project-checklist.css';

type Props = {
  data: ControlData;
  project: Project;
  busy: boolean;
  onSave(next: ControlData): Promise<boolean>;
  onOpen(id: string): void;
  onError(message: string): void;
};

function ChecklistRow({
  data,
  project,
  task,
  busy,
  apply,
}: {
  data: ControlData;
  project: Project;
  task: ControlTask;
  busy: boolean;
  apply(make: () => ControlData): Promise<boolean>;
}) {
  const done = taskStatus(data, task.id) === 'done';
  const parent = data.tasks.some(
    (item) => item.parentId === task.id && !item.archived,
  );
  return (
    <label className={`checklist-row${done ? ' is-done' : ''}`}>
      <input
        type="checkbox"
        aria-label={`${project.name} · ${task.title} 완료`}
        checked={done}
        disabled={busy || project.archived || parent}
        title={parent ? '하위 작업의 완료 상태를 따릅니다.' : undefined}
        onChange={() =>
          void apply(() =>
            setTaskStatus(data, task.id, done ? 'todo' : 'done', Date.now()),
          )
        }
      />
      <span>{task.title}</span>
    </label>
  );
}

function TaskBranch({
  task,
  tasks,
  ...props
}: {
  task: ControlTask;
  tasks: ControlTask[];
} & Parameters<typeof ChecklistRow>[0]) {
  const children = tasks.filter((item) => item.parentId === task.id);
  const pending = children.filter(
    (item) => taskStatus(props.data, item.id) !== 'done',
  );
  const done = children.filter(
    (item) => taskStatus(props.data, item.id) === 'done',
  );
  return (
    <li>
      <ChecklistRow {...props} task={task} />
      {pending.length > 0 && (
        <ul className="checklist-children">
          {pending.map((child) => (
            <li key={child.id}>
              <ChecklistRow {...props} task={child} />
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details className="checklist-completed checklist-children">
          <summary>완료한 하위 작업 {done.length}</summary>
          <ul>
            {done.map((child) => (
              <li key={child.id}>
                <ChecklistRow {...props} task={child} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

export function ProjectChecklist({
  data,
  project,
  busy,
  onSave,
  onOpen,
  onError,
}: Props) {
  const tasks = data.tasks.filter(
    (task) => task.projectId === project.id && !task.archived,
  );
  const roots = tasks.filter((task) => task.parentId === null);
  const pending = roots.filter((task) => taskStatus(data, task.id) !== 'done');
  const done = roots.filter((task) => taskStatus(data, task.id) === 'done');
  async function apply(make: () => ControlData) {
    if (busy) return false;
    try {
      return await onSave(make());
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '프로젝트를 저장하지 못했습니다.',
      );
      return false;
    }
  }
  const rowProps = { data, project, busy, apply, tasks };
  return (
    <article
      className="project-card project-checklist"
      aria-label={project.name}
    >
      <h3>
        <button
          type="button"
          className="checklist-title"
          aria-label={`${project.name} 열기`}
          onClick={() => onOpen(project.id)}
        >
          {project.name}
        </button>
      </h3>
      {project.archived && <small>보관됨</small>}
      {pending.length > 0 ? (
        <ul className="checklist-tasks">
          {pending.map((task) => (
            <TaskBranch key={task.id} {...rowProps} task={task} />
          ))}
        </ul>
      ) : (
        <p className="checklist-empty">
          {done.length
            ? '모든 할 일을 마쳤어요.'
            : '아래에 첫 할 일을 적어보세요.'}
        </p>
      )}
      {!project.archived && (
        <QuickCapture
          data={data}
          busy={busy}
          onSave={onSave}
          onError={onError}
          projectId={project.id}
          label={`${project.name} 할 일 입력`}
        />
      )}
      {done.length > 0 && (
        <details className="checklist-completed">
          <summary>완료한 할 일 {done.length}</summary>
          <ul>
            {done.map((task) => (
              <TaskBranch key={task.id} {...rowProps} task={task} />
            ))}
          </ul>
        </details>
      )}
      <details className="checklist-settings">
        <summary>설정</summary>
        <label>
          카테고리
          <select
            aria-label={`${project.name} 영역`}
            value={project.area ?? ''}
            disabled={busy || project.id === INBOX_PROJECT_ID}
            onChange={(event) =>
              void apply(() =>
                saveProject(data, {
                  ...project,
                  area: event.target.value
                    ? (event.target.value as ProjectArea)
                    : undefined,
                }),
              )
            }
          >
            <option value="">미분류</option>
            <option value="class">수업</option>
            <option value="project">프로젝트</option>
            <option value="study">개인공부</option>
          </select>
        </label>
        <button type="button" onClick={() => onOpen(project.id)}>
          프로젝트 관리
        </button>
      </details>
    </article>
  );
}
