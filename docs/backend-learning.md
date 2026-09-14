# Goodjob 백엔드 학습실

목표는 여러 기술을 설치하는 것이 아니라 **할 일 하나가 요청 검증 → 서비스 → 트랜잭션 → SQL → 응답을 거치는 과정을 설명하고 직접 바꾸는 것**이다.

## 이번 범위

- 기존 `/` 관제판은 Supabase를 그대로 사용한다.
- `/learn/tasks`는 별도의 Kotlin API와 학습 DB를 사용한다. 기존 데이터 이전·이중 쓰기·자동 동기화는 하지 않는다.
- 학습 화면에서 할 일 등록, 목록 조회, 수정, 완료/완료 취소를 수행한다.
- 프로젝트 이름은 저장할 때 정규화하고 재사용한다. 프로젝트 관리 API, 삭제, 시간 배치, 외부 수집은 다음 단계다.

## 왜 이 기술인가

| 선택 | 여기서 배울 것 | 아직 넣지 않는 것 |
| --- | --- | --- |
| Kotlin + Spring Boot | 타입, DI, HTTP 계층, 검증, 인증·오류 처리 | 마이크로서비스 분리 |
| MySQL | 관계형 모델, unique/FK, 트랜잭션, 동시 수정 | DynamoDB·BigQuery |
| Exposed JDBC | Kotlin DSL과 실제 SQL의 관계, 명시적인 저장소 책임 | JPA와 동시 사용 |
| Flyway | 스키마 변경을 순서 있는 SQL 파일로 관리 | 앱 시작 때 임의 테이블 자동 생성 |
| OpenAPI | 프런트와 백엔드의 언어 독립적인 HTTP 계약 | gRPC·Protocol Buffers |
| 기존 Next.js | 이미 만든 화면 보존, 서버 전용 프록시 | 프런트 재작성 |

Redis는 측정된 캐시/분산 제한 문제가 생기면, Spring Batch는 재시작·체크포인트가 필요한 수집/집계 작업이 생기면 검토한다. Kafka, Kubernetes, Istio, 여러 관측 도구를 이번 단일 사용자 CRUD에 한꺼번에 넣지 않는다. AWS 배포는 로컬 API와 데이터 모델을 이해한 뒤 별도 단계로 진행한다.

## 저장소 구조와 요청 경로

```text
apps/web          Next 화면과 /api/learn/tasks 프록시
apps/api          독립 Kotlin/Spring Boot 프로세스 (Maven)
packages/backend  기존 Supabase 처리 + Next용 프록시 정책 (TypeScript)
packages/shared   공통 순수 도메인 로직 (TypeScript)
```

`packages/backend`는 Kotlin 서버가 아니며 삭제하지 않는다. Kotlin 빌드는 npm workspaces와 독립적이다. HTTP/OpenAPI가 두 언어 사이의 계약이며 TypeScript 타입을 Kotlin에서 직접 가져오지 않는다.

```text
TaskEditor → client.ts → Next route → learning-proxy.ts
  → Kotlin Controller → Service → Exposed Repository → MySQL
  ← { success, data, meta? } 또는 { success: false, error }
```

Kotlin 구현과 계약은 `apps/api/src/main/kotlin/dev/goodjob` 및 `apps/api/openapi.yaml`을 함께 읽는다. SQL은 `apps/api/src/main/resources/db/migration`에 있다.

## 로컬 실행

준비물: Node 22.13+, Java 21 이상, MySQL 8.4. Maven은 저장소의 wrapper를 사용한다. `.env.example`은 설명용이며 Spring Boot가 `.env` 파일을 자동으로 읽는 것은 아니다.

1. MySQL에 **학습 전용** 데이터베이스와 사용자 계정을 준비한다. 기존/운영 DB를 지정하지 않는다. Flyway 실행 계정에는 이 DB의 DDL 권한도 필요하다. 원격 운영에서는 migration 계정과 runtime 계정을 분리한다.
2. PowerShell 터미널에서 API를 실행한다. 아래 자리표시는 본인 값으로 바꾸며 실제 비밀번호를 커밋하지 않는다.

```powershell
cd apps/api
$env:GOODJOB_USERNAME = '본인학습계정'
$env:GOODJOB_PASSWORD = '본인이정한긴학습용비밀번호'
$env:GOODJOB_DB_URL = 'jdbc:mysql://127.0.0.1:3306/goodjob_learning'
$env:GOODJOB_DB_USERNAME = '본인DB계정'
$env:GOODJOB_DB_PASSWORD = '본인DB비밀번호'
.\mvnw.cmd spring-boot:run
```

macOS/Linux에서는 같은 환경변수를 `export`로 지정하고 `sh ./mvnw spring-boot:run`을 사용한다. `JAVA_HOME`이 JDK 설치 경로를 가리키는지 확인한다. MySQL 인증 방식에 따라 로컬 JDBC 연결 옵션이 추가로 필요할 수 있다. 원격 DB에서 TLS를 끄지 않는다.

