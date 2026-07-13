# the-star-way

> English | [简体中文](./README.md)

> **Turn GitHub Stars into your developer interest map and AI-powered learning path.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-starway.patdelphi.xyz-blue?style=flat-square)](https://starway.patdelphi.xyz) [![Docs](https://img.shields.io/badge/Docs-📚-green?style=flat-square)](./Docs) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

Enter any GitHub username to analyze their starred repositories:

- **Star DNA** — Developer tech profile (AI-generated)
- **Learning Path** — Personalized learning path recommendations (AI-generated)
- **Hidden Gems** — Discover overlooked low-star quality projects
- **Tech Map** — Language, topic, license, and activity statistics

## Why It Matters

Every developer has stared at their own GitHub Stars list at some point—thousands of repos piled up, with no clear idea of what was actually saved or why. The interesting part is that when we look at the stars of developers we admire, we often uncover a hidden learning path: what technologies they care about, what they read, what toolchains they use, what they've been tinkering with lately.

**the-star-way** turns that instinct of "browsing someone else's bookmarks" into a structured tool. It's not just another Stars manager—it answers:

- What does my (or another developer's) interest landscape look like?
- What learning patterns and growth trajectories are hidden behind those starred repos?
- If I want to fill a gap in a technical direction, what should I learn or build next?

Turning a chaotic stars list into a searchable, analyzable, inferable map of technical assets—that's what the-star-way is about.

## Core Features

- **Star Sync** — Sync any GitHub user's starred repos, with incremental updates and removed-star tracking
- **Smart Classification** — Auto-tagging based on topics, repo name, and description (60+ categories: AI/LLM, frontend frameworks, DevOps, tools, etc.)
- **Multi-dimensional Filtering** — Filter by language, tag, keyword; sort and paginate
- **Statistical Analysis** — Language distribution, topic clustering, license distribution, active/dormant repo stats, star timeline trends
- **Repository Analysis** — Deep info page per repo, with license compliance analysis (MIT/Apache/GPL/CC, 12+ types)
- **AI-Powered Insights** —
  - **Star DNA**: Developer tech profile generated from starred repos
  - **Learning Path**: Personalized learning path recommendations
  - **README Summary**: Intelligent summary of repo READMEs
- **Data Export** — CSV / JSON / Markdown / HTML formats
- **Bilingual UI** — Chinese / English switch
- **Tri-state Theme** — Light / Dark / System
- **Demo Mode** — Built-in real starred repo data, works without backend

## Screenshots

![screenshot-1](./Docs/assets/ScreenShot_2026-07-13_135427_573.png)
![screenshot-2](./Docs/assets/ScreenShot_2026-07-13_135505_819.png)
![screenshot-3](./Docs/assets/ScreenShot_2026-07-13_141748_448.png)
![screenshot-4](./Docs/assets/ScreenShot_2026-07-13_141805_171.png)
![screenshot-5](./Docs/assets/ScreenShot_2026-07-13_141827_584.png)
![screenshot-6](./Docs/assets/ScreenShot_2026-07-13_141844_689.png)
![screenshot-7](./Docs/assets/ScreenShot_2026-07-13_141911_794.png)
![screenshot-8](./Docs/assets/ScreenShot_2026-07-13_141922_378.png)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · Vite · TypeScript · Tailwind CSS 4 · Radix UI · recharts |
| Backend (Local) | Node.js · TypeScript · better-sqlite3 (WAL mode) |
| Backend (Cloudflare) | Cloudflare Workers · D1 (SQLite) |
| Shared Layer | TypeScript types + pure logic (threshold functions, classification rules, tag dictionaries) |
| AI | OpenAI-compatible API (supports Zhipu GLM, Alibaba dashscope, SenseNova, OpenAI, Ollama, etc.) |
| Testing | Vitest (132 backend tests + 85 Worker tests) |

## Multi-platform Deployment

the-star-way supports two deployment modes—choose based on your needs.

### Option 1: Local / VPS (Node.js + SQLite)

For personal use, fully local data, or offline scenarios.

**Requirements**: Node.js `v24.15.0` + pnpm `11.7.0` (enable via corepack).

```bash
# Windows
.\start.ps1

# macOS / Linux
./start.sh
```

The startup script checks Node version, compiles native modules, and launches both frontend and backend.

- Backend API: `http://localhost:3210`
- Frontend UI: `http://localhost:5173`

See [Docs/deployment.md](./Docs/deployment.md) for manual setup.

### Option 2: Cloudflare (Workers + D1 + Pages)

For online services, zero-ops, global edge acceleration.

**Architecture**:

```
Frontend (Cloudflare Pages)  ──HTTPS──▶  Worker API (Cloudflare Workers)  ──bind──▶  D1 Database
```

**Deploy steps** (see [Docs/cloudflare-deployment.md](./Docs/cloudflare-deployment.md) for details):

```bash
# 1. Create D1 database
cd cloudflare/worker
npx wrangler d1 create starway-db
# Write the returned database_id into wrangler.toml

# 2. Run database migration
npx wrangler d1 execute starway-db --remote --file=../d1/migrations/0001_init.sql

# 3. Configure secrets
npx wrangler secret put STARWAY_GITHUB_TOKEN      # GitHub sync token
npx wrangler secret put STARWAY_AI_BASE_URL        # AI endpoint
npx wrangler secret put STARWAY_AI_API_KEY         # AI key
npx wrangler secret put STARWAY_AI_MODEL           # Model name

# 4. Deploy Worker
npx wrangler deploy

# 5. Frontend: connect GitHub repo to Cloudflare Pages for auto-build
#    Set VITE_API_BASE env var to the Worker URL
```

**CI/CD**: A GitHub Actions workflow is bundled (`.github/workflows/deploy-cloudflare.yml`); pushing to master auto-deploys Worker and Pages. Configure these in GitHub repo Settings → Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `D1_DATABASE_ID`

### Option 3: Docker (Planned)

Containerized deployment is being planned—see [Docs/roadmap.md](./Docs/roadmap.md).

## Project Structure

```
the-star-way/
├── shared/                # Cross-platform shared layer (types + pure logic)
├── backend/               # Local backend (Node.js + SQLite)
├── frontend/              # Frontend app (React + Vite)
├── cloudflare/
│   ├── worker/            # Cloudflare Worker API
│   └── d1/migrations/     # D1 database migrations
├── Docs/                  # Project docs
├── start.ps1 / start.sh   # One-click startup scripts
└── .github/workflows/     # CI/CD config
```

## Quick Start

### Local Trial (No Token Required)

```bash
git clone <repo-url> && cd the-star-way
./start.sh              # or Windows: .\start.ps1
```

Demo data loads automatically—explore all features immediately.

### Environment Variables

Copy `sample.env` to `.env` and fill as needed:

```bash
cp sample.env .env
```

| Variable | Purpose | Required |
|---|---|---|
| `STARWAY_GITHUB_TOKEN` | GitHub sync token (read:user scope) | For real data sync |
| `STARWAY_AI_BASE_URL` | AI service endpoint | For AI features |
| `STARWAY_AI_API_KEY` | AI service key | For AI features |
| `STARWAY_AI_MODEL` | Model name (e.g., glm-5.2 / deepseek-v4-flash) | For AI features |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/users` | User list |
| GET | `/api/users/:login/repos` | Repo list (filter/sort/paginate) |
| GET | `/api/users/:login/stats` | Statistics |
| GET | `/api/users/:login/summary` | User summary (Sleep Stars / Hidden Gems) |
| GET | `/api/users/:login/star-dna` | Star DNA profile (AI-generated) |
| GET | `/api/users/:login/learning-path` | Learning path (AI-generated) |
| GET | `/api/repos/:fullName/readme-summary` | README summary (AI-generated) |
| POST | `/api/sync` | Trigger GitHub sync |
| GET | `/api/export` | Export data (CSV/JSON/Markdown/HTML) |
| GET | `/api/overview` | Global overview |

See [Docs/api.md](./Docs/api.md) for the full API list.

## Testing

```bash
# Backend tests
cd backend && corepack pnpm test

# Worker tests
cd cloudflare/worker && corepack pnpm test
```

## License

MIT License
