# Kotlin Task API Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement the independently owned API and web units, with tests before behavior changes.

**Goal:** 기존 관제판을 보존하면서 Kotlin 서버에 실제 저장되는 할 일 등록·조회·수정·완료 기능을 별도 학습 화면에서 사용한다.

**Architecture:** `apps/api`는 독립 Spring Boot 서버, `apps/web/learn/tasks`는 학습 클라이언트다. Next의 고정 대상 프록시가 명시적 Basic 헤더만 전달한다. Supabase workspace와 새 project/task 테이블 사이의 이중 쓰기나 자동 동기화는 없다.

**Tech Stack:** Spring Initializr Maven wrapper, Kotlin 2.3.21, Spring Boot 4.1.1, Java 21 bytecode, Exposed 1.5.0 JDBC, MySQL, Flyway SQL, OpenAPI 3.0.3, 기존 Next.js/TypeScript.

## Global Constraints

- 사용자 목적은 백엔드 학습이다. 기존 Supabase API, 화면, 데이터, GitHub main은 변경·배포하지 않는다.
- 새 작업은 `feat/kotlin-task-api` 브랜치에서 진행한다. AWS, Sentry, Redis, Batch, 외부 수집은 이번 구현 범위가 아니다.
- 초기 한 명의 학습 사용자만 지원한다. 계정은 서버 환경변수로 명시하고 기본 비밀번호는 없다.
- HTTP Basic은 루프백 로컬 학습용이다. 원격 운영에는 TLS와 인증 설계 재검토가 필수다. 브라우저는 입력한 자격증명을 메모리에만 저장하며 쿠키·localStorage를 쓰지 않는다.
- 서버 기본 바인딩은 127.0.0.1이다. MySQL이 기본 저장소이며 H2는 명시적 로컬 연습/테스트 프로필에만 허용한다. H2 검증을 MySQL 검증이라고 부르지 않는다.
- 파일은 역할별 분리, 사용자 입력 검증, 파라미터 바인딩, 상태 변경은 DB 트랜잭션과 revision 비교를 사용한다.
- 전체 프로젝트 80% 또는 운영 E2E를 측정하지 않고 달성했다고 주장하지 않는다.

## Shared HTTP Contract

`GET /api/v1/tasks?page=0&size=20` → `{success:true,data:Task[],meta:{total,page,limit}}`.

`POST /api/v1/tasks` → 201 `{success:true,data:Task}`.

`PUT /api/v1/tasks/{uuid}` → 200 `{success:true,data:Task}`; revision은 조건부 갱신에 사용.

```typescript
type TaskInput = { project: string; title: string; minutes: number; priority: number; done: boolean; due: string };
type Task = TaskInput & { id: string; revision: number };
type TaskUpdate = TaskInput & { revision: number };
type ApiError = { success: false; error: { code: string; message: string } };
```

project 1..100자, title 1..300자(공백만 불가), minutes 정수 1..1440, priority 정수 1..3, done boolean, due는 빈 문자열 또는 실제 ISO 날짜. revision은 1 이상의 정수. size 1..100, page 0 이상 제한된 정수. 정렬은 id로 안정화한다. POST는 revision을 받지 않는다.

프로젝트 이름은 trim 후 한 프로젝트로 정규화한다. 동일한 이름의 동시 등록은 unique constraint와 트랜잭션을 이용한다. task 수정의 프로젝트 생성도 실패하면 롤백한다.

401 인증 실패, 400 입력 오류, 404 없는 task, 409 stale revision, 413 body 제한, 415 media type, 429 rate limit, 503 저장소 장애. 응답은 no-store. 외부 예외의 SQL·호스트·자격증명을 반환하지 않는다.

## U1: Kotlin API / persistence / security

**Files:** `apps/api/pom.xml`, wrapper, `src/main/kotlin/dev/goodjob/{tasks,security,config}`, `src/main/resources/{application.yml,application-local.yml,db/migration/V1__tasks.sql}`, `src/test/kotlin/dev/goodjob`, `openapi.yaml`, `.env.example`.

