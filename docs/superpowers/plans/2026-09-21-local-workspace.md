# Local Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** Open independent, login-free project workspaces in every browser.
**Architecture:** Reuse the control UI with a mode-selected request adapter. Local storage uses a new key and Web Locks around revision compare-and-swap; cloud mode keeps existing auth and API behavior. Root opens local mode and forwards legacy auth fragments to `/cloud`.
**Tech Stack:** Existing Next.js/React/TypeScript, localStorage, Web Locks, Node tests, Playwright. No new dependency.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-21-local-workspace-design.md`.
- No automatic cloud or legacy-data migration; fresh local state is empty V2.
- Do not remove server authentication, RLS, validation, or backup size limits.
- Current folder/feature branch retained per user's prior workspace choice.
- No raw credentials in logs, docs, tests, or commits.

## Task 1: Local request adapter

Files: `apps/web/features/project-control/local-storage.ts`, `tests/local-storage.test.mjs`.
Interface: `createLocalRequest(storage, locks)` returns `(options?: RequestInit) => Promise<Response>`; export `LOCAL_WORKSPACE_KEY`, `localWorkspaceRequest`, and `emptyLocalData`.

- [ ] Write tests then run `node --experimental-strip-types --test tests/local-storage.test.mjs`; expected RED for missing adapter.
- [ ] Implement GET returning `{data: emptyLocalData(), revision: 0}` when key absent, with no write. Read validates stored `{data, revision}`; malformed storage throws actionable Korean error without clearing it.
- [ ] PUT validates JSON, V2 data, size and safe revision; `locks.request(LOCAL_WORKSPACE_KEY, () => { read; compare revision; setItem; return Response.json({revision: revision + 1}); })`. Revision mismatch returns409. Missing locks fails closed. Quota/storage access failures never return success.
- [ ] Run tests for roundtrip, isolation, corruption, quota, stale/concurrent writes, no lock support, invalid inputs and size bounds. Expected GREEN. Measure adapter coverage >=80%.

## Task 2: Local entry and mode-aware UI

Files: `apps/web/app/page.tsx`, `apps/web/app/cloud/page.tsx`, `apps/web/features/project-control/local-entry.tsx`, `entry-routing.ts`, `use-control-workspace.ts`, `control-workspace.tsx`.
Consumes: Task1 request adapter. Produces: default local page, existing authenticated workspace at `/cloud`.

- [ ] Add failing entry routing tests: plain hash => null, recovery/error/token fragment => `/cloud` forwarding the unchanged fragment, no external redirect target.
- [ ] Add browser RED: root opens project dashboard without login or API/auth traffic.
- [ ] Root client gate checks callback before mounting local workspace; cloud page renders existing AuthGate. Recovery email redirect to root remains valid because callback forwards to `/cloud` before SDK initialization.
- [ ] Hook selects `mode === 'local' ? localWorkspaceRequest : workspaceRequest`. Defaults remain cloud for existing AuthGate. Local page explicitly passes local. Save notices/loading text reflect mode. Render browser-local deletion/backup warning and cloud link. Guard overlapping saves with a ref as well as busy UI.
- [ ] Adapt existing cloud E2E navigation to `/cloud`; keep root callback tests unchanged. Run browser tests for create/reload/timer/subtask/milestone, profile isolation, JSON backup import, storage failure, corruption, conflicts, recovery regressions.

## Task 3: Handoff and verification

Files: `docs/local-mode.md`, `README.md`, `playwright.local.config.ts`, `e2e/local-workspace.spec.ts`.

- [ ] Document one shared Vercel URL, separate browser-origin storage, same-profile sharing warning, no automatic sync, JSON transfer, no offline/PWA promise. Local developer commands: `npm ci --include=dev`, `npm run dev`; no Supabase setup needed for root.
- [ ] Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build`, local desktop/mobile and auth browser tests. Inspect rendered page. Review changed code with code-reviewer agent; address important findings with regression tests.
- [ ] Commit and deploy approved local mode; verify root and unauthenticated cloud endpoint behavior. If hosting access is unavailable, report local verification separately from deployment.

## Execution record

- Design approved in user conversation 2026-09-21. Main owns integration; planner reviews boundaries; tdd-guide owns adapter tests/implementation. Existing feature branch retained; no unrelated changes at start.
- Web Locks chosen to serialize same-origin writes across tabs; unsupported browsers show a safe save error instead of an unsafe fallback. Backups remain the recovery mechanism for browser data removal.
- Task 1 complete: adapter RED before implementation, 14 unit tests GREEN; fresh measured coverage 96.99% lines / 96.72% branches / 100% functions. No dependency added.
- Task 2 complete: root wiring and callback tests RED→GREEN. Browser local suite 14/14 desktop+mobile passed; persistence, milestones/subtasks/timer, profile isolation, backups, conflicts, blocked storage and quota covered. Plain cloud navigation remains in root parent nav.
- Task 3 verification: full Node suite 91/91, typecheck and production build passed. Main inspected desktop/mobile screenshots. Independent reviewer has no actionable findings (initial cloud-link finding retracted after inspecting parent nav). Cloud auth regression and hosting verification follow before handoff.
- Cloud regressions completed: auth 18/18 desktop+mobile, control/editor 10/10 desktop, all exit0. Total browser checks 42. Hosted Supabase account login remains an independent unresolved issue; local operation does not depend on it.