Windows의 wrapper가 Maven을 처음 내려받다가 TLS 오류로 중단되면 이미 설치한 Maven 3.9.16의 `mvn.cmd`로 같은 목표를 실행할 수 있다. 인증서 검증을 끄지 않는다. 이 작업 환경에서도 wrapper 다운로드는 TLS 오류가 났으며, 공식 배포본의 SHA-512를 확인한 별도 Maven으로 빌드했다. 제한된 환경에서 Kotlin daemon 디렉터리 접근 오류가 나면 `-Dkotlin.compiler.daemon=false`로 프로세스 내 컴파일을 사용한다.

3. 다른 터미널에서 저장소 루트의 프런트를 실행한다.

```powershell
npm ci
$env:GOODJOB_API_URL = 'http://127.0.0.1:8080'
$env:GOODJOB_WEB_ORIGIN = 'http://localhost:3000'
npm run dev
```

두 설정은 `apps/web/.env.local`에 넣어도 된다. 서버를 재시작해야 적용된다. API 주소에는 `/api/v1/tasks`를 붙이지 않는다. `GOODJOB_WEB_ORIGIN`은 실제 브라우저 주소와 포트까지 정확히 맞춘다. 예를 들어 127.0.0.1:5317로 열면 `http://127.0.0.1:5317`이다. Next가 내부 요청 주소를 localhost로 표현해도 이 설정을 기준으로 Origin을 검증하며, 임의의 forwarded-host 헤더를 신뢰하지 않는다. 이 화면만 사용할 때는 Supabase 설정이 없어도 된다.

4. `/learn/tasks`를 열어 API의 `GOODJOB_USERNAME`/`GOODJOB_PASSWORD`로 연결한다. DB 비밀번호를 입력하는 화면이 아니다.

MySQL 없이 가볍게 연습하려면 `GOODJOB_DB_*` 환경변수가 없는 새 터미널에서 API 계정만 설정하고 `-Dspring-boot.run.profiles=local`로 실행한다. 이 프로필의 H2는 MySQL 검증을 대신하지 않는다. 기본 프로필은 MySQL이며 DB 오류 시 임시 메모리 저장소로 자동 전환하지 않는다.

## 계약을 직접 확인하는 방법

| 요청 | 의미 |
| --- | --- |
| `GET /api/v1/tasks?page=0&size=20` | ID순 페이지 목록과 전체 개수 |
| `POST /api/v1/tasks` | 새 할 일, revision=1 |
| `PUT /api/v1/tasks/{id}` | 전체 입력 필드와 현재 revision으로 수정 |

입력 필드는 `project`, `title`, `minutes`, `priority`, `done`, `due`다. `due`는 빈 문자열 또는 `YYYY-MM-DD`이며 실제 날짜여야 한다. 예상 시간은 1~1440분, 중요도는 1~3이다.

수정할 때 이전 revision을 보내면 409가 나야 한다. 이는 마지막 저장이 다른 변경을 조용히 덮어쓰는 것을 막는다. 충돌 시 목록을 새로고침하고 수정 내용을 다시 확인한다. 프로젝트 생성과 할 일 수정은 같은 트랜잭션에 있어 실패한 수정 때문에 빈 프로젝트가 남아서는 안 된다.

## 인증 및 운영 경계

- Basic은 암호화가 아니라 헤더 인코딩이다. 현재는 루프백 로컬 학습용이며 API 기본 주소도 127.0.0.1이다.
- 브라우저의 전용 계정 정보는 메모리에만 보관한다. 새로고침하면 다시 입력한다. 비밀번호를 localStorage, URL, 소스 코드에 저장하지 않는다.
- Next 프록시는 고정 서버의 할 일 API만 호출하며 쿠키나 Supabase 토큰을 전달하지 않는다. 변경 요청은 같은 Origin과 JSON 형식을 요구한다.
- 원격 사용에는 HTTPS, 정식 사용자 인증/인가, DB 백업, 시크릿 관리 및 네트워크 제한을 먼저 설계한다. 현재 실습 계정을 그대로 공개 배포하지 않는다.
- 재시작 시 초기화되는 단일 프로세스 요청 제한은 분산 운영용이 아니다.
- Vercel의 현재 프런트 배포 설정만으로 Kotlin 서버가 함께 배포되지는 않는다. API 실행 환경과 비공개 DB 연결은 별도로 준비해야 한다.

## 검사

```powershell
# 저장소 루트
npm test
npm run typecheck
npm run build
npm run test:e2e

# apps/api
.\mvnw.cmd verify
```

Playwright UI 검사는 API 응답을 대역으로 사용하므로 실제 Kotlin/MySQL 통합 검증과 구분한다. Windows는 설치된 Edge를 사용하고, 다른 환경은 `npx playwright install chromium`이 필요하다. 테스트용 Next 서버 포트는 5317이다.

