/**
 * Worker 测试配置
 * 让 vitest 能解析 @shared alias 并包含 shared 测试
 * 使用 miniflare 模拟 D1 环境
 */
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      // shared 层在 worker 目录之外，用 @shared alias 统一解析
      '@shared': resolve(__dirname, '..', '..', 'shared'),
    },
  },
  test: {
    globals: true,
    testTimeout: 15000,
    include: [
      'src/**/*.{test,spec}.ts',
    ],
  },
})
