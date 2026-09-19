'use client';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAuthClient } from './client';
import {
  authErrorMessage,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  RECOVERY_COOLDOWN_SECONDS,
  validatePassword,
} from './recovery';

export function RequestRecovery({
  onBack,
  backLabel = '로그인으로 돌아가기',
}: {
  onBack: () => void;
  backLabel?: string;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError('');
    setSent(false);
    try {
      const client = getAuthClient();
      if (!client) throw new Error('Missing auth configuration');
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setSent(true);
      setCooldown(RECOVERY_COOLDOWN_SECONDS);
    } catch (error) {
      setError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="task-form" onSubmit={submit}>
      <h2>비밀번호 재설정</h2>
      <p>가입한 이메일로 새 비밀번호를 설정할 링크를 보내드립니다.</p>
      <label htmlFor="recovery-email">
        이메일
        <Input
          id="recovery-email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
        />
      </label>
      <Button type="submit" disabled={busy || cooldown > 0}>
        {busy
          ? '메일 요청 중…'
          : cooldown > 0
            ? `${cooldown}초 후 다시 요청`
            : '재설정 메일 보내기'}
      </Button>
      {sent && (
        <p role="status">
          등록된 이메일이라면 재설정 메일이 발송됩니다. 스팸함도 확인하고 가장
          최근 메일의 링크를 한 번만 눌러주세요.
        </p>
      )}
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>
        {backLabel}
      </Button>
    </form>
  );
}

export function UpdatePassword({
  onComplete,
  onRetry,
}: {
  onComplete: () => void;
  onRetry: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const invalid = validatePassword(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const client = getAuthClient();
      if (!client) throw new Error('Missing auth configuration');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmation('');
      onComplete();
    } catch (error) {
      setError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="task-form" onSubmit={submit}>
      <h2>새 비밀번호 설정</h2>
      <p>
        다른 서비스에서 사용하지 않는 {PASSWORD_MIN_LENGTH}~
        {PASSWORD_MAX_LENGTH}자 비밀번호를 입력해주세요.
      </p>
      <label htmlFor="new-password">
        새 비밀번호
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
        />
      </label>
      <label htmlFor="confirm-password">
        새 비밀번호 확인
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={busy}
        />
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? '변경 중…' : '비밀번호 변경'}
      </Button>
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      <Button type="button" variant="ghost" disabled={busy} onClick={onRetry}>
        재설정 메일 다시 요청
      </Button>
    </form>
  );
}

export function RecoveryComplete({
  onSignedOut,
  hasSession,
}: {
  onSignedOut: () => void;
  hasSession: boolean;
}) {
  const [busy, setBusy] = useState(hasSession);
  const [error, setError] = useState('');
  async function finish() {
    setBusy(true);
    setError('');
    try {
      const client = getAuthClient();
      if (!client) throw new Error('Missing auth configuration');
      const { error } = await client.auth.signOut();
      if (error) throw error;
      onSignedOut();
    } catch {
      setError(
        '비밀번호는 변경됐지만 로그아웃하지 못했습니다. 아래 버튼으로 다시 시도해주세요.',
      );
    } finally {
      setBusy(false);
    }
  }
  // Runs only after updateUser succeeds; retrying logout never repeats the update.
  useEffect(() => {
    if (hasSession) void finish();
  }, []);
  return (
    <div className="task-form">
      <h2>비밀번호 변경 완료</h2>
      <p role="status">
        새 비밀번호가 저장됐습니다. 로그인 화면으로 이동합니다.
      </p>
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      <Button disabled={busy} onClick={() => void finish()}>
        로그인으로 돌아가기
      </Button>
    </div>
  );
}
