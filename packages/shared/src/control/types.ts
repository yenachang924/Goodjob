import type { Slot } from '../planner.ts';

export type ProjectArea = 'class' | 'project' | 'study';
export type Project = {
  id: string;
  name: string;
  description: string;
  link: string;
  archived: boolean;
  area?: ProjectArea;
};
export type Milestone = {
  id: string;
  projectId: string;
  title: string;
  due: string;
  achieved: boolean;
};
export type ControlTask = {
  id: string;
  projectId: string;
  parentId: string | null;
  milestoneId: string | null;
  title: string;
  minutes: number;
  priority: number;
  due: string;
  status: 'todo' | 'doing' | 'blocked' | 'done';
  scheduledFor?: string;
  blockedReason: string;
  createdAt: number | null;
  completedAt: number | null;
  archived: boolean;
};
export type TimeSession = {
  id: string;
  taskId: string;
  projectId: string;
  startedAt: number;
  endedAt: number | null;
  source: 'timer' | 'manual';
};
export type ControlDay = {
  capacity: number;
  buffer: number;
  confirmed: Slot[] | null;
};
export type LegacyTimer = { date: string; taskId: string; startedAt: number };
export type ControlData = {
  version: 2;
  projects: Project[];
  tasks: ControlTask[];
  milestones: Milestone[];
  sessions: TimeSession[];
  days: Record<string, ControlDay>;
  legacyActive: LegacyTimer[];
};
