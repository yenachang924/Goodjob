import 'server-only';
import { createWorkspaceHandlers } from './handlers.ts';
import { createDependencies } from './supabase.ts';
import { validBackendConfig } from './config.ts';
export async function workspaceEndpoint(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const ownerId = process.env.COCKPIT_OWNER_ID;
  const unavailable = () =>
    Response.json(
      { error: 'Supabase와 소유자 설정이 필요합니다.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  if (!url || !publishableKey || !ownerId) return unavailable();
  if (!validBackendConfig({ url, publishableKey, ownerId }))
    return unavailable();
  try {
    const handlers = createWorkspaceHandlers(
      createDependencies(
        { url, publishableKey, ownerId },
        request.headers.get('authorization') || '',
      ),
    );
    return request.method === 'GET'
      ? await handlers.GET(request)
      : await handlers.PUT(request);
  } catch {
    return unavailable();
  }
}
