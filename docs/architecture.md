# 기술 선택과 규모 판단

## 한 문장으로 설명하기

개인용 관제판은 독립 서버의 운영 비용보다 기능 완성과 데이터 안전이 중요하므로, **코드는 분리하고 배포는 하나로 유지하는 모듈형 모놀리스**를 선택했다.

## 현재 구조

```text
apps/web/app             화면 경로와 얇은 HTTP API 진입점
apps/web/features        로그인, 관제판, 백업 UI
apps/web/components      기존 접근성 UI 컴포넌트
packages/backend/src    서버 인증, API 정책, 저장소 접근
packages/backend/migrations  Postgres 권한과 원자적 저장 함수
packages/shared/src     순수 TypeScript 타입·계획·입력 검증
```

화면은 shared만 사용한다. Next 서버 API가 backend를 호출한다. backend는 shared와 Supabase에 의존한다. backend의 공개 진입점은 `server-only`로 브라우저 번들 유입을 막는다. 모노레포 구조 테스트도 역방향 의존성을 확인한다.

## 선택 / 이유 / 대안 / 변경 시점

| 선택 | 현재 문제를 해결하는 이유 | 대안과 선택하지 않은 이유 | 다시 검토할 조건 |
|---|---|---|---|
| Next.js + React + TypeScript | 기존 React UI를 재사용하고 같은 origin에서 UI/API를 단일 배포한다. 타입으로 데이터 경계를 표현한다. | React SPA + 별도 Hono/Express는 배포·CORS·인증 경계를 추가한다. 현재 API 수와 이용자는 작다. | 독립 모바일/API 소비자, 다른 서버 런타임 또는 독립 확장이 필요할 때 |
| Vercel 한 프로젝트 | 사용자 지정 배포 대상이며 Next 화면·Route Handler를 한 번에 운영한다. | 프런트/백엔드 프로젝트 2개는 지금은 독립 배포의 이익보다 운영 항목이 많다. | 긴 백그라운드 작업과 배포 주기가 실제로 달라질 때 |
| npm workspaces | 기존 npm lockfile 흐름을 유지하면서 3개 패키지의 로컬 연결과 통합 명령을 제공한다. | pnpm 전환은 현재 해결할 문제 없음. Turborepo는 지금 캐시/빌드 그래프 비용을 더한다. | 빌드 시간이 병목이 되거나 앱·개발자가 늘어날 때 |
| Supabase Postgres + Auth | Sites가 제공하던 인증과 영구 DB를 함께 대체한다. RLS로 DB에서도 소유자를 확인한다. | Neon+별도 인증은 공급자가 나뉜다. 로컬 SQLite는 서버리스 영구 저장소가 아니다. | 공급자 독립성이 중요해지거나 인증 요구가 서비스 지원 범위를 벗어날 때 |
| JSONB workspace + revision | 기존 저장 계약과 확정 슬롯 스냅샷을 그대로 옮긴다. 원자적 revision 비교로 덮어쓰기 경쟁을 막는다. | tasks/projects 정규화를 이전과 동시에 하면 데이터 변환·UI/API 변경이 겹친다. | 여러 사용자의 동시 편집, SQL 통계, 작업별 부분 갱신이 필요할 때 |
| 기존 순수 검증·추천 로직 | 프런트와 서버가 같은 규칙을 쓰고 이전 전후 결과를 비교할 수 있다. | LLM 추천은 비용·비결정성·비밀키 관리를 추가한다. 이번 작업은 호스팅 이전이다. | 자연어 조작/설명이 실제로 필요할 때 별도 제안 계층으로 추가 |
| Supabase SDK, 서버 getUser | 세션 갱신을 직접 구현하지 않고 서버는 검증된 사용자 ID만 신뢰한다. | 클라이언트 getSession 결과만 믿으면 서버 인증이 아니다. 자체 JWT/비밀번호 구현은 공격 표면을 늘린다. | SSR에서 사용자 정보를 미리 렌더링해야 한다면 cookie 기반 @supabase/ssr로 전환 |
| 기존 shadcn/Base UI + Tailwind | 기존 화면과 접근성 프리미티브를 유지해 기술 이전과 디자인 교체를 분리한다. | 새 UI 라이브러리는 사용자 가치 없이 회귀 범위를 넓힌다. | 실제 UI 요구가 라이브러리와 충돌할 때 |

## 인증·저장 경계

- 브라우저 SDK는 로그인/세션 갱신만 담당한다. API는 매 요청의 bearer를 Supabase `getUser`로 검증하고 서버의 `COCKPIT_OWNER_ID`와 비교한다.
- 익명·다른 계정은 API 401/403, 설정 누락은 503으로 차단한다. UI 게이트만으로 보안을 구현하지 않는다.
- 사용자별 RLS + DB의 cockpit_owners 허용 목록을 적용한다. 앱에 service_role 키를 두지 않는다.
- 직접 테이블 쓰기는 금지한다. 좁은 SECURITY DEFINER RPC가 auth.uid와 owner를 확인하고 원자적으로 revision을 비교한다. search_path는 빈 문자열이며 대상 스키마를 명시한다.
- API는 전체 도메인 검증과 스트리밍 UTF-8 1MB 제한을 수행한다. DB는 최상위 JSON 구조·크기·revision을 추가 확인한다. SQL이 TypeScript의 모든 중첩 검증을 복제하지는 않으므로, 소유자가 직접 RPC를 호출하는 운영 작업도 검증된 백업만 사용해야 한다.
- 인증된 API 요청은 DB 기반 분당 120회 제한. 익명 공격의 인증 조회 비용은 Vercel Firewall/Supabase Auth 제한으로 별도 보호해야 한다. 메모리 Map을 분산 레이트리밋이라고 주장하지 않는다.
- 이메일/비밀번호는 Supabase가 처리한다. 공개 회원가입은 끄고 소유자 계정을 관리자 화면에서 미리 만든다. 비밀번호를 앱 코드·환경변수·채팅에 저장하지 않는다.

## 의도적으로 만들지 않은 것

독립 Hono 서버, Redis, 큐, 마이크로서비스, 일반 사용자 가입, 실시간 협업, LLM, Slack·Obsidian 수집. Obsidian 로컬 파일 읽기는 Vercel의 역할이 아니며 추후 PC 연결 프로그램에서 수행한다.

## 비용·한계

소규모에 맞춘 선택이지 비용 0 보장은 아니다. Vercel 함수/대역폭, Supabase DB/인증/백업 정책은 선택한 요금제를 확인해야 한다. 서버리스 함수에 상시 파일 감시나 무한 루프를 두지 않는다. API 요청은 1,000,000바이트로 제한한다. 백업 파일은 메타데이터용 1,024바이트를 추가 허용하지만 가져올 실제 데이터는 API 제한을 다시 확인한다.

## 참고한 공식 자료

- [Next.js workspace transpilation](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase identity verification / sessions](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Vercel storage](https://vercel.com/docs/storage)

## 설명 예시

“모노레포를 쓴 이유는 서버를 여러 개 띄우기 위해서가 아니라 화면과 업무 규칙의 책임을 분리하기 위해서입니다. 1인용 앱이라 Next.js 한 배포로 충분하고, 인증과 DB는 Supabase에 맡겼습니다. 이전 과정에서는 JSONB와 기존 revision 계약을 유지해 데이터 손실 위험을 줄였고, 규모가 커지면 패키지 경계를 기준으로 서버 분리나 정규화를 할 수 있습니다.”
