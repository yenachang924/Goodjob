export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const RECOVERY_COOLDOWN_SECONDS = 60;

export function validatePassword(password: string, confirmation: string) {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  )
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 입력해주세요.`;
  if (password !== confirmation) return '새 비밀번호가 서로 일치하지 않습니다.';
  return null;
}

export function authErrorMessage(error: unknown): string {
  const value =
    error && typeof error === 'object'
      ? (error as { code?: string; status?: number; name?: string })
      : {};
  if (
    value.status === 429 ||
    value.code === 'over_email_send_rate_limit' ||
    value.code === 'over_request_rate_limit'
  )
    return '요청이 많습니다. 잠시 기다린 뒤 다시 시도해주세요.';
  if (value.code === 'email_not_confirmed')
    return '이메일 인증이 필요합니다. 받은 메일함을 확인해주세요.';
  if (value.code === 'invalid_credentials')
    return '이메일 또는 비밀번호가 일치하지 않습니다.';
  if (value.code === 'same_password')
    return '기존 비밀번호와 다른 새 비밀번호를 입력해주세요.';
  if (value.code === 'weak_password')
    return '서버의 비밀번호 보안 조건을 충족하지 못했습니다. 더 길고 고유한 비밀번호를 입력해주세요.';
  if (
    value.code === 'session_not_found' ||
    value.name === 'AuthSessionMissingError'
  )
    return '인증 세션이 만료됐습니다. 재설정 메일을 다시 요청해주세요.';
  if (error instanceof TypeError || value.name === 'AuthRetryableFetchError')
    return '인증 서버에 연결하지 못했습니다. 인터넷 연결과 잠시 후 재시도를 확인해주세요.';
  return '인증 요청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

export function readAuthCallback(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const incompleteRecovery =
    params.get('type') === 'recovery' &&
    (!params.get('access_token') || !params.get('refresh_token'));
  const failed =
    params.has('error') || params.has('error_code') || incompleteRecovery;
  return {
    recovery: !failed && params.get('type') === 'recovery',
    error: failed
      ? params.get('error_code') === 'otp_expired'
        ? '이메일 링크가 만료됐거나 이미 사용됐습니다. 재설정 메일을 다시 요청해주세요.'
        : '이메일 링크를 확인하지 못했습니다. 재설정 메일을 다시 요청해주세요.'
      : null,
  };
}
