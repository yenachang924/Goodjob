import type { BackendConfig } from './supabase.ts';
import { configIssue } from './diagnostics.ts';
export function validBackendConfig(config: BackendConfig): boolean {
  return configIssue(config) === null;
}
