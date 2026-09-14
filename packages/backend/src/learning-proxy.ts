import { boundedText, privateHeaders as noStore } from './http.ts';
const failures: Record<number, [string, string]> = {
  400: ['INVALID_INPUT', '입력한 값과 요청 경로를 확인하세요.'],
  401: ['UNAUTHORIZED', '학습 서버의 계정과 비밀번호를 확인하세요.'],
  403: ['FORBIDDEN', '허용되지 않은 요청입니다.'],
  404: ['NOT_FOUND', '할 일을 찾을 수 없습니다. 목록을 새로고침하세요.'],
  409: ['CONFLICT', '다른 화면에서 수정했습니다. 새로고침 후 다시 시도하세요.'],
  413: ['PAYLOAD_TOO_LARGE', '입력 용량을 초과했습니다.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'JSON 요청이 필요합니다.'],
  429: ['RATE_LIMITED', '요청이 많습니다. 잠시 후 다시 시도하세요.'],
  503: [
    'UNAVAILABLE',
    'Kotlin 학습 서버의 실행 상태와 연결 설정을 확인하세요.',
  ],
};
function failure(status: number) {
  const [code, message] = failures[status] ?? failures[503];
  return Response.json(
    { success: false, error: { code, message } },
    { status, headers: noStore },
  );
}
function target(base: string | undefined): URL | null {
  if (!base) return null;
  try {
    const url = new URL(base);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      return null;
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
      return null;
    return url;
  } catch {
    return null;
  }
}
function validate(
  request: Request,
  id: string | undefined,
  webOrigin?: string,
): number | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.length > 4096 || !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(auth))
    return 401;
  if (id && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
    return 400;
  if (!['GET', 'POST', 'PUT'].includes(request.method)) return 400;
  if ((request.method === 'PUT') !== !!id) return 400;
  const source = new URL(request.url),
    origin = request.headers.get('origin');
  if (
    (origin && origin !== (webOrigin ?? source.origin)) ||
    (request.method !== 'GET' && !origin)
  )
    return 403;
  if (
    request.method !== 'GET' &&
    request.headers.get('content-type')?.split(';')[0] !== 'application/json'
  )
    return 415;
  for (const [key, value] of source.searchParams) {
    if (
      request.method !== 'GET' ||
      !['page', 'size'].includes(key) ||
      !/^\d{1,5}$/.test(value)
    )
      return 400;
    if (source.searchParams.getAll(key).length !== 1) return 400;
    if (
      (key === 'page' && Number(value) > 10000) ||
      (key === 'size' && (Number(value) < 1 || Number(value) > 100))
    )
      return 400;
  }
  return null;
}
export async function learningProxy(
  request: Request,
  base: string | undefined,
  id?: string,
  webOrigin?: string,
): Promise<Response> {
  const origin = target(base);
  if (!origin) return failure(503);
  const allowedWeb = webOrigin === undefined ? undefined : target(webOrigin);
  if (allowedWeb === null) return failure(503);
  const invalid = validate(request, id, allowedWeb?.origin);
  if (invalid) return failure(invalid);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
  const url = new URL(
    `/api/v1/tasks${id ? `/${id}` : ''}${new URL(request.url).search}`,
    origin,
  );
  try {
    const body =
      request.method === 'GET'
        ? undefined
        : await boundedText(request.body, 16384, signal);
    if (body === null) return failure(413);
    const upstream = await fetch(url, {
      method: request.method,
      body,
      headers: {
        authorization: request.headers.get('authorization')!,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'manual',
      signal,
    });
    if (![200, 201].includes(upstream.status)) {
      await upstream.body?.cancel();
      return failure(failures[upstream.status] ? upstream.status : 503);
    }
    const raw = await boundedText(upstream.body, 524288, signal);
    if (!raw) return failure(503);
    const result: unknown = JSON.parse(raw);
    if (
      !result ||
      typeof result !== 'object' ||
      !('success' in result) ||
      result.success !== true
    )
      return failure(503);
    return Response.json(result, { status: upstream.status, headers: noStore });
  } catch {
    return failure(503);
  }
}
