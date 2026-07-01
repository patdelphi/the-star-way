/**
 * API 服务器启动入口
 * 使用 Node.js 内置 http 模块，端口 3210
 */
import { createServer } from 'node:http'
import { createConnection, initDatabase } from '../db/connection.js'
import { createRouter } from './routes.js'

const DEFAULT_PORT = 3210

/**
 * 启动 API 服务
 * @param port 端口号，默认 3210
 */
export function startApiServer(port: number = DEFAULT_PORT): void {
  // 初始化数据库
  const db = createConnection()
  initDatabase(db)

  // 创建路由处理器
  const handler = createRouter(db)

  // 启动 HTTP 服务
  const server = createServer(handler)

  server.listen(port, () => {
    console.log(`[the-star-way] API 服务已启动: http://localhost:${port}`)
    console.log(`[the-star-way] 数据库: ${process.cwd()}\\data\\starway.db`)
  })

  // 优雅关闭
  const shutdown = () => {
    console.log('[the-star-way] 正在关闭 API 服务...')
    server.close(() => {
      db.close()
      console.log('[the-star-way] 已关闭')
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

// 直接运行时启动服务
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10)
  startApiServer(port)
}
