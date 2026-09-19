import type { BackendConfig } from './supabase.ts';

type ConfigIssue = {
  stage: 'config';
  field: keyof BackendConfig;
  reason: 'missing' | 'invalid';
};
type Diagnostic = ConfigIssue | { stage: 'initialize' };

function validUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return (
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' || (local && url.protocol === 'http:'))
    );
  } catch {
    return false;
  }
}

export function configIssue(
  config: Partial<BackendConfig>,
): ConfigIssue | null {
  for (const field of ['url', 'publishableKey', 'ownerId'] as const) {
    if (!config[field]) return { stage: 'config', field, reason: 'missing' };
  }
  if (!config.publishableKey!.trim())
    return { stage: 'config', field: 'publishableKey', reason: 'invalid' };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      config.ownerId!,
    )
  )
    return { stage: 'config', field: 'ownerId', reason: 'invalid' };
  if (!validUrl(config.url!))
    return { stage: 'config', field: 'url', reason: 'invalid' };
  return null;
}

export function reportUnavailable(
  issue: Diagnostic,
  logger: (label: string, metadata: Diagnostic) => void = console.error,
): Response {
  // Never pass environment values, request headers, or raw exceptions to logs.
  const metadata: Diagnostic =
    issue.stage === 'config'
      ? { stage: 'config', field: issue.field, reason: issue.reason }
      : { stage: 'initialize' };
  logger('[workspace-unavailable]', metadata);
  return Response.json(
    { error: 'Supabase와 소유자 설정이 필요합니다.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
