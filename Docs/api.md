# the-star-way API 与 CLI 规划

## 1. CLI 命令

```bash
the-star-way init
the-star-way sync <username>
the-star-way import-demo
the-star-way ui
the-star-way tag <username>
the-star-way export <username> --format csv|json|markdown|html
the-star-way report <username> --type dna|hidden-gems|sleep-stars
the-star-way translate <username> --to zh-CN
```

## 2. CLI 设计原则

- 默认本地运行。
- 无 token 也能使用 Demo 和匿名同步。
- 任何外部 API 失败必须有明确错误信息。
- 命令默认幂等，重复执行不产生重复数据。
- 导出命令不修改数据库。

## 3. 本地服务接口

首版 UI 可以通过本地 API 读取 SQLite 数据。

```text
GET /api/users
GET /api/users/:login/stats
GET /api/users/:login/repos
GET /api/users/:login/repos/:fullName
GET /api/users/:login/tags
POST /api/users/:login/classify
POST /api/sync
GET /api/export?format=markdown&login=:login
```

后续多语言 UI 可以增加本地配置接口，但当前 Demo 先用前端 `localStorage` 保存语言偏好，不依赖后端：

```text
GET /api/config/ui
PATCH /api/config/ui
```

## 4. 查询参数

`GET /api/users/:login/repos` 支持：

```text
q             搜索 repo name / description
language      编程语言
topic         GitHub topic
tag           自动标签
license       协议
sort          stars|forks|pushed_at|starred_at|open_issues
direction     asc|desc
page          页码
pageSize      每页数量
```

## 5. 返回结构示例

```json
{
  "items": [
    {
      "fullName": "owner/repo",
      "url": "https://github.com/owner/repo",
      "description": "repo description",
      "language": "TypeScript",
      "license": "MIT",
      "stars": 1200,
      "forks": 100,
      "topics": ["ai", "mcp"],
      "tags": [
        { "tag": "AI / LLM", "confidence": 0.95, "source": "topic" }
      ],
      "updatedAt": "2026-06-19T00:00:00Z",
      "starredAt": "2026-03-12T00:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 691
}
```

## 6. API 异常格式

```json
{
  "error": {
    "code": "GITHUB_RATE_LIMITED",
    "message": "GitHub API rate limit exceeded. Try again after reset time.",
    "retryable": false
  }
}
```

## 7. 导出格式

- CSV：适合表格分析。
- JSON：适合二次处理。
- Markdown：适合 README、Obsidian、博客。
- HTML：适合分享静态报告。
