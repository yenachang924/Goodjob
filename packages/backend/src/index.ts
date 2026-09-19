import 'server-only';
import { createWorkspaceHandlers } from './handlers.ts';
import { createDependencies } from './supabase.ts';
import { configIssue, reportUnavailable } from './diagnostics.ts';
export async function workspaceEndpoint(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const ownerId = process.env.COCKPIT_OWNER_ID;
  const issue = configIssue({ url, publishableKey, ownerId });
  if (issue) return reportUnavailable(issue);
  try {
    const handlers = createWorkspaceHandlers({
      ...createDependencies(
        { url: url!, publishableKey: publishableKey!, ownerId: ownerId! },
        request.headers.get('authorization') || '',
      ),
      webOrigin: process.env.COCKPIT_WEB_ORIGIN,
    });
    return request.method === 'GET'
      ? await handlers.GET(request)
      : await handlers.PUT(request);
  } catch {
    return reportUnavailable({ stage: 'initialize' });
  }
}
