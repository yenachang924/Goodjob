import { env } from 'cloudflare:workers';
import { initialData, validData } from '@/lib/planner';
const headers = { 'Cache-Control': 'no-store' };
export async function GET() {
  try {
    const row = await env.DB.prepare(
      'SELECT data, revision FROM workspace WHERE id = ?',
    )
      .bind('personal')
      .first<{ data: string; revision: number }>();
    return Response.json(
      row
        ? { data: JSON.parse(row.data), revision: row.revision }
        : { data: initialData, revision: 0 },
      { headers },
    );
  } catch {
    return Response.json(
      { error: '저장된 정보를 불러오지 못했습니다. 다시 시도하세요.' },
      { status: 503, headers },
    );
  }
}
export async function PUT(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json(
      { error: '허용되지 않은 요청입니다.' },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 1000000)
      return Response.json(
        { error: '저장 용량을 초과했습니다.' },
        { status: 413 },
      );
    const body = JSON.parse(raw);
    if (
      !validData(body.data) ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0
    )
      return Response.json(
        { error: '입력한 날짜와 시간을 확인하세요.' },
        { status: 400 },
      );
    const row = await env.DB.prepare(
      'INSERT INTO workspace (id, data, revision) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET data = excluded.data, revision = workspace.revision + 1 WHERE workspace.revision = ? RETURNING revision',
    )
      .bind('personal', JSON.stringify(body.data), body.revision)
      .first<{ revision: number }>();
    if (!row)
      return Response.json(
        { error: '다른 탭에서 변경했습니다. 새로고침 후 다시 시도하세요.' },
        { status: 409 },
      );
    return Response.json({ revision: row.revision }, { headers });
  } catch {
    return Response.json(
      { error: '저장하지 못했습니다. 연결을 확인하고 다시 시도하세요.' },
      { status: 503 },
    );
  }
}
