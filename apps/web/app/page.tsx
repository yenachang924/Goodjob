import { LocalEntry } from '@/features/project-control/local-entry';
import Link from 'next/link';
export default function Page() {
  return (
    <>
      <nav className="account-bar" aria-label="개발 학습">
        <Link href="/learn/tasks">백엔드 학습실</Link>
        <a href="/cloud">클라우드 모드 · 로그인</a>
      </nav>
      <LocalEntry />
    </>
  );
}
