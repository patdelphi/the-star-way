# [Feature] Compare GitHub users by starred repos

> 用于 GitHub Issue 创建。复制下方内容到 https://github.com/patdelphi/the-star-way/issues/new

## Issue 标题

```
[Feature] Compare GitHub users by starred repos
```

## Labels

`enhancement`, `feature`

## Issue 正文

```markdown
## Motivation

Comparing two developers' GitHub Stars has strong viral potential — titles like "I compared two developers' GitHub Stars and their tech paths are completely different" drive curiosity clicks and shares.

## Proposed Feature

A new page that takes two GitHub usernames and produces a side-by-side comparison:

```
User A vs User B

Common interests:
- AI tools
- TypeScript
- Cloudflare

A unique interests:
- Design systems
- Marketing automation

B unique interests:
- Rust
- Infrastructure

Common starred repos: 12
```

## Implementation Ideas

- New route `/compare?u=a&u=b`
- Reuse existing sync + classification logic
- Compute set difference of autoTags for each user
- List common starred repos (by repo id intersection)
- Optional: radar chart comparing tag distributions (recharts)

## Acceptance Criteria

- [ ] Compare page accepts two usernames via URL query
- [ ] Shows common interests, A-unique, B-unique
- [ ] Lists common starred repos
- [ ] Handles users not yet synced (auto-sync or prompt)
- [ ] Bilingual labels
- [ ] Shareable URL (so users can post the comparison link)

## Priority

P1 — strong distribution, builds on existing classification infra.
```
