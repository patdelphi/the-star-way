/**
 * 同步状态共享逻辑
 * 统一本地后端与 Cloudflare Worker 对 success / partial / failed 的业务语义。
 */

export const SYNC_STATUSES = ['running', 'success', 'partial', 'failed'] as const

export type SyncStatus = typeof SYNC_STATUSES[number]

export function canGenerateUserAiFromSyncStatus(status: SyncStatus): boolean {
  return status === 'success'
}

export function isTerminalSyncStatus(status: SyncStatus): boolean {
  return status !== 'running'
}

export function getIncompleteSyncMessage(login: string, status: SyncStatus, errorMessage?: string | null): string {
  const suffix = errorMessage ? `：${errorMessage}` : ''
  return `用户 ${login} 的星标同步尚未完整完成（${status}）${suffix}，请先完成同步后再生成 AI 内容`
}
