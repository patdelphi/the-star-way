## Inspiration

Every developer has stared at their own GitHub Stars list — thousands of repos piled up, with no clear idea of what was saved or why. But the interesting part is that when we browse the stars of developers we admire, we often uncover a hidden learning path: what technologies they care about, what they read, what toolchains they use, what they've been tinkering with lately. **the-star-way** turns the instinct of "browsing someone else's bookmarks" into a structured tool.

## What it does

Enter any GitHub username to analyze their starred repositories:

- **Star Sync** — Sync any GitHub user's starred repos with incremental updates and removed-star tracking
- **Smart Classification** — Auto-tagging based on topics, repo name, and description (60+ categories)
- **Multi-dimensional Filtering** — Filter by language, tag, keyword; sort and paginate
- **Statistical Analysis** — Language distribution, topic clustering, license distribution, star timeline trends
- **AI-Powered Insights**:
  - **Star DNA**: Developer tech profile generated from starred repos
  - **Learning Path**: Personalized learning path recommendations
  - **README Summary**: Intelligent summary of repo READMEs
- **Data Export** — CSV / JSON / Markdown / HTML
- **Bilingual UI** — Chinese / English switch
- **Tri-state Theme** — Light / Dark / System
- **Demo Mode** — Built-in real starred repo data, works without backend

## How we built it

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS 4 + Radix UI + recharts
- **Backend (Local)**: Node.js + TypeScript + better-sqlite3 (WAL mode)
- **Backend (Cloud)**: Cloudflare Workers + D1 (SQLite at the edge)
- **Shared Layer**: TypeScript types + pure logic (threshold functions, classification rules, tag dictionaries) — reused across both backends
- **AI**: OpenAI-compatible API (supports Zhipu GLM, Alibaba dashscope, SenseNova, OpenAI, Ollama, etc.)
- **Testing**: Vitest (132 backend tests + 85 Worker tests)
- **CI/CD**: GitHub Actions auto-deploys Worker + Pages on push to master

## Challenges we ran into

- **Middleware migration**: `koa-connect` wrappers caused `ctx` leaks when porting Express middleware to Koa — required a native Koa rewrite.
- **D1 SQL variable limit**: The `markRemovedStars` operation failed due to D1's SQL variable cap — solved via query + set-difference + batched UPDATE.
- **Worker CPU timeouts**: Syncing GitHub data without page limits blew the CPU budget — capped at 10 pages (1000 repos).
- **Edge cases in classification**: Invalid `topicsJson` caused null-pointer issues in `classifyRepo` — required defensive parsing.
- **TypeScript bundler quirks**: Inline multi-line generics triggered Vite's rolldown parser failure — had to extract types.
- **Bilingual stability**: Tag filtering needed to stay reliable while the UI language switched — solved by always storing the original Chinese label in `selectedTags` and only translating at display time via `getTagLabel()`.

## Accomplishments that we're proud of

- Turning a chaotic stars list into a **searchable, analyzable, inferable map of technical assets**
- A **dual deployment model** — run fully local for privacy, or on Cloudflare's global edge for zero-ops
- **AI-derived insights** (Star DNA + Learning Path) that feel personalized, not generic
- A genuinely **bilingual, theme-aware UI** out of the box
- **217 tests** keeping both backends honest

## What we learned

- GitHub Stars are a surprisingly strong proxy for a developer's interest graph — better than bios or pinned repos.
- Edge compute (Cloudflare Workers + D1) can carry real analytical workloads, not just CRUD — but you have to design around its CPU and SQL limits upfront.
- Bilingual UX requires strict separation between **stored identity** and **displayed label** — mixing them causes subtle filter bugs.
- AI-generated insights need a **cache-first strategy** (generate once on first access, serve from DB afterward) to stay cheap and fast.

## What's next for the star way

- **Share Card** — Export your Star DNA as a shareable image/card for social posts
- **Compare Users** — Diff two developers' starred repos to reveal overlapping and diverging tech interests
- **GitHub Profile Badge** — Embed a live stars-overview badge in your profile README
- **Docker Compose deployment** — One-command self-hosted deploy
- **More classification rules** — Community-driven tag dictionary expansion (open as Good First Issues)
