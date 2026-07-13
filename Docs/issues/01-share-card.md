# [Feature] Share Card for Star DNA

> 用于 GitHub Issue 创建。复制下方内容到 https://github.com/patdelphi/the-star-way/issues/new

## Issue 标题

```
[Feature] Share Card for Star DNA
```

## Labels

`enhancement`, `feature`

## Issue 正文

```markdown
## Motivation

Star DNA is the most viral feature of the-star-way. Currently users can only view their profile in the browser. A shareable image card would enable users to post their Star DNA on X / 即刻 / 朋友圈 / 小红书, driving organic distribution.

## Proposed Feature

Generate a downloadable image card (PNG) summarizing a developer's Star DNA:

```
patdelphi's Star DNA

Top Interests:
AI / LLM · Frontend · DevTools · Cloudflare · Automation

Hidden Gems: 18
Sleeping Stars: 42
Learning Path: AI-native full-stack tooling
```

## Implementation Ideas

- Frontend: use `html-to-image` or `canvas` to render a styled card and export as PNG
- Card layout: gradient background, repo count, top tags (chips), Hidden Gems / Sleeping Stars counts, Learning Path one-liner
- Add a "Share" button on the Star DNA result page
- Optional: embed QR code linking back to the live demo

## Acceptance Criteria

- [ ] "Share Card" button visible on Star DNA page
- [ ] Clicking generates a 1080×1080 (or 1200×630) PNG
- [ ] Card includes: username, top interests, Hidden Gems count, Sleeping Stars count, Learning Path summary
- [ ] Bilingual card content (follows current UI language)
- [ ] Download works on major browsers (Chrome / Safari / Firefox)

## Priority

P0 — highest distribution value among planned features.
```
