# [Feature] GitHub Profile Badge for Star DNA

> 用于 GitHub Issue 创建。复制下方内容到 https://github.com/patdelphi/the-star-way/issues/new

## Issue 标题

```
[Feature] GitHub Profile Badge for Star DNA
```

## Labels

`enhancement`, `feature`

## Issue 正文

```markdown
## Motivation

A badge that developers can embed in their GitHub Profile README creates a natural distribution loop — every profile visitor sees the badge and may click through to the-star-way.

## Proposed Feature

A public endpoint that returns an SVG badge summarizing a user's Star DNA:

```md
![My Star DNA](https://starway.patdelphi.xyz/api/badge/patdelphi)
```

Example SVG content:

- Left: `Star DNA`
- Right: `AI · Frontend · DevTools` (top 3 tags)
- Clicking the badge links to `https://starway.patdelphi.xyz?user=patdelphi`

## Implementation Ideas

- New Worker route `GET /api/badge/:login` returning `image/svg+xml`
- Cache badge SVG in D1 or KV (TTL 24h) to avoid recomputing
- Reuse existing `getStarDna` / classification logic
- Shields.io-style flat design, themeable (light/dark)

## Acceptance Criteria

- [ ] `GET /api/badge/:login` returns valid SVG
- [ ] Badge shows top 3 interest tags
- [ ] Badge links back to the user's Star DNA page
- [ ] Response cached for 24h
- [ ] Handles unknown user with a "Sync first" placeholder badge
- [ ] Works embedded in GitHub Profile README

## Priority

P2 — passive distribution, low effort once endpoint exists.
```
