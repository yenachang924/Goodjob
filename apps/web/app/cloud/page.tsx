import { AuthGate } from '@/features/auth/auth-gate';

export default function CloudPage() {
  return (
    <>
      <nav className="account-bar" aria-label="저장 모드">
        <a href="/">로그인 없이 로컬 모드 사용</a>
      </nav>
      <AuthGate />
    </>
  );
}
