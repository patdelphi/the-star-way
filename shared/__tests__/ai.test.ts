/**
 * shared/ai 共享逻辑测试
 * 验证用户级 AI prompt 和缓存 key 在本地后端与 Worker 之间保持一致。
 */
import { describe, expect, it } from 'vitest'
import {
  USER_AI_CACHE_KEYS,
  buildLearningPathPrompt,
  buildStarDnaPrompt,
  getUserAiCacheKey,
  isUserAiCacheKey,
} from '../ai/index.js'

const stats = {
  repoCount: 423,
  activeRepoCount: 321,
  languages: [{ language: 'TypeScript', count: 120 }],
  tags: [{ tag: 'ai', count: 80 }],
  topRepos: [{ full_name: 'owner/repo', description: 'Useful project', stars: 1000 }],
}

describe('shared ai prompts', () => {
  it('Star DNA prompt 明确使用 starred repositories，不混用 public repositories', () => {
    const prompt = buildStarDnaPrompt('backnotprop', stats)

    expect(prompt).toContain('已同步 starred repositories 数：423')
    expect(prompt).toContain('不是该用户自己创建的 public repositories 数')
    expect(prompt).toContain('owner/repo')
  })

  it('学习路径 prompt 明确使用 starred repositories，不混用 public repositories', () => {
    const prompt = buildLearningPathPrompt('backnotprop', stats)

    expect(prompt).toContain('已同步 starred repositories 数：423')
    expect(prompt).toContain('不是该用户自己创建的 public repositories 数')
    expect(prompt).toContain('owner/repo')
  })
})

describe('shared ai cache keys', () => {
  it('集中定义用户级 AI 缓存 key', () => {
    expect(USER_AI_CACHE_KEYS).toEqual(['dna-zh', 'dna-en', 'learning-zh', 'learning-en'])
    expect(getUserAiCacheKey('backnotprop')).toBe('user:backnotprop')
  })

  it('识别用户级 AI 缓存 key', () => {
    expect(isUserAiCacheKey('dna-zh')).toBe(true)
    expect(isUserAiCacheKey('learning-en')).toBe(true)
    expect(isUserAiCacheKey('zh')).toBe(false)
  })
})
