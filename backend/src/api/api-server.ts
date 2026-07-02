/**
 * API 服务器启动入口
 * 使用 Node.js 内置 http 模块，端口 3210
 */
import { createServer, type Server } from 'node:http'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createConnection, initDatabase } from '../db/connection.js'
import { createRouter } from './routes.js'

const DEFAULT_PORT = 3210
const PORT_FILE = join(process.cwd(), '..', '.runtime', 'port.json')

/**
 * 尝试在指定端口启动服务，被占用则自动递增
 */
function listenWithRetry(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (p: number) => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && p < DEFAULT_PORT + 10) {
          console.log(`[the-star-way] 端口 ${p} 被占用，尝试 ${p + 1}...`)
          tryPort(p + 1)
        } else {
          reject(err)
        }
      })
      server.listen(p, () => {
        // 写入实际端口到文件，供 Vite proxy 读取
        try {
          mkdirSync(dirname(PORT_FILE), { recursive: true })
          writeFileSync(PORT_FILE, JSON.stringify({ port: p, startedAt: new Date().toISOString() }))
        } catch { /* 忽略写入错误 */ }
        resolve(p)
      })
    }
    tryPort(port)
  })
}

/**
 * 启动 API 服务
 * @param port 端口号，默认 3210
 */
export async function startApiServer(port: number = DEFAULT_PORT): Promise<void> {
  // 初始化数据库
  const db = createConnection()
  initDatabase(db)

  // 创建路由处理器
  const handler = createRouter(db)

  // 启动 HTTP 服务（端口自动递增）
  const server = createServer(handler)
  const actualPort = await listenWithRetry(server, port)

  console.log(`[the-star-way] API 服务已启动: http://localhost:${actualPort}`)
  console.log(`[the-star-way] 数据库: ${process.cwd()}\\data\\starway.db`)

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
