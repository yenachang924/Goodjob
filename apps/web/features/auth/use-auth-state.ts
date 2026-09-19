'use client';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getAuthClient } from './client';
import { readAuthCallback } from './recovery';

type Mode = 'login' | 'request' | 'recovery' | 'complete';
const markerKey = 'cockpit.password-recovery-user';

// This user-bound tab marker only restores UI; Supabase validates all credentials.
function recoveryMarker(userId?: string | null) {
  try {
    if (userId === undefined) return sessionStorage.getItem(markerKey);
    if (userId === null) sessionStorage.removeItem(markerKey);
    else sessionStorage.setItem(markerKey, userId);
  } catch {
    /* Recovery still works when browser storage is unavailable. */
  }
  return null;
}

export function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [mode, setMode] = useState<Mode>('login');
  const [notice, setNotice] = useState('');
  const callback = useRef<ReturnType<typeof readAuthCallback> | null>(null);

  useEffect(() => {
    let alive = true;
    // Capture BEFORE creating the SDK: it consumes/removes the token fragment.
    const incoming = callback.current ?? readAuthCallback(window.location.hash);
    callback.current = incoming;
    if (incoming.error) {
      recoveryMarker(null);
      history.replaceState(
        history.state,
        '',
        window.location.pathname + window.location.search,
      );
      setNotice(incoming.error);
      setMode('request');
    } else if (incoming.recovery) setMode('recovery');
    const client = getAuthClient();
    if (!client) {
      setConfigured(false);
      setReady(true);
      return;
    }
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next);
      if (event === 'PASSWORD_RECOVERY' && next) {
        recoveryMarker(next.user.id);
        setNotice('');
        setMode('recovery');
        setReady(true);
      } else if (event === 'SIGNED_OUT') {
        if (!recoveryMarker()?.endsWith(':complete')) recoveryMarker(null);
        setMode((current) => (current === 'recovery' ? 'request' : current));
        setReady(true);
      } else if (event === 'INITIAL_SESSION') {
        const saved = recoveryMarker();
        const completed =
          saved?.endsWith(':complete') &&
          (!next || saved === `${next.user.id}:complete`);
        if (!incoming.error && !incoming.recovery && completed)
          setMode('complete');
        if (
          !incoming.error &&
          !incoming.recovery &&
          next &&
          recoveryMarker() === next.user.id
        )
          setMode('recovery');
        if (!next && !completed) recoveryMarker(null);
        // INITIAL_SESSION may precede PASSWORD_RECOVERY; never flash the workspace.
        if (!incoming.recovery) setReady(true);
      }
    });
    void client.auth
      .initialize()
      .then(({ error }) => {
        if (!alive || !error) return;
        history.replaceState(
          history.state,
          '',
          window.location.pathname + window.location.search,
        );
        recoveryMarker(null);
        setNotice(
          '이메일 링크를 확인하지 못했습니다. 새 재설정 메일을 요청해주세요.',
        );
        setMode('request');
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setNotice(
          '인증 서버에 연결하지 못했습니다. 새로고침 후 다시 시도해주세요.',
        );
        setMode('request');
        setReady(true);
      });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  function completeRecovery() {
    if (session) recoveryMarker(`${session.user.id}:complete`);
    setMode('complete');
  }
  function finishRecovery() {
    recoveryMarker(null);
    setNotice('비밀번호가 변경됐습니다. 새 비밀번호로 로그인해주세요.');
    setMode('login');
  }
  return {
    session,
    ready,
    configured,
    mode,
    setMode,
    notice,
    setNotice,
    completeRecovery,
    finishRecovery,
  };
}
