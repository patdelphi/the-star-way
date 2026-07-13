# the-star-way 推广文案集

> 用于各渠道发帖。直接复制对应章节内容使用。
> 发帖前请先确认 Demo 可访问：https://starway.patdelphi.xyz

---

## 1. V2EX 互动贴（第一优先级）

### 推荐版块

- 分享创造
- 程序员
- 奇思妙想

### 标题建议

```
[开源] 我做了一个 GitHub Star DNA 分析器，留下你的 GitHub ID 我帮你跑
```

### 正文

我做了一个开源小工具：the-star-way。

它可以把任意 GitHub 用户的 starred repositories 同步下来，然后自动分类、统计分析，并用 AI 生成开发者的 Star DNA 和 Learning Path。

简单说，就是把 GitHub Stars 从"吃灰收藏夹"变成一张技术兴趣地图。

目前支持：

- 同步任意 GitHub 用户的 starred repos
- 按语言、topic、关键词、活跃度筛选
- 自动识别 AI / LLM、前端、DevOps、工具库等技术方向
- 生成 Star DNA 开发者画像
- 生成 Learning Path 学习路径
- 发现 Hidden Gems 和 Sleeping Stars
- 导出 CSV / JSON / Markdown / HTML
- 本地 SQLite 部署，也支持 Cloudflare Workers + D1

在线 Demo：https://starway.patdelphi.xyz
GitHub：https://github.com/patdelphi/the-star-way

我准备做一个互动测试：

你可以在楼下留下 GitHub 用户名，我帮你跑一次 Star DNA，看你的 GitHub Stars 里藏着什么技术人设和学习路线。

如果觉得这个方向有意思，欢迎给项目点个 Star。后面会继续做 Share Card、Compare Users 和 GitHub Profile Badge。

---

## 2. 微信群 / 朋友圈 / 即刻（短图配文）

```
我做了个小工具，可以分析 GitHub Stars，生成开发者 Star DNA。

输入 GitHub ID，就能看到：
- 技术兴趣分布
- 隐藏好项目
- 学习路径建议
- 收藏夹里的技术画像

在线体验：https://starway.patdelphi.xyz
GitHub：https://github.com/patdelphi/the-star-way

想试的可以丢 GitHub ID，我帮你跑。
```

配图建议：Star DNA 截图 + Dashboard 截图

---

## 3. 掘金 / SegmentFault 技术文章

### 标题（二选一）

```
我做了一个开源工具，把 GitHub Stars 变成技术画像和学习路径
```

```
用 React 19 + Tailwind 4 + Cloudflare Workers 重构一个 GitHub Star 分析工具
```

### 文章结构

1. 为什么做这个项目（GitHub Stars 吃灰痛点）
2. GitHub Stars 为什么值得分析
3. 产品功能设计（同步 / 分类 / 筛选 / 分析）
4. Star DNA / Learning Path 怎么做（AI 实现）
5. SQLite + D1 双架构设计
6. React 19 + Tailwind 4 实践
7. Demo 和 GitHub 链接 + CTA

---

## 4. X / Twitter

```
I built an open-source tool called the-star-way.

It turns GitHub Stars into an AI-powered developer interest map and learning path.

You can use it to:

- Analyze any GitHub user's starred repos
- Generate a Star DNA profile
- Discover hidden gems
- Find sleeping but useful repos
- Create a personalized learning path
- Export stars as CSV / JSON / Markdown / HTML
- Run locally with SQLite or deploy on Cloudflare Workers + D1

GitHub Stars are more than bookmarks. They reveal what a developer is learning, building, and paying attention to.

Live Demo: https://starway.patdelphi.xyz
GitHub: https://github.com/patdelphi/the-star-way

Drop your GitHub username and I'll run a Star DNA analysis for you. 👇
```

配图：Star DNA 截图 或 10 秒 GIF

---

## 5. Reddit

### 推荐社区与角度

| 社区 | 主打角度 |
|---|---|
| r/selfhosted | 本地部署、SQLite、隐私 |
| r/webdev | React / Vite / Tailwind / Cloudflare |
| r/reactjs | React 19 实践 |
| r/github | GitHub Stars 管理与分析 |
| r/opensource | 开源项目、可贡献路线图 |

### 通用正文模板

```
I built an open-source tool that turns GitHub Stars into a developer interest map and AI-powered learning path.

It syncs any GitHub user's starred repos, categorizes them, and generates:
- Star DNA (developer tech profile)
- Learning Path recommendations
- Hidden Gems (low-star but active repos)
- Sleeping Stars (dormant repos)

Tech: React 19 + Vite + Tailwind 4 + Cloudflare Workers + D1 + SQLite
Demo: https://starway.patdelphi.xyz
GitHub: https://github.com/patdelphi/the-star-way

Feedback welcome! What would you want to see in a GitHub Stars analyzer?
```

按社区调整标题：
- r/selfhosted: "Self-host your GitHub Stars analyzer (SQLite + Cloudflare D1)"
- r/reactjs: "Built a GitHub Stars analyzer with React 19 + Tailwind 4"
- r/github: "Turn GitHub Stars into a developer tech profile (open source)"

---

## 6. Show HN (Hacker News)

### 标题

```
Show HN: The-star-way – Turn GitHub Stars into your Tech DNA with AI
```

### 正文

```
I built an open-source tool that analyzes GitHub starred repositories and turns them into a developer interest map.

It can sync starred repos from any GitHub user, categorize them by language/topic/description, generate a Star DNA profile, recommend a learning path, and surface hidden gems or sleeping repos.

It supports local deployment with Node.js + SQLite, and also a Cloudflare deployment with Workers + D1 + Pages.

I built it because my own GitHub Stars had become a huge pile of forgotten bookmarks. I wanted to turn them into something searchable, analyzable, and actually useful.

Demo: https://starway.patdelphi.xyz
GitHub: https://github.com/patdelphi/the-star-way

I'd love feedback on the concept and the execution. What would make this useful for you?
```

---

## 7. 发帖节奏建议

| 时间 | 动作 |
|---|---|
| T-2 天 | 补 README GIF、截图、topics、release、issues |
| T-1 天 | 找 20–30 个朋友/开发者先体验，拿第一批 star 和反馈 |
| T 日上午 | 发 V2EX 互动贴 |
| T 日中午 | 发微信群、即刻、朋友圈 |
| T 日下午 | 发掘金/SegmentFault 技术文章 |
| T 日晚上 | 发 X、Reddit |
| T+1 日 | 根据反馈发 v0.1.1，小版本更新 |
| T+2 日 | 尝试 Show HN / Product Hunt |
