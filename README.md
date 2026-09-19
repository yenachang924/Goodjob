# Goodjob — 오늘의 관제판

개인 프로젝트·학습 할 일, 가용시간, 추천안과 확정 계획을 관리하는 작은 모노레포.

- [왜 이 스택인가](docs/architecture.md)
- [Vercel 배포와 데이터 이전](docs/deployment.md)
- [비밀번호 재설정과 인증 주소 설정](docs/password-recovery.md)
- [Kotlin 백엔드 학습실 실행·선택 이유·학습 순서](docs/backend-learning.md)

## 로컬 실행

Node 22.13 이상, npm을 사용합니다. 저장소 루트에서 실행합니다.

```sh
npm ci
npm run dev
```

`apps/web/.env.example`을 참고해 `apps/web/.env.local`에 Supabase URL, publishable key, 소유자 UUID를 설정하세요. 설정이 없으면 안내 화면/API 503이 정상이며 임시 데이터로 우회하지 않습니다.

## 검사

`/learn/tasks`에 독립적인 Kotlin/Spring Boot 학습 화면이 추가되어 있습니다. 기존 관제판의 Supabase 데이터와 자동으로 합쳐지지 않습니다. API는 `apps/api`에서 별도로 실행합니다. 자세한 환경변수와 보안 경계는 위 학습 안내를 참고하세요.

```sh
npm test
npm run typecheck
npm run build
npm run test:coverage
npm audit --omit=dev
```

DB 테스트는 PGlite(Postgres)를 로컬에서 실행하므로 운영 DB를 변경하지 않습니다. Supabase Auth/RLS의 실제 호스팅 동작 및 Vercel 로그인·저장 E2E는 별도로 계정 설정 후 검증해야 합니다.

기존 Supabase SDK 검사는 로컬 HTTP 대역으로 bearer 전달·인증 오류·저장 응답을 확인합니다. Kotlin 학습실의 검사 범위와 결과는 [학습 안내](docs/backend-learning.md)에 구분해 기록합니다. 모듈 커버리지는 React 화면·서버 진입점을 포함한 전체 프로젝트 커버리지를 뜻하지 않습니다. 실제 Supabase 계정의 로그인·가져오기·저장 흐름 검증은 별도로 남아 있습니다.

## 책임

- apps/web: 화면과 API 진입점; Vercel Root Directory
- apps/api: 별도 실행하는 Kotlin/Spring Boot + Exposed + MySQL 학습 API; npm 빌드에 포함되지 않음
- packages/backend: 인증·저장·요청 제한; 별도 서버가 아님
- packages/shared: 서버/브라우저 공통 순수 로직
- docs/legacy: 기존 Sites 구성과 D1 스키마의 기록, 새 빌드에서 실행되지 않음

이전 Sites 서비스와 DB는 삭제하지 않았습니다. 이번 코드는 Slack, Obsidian, LLM이 연결됐다는 뜻이 아닙니다.
