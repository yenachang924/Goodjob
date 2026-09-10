import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | undefined;
export function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    client ??= createClient(url, key);
    return client;
  } catch {
    return null;
  }
}
export async function workspaceRequest(options?: RequestInit) {
  const auth = getAuthClient();
  if (!auth) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await auth.auth.getSession();
  if (error || !data.session) throw new Error('로그인이 필요합니다.');
  return fetch('/api/workspace', {
    ...options,
    headers: {
      ...Object.fromEntries(new Headers(options?.headers)),
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
}
