'use client';
import { useEffect, useState, type SyntheticEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getAuthClient } from './client';
import Cockpit from '@/features/cockpit/cockpit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false),
    [configured, setConfigured] = useState(true);
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const client = getAuthClient();
    if (!client) {
      queueMicrotask(() => {
        if (alive) {
          setConfigured(false);
          setReady(true);
        }
      });
      return () => {
        alive = false;
      };
    }
    // INITIAL_SESSION and subsequent changes share one ordered SDK subscription.
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (alive) {
        setSession(next);
        setReady(true);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function login(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const client = getAuthClient();
      if (!client) throw new Error('설정 필요');
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword('');
    } catch {
      setError('로그인하지 못했습니다. 등록된 이메일과 비밀번호를 확인하세요.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      const result = await getAuthClient()?.auth.signOut();
      if (result?.error) throw result.error;
      setSession(null);
    } catch {
      setError('로그아웃에 실패했습니다. 다시 시도하세요.');
    } finally {
      setBusy(false);
    }
  }
  if (session)
    return (
      <>
        <div className="account-bar">
          <span>개인 워크스페이스</span>
          <Button variant="ghost" disabled={busy} onClick={logout}>
            로그아웃
          </Button>
          {error && <span role="alert">{error}</span>}
        </div>
        <Cockpit key={session.user.id} />
      </>
    );
  return (
    <main className="auth-page">
      <section className="panel auth-panel">
        <p className="eyebrow">MY WORKSPACE</p>
        <h1>오늘의 관제판</h1>
        {!ready ? (
          <p>로그인을 확인하고 있어요.</p>
        ) : !configured ? (
          <>
            <h2>연결 설정이 필요합니다</h2>
            <p>
              Supabase 연결과 소유자 계정을 설정하면 사용할 수 있습니다. 기존
              관제판의 데이터는 변경되지 않았습니다.
            </p>
          </>
        ) : (
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
                onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
          </form>
        )}
      </section>
    </main>
  );
}
