import { validWorkspace, type WorkspaceData } from './workspace.ts';
export const MAX_WORKSPACE_BYTES = 1_000_000;
// Backup metadata is not part of the API request; allow room for that envelope.
export const MAX_BACKUP_BYTES = MAX_WORKSPACE_BYTES + 1024;
export function parseBackup(
  raw: string,
  currentRevision: number,
): WorkspaceData {
  if (currentRevision !== 0)
    throw new Error('빈 워크스페이스에만 가져올 수 있습니다.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('JSON 파일을 확인하세요.');
  }
  const data =
    typeof value === 'object' && value !== null && 'data' in value
      ? value.data
      : value;
  if (!validWorkspace(data)) throw new Error('백업 형식이 올바르지 않습니다.');
  if (
    new TextEncoder().encode(JSON.stringify({ data, revision: 0 })).byteLength >
    MAX_WORKSPACE_BYTES
  )
    throw new Error('저장 용량을 초과한 백업입니다.');
  return structuredClone(data);
}
