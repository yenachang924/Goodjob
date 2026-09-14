# Vercel 배포·데이터 이전

## 배포 전 필요한 계정

Vercel 프로젝트, 전용 Supabase 프로젝트, Git 저장소 연결이 필요합니다. 계정이 연결되지 않은 상태에서 배포 성공이나 데이터 이전 완료를 주장하지 않습니다. 유료 플랜 전환은 별도 승인 없이 하지 않습니다.

## 1. Supabase 설정

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 새 전용 프로젝트를 만듭니다. 이름은 `goodjob`처럼 구분하기 쉽게 정하고 DB 비밀번호는 비밀번호 관리자에 보관합니다. 유료 전환은 필요 여부를 확인한 뒤 직접 결정하세요. 기존 다른 앱 DB에 이 SQL을 무작정 실행하지 않습니다.
2. SQL Editor에서 `packages/backend/migrations/001_cockpit.sql`을 한 번 실행합니다. 파괴적 삭제가 없는 초기 마이그레이션입니다. 재실행용 SQL이 아닙니다.
3. Auth 설정에서 공개 가입을 끄고, Auth Users에서 자신의 이메일/비밀번호 계정을 생성·확인합니다. 비밀번호는 Supabase UI에서만 입력합니다.
4. 생성된 실제 사용자 UUID를 다음 SQL의 문자열에 넣어 허용합니다.

```sql
insert into public.cockpit_owners(user_id) values ('실제-Supabase-사용자-UUID');
```

5. 프로젝트의 **Connect** 또는 **Settings → API Keys**에서 프로젝트 URL과 Publishable key를 확인합니다. service_role/secret key는 앱에 필요하지 않습니다. [공식 키 안내](https://supabase.com/docs/guides/getting-started/api-keys)

### 먼저 로컬에서 연결하기

`apps/web/.env.example`을 참고해 `apps/web/.env.local`에 아래 값을 직접 넣습니다. 비밀번호·비밀 키는 채팅에 보내지 마세요. 소유자 UUID는 위 Auth Users에서 만든 사용자의 ID이며 프로젝트 ID가 아닙니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
COCKPIT_OWNER_ID=YOUR_AUTH_USER_UUID
COCKPIT_WEB_ORIGIN=http://127.0.0.1:3000
```

저장소 루트에서 `npm run dev --workspace @cockpit/web -- --port 3000`을 실행하고 `http://127.0.0.1:3000`으로 접속합니다. 포트를 바꾸면 `COCKPIT_WEB_ORIGIN`도 같은 주소로 바꾸고 서버를 재시작하세요. 설정 없이 나오는 안내 화면은 정상이며, 테스트용 로그인이나 임시 DB가 실사용 저장소를 대신하지 않습니다.

로그인 → 새 워크스페이스 시작 → 프로젝트/작업 등록 → 새로고침 후 유지되는지 확인합니다. 기존 데이터가 있다면 새로 시작하기 전에 원본 백업을 준비하세요.

## 2. Vercel 프로젝트 하나

- 같은 Git 저장소를 연결하고 Root Directory를 `apps/web`로 설정합니다.
- Framework Preset: Next.js. 루트 바깥 workspace 패키지 파일을 빌드에 포함하도록 설정합니다.
- 커스텀 Output Directory는 지정하지 않습니다.
- Install Command는 저장소 루트에서 `npm ci`가 실행되도록 합니다. 필요하면 `cd ../.. && npm ci`를 지정합니다.
- Build Command: `npm run build` (web workspace 디렉터리에서 실행).
- Node 버전은 22.x로 맞춥니다.
- Preview/Production 환경변수를 각각 설정합니다. Preview에는 별도 테스트 DB를 권장합니다.

| 환경변수 | 위치 | 의미 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | 브라우저·서버 | 프로젝트 HTTPS URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | 브라우저·서버 | 공개 가능한 API 식별 키, RLS 필수 |
| COCKPIT_OWNER_ID | 서버 전용 | 허용한 실제 사용자 UUID |
| COCKPIT_WEB_ORIGIN | 서버 전용 | 실제 접속할 HTTPS 배포 origin, 경로·끝 슬래시 제외 |

NEXT_PUBLIC 값은 빌드에 들어가므로 변경 후 재배포합니다. DB 허용 목록의 UUID와 서버 UUID가 같아야 합니다. .env.local 파일은 커밋하지 않습니다.

## 3. 기존 Sites 데이터 가져오기

기존 앱의 저장 형식 `{data, revision}`을 새 앱이 읽습니다. 기존 사이트는 계속 유지하며, 원본 데이터에 쓰거나 삭제하지 않습니다.

1. 이전 Sites에서 본인으로 로그인합니다.
2. 같은 브라우저 탭에서 `/api/workspace`의 JSON 응답을 로컬 JSON 파일로 저장합니다. 로그인한 세션 안에서만 수행하고 토큰·쿠키를 복사하거나 공유하지 않습니다. 보안 설정상 직접 저장이 어렵다면 인증된 DB 내보내기를 별도 수행합니다.
3. 새 앱에서 소유자로 로그인한 뒤, 아무 계획도 저장하지 않은 상태에서 ‘데이터 백업·이전’의 파일 가져오기를 사용합니다.
4. 새 워크스페이스의 revision은 첫 저장 1부터 다시 시작합니다. task ID, 날짜, 확정 슬롯, 진행 타이머 timestamp 등 data 값은 그대로 보존합니다.
5. 이미 저장한 앱은 자동 덮어쓰지 않습니다. 기존 내용을 백업하고 별도 병합 절차를 결정해야 합니다.
6. 양쪽 프로젝트·할 일 수, 완료 상태, 계획 날짜·시간을 비교한 뒤 새 URL로 전환합니다. 원본 JSON은 안전한 장소에 보관합니다.

## 4. 배포 후 확인

- 로그아웃 상태 API: 401. 설정 누락: 503. 다른 로그인 계정: 403.
- 소유자 로그인 후 할 일 추가/수정/완료 → 새로고침 후 동일 데이터.
- 탭 두 개에서 동시에 수정 → 늦은 저장 409, 먼저 저장한 데이터 유지.
- 시간 초과 계획 확정 불가, 기존 확정 계획은 변경안 적용 전 유지.
- JSON 백업/빈 워크스페이스 가져오기 비교.
- 모바일·데스크톱 로그인/관제판 흐름 E2E.

## 운영 관찰·롤백

첫 사용 세션 동안 운영자(본인)가 Vercel `/api/workspace` 응답과 Supabase Auth/Postgres 로그를 확인합니다. 정상은 owner 200, anon 401, 충돌 409입니다. 반복되는 owner 403/503, 저장 후 데이터 불일치, DB 권한 오류는 전환 중단 신호입니다. 서버 로그에 access token이나 전체 노트 내용을 남기지 않습니다.

문제가 있으면 기존 Sites URL을 계속 사용하고 새 앱 쓰기를 중단합니다. 새 앱에서 추가한 데이터가 있다면 먼저 백업하세요. Sites와 Supabase는 자동 동기화되지 않으므로 무조건 롤백하면 그 사이 변경이 자동으로 합쳐지지 않습니다.

인증 전 요청 폭주는 Vercel Firewall 및 Supabase Auth의 레이트리밋을 확인해 제한합니다. 앱의 분당 120회 DB 제한은 인증된 사용자의 요청에만 적용됩니다.