실제 MySQL 동시성 검사는 `GOODJOB_MYSQL_TEST=true` 및 `GOODJOB_MYSQL_TEST_URL`, `GOODJOB_MYSQL_TEST_USERNAME`, `GOODJOB_MYSQL_TEST_PASSWORD`를 설정하고 `verify`를 실행한다. **루프백에 있는 정확한 `goodjob_learning` DB만 허용**한다. 테스트는 고유한 프로젝트/할 일을 생성해 남기므로 전용 학습 DB를 사용한다. 기존 데이터 삭제로 초기화하지 않는다.

실제 브라우저 통합 검사는 API를 먼저 실행하고 테스트 터미널에 `GOODJOB_API_URL`, `GOODJOB_USERNAME`, `GOODJOB_PASSWORD`를 설정한 뒤 `npm run test:e2e:live`를 실행한다. 기존 5317 서버를 재사용한다면 해당 서버에도 `GOODJOB_API_URL`과 `GOODJOB_WEB_ORIGIN=http://127.0.0.1:5317`이 설정되어 있어야 한다. 네트워크 요청을 대역으로 바꾸지 않으며 등록·수정·완료·재접속 후 재조회를 검사한다. 역시 테스트 데이터를 생성한다.

전체 프로젝트 커버리지 80%와 특정 모듈의 커버리지는 다르다. 테스트 수·검사 결과는 실제 실행한 범위와 함께 기록한다. 로컬 성공은 Supabase 운영 로그인이나 Vercel 배포 검증을 뜻하지 않는다.

### 2026-09-10 확인한 결과

- Node 테스트 29개 통과: 기존 저장 정책, 새 프록시·클라이언트·OpenAPI 계약을 포함한다.
- TypeScript 타입 검사와 Next 프로덕션 빌드 통과.
- 대역 API를 사용하는 브라우저 검사 8개 통과: 데스크톱·모바일 각각 등록·수정·완료, 인증 오류, 작성 중인 내용 보존.
- 실제 Next → Kotlin → MySQL 브라우저 검사 2개 통과: 데스크톱·모바일에서 등록·수정·완료 후 다시 연결해 revision 3과 저장한 시간을 재조회했다.
- 실제 MySQL 8.4.10을 포함한 Maven `verify` 10개 통과: 같은 프로젝트 동시 등록 8건, 같은 revision 동시 수정 6건에서 승자 1건과 충돌 5건을 확인했다.
- MySQL 검사를 끈 별도 실행은 8개 통과·2개 명시적 건너뜀. 새 JaCoCo 기록의 API 라인 커버리지는 232/258, 약 89.9%다. 애플리케이션 부트스트랩·config 등 `pom.xml`의 제외 범위가 있으며 전체 프로젝트 수치가 아니다.
- Windows 제한으로 `clean`의 target 삭제는 실패했다. API 실행 중 jar 교체도 파일 잠금으로 실패하여 서버를 종료하고 jar 패키징을 다시 수행했다. 이 환경에서 `clean verify` 성공을 주장하지 않는다.
- 동시 등록에서 실제 발생한 SQLSTATE `40001`은 전체 트랜잭션을 최대 3회 시도한다. 다른 SQL 오류나 무한 재시도까지 허용하는 정책이 아니다.
- Java 21 바이트코드를 생성했으며, 실행 검증은 이 컴퓨터의 Java 25.0.2에서 수행했다. Java 21 런타임 자체의 실행 검증과는 구분한다.

학습 화면과 API는 로컬 기능 브랜치의 변경이며 공개 배포·기존 데이터 이전을 완료한 상태가 아니다.

## 하루 10~15분 학습 순서

1. 할 일 하나를 저장하고 브라우저 Network에서 요청/응답을 읽는다. 왜 POST 응답이 201인지 설명한다.
2. Controller부터 저장소까지 그 요청을 따라간다. 화면 모델, 입력 DTO, DB 테이블을 구분한다.
3. `minutes=0`, 잘못된 날짜, 공백 제목을 테스트하고 400 응답의 책임이 어디에 있는지 찾는다.
4. 같은 프로젝트의 할 일을 두 개 만들어 테이블 관계와 프로젝트 재사용을 확인한다.
5. 같은 revision으로 두 번 수정해 409를 재현한다. 조건부 UPDATE와 트랜잭션을 설명한다.
6. 테스트를 먼저 추가하고 작은 기능 하나를 구현한다. 추천 첫 기능은 완료 여부 필터다.
7. API 계약과 SQL을 보지 않고 요청 경로를 말로 설명해 본다. 그다음 인증/Obsidian·Slack 단방향 수집으로 확장한다.

LLM에는 완성 코드를 먼저 요청하기보다 “이 실패 테스트의 원인을 질문으로 안내해줘”라고 요청하면 직접 학습하기 좋다.
