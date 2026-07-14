/**
 * 分类纯函数测试
 * 验证 classifyRepo 的 topic/name/description 三级匹配逻辑
 */
import { describe, it, expect } from 'vitest'
import { classifyRepo } from '../classification/classifier.js'

describe('classifyRepo', () => {
  it('应从 topics 精确匹配 AI / LLM 标签', () => {
    const tags = classifyRepo('langchain', 'Build LLM apps', '["llm", "ai", "agent", "rag"]')
    const tagNames = tags.map(t => t.tag)
    expect(tagNames).toContain('AI / LLM')
    expect(tagNames).toContain('AI Agent')
    expect(tagNames).toContain('RAG / 向量检索')
  })

  it('应从 topics 匹配前端框架标签', () => {
    const tags = classifyRepo('next.js', 'The React framework', '["react", "nextjs", "typescript"]')
    const tagNames = tags.map(t => t.tag)
    expect(tagNames).toContain('前端框架')
    expect(tagNames).toContain('JavaScript / TypeScript')
  })

  it('应从仓库名称匹配标签', () => {
    const tags = classifyRepo('awesome-python', 'A curated list', '["awesome-list", "python"]')
    const tagNames = tags.map(t => t.tag)
    expect(tagNames).toContain('Awesome 列表')
    expect(tagNames).toContain('Python')
  })

  it('应从描述匹配标签', () => {
    const tags = classifyRepo('portainer', 'A lightweight self-hosted Docker management UI', '["docker"]')
    const tagNames = tags.map(t => t.tag)
    expect(tagNames).toContain('容器 / 编排')
    expect(tagNames).toContain('可自托管')
    expect(tagNames).toContain('轻量级')
  })

  it('置信度应正确：topic > name > description', () => {
    const tags = classifyRepo('awesome-react', 'A curated awesome list for learning react', '["react", "awesome-list"]')
    const tagMap = new Map(tags.map(t => [t.tag, t]))

    expect(tagMap.get('前端框架')!.source).toBe('topic')
    expect(tagMap.get('前端框架')!.confidence).toBe(0.95)

    expect(tagMap.get('Awesome 列表')!.source).toBe('topic')
    expect(tagMap.get('学习资源')!.source).toBe('description')
    expect(tagMap.get('学习资源')!.confidence).toBe(0.80)
  })

  it('同一标签不应重复出现', () => {
    const tags = classifyRepo('test', null, '["ai", "machine-learning"]')
    const aiCount = tags.filter(t => t.tag === 'AI / LLM').length
    expect(aiCount).toBeLessThanOrEqual(1)
  })

  it('无匹配时应返回空数组', () => {
    const tags = classifyRepo('xyz', 'some random text', '[]')
    expect(tags).toEqual([])
  })

  it('null 描述应正常处理', () => {
    const tags = classifyRepo('react-app', null, '["react"]')
    expect(tags.length).toBeGreaterThan(0)
    expect(tags.some(t => t.tag === '前端框架')).toBe(true)
  })

  it('null topicsJson 应正常处理', () => {
    const tags = classifyRepo('awesome-go', 'A curated list', null)
    expect(tags.some(t => t.tag === 'Awesome 列表')).toBe(true)
  })

  it('无效 topicsJson 应正常处理', () => {
    const tags = classifyRepo('test', 'test', 'invalid json')
    expect(tags).toEqual([])
  })

  it('应从 topics 匹配 Rust 生态标签', () => {
    const tags = classifyRepo('tokio', 'A runtime for async Rust', '["rust", "tokio", "async"]')
    const tagNames = tags.map(t => t.tag)
    expect(tagNames).toContain('Rust 生态')
    expect(tagNames).toContain('Rust')
  })

  it('应从 topics 匹配安全工具标签', () => {
    const tags = classifyRepo('pwntools', 'CTF framework', '["ctf", "pentest", "security"]')
    const tagNames = tags.map(t => t.tag)
    expect(tagNames).toContain('安全工具')
    expect(tagNames).toContain('安全 / 隐私')
  })

  it('应从 topics 匹配数据工程标签', () => {
    const tags = classifyRepo('dbt-core', 'Data build tool', '["dbt", "data-engineering", "sql"]')
    const tagNames = tags.map(t => t.tag)
    expect(tagNames).toContain('数据工程')
  })

  it('应从 topics 匹配 Homelab 标签', () => {
    const tags = classifyRepo('pi-hole', 'Network ad blocker', '["pihole", "dns", "homelab"]')
    const tagNames = tags.map(t => t.tag)
    expect(tagNames).toContain('Homelab')
    expect(tagNames).toContain('网络')
  })
})
