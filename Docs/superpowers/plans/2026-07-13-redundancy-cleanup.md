# Redundancy and Over-Design Cleanup Implementation Plan

> **For agentic workers:** Execute this plan inline in the current session. Do not dispatch subagents.

**Goal:** Remove the five previously identified redundant designs while preserving current API behavior and sync continuation.

**Architecture:** Keep existing module boundaries. The frontend will send API requests directly and use its existing per-request fallback handling. The Worker will keep `env.ts` as the single AI configuration readiness entry point, let D1-backed sync state own pagination, and retain only the canonical username normalization path.

**Tech Stack:** React/TypeScript/Vite frontend, Cloudflare Worker TypeScript, D1, Vitest, TypeScript compiler.

## Global Constraints

- Preserve unrelated user changes in the worktree.
- Do not change the resumable sync behavior or public response contract.
- Use the smallest code change; no speculative abstractions.
- Add or update Chinese comments for non-obvious behavior.
- Verify with Worker tests, Worker type-check, and frontend build/verification script.

---

### Task 1: Remove duplicate frontend API availability probes

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [x] Remove `apiAvailable` and `checkApiAvailable`; each API method should issue its own existing request inside its existing error handling.
- [x] Remove the `if (await checkApiAvailable())` wrappers without changing fallback return values or response parsing.
- [x] Keep `syncStars` as the only continuation loop and continue sending only `username`, optional `token`, and `syncId` state.
- [x] Run the frontend build and UI verification script.

### Task 2: Consolidate Worker AI readiness logic

**Files:**
- Modify: `cloudflare/worker/src/ai/config.ts`
- Modify: `cloudflare/worker/src/env.ts`

- [x] Keep `loadAiConfig(env).enabled` as the canonical implementation.
- [x] Make `env.ts` delegate `isAiConfigured` to `loadAiConfig` without duplicating the three-variable check.
- [x] Keep route imports unchanged so the public route behavior remains stable.
- [x] Run the Worker route tests.

### Task 3: Remove redundant sync continuation input

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `cloudflare/worker/src/routes.ts`
- Modify: `cloudflare/worker/src/github-sync.ts`
- Modify: `cloudflare/worker/src/github-client.ts`
- Test: `cloudflare/worker/src/__tests__/github-sync.test.ts`

- [x] Remove `startPage` from the request body and route validation.
- [x] Let `sync_runs.next_page` remain the only source of continuation page state.
- [x] Keep `GitHubClient.listStarredRepos` accepting its internal `startPage` argument because the Worker sync service still needs to call the GitHub API from the persisted page.
- [x] Update continuation tests to omit the external page argument.
- [x] Run all Worker tests and type-check.

### Task 4: Delete dead and duplicate Worker helpers

**Files:**
- Modify: `cloudflare/worker/src/d1-repository.ts`
- Modify: `backend/src/sync/star-syncer.ts`
- Modify: `cloudflare/worker/src/github-sync.ts`
- Modify: `cloudflare/worker/src/ai/config.ts`

- [x] Remove unused `markRemovedStars` after confirming production sync uses `markRemovedStarsBySyncRun`.
- [x] Keep backend and Worker username normalization separate because no shared module exists and both functions are used by independent runtimes.
- [x] Keep `loadAiConfig` as the only Worker AI readiness implementation.
- [x] Run Worker compile and relevant tests.

### Task 5: Review and document completion

**Files:**
- Modify: `todo.md`
- Modify: `chat_history.md`

- [x] Record each cleanup item and its verification result.
- [x] Run `git diff --check` and report unrelated dirty files without staging them.
