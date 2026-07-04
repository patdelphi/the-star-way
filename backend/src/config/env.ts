/**
 * 程序说明：统一加载后端环境变量。
 * 后端通常从 backend 目录启动，但项目 .env 放在仓库根目录；这里同时读取两处配置。
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'

let loaded = false

export function loadEnv(options: { force?: boolean } = {}): void {
  if (loaded && !options.force) return
  loaded = true

  // 不覆盖系统环境变量；backend/.env 优先，根目录 .env 用于补充缺失项。
  for (const envPath of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
    if (existsSync(envPath)) {
      config({ path: envPath, override: false, quiet: true })
    }
  }
}
