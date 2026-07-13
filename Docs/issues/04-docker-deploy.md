# [Feature] Docker Compose deployment

> 用于 GitHub Issue 创建。复制下方内容到 https://github.com/patdelphi/the-star-way/issues/new

## Issue 标题

```
[Feature] Docker Compose deployment
```

## Labels

`enhancement`, `deployment`

## Issue 正文

```markdown
## Motivation

Currently the project supports Node.js local deploy and Cloudflare deploy. A Docker option would lower the barrier for self-hosted users who already run a Docker stack, and make VPS deployment a single `docker compose up`.

## Proposed Feature

Provide a `docker-compose.yml` and `Dockerfile` that:

- Build the frontend (Vite) and serve static files
- Run the Node.js backend with SQLite (WAL mode)
- Persist SQLite data via a named volume
- Expose a single port (reverse proxy or backend serves frontend)

## Implementation Ideas

- Multi-stage `Dockerfile`: build stage (pnpm install + build) → runtime stage (node slim)
- `docker-compose.yml` with one service, volume `./data:/app/backend/data`
- Environment variables passed through (GitHub token, AI keys)
- Optional: bundled Caddy/nginx for HTTPS

## Acceptance Criteria

- [ ] `Dockerfile` builds and runs successfully
- [ ] `docker-compose up` starts the full app on a single port
- [ ] SQLite data persists across container restarts
- [ ] Demo mode works out of the box (no env vars required)
- [ ] Documented in `Docs/deployment.md`
- [ ] Image size reasonable (< 500MB)

## Priority

P2 — expands self-hosted adoption.
```
