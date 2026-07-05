/**
 * shared/sync 共享逻辑测试
 * 验证同步状态语义在本地后端与 Worker 之间保持一致。
 */
import { describe, expect, it } from 'vitest'
import {
  SYNC_STATUSES,
  canGenerateUserAiFromSyncStatus,
  getIncompleteSyncMessage,
  isTerminalSyncStatus,
} from '../sync/index.js'

describe('shared sync status', () => {
  it('集中定义同步状态集合', () => {
    expect(SYNC_STATUSES).toEqual(['running', 'success', 'partial', 'failed'])
  })

  it('只有 success 允许生成用户级 AI 内容', () => {
    expect(canGenerateUserAiFromSyncStatus('success')).toBe(true)
    expect(canGenerateUserAiFromSyncStatus('partial')).toBe(false)
    expect(canGenerateUserAiFromSyncStatus('running')).toBe(false)
    expect(canGenerateUserAiFromSyncStatus('failed')).toBe(false)
  })

  it('running 不是终态，success partial failed 是终态', () => {
    expect(isTerminalSyncStatus('running')).toBe(false)
    expect(isTerminalSyncStatus('success')).toBe(true)
    expect(isTerminalSyncStatus('partial')).toBe(true)
    expect(isTerminalSyncStatus('failed')).toBe(true)
  })

  it('生成同步未完整完成的统一错误文案', () => {
    expect(getIncompleteSyncMessage('backnotprop', 'partial', '达到 Worker 同步上限'))
      .toContain('backnotprop')
    expect(getIncompleteSyncMessage('backnotprop', 'partial', '达到 Worker 同步上限'))
      .toContain('达到 Worker 同步上限')
  })
})
