// Keep old email links valid without initializing auth during normal local use.
export function cloudCallbackPath(hash: string, search = ''): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const callback =
    ['access_token', 'refresh_token', 'error', 'error_code'].some((key) =>
      params.has(key),
    ) || params.get('type') === 'recovery';
  return callback ? `/cloud${search}${hash}` : null;
}
