# Cloudflare 星标同步续传 Implementation Plan

> **For agentic workers:** Inline execution in the current session; no subagents.

**Goal:** Replace the single-request 2000-star cutoff with bounded, automatically continued Worker batches.

**Architecture:** `sync_runs.id` and `next_page` identify the continuation. Each star stores the current sync id, so final removal detection is database-backed instead of holding all names in Worker memory. The frontend loops over the existing API function until the Worker reports completion.

**Tech Stack:** TypeScript, Cloudflare Worker, D1, React frontend, Vitest.

## Global Constraints

- Keep each Worker request bounded by `STARWAY_GITHUB_MAX_PAGES`.
- Do not execute deployment or database migration commands.
- Preserve existing partial-sync safety: incomplete batches must not mark stars removed.
- Add tests before production implementation changes.

### Task 1: Add continuation fields and contracts

**Files:** `cloudflare/d1/migrations/0001_init.sql`, new migration, `shared/api-contracts/sync.ts`.

- Add `sync_runs.next_page` defaulting to 1 and `stars.sync_run_id`.
- Add an idempotent follow-up migration for existing D1 databases.
- Extend `SyncResult` with optional `syncId` and `nextPage`.

### Task 2: Test Worker continuation behavior

**Files:** `cloudflare/worker/src/__tests__/github-sync.test.ts`.

- Add a failing test that runs two requests for 2500 repos using the returned sync id/page.
- Assert the first request is partial, the second is complete, all rows exist, and old unseen rows are only removed after the second request.
- Add a failing route validation test for a mismatched continuation user.

### Task 3: Implement bounded Worker continuation

**Files:** `cloudflare/worker/src/github-client.ts`, `cloudflare/worker/src/github-sync.ts`, `cloudflare/worker/src/d1-repository.ts`, `cloudflare/worker/src/routes.ts`.

- Let GitHub page collection accept a starting page and return `nextPage`.
- Load or create the sync run, update progress after each batch, and write each row with the sync id.
- Add final removal detection by sync id; only complete runs clear AI cache and mark success.
- Validate continuation ownership at the route boundary.

### Task 4: Make frontend sync automatically continue

**Files:** `frontend/src/lib/api.ts`, frontend tests if present.

- Loop over `/api/sync` while `complete=false` and `nextPage` exists.
- Send the returned `syncId` on each continuation request.
- Aggregate counts and preserve the final warning/rate-limit result.

### Task 5: Verify and document

- Run the focused Worker tests, frontend checks, and frontend build.
- Update Cloudflare deployment documentation with the continuation behavior.
- Inspect diff and repository status, then commit and push.
