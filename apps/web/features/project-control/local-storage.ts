import { validControlData, type ControlData } from '@cockpit/shared/control';
import { MAX_WORKSPACE_BYTES } from '@cockpit/shared/backup';

export const LOCAL_WORKSPACE_KEY = 'cockpit.local-workspace.v2';
type LocalStorage = Pick<Storage, 'getItem' | 'setItem'>;
type LocalLocks = {
  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
};
type RecordData = { data: ControlData; revision: number };
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
const failure = (error: string, status: number) => json({ error }, status);
const blocked = () =>
  failure(
    '브라우저 저장소를 사용할 수 없습니다. 저장소 권한과 일반 브라우저 모드를 확인하세요.',
    503,
  );
const corrupt = () =>
  failure(
    '저장된 데이터가 손상되었거나 지원하지 않는 형식입니다. 브라우저 데이터를 삭제하지 말고 원본을 백업한 뒤 복구하세요.',
    422,
  );

export function emptyLocalData(): ControlData {
  return {
    version: 2,
    projects: [],
    tasks: [],
    milestones: [],
    sessions: [],
    days: {},
    legacyActive: [],
  };
}

function read(storage: LocalStorage): RecordData | Response {
  let raw: string | null;
  try {
    raw = storage.getItem(LOCAL_WORKSPACE_KEY);
  } catch {
    return blocked();
  }
  if (raw === null) return { data: emptyLocalData(), revision: 0 };
  if (bytes(raw) > MAX_WORKSPACE_BYTES) return corrupt();
  try {
    const record = JSON.parse(raw);
    if (
      !record ||
      !Number.isSafeInteger(record.revision) ||
      record.revision < 1 ||
      !validControlData(record.data)
    )
      return corrupt();
    return { data: record.data, revision: record.revision };
  } catch {
    return corrupt();
  }
}

function parsePut(options: RequestInit): RecordData | Response {
  const contentType = new Headers(options.headers)
    .get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json')
    return failure('JSON 형식으로 저장 요청을 보내세요.', 415);
  if (typeof options.body !== 'string')
    return failure('저장할 데이터 형식을 확인하세요.', 400);
  if (bytes(options.body) > MAX_WORKSPACE_BYTES)
    return failure(
      '저장 용량 1MB를 넘었습니다. 먼저 백업한 뒤 오래된 기록을 정리하세요.',
      413,
    );
  try {
    const record = JSON.parse(options.body);
    if (
      !record ||
      !Number.isSafeInteger(record.revision) ||
      record.revision < 0 ||
      record.revision >= Number.MAX_SAFE_INTEGER ||
      !validControlData(record.data)
    ) {
      return failure('입력값과 프로젝트 연결 관계를 확인하세요.', 400);
    }
    return { data: record.data, revision: record.revision };
  } catch {
    return failure('저장할 JSON 형식을 확인하세요.', 400);
  }
}

function commit(storage: LocalStorage, next: RecordData): Response {
  const current = read(storage);
  if (current instanceof Response) return current;
  if (current.revision !== next.revision)
    return failure(
      '다른 탭에서 변경되었습니다. 새로고침 후 다시 확인하세요.',
      409,
    );
  const revision = next.revision + 1;
  const raw = JSON.stringify({ data: next.data, revision });
  if (bytes(raw) > MAX_WORKSPACE_BYTES)
    return failure(
      '저장 용량을 초과했습니다. 먼저 백업한 뒤 기록을 정리하세요.',
      413,
    );
  try {
    storage.setItem(LOCAL_WORKSPACE_KEY, raw);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      return failure(
        '브라우저 저장 용량이 부족합니다. 기존 기록을 백업하고 저장 공간을 확보하세요.',
        507,
      );
    }
    return blocked();
  }
  return json({ revision });
}

export function createLocalRequest(
  storage: LocalStorage,
  locks: LocalLocks | undefined,
) {
  return async (options: RequestInit = {}): Promise<Response> => {
    try {
      const method = (options.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        const record = read(storage);
        return record instanceof Response ? record : json(record);
      }
      if (method !== 'PUT')
        return failure('지원하지 않는 저장 요청입니다.', 405);
      const next = parsePut(options);
      if (next instanceof Response) return next;
      if (!locks)
        return failure(
          '안전한 저장을 지원하는 최신 Chrome, Edge, Firefox 또는 Safari 브라우저에서 HTTPS 주소로 열어주세요.',
          503,
        );
      // One origin-wide lock makes revision checking and writing atomic across tabs.
      return await locks.request(LOCAL_WORKSPACE_KEY, () =>
        commit(storage, next),
      );
    } catch {
      return blocked();
    }
  };
}

export async function localWorkspaceRequest(
  options?: RequestInit,
): Promise<Response> {
  try {
    return await createLocalRequest(
      window.localStorage,
      window.navigator.locks,
    )(options);
  } catch {
    return blocked();
  }
}
