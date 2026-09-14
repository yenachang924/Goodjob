import { validWorkspace, type WorkspaceData } from '@cockpit/shared/workspace';
import { MAX_WORKSPACE_BYTES } from '@cockpit/shared/backup';
import { boundedText, privateHeaders as headers } from './http.ts';
export type Snapshot = { data: WorkspaceData; revision: number };
export type Repository = {
  read: (userId: string) => Promise<Snapshot>;
  save: (
    userId: string,
    data: WorkspaceData,
    revision: number,
  ) => Promise<number | null>;
  consumeRateLimit: (userId: string) => Promise<boolean>;
};
type Dependencies = {
  ownerId: string;
  webOrigin?: string;
  authenticate: (token: string) => Promise<string | null>;
  repository: Repository;
};
const failure = (status: number, error: string) =>
  Response.json({ error }, { status, headers });
async function parseWrite(
  request: Request,
  webOrigin?: string,
): Promise<Snapshot | Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== (webOrigin ?? new URL(request.url).origin))
    return failure(403, '허용되지 않은 요청입니다.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return failure(415, 'JSON 요청이 필요합니다.');
  const raw = await boundedText(request.body, MAX_WORKSPACE_BYTES);
  if (raw === null) return failure(413, '저장 용량을 초과했습니다.');
  try {
    const body = JSON.parse(raw);
    if (
      !body ||
      !validWorkspace(body.data) ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      body.revision > 2147483646
    )
      return failure(400, '입력한 날짜와 시간을 확인하세요.');
    return { data: body.data, revision: body.revision };
  } catch {
    return failure(400, '올바른 JSON을 보내주세요.');
  }
}
export function createWorkspaceHandlers({
  ownerId,
  webOrigin,
  authenticate,
  repository,
}: Dependencies) {
  async function authorize(request: Request): Promise<string | Response> {
    if (!ownerId) return failure(503, '소유자 설정이 필요합니다.');
    const token = request.headers
      .get('authorization')
      ?.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token) return failure(401, '로그인이 필요합니다.');
    const userId = await authenticate(token);
    if (!userId) return failure(401, '로그인을 다시 해주세요.');
    if (userId !== ownerId) return failure(403, '소유자만 접근할 수 있습니다.');
    if (!(await repository.consumeRateLimit(userId)))
      return failure(429, '요청이 많습니다. 잠시 후 다시 시도하세요.');
    return userId;
  }
  async function handle(request: Request, write: boolean) {
    try {
      if (webOrigin !== undefined && !validWebOrigin(webOrigin))
        return failure(503, '허용할 웹 주소 설정을 확인하세요.');
      const userId = await authorize(request);
      if (userId instanceof Response) return userId;
      if (!write)
        return Response.json(await repository.read(userId), { headers });
      const body = await parseWrite(request, webOrigin);
      if (body instanceof Response) return body;
      const revision = await repository.save(userId, body.data, body.revision);
      return revision === null
        ? failure(409, '다른 탭에서 변경했습니다. 새로고침 후 다시 시도하세요.')
        : Response.json({ revision }, { headers });
    } catch {
      return failure(
        503,
        '저장소에 연결하지 못했습니다. 잠시 후 다시 시도하세요.',
      );
    }
  }
  return {
    GET: (request: Request) => handle(request, false),
    PUT: (request: Request) => handle(request, true),
  };
}

function validWebOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}
