import { validData, type Data } from './planner.ts';
import { validControlData, type ControlData } from './control/index.ts';

export type WorkspaceData = Data | ControlData;

export function validWorkspace(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if ('version' in value) return value.version === 2 && validControlData(value);
  return validData(value);
}
