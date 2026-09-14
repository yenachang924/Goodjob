'use client';

import { Button } from '@/components/ui/button';
import { LearningLogin } from './learning-login';
import { TaskWorkspace } from './task-workspace';
import { useTaskLab } from './use-task-lab';

export function TaskLab() {
  const lab = useTaskLab();

  return (
    <main className="learning-shell">
      <header className="learning-header">
        <a href="/">← 기존 관제판</a>
        <span>KOTLIN · SPRING BOOT</span>
      </header>
      <section className="learning-heading">
        <p className="eyebrow">GOODJOB / BACKEND LAB</p>
        <h1>백엔드 학습실</h1>
        <p>화면에서 보낸 요청이 API와 SQL을 거쳐 저장되는 과정을 배워요.</p>
      </section>
      <aside className="learning-boundary">
        기존 관제판과 분리된 학습 DB입니다. Supabase 데이터는 변경하지 않으며
        자동으로 가져오지 않습니다.
      </aside>
      {lab.error && (
        <div className="learning-error" role="alert">
          {lab.error}
          {lab.auth && (
            <Button
              variant="outline"
              disabled={lab.busy}
              onClick={() => {
                lab.setEditing(undefined);
                void lab.refresh();
              }}
            >
              목록 새로고침
            </Button>
          )}
        </div>
      )}
      {!lab.auth ? (
        <LearningLogin
          username={lab.username}
          password={lab.password}
          busy={lab.busy}
          onUsernameChange={lab.setUsername}
          onPasswordChange={lab.setPassword}
          onConnect={lab.connect}
        />
      ) : (
        <TaskWorkspace
          result={lab.result}
          editing={lab.editing}
          busy={lab.busy}
          notice={lab.notice}
          formKey={lab.formKey}
          onEdit={lab.setEditing}
          onSave={lab.save}
          onCancelEdit={() => lab.setEditing(undefined)}
          onRefresh={lab.refresh}
          onDisconnect={lab.disconnect}
        />
      )}
      <footer className="learning-footer">
        학습 순서: 요청 검증 → 서비스 규칙 → 트랜잭션 → SQL → 응답 · 자세한
        안내: 저장소의 docs/backend-learning.md
      </footer>
    </main>
  );
}
