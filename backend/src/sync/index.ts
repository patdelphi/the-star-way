/**
 * the-star-way 同步模块统一导出
 */
export { GitHubClient } from './github-client.js'
export type { GitHubClientConfig, GitHubStarredRepo, SyncResult, RateLimitInfo } from './github-client.js'
export { syncStars, syncStarsWithDefaultDb } from './star-syncer.js'
export type { StarSyncResult } from './star-syncer.js'
export { GitHubSyncError, createSyncError } from './errors.js'
