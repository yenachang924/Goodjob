import type { BackendConfig } from './supabase.ts';
export function validBackendConfig(config: BackendConfig): boolean {
  if (!config.publishableKey.trim()) return false;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      config.ownerId,
    )
  )
    return false;
  try {
    const url = new URL(config.url);
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
