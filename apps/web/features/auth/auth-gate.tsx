'use client';
import { useState, type SyntheticEvent } from 'react';
import { getAuthClient } from './client';
import { useAuthState } from './use-auth-state';
import { authErrorMessage } from './recovery';
import {
  RecoveryComplete,
  RequestRecovery,
  UpdatePassword,
} from './recovery-forms';
import Cockpit from '@/features/cockpit/cockpit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AuthGate() {
  const auth = useAuthState();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    setError('');
    try {
      const result = await getAuthClient()?.auth.signOut();
      if (result?.error) throw result.error;
    } catch {
      setError('로그아웃에 실패했습니다. 다시 시도하세요.');
    } finally {
      setBusy(false);
    }
  }
  if (auth.ready && auth.session && auth.mode === 'login')
    return (
      <>
        <div className="account-bar">
          <span>{auth.session.user.email ?? '개인 워크스페이스'}</span>
          <Button variant="ghost" disabled={busy} onClick={logout}>
            로그아웃
          </Button>
          {error && <span role="alert">{error}</span>}
        </div>
        <Cockpit key={auth.session.user.id} />
      </>
    );
  return (
    <main className="auth-page">
      <section className="panel auth-panel">
        <p className="eyebrow">MY WORKSPACE</p>
        <h1>오늘의 관제판</h1>
        {!auth.ready ? (
          <p role="status">로그인을 확인하고 있어요.</p>
        ) : !auth.configured ? (
          <>
            <h2>연결 설정이 필요합니다</h2>
            <p>
              Supabase 연결과 소유자 계정을 설정하면 사용할 수 있습니다. 기존
              관제판의 데이터는 변경되지 않았습니다.
            </p>
          </>
        ) : (
          <AuthContent auth={auth} />
        )}
      </section>
    </main>
  );
}

function AuthContent({ auth }: { auth: ReturnType<typeof useAuthState> }) {
  if (auth.mode === 'complete')
    return (
      <RecoveryComplete
        hasSession={Boolean(auth.session)}
        onSignedOut={auth.finishRecovery}
      />
    );
  if (auth.mode === 'recovery' && auth.session)
    return (
      <UpdatePassword
        onComplete={auth.completeRecovery}
        onRetry={() => auth.setMode('request')}
      />
    );
  if (auth.mode === 'request' || auth.mode === 'recovery')
    return (
      <>
        {auth.notice && (
          <p role="alert" className="danger">
            {auth.notice}
          </p>
        )}
        <RequestRecovery
          backLabel={auth.session ? '새 비밀번호 설정으로 돌아가기' : undefined}
          onBack={() => {
            auth.setNotice('');
            auth.setMode(auth.session ? 'recovery' : 'login');
          }}
        />
      </>
    );
  return (
    <>
      {auth.notice && <p role="status">{auth.notice}</p>}
      <LoginForm
        onRecovery={() => {
          auth.setNotice('');
          auth.setMode('request');
        }}
      />
    </>
  );
}

function LoginForm({ onRecovery }: { onRecovery: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function login(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const client = getAuthClient();
      if (!client) throw new Error('Missing auth configuration');
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword('');
    } catch (error) {
      setError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="task-form" onSubmit={login}>
      <p>미리 등록한 소유자 계정으로 로그인하세요.</p>
      <label htmlFor="email">
        이메일
        <Input
          id="email"
          autoComplete="username"
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
        />
      </label>
      <label htmlFor="password">
        비밀번호
        <Input
          id="password"
          autoComplete="current-password"
          type="password"
          required
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
        />
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? '로그인 중…' : '로그인'}
      </Button>
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={onRecovery}
      >
        비밀번호를 잊으셨나요?
      </Button>
    </form>
  );
}
