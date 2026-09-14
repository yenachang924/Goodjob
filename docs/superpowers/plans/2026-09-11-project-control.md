# Project Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task with TDD and scoped reviews.

**Goal:** 기존 웹 관제판에 프로젝트 계층, 마일스톤, 실제 시간 기록을 연결한다.

**Architecture:** 기존 V1 모델은 유지하고 별도 V2 순수 도메인을 추가한다. 저장 API는 V1/V2를 검증하여 읽고 쓰며, 웹은 명시적인 백업·변환 후 V2를 사용한다. Kotlin 학습 경로는 변경하지 않는다.

**Tech Stack:** Existing Next.js/React/TypeScript, Supabase Auth/Postgres, native Node tests and Playwright. No additional runtime dependency.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-11-project-control-design.md`.
- Current folder authorized by user; preserve all prior uncommitted work. Parent owns commits and full test runs.
- No credentials in code/logs, no local-storage persistence fallback, no fake hosted-auth success.
- First unit only: core project/time workspace. Google OAuth/calendar is a separate next unit, not claimed implemented here.
- Korea dates, Monday weeks, UTC millisecond session timestamps, at most one active session.
- Parent + child depth only; leaf-only progress; never count elapsed time as completion.
- Existing 1,000,000-byte payload limit remains. Keep application/configuration failures visible.

## Shared interfaces

New export `@cockpit/shared/control` resolves `src/control/index.ts`. V1 `planner.ts` exports remain unchanged.

```ts
type Project = { id:string; name:string; description:string; link:string; archived:boolean };
type Milestone = { id:string; projectId:string; title:string; due:string; achieved:boolean };
type ControlTask = { id:string; projectId:string; parentId:string|null; milestoneId:string|null; title:string; minutes:number; priority:number; due:string; status:'todo'|'doing'|'blocked'|'done'; blockedReason:string; createdAt:number|null; completedAt:number|null; archived:boolean };
type TimeSession = { id:string; taskId:string; projectId:string; startedAt:number; endedAt:number|null; source:'timer'|'manual' };
type ControlDay = { capacity:number; buffer:number; confirmed:import('../planner.ts').Slot[]|null };
type LegacyTimer = { date:string; taskId:string; startedAt:number };
type ControlData = { version:2; projects:Project[]; tasks:ControlTask[]; milestones:Milestone[]; sessions:TimeSession[]; days:Record<string,ControlDay>; legacyActive:LegacyTimer[] };
```

Typed public functions are part of Task 1 and used by Task 3:

```ts
validControlData(value:unknown, now?:number): value is ControlData;
migrateWorkspace(value:unknown): ControlData; // validated V1 or V2 only, throws Korean error
saveProject(data:ControlData, input:Project):ControlData;
saveMilestone(data:ControlData, input:Milestone):ControlData;
saveControlTask(data:ControlData, input:ControlTask, now:number):ControlData;
setTaskStatus(data:ControlData, id:string, status:ControlTask['status'], now:number):ControlData;
setTaskArchived(data:ControlData, id:string, archived:boolean):ControlData;
startTimer(data:ControlData, taskId:string, sessionId:string, now:number):ControlData;
stopTimer(data:ControlData, now:number):ControlData;
saveTimeSession(data:ControlData, input:TimeSession, now:number):ControlData;
resolveLegacyTimer(data:ControlData, date:string, endedAt:number|null, sessionId:string, now:number):ControlData;
projectSummary(data:ControlData, projectId:string, now:number):{total:number; done:number; remaining:number; blocked:number; overdue:number; remainingMinutes:number; weekAdded:number; weekDone:number; todaySeconds:number; weekSeconds:number};
leafTasks(data:ControlData, projectId?:string):ControlTask[];
taskStatus(data:ControlData, id:string):ControlTask['status'];
sessionSeconds(sessions:TimeSession[], from:number, until:number, projectId?:string):number;
```

## Task 1: V2 domain, compatibility and time semantics

**Files:** create `packages/shared/src/control/{types,validation,migration,projects,tasks,time,summary,index}.ts`, `packages/shared/src/control.test.mjs`; modify only shared `package.json` to add export.

**Consumes:** V1 `Data`, `validData`, `Slot` from planner. **Produces:** public interfaces above.

- [ ] Write real Node tests before implementation: migration preserves IDs/title/done/plans and original input; V2 migration is idempotent; legacy times are recovery candidates, not invented sessions.

```js
const old = structuredClone(initialData);
assert.equal(migrateWorkspace(old).version, 2);
assert.deepEqual(migrateWorkspace(migrateWorkspace(old)), migrateWorkspace(old));
assert.deepEqual(old, initialData);
```

- [ ] Run `node --experimental-strip-types --test packages/shared/src/control.test.mjs`, observe missing-function/behavior RED, then implement definitions and validation in small files.
- [ ] Add RED cases before commands: duplicate/foreign IDs, depth>2, cycle, mismatched milestone, parent decomposition while active/planned, archived parent hiding descendants, status derived from live children; milestones reopen when work reopens.
- [ ] Enforce project/milestone/task identity, string lengths, finite integer bounds, safe http(s) links and actual dates. Reject invalid input rather than silently normalize unrelated data. No mutation of caller data.
- [ ] Add timer RED cases: switching closes prior and opens new at same instant; overlap/future/reversed/over-24h manual interval rejected; completion stops timer atomically; archived/completed/parent tasks cannot start; preserve historical parent sessions.

```js
const second = startTimer(startTimer(data, a.id, 's1', now), b.id, 's2', now+60000);
assert.equal(second.sessions.filter(s=>s.endedAt===null).length,1);
assert.equal(second.sessions[0].endedAt,now+60000);
```

- [ ] Add summary tests: zero tasks, leaf-only denominator, week additions excluding unknown migration timestamps, overlapping interval rejection, cross-midnight clipping and Monday boundaries. Add bounded count limits sufficient within payload size; any validation failure must be actionable.
- [ ] Run focused tests and coverage, report RED/GREEN evidence and exact signatures. Review and fix before UI integration. Parent commits only this logical unit's files after review.

## Task 2: version-aware persistence and safe upgrade

**Files:** `packages/shared/src/workspace.ts`, shared package export `./workspace`, `packages/shared/src/backup.ts`, backend `{handlers,supabase,index}.ts`, backend tests and backup tests.

**Consumes:** Task1 ControlData/validation. **Produces:** `WorkspaceData = Data | ControlData`, `validWorkspace(value): value is WorkspaceData`; Repository reads/writes this union without automatic migration.

- [ ] Write failing tests for V2 read/save and backup round-trip while retaining V1 tests. Use real handlers plus in-memory repository; preserve existing PGlite SQL integration and add a V2 snapshot stored/reloaded through the same RPC.

```js
assert.equal(validWorkspace(migrateWorkspace(initialData)), true);
assert.deepEqual(parseBackup(JSON.stringify({data:v2}),0),v2);
assert.throws(()=>parseBackup(JSON.stringify({data:v2}),1));
```

- [ ] Expand validators/types, preserve revision compare-and-swap and no data rewrite on GET. Keep malformed or unknown versions rejected.
- [ ] Add explicit backend configured web Origin to match browser origin behind Next; tests reject hostile origin/headers and invalid configuration. Do not trust forwarded-host.
- [ ] Verify payload bounds/no-store/401/403/409 and unknown fields carrying invalid relationships. Failed writes leave tasks and sessions unchanged together.
- [ ] Keep 001 SQL unchanged if real PGlite confirms the V2 JSON shape satisfies its top-level constraints. Do not provision or mutate external DB without configuration/authority.

## Task 3: usable project/time workspace

**Files:** create `apps/web/features/project-control/{control-workspace,use-control-workspace,project-overview,project-detail,task-editor,milestone-editor,time-records,today-plan,upgrade-panel,format}.tsx|ts`, scoped `control.css`; replace cockpit entry with a small adapter; retain AuthGate.

**Consumes:** Task1 domain and Task2 workspace API. **Produces:** root authenticated UI with sidebar tabs 전체/프로젝트/오늘/시간기록, shared persisted data.

- [ ] Add Playwright RED flows using the real AuthGate SDK against a local HTTP auth/API fixture (never a production bypass or public unauthenticated route). Run focused browser test to confirm missing V2 UI.
- [ ] Hook loads validated V1/V2. V1 renders upgrade preview, requires backup download and explicit conversion save, preserves revision and legacy timer recovery. Empty revision0 data can initialize V2 on explicit start without claiming migrated history.
- [ ] Save hook validates data/byte size and locks concurrent operations; 409 retains inputs and offers explicit refresh rather than overwrite. Persist only successful responses. Timer display ticks locally; no per-second writes.
- [ ] Project cards show counts/remaining workload/week additions/completions/time. Project detail has project editing, milestone editor, unassigned tasks, two-level hierarchy, status/block reason, archive toggle, leaf-only start buttons.
- [ ] Timer bar supports stop/switch, recovery after reload, >8h warning, manual end/start editing with overlap errors. Records display today/week sums and per-project estimates vs recorded time. Expose archived history without double counting.
- [ ] Today tab reuses rule-based ordering and confirmed Slot snapshots, filters leaf/unarchived/unfinished work, allows adjustment before confirm, preserves active session when plan changes. Labels stay 'registered capacity' not clock-based remaining time.
- [ ] Add version-aware export/import controls. Keep unrelated LLM/Kotlin learning UI accessible without claiming integration.
- [ ] Apply existing UI primitives and scoped responsive styles. Test desktop/mobile, keyboard labels, empty/loading/error/blocked states and drafts preserved on unrelated actions.

## Task 4: end-to-end verification and handoff

**Files:** `e2e/project-control.spec.ts`, optional dedicated Playwright fixture/config, `docs/project-control.md`, README link; scoped fixes only.

- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, existing learning E2E and new project E2E. Separate real domain/API/PGlite tests from hosted Supabase E2E.
- [ ] Read-only credential presence check: only names/booleans, no values. If unavailable, continue local tests and report hosted auth/storage as blocked, not completed. User was asked asynchronously for Supabase project availability.
- [ ] Independent spec and quality review; fix Critical/Important findings using regression tests. Record test coverage scope and any Windows/environment constraints truthfully.
- [ ] Document everyday workflow and setup, legacy preservation and quota boundary. Calendar remains subsequent read-only integration, with no fake connect success.
- [ ] No publish, push, or unrequested provider provisioning. A working local fixture is QA, not the user's permanent workspace.
