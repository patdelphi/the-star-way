# the-star-way 优化计划

## 1. 性能优化

- GitHub 同步使用分页批处理。
- SQLite 对 `user_login`、`repo_full_name`、`language`、`license`、`updated_at`、`starred_at` 建索引。
- 列表查询默认分页。
- 大字段如 README 摘要延迟加载。
- 统计结果可缓存到 analysis_reports。

## 2. 分类优化

- 先用规则分类，减少 AI 调用。
- 对低置信度项目再启用 LLM。
- 用户手动修正写回本地偏好。
- 标签字典按真实数据持续迭代。

## 3. 导出优化

- 导出与筛选条件绑定。
- 大列表使用流式写入。
- 文本文件统一 UTF-8 BOM 和 CRLF。
- Markdown 导出提供 Awesome List、学习路线、复用清单三种模板。

## 4. UI 优化

- Star List 保持高信息密度。
- Dashboard 和 Star DNA 要适合截图传播。
- 筛选器保持稳定布局，避免文本溢出。
- 使用真实项目数据，不使用空泛占位图。

## 5. AI 成本控制

- 翻译和摘要必须缓存。
- 同一 repo + target_lang 不重复请求。
- 默认关闭外部 AI。
- OpenAI-compatible、Ollama、LM Studio 等 provider 使用统一适配器。

## 6. 风险控制

- License 分析只做工程提醒，不做法律意见。
- GitHub rate limit 明确提示。
- 网络失败不影响本地 Demo。
- removed_at 只标记，不删除历史。
