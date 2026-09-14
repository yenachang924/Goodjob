'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LearningLogin({
  username,
  password,
  busy,
  onUsernameChange,
  onPasswordChange,
  onConnect,
}: {
  username: string;
  password: string;
  busy: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConnect: () => Promise<void>;
}) {
  return (
    <section className="panel learning-login">
      <h2>학습 서버 연결</h2>
      <p>
        서버에 설정한 전용 계정을 입력하세요. 새로고침하면 다시 연결해야 합니다.
      </p>
      <form
        className="task-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onConnect();
        }}
      >
        <label htmlFor="learn-username">
          학습 계정
          <Input
            id="learn-username"
            required
            maxLength={100}
            autoComplete="off"
            value={username}
            disabled={busy}
            onChange={(event) => onUsernameChange(event.target.value)}
          />
        </label>
        <label htmlFor="learn-password">
          학습 비밀번호
          <Input
            id="learn-password"
            type="password"
            required
            maxLength={256}
            autoComplete="off"
            value={password}
            disabled={busy}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? '연결 중…' : '학습 서버 연결'}
        </Button>
      </form>
      <small>
        자격증명은 이 화면의 메모리에만 보관합니다. 로컬 학습용 인증이며 원격
        사용에는 HTTPS가 필요합니다.
      </small>
    </section>
  );
}
