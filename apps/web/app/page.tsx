import { AuthGate } from '@/features/auth/auth-gate';
import Link from 'next/link';
export default function Page() {
  return (
    <>
      <nav className="account-bar" aria-label="개발 학습">
        <Link href="/learn/tasks">백엔드 학습실</Link>
      </nav>
      <AuthGate />
    </>
  );
}
