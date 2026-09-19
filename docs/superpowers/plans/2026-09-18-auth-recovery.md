# Password recovery and Pretendard implementation plan

**Goal:** Complete the approved password recovery flow without recreating users or changing workspace ownership, and apply Pretendard across the UI.

**Architecture:** Keep the existing browser Supabase client and implicit email callback at `/`. Handle recovery before mounting the workspace. Authentication remains enforced by Supabase and the existing backend; no admin key or new password storage.

## Acceptance criteria

- Login offers a recovery request form. Submit a trimmed, valid email to `resetPasswordForEmail(email, {redirectTo: window.location.origin + '/'})`.
- Return neutral delivery messaging without revealing account existence. Disable repeated requests briefly; Supabase remains the authoritative rate limiter.
- `PASSWORD_RECOVERY` with a session selects a new-password form before workspace rendering. Preserve that mode across reload with a user-bound, non-secret tab marker.
- Invalid/expired callback errors render a safe message and resend action. Never render provider-supplied descriptions or log credentials/tokens.
- Validate two matching passwords of 12–128 characters; call `updateUser({password})` only with a session. Supabase password policy also applies.
- After successful update clear form state, sign out, and return to login. A sign-out failure must not imply password update failure or repeat the update.
- Self-host licensed Pretendard and use one shared font family for page, headings, buttons, and inputs. Preserve code monospace.

## Tasks

- [x] Tests: unit password/error helpers RED then GREEN; font config RED then GREEN. Initial UI browser suite was written after implementation; completion-refresh regression was RED then GREEN.
- [x] Implement pure recovery validation/error helpers, auth-state hook, request/update forms; integrate existing login gate.
- [x] Apply Pretendard with bundled license and verify CSS font overrides and rendered font.
- [x] Run node tests, type checks, auth browser tests and production build. Review security and callback races.
- [x] Document deployed origin/redirect allowlist, new-mail requirement, and exact verification limits. No hosted mail or password changes performed.

No database migration or account recreation. Existing Supabase Site URL and allowed root redirect must be the deployment URL. Deployment is separate from local implementation; do not claim hosted success without verification.

## Verification, 2026-09-19

- `npm test`: 60 passed.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0 after final auth changes.
- Auth Playwright: 18 passed (9 desktop + 9 mobile); actual SDK + local Auth fixture, no hosted credentials. `test-results/.last-run.json` confirms no failures.
- Pure recovery helper coverage: 100% lines, 93.94% branches; not a whole-UI coverage claim.
- Desktop login and mobile recovery screenshots visually checked; local Pretendard font loaded for body, inputs and buttons.
- Scoped independent auth review: no remaining must-fix findings. One initial review assumption was corrected against installed SDK: signOut removes the local session even on server 500. A non-secret completion marker preserves completion messaging after refresh, without retaining credentials or repeating password updates.
- Existing global <50-lines-per-function style target is not fully met by JSX forms/hooks; files remain under 800 lines. No broad formatting/refactor of unrelated features performed.
- Changes remain local/uncommitted; GitHub push and Vercel deployment have not been performed.
