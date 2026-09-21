# Fast capture workspace implementation plan

Approved spec: ../specs/2026-09-21-fast-capture-workspace-design.md

Goal: persistent activity navigation, today calendar and low-friction entry without changing storage or authentication.

## Work units

1. Domain / TDD: extend shared control types and validation with optional area and scheduledFor; allow minutes0 as unset; atomic quickCaptureTask and reserved inbox. Test legacy compatibility, failures, backup and relations before implementation.
2. Capture UI: reusable QuickCapture, title-only Enter, composition guard, save mutex, failed draft and focus retention. Project area editing, task preview, checkbox and inline child capture. Preserve advanced editors.
3. Time entry: pure validated hours/minutes conversion; manual duration and date form plus advanced timestamps; preserve unchanged seconds. Unit tests before implementation.
4. Shell / Today: reusable calendar date selectors and task filtering; sidebar area groups, collapse preference, mobile disclosure, header timer; replace duplicated default overview with today. Test day union/dedup/archive behavior before implementation.
5. Integration: exclude unset estimates from automatic planning; keep old backup key, CAS, cloud authentication routes, recovery, JSON backup. Run unit tests, typecheck, build and local desktop/mobile browser flows, independent review. No production push in this work unit.

## Contracts

- Project.area?: 'class'|'project'|'study'; missing means unclassified.
- ControlTask.scheduledFor?: ISO date or empty string. Missing does not change legacy data.
- quickCaptureTask(data,{id,title,projectId?,parentId?,scheduledFor?},now) returns new ControlData; no writes itself.
- QuickCapture accepts data,busy,onSave,onError,projectId?,parentId?,scheduledFor?,inputId?.
- Sidebar selection is UI state; storage preference errors must not block actual workspace saves.
- Dates use Asia/Seoul task-date semantics; calendar calculations use UTC date-only strings.

## Verification

- node --experimental-strip-types --test tests/*.test.mjs packages/shared/src/*.test.mjs packages/backend/tests/*.test.mjs
- npm.cmd run typecheck
- npm.cmd run build
- node node_modules/@playwright/test/cli.js test --config playwright.local.config.ts
- Check desktop/mobile screenshots, no horizontal overflow, timer persistence, Enter focus and keyboard IME, corrupted/quota/stale storage preservation.

## Ownership

Domain agent: shared control and focused domain tests. Capture agent: quick-capture, project detail/overview, task editor. Time agent: time-records and duration helper/tests. Main: shell/sidebar/calendar/CSS, test integration and review. No concurrent dev servers or commits.
