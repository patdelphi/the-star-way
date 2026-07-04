/**
 * Cloudflare Worker 入口
 * the-star-way Worker API
 *
 * 职责：
 * - 接收 fetch 请求，转发到路由处理器
 * - 绑定 D1 数据库
 * - 注入 Worker secrets（GitHub Token 等）
 *
 * 部署：wrangler deploy
 */
import { handleRequest } from './routes.js'
import type { Env } from './env.js'

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return handleRequest(request, env, ctx)
  },
}
