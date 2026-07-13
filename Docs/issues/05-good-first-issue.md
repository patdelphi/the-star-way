# [Good First Issue] Add more repo category rules

> 用于 GitHub Issue 创建。复制下方内容到 https://github.com/patdelphi/the-star-way/issues/new

## Issue 标题

```
[Good First Issue] Add more repo category rules
```

## Labels

`good first issue`, `help wanted`, `enhancement`

## Issue 正文

```markdown
## Motivation

the-star-way auto-categorizes starred repos using rules in `shared/classification/`. The current tag dictionary covers 60+ categories, but there are always niches we're missing. This is a great first issue for new contributors — it's self-contained, well-scoped, and improves classification quality immediately.

## Task

Add classification rules for categories that are currently under-covered. Good candidates:

- `rust-ecosystem` (cargo, tokio, serde, axum)
- `gamedev` (godot, bevy, unity, unreal)
- `data-engineering` (airflow, dbt, spark, kafka)
- `security` (pentest, ctf, reverse-engineering, owasp)
- `cli-tools` (tui, cobra, clap, inquirer)
- `homelab` (proxmox, truenas, pihole, unraid)

## How to Add a Rule

1. Open `shared/classification/tag-dictionary.ts`
2. Find the relevant tag entry (or add a new one with Chinese label + English label)
3. Add keywords/topics to the `keywords` / `topics` arrays
4. Open `shared/classification/__tests__/classification.test.ts`
5. Add test cases for the new rules
6. Run `cd shared && pnpm test` to verify

## Example

```ts
// shared/classification/tag-dictionary.ts
{
  label: '游戏开发',
  enLabel: 'Game Development',
  keywords: ['godot', 'bevy', 'unity', 'unreal', 'game engine'],
  topics: ['gamedev', 'game-development', 'godot', 'bevy'],
}
```

## Acceptance Criteria

- [ ] New category rules added to `tag-dictionary.ts`
- [ ] Corresponding `TAG_LABEL_EN` entries added in `frontend/src/lib/tag-labels.ts`
- [ ] Test cases added in `shared/classification/__tests__/classification.test.ts`
- [ ] `cd shared && pnpm test` passes
- [ ] `cd backend && pnpm test` passes

## Need help?

Leave a comment if you'd like to be assigned. Happy to guide you through the codebase!
```