**Interfaces:** 위 HTTP 계약을 제공한다. 로컬 연습 계정 환경변수 `GOODJOB_USERNAME`, `GOODJOB_PASSWORD`; DB 환경변수 `GOODJOB_DB_URL`, `GOODJOB_DB_USERNAME`, `GOODJOB_DB_PASSWORD`; 기본 포트 8080.

- [ ] 공식 Initializr 골격과 wrapper를 가져와 컴파일 환경을 확인한다. 생성된 골격은 구성 검증 예외이며 동작 구현은 아래 RED 이후 시작한다.
- [ ] 실제 보안 필터·HTTP·Exposed 경로를 통과하는 실패 테스트를 먼저 실행한다.

```kotlin
mockMvc.perform(get("/api/v1/tasks").with(httpBasic("learner", testPassword)))
    .andExpect(status().isOk)
    .andExpect(jsonPath("$.data").isEmpty)
```

- [ ] POST→GET→PUT(done=true)→GET, 잘못된 입력, 401, 404, 409를 순서대로 RED→GREEN 구현한다. 정규화된 projects/tasks 스키마, Exposed repository, service, controller를 나눈다.
- [ ] 요청 크기·rate limit과 명시적 헤더 기반 stateless 인증 정책을 검사한다. DB 실패는 일반 오류로 변환한다.
- [ ] SQL 특수문자 literal 저장, 외래키, 같은 프로젝트 재사용, stale update의 미변경을 검증한다.
- [ ] `./mvnw verify`로 테스트·커버리지를 확인한다. MySQL 환경이 없으면 그 제약을 별도로 기록하고 실행 가능한 MySQL 검사 경로를 제공한다.

## U2: Next proxy and isolated learning screen

**Files:** `apps/web/app/learn/tasks/page.tsx`, `apps/web/features/learning-tasks/*`, `apps/web/app/api/learn/tasks/route.ts`, `apps/web/app/api/learn/tasks/[id]/route.ts`, `packages/backend/src/learning-proxy.ts`, `packages/backend/tests/learning-proxy.test.mjs`.

**Interfaces:** 프록시는 GET/POST/PUT만 받고 `GOODJOB_API_URL`의 `/api/v1/tasks`로 전달한다. 주소 설정이 없으면 503이다. 서버 전용 진입점을 거치며 클라이언트 번들에 백엔드 코드가 포함되지 않는다.

- [ ] 고정 대상, query allowlist, bearer 거부, Origin 검사, no-store, upstream 401/409 전달, redirect 거부, body/timeout 제한을 로컬 HTTP 대역으로 먼저 테스트한다.

```javascript
assert.equal((await proxy(new Request('http://app/api/learn/tasks'), undefined)).status, 503);
assert.equal((await proxy(requestWithoutAuthorization, 'http://127.0.0.1:8080')).status, 401);
```

- [ ] 서버 프록시를 구현하고 Node 테스트를 통과시킨다.
- [ ] 화면에 계정 입력, 학습 DB 분리 안내, 등록 폼, 목록, 수정·완료, pagination, loading/error/empty/conflict 상태를 구현한다. 새 CSS는 학습 화면에만 scope한다.
- [ ] 기존 화면 링크는 만들되 기존 저장 경로를 바꾸지 않는다. 브라우저에서 계정 입력→등록→수정→완료→재로그인 후 재조회 흐름을 확인한다.

## U3: Learning notes and final verification

**Files:** `docs/backend-learning.md`, `README.md`, `.gitignore`, 필요한 로컬 실행 구성.

- [ ] 요청이 controller→service→repository→SQL→응답으로 흐르는 과정을 실제 파일과 연결해 설명한다.
- [ ] MySQL과 H2 차이, Basic의 한계, revision 충돌, 트랜잭션 경계, 향후 사용자별 인증 전환을 문서화한다.
- [ ] `npm test`, `npm run typecheck`, `npm run build`, API `./mvnw verify`, 브라우저 흐름을 확인한다. 실제 실행한 DB와 측정한 커버리지 범위를 적는다.
- [ ] 코드·보안 리뷰 지적을 수정하고 재검증한다. 배포나 데이터 이전 완료를 주장하지 않는다.
