# Vercel monorepo migration implementation plan

**Goal:** Preserve the personal cockpit in a small monorepo with one Next.js/Vercel deployment and explain each stack choice.
**Architecture:** apps/web owns UI and thin HTTP entrypoints; packages/backend owns authentication, persistence and API policy; packages/shared owns pure planner types/validation. Supabase supplies Postgres and Auth. Existing deployed Sites is not changed or deleted.
**Tech Stack:** Next.js, React, TypeScript, npm workspaces, Supabase, Node test runner; no Hono, Turbo, Redis or separate API host.

## Global constraints
- Owner-only access, verified server identity, RLS, no service-role key in application.
- Preserve confirmed snapshots, revisions and existing planner behavior. Initial import only into empty workspace; existing site remains backup.
- No Slack/Obsidian/LLM integration implementation in this migration.
- No external resource creation, paid upgrades, production data writes or public deployment without configured accounts and authorization.

## U1: Workspace boundaries and existing behavior
- Characterize current planner with `node --experimental-strip-types --test lib/planner.test.mjs`.
- Move UI under apps/web, planner under packages/shared, keep npm and replace vinext with Next.js.
- Create architecture tests proving browser features cannot import backend and backend/shared cannot import web.
- Build with Next.js and check package-level types. Config/file relocation uses mechanical verification rather than behavior TDD.

## U2: Authenticated persistence
- Add failing tests for 401 unauthenticated, 403 wrong owner, 400 malformed input, 413 size limit, 409 conflicts, generic 503 and success.
- Implement `createWorkspaceHandlers(dependencies)` using verified user, request-scoped repository and immutable Data.
- Supabase provider authenticates through getUser(token), sends user bearer to REST/RPC and never uses a service role.
- Postgres stores user_id/data JSONB/revision, owner allowlist and RLS. Atomic revision compare-and-swap RPC prevents first insert with nonzero revision and stale updates. Persistent rate-limit RPC protects authenticated API requests.
- Execute SQL/RLS integration tests against local embedded Postgres; real Supabase verification remains credential-dependent.

## U3: Login and cockpit adapter
- Add a login gate using Supabase password login with public signup disabled and owner provisioned separately.
- Browser obtains/refreshes session via SDK; API authenticates independently. Logout unmounts cockpit. No demo fallback when configuration is missing.
- Thin Next GET/PUT delegates to backend. Existing cockpit requests add bearer, preserve interaction and save semantics.
- Add download/import of validated backup. Import refuses overwrite of a saved workspace and resets revision through first save.

## U4: Verification and handoff
- Run tests, coverage for shared/backend, TypeScript checks and Next production build.
- Document WHY this stack, alternatives, decision reversal triggers, setup, owner provisioning, RLS migration, backup migration and Vercel apps/web root.
- Preserve existing deployed Site until new auth/storage tested with actual accounts. Report missing credentials honestly; never label a local build as deployed.
