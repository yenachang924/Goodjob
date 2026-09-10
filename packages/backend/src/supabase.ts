import { createClient } from '@supabase/supabase-js';
import { initialData, validData } from '@cockpit/shared';
import type { Repository } from './handlers.ts';
export type BackendConfig = {
  url: string;
  publishableKey: string;
  ownerId: string;
};
export function createDependencies(
  config: BackendConfig,
  authorization: string,
) {
  const client = createClient(config.url, config.publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const repository: Repository = {
    async read(userId) {
      const { data, error } = await client
        .from('cockpit_workspaces')
        .select('data,revision')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error('Workspace read failed');
      if (!data) return { data: structuredClone(initialData), revision: 0 };
      if (
        !validData(data.data) ||
        !Number.isSafeInteger(data.revision) ||
        data.revision < 1
      )
        throw new Error('Invalid stored workspace');
      return { data: data.data, revision: data.revision };
    },
    async save(_userId, data, revision) {
      const result = await client.rpc('save_cockpit_workspace', {
        p_data: data,
        p_revision: revision,
      });
      if (result.error) throw new Error('Workspace write failed');
      if (
        result.data !== null &&
        (!Number.isSafeInteger(result.data) || result.data < 1)
      )
        throw new Error('Invalid revision');
      return result.data as number | null;
    },
    async consumeRateLimit() {
      const { data, error } = await client.rpc('consume_cockpit_request');
      if (error || typeof data !== 'boolean')
        throw new Error('Rate limit unavailable');
      return data;
    },
  };
  return {
    ownerId: config.ownerId,
    repository,
    authenticate: async (token: string) => {
      const { data, error } = await client.auth.getUser(token);
      if (error) {
        if (error.status && error.status < 500) return null;
        throw new Error('Auth unavailable');
      }
      return data.user?.id ?? null;
    },
  };
}
