import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      // shared 层在 backend 目录之外，用 @shared alias 统一解析
      '@shared': resolve(__dirname, '..', 'shared'),
    },
  },
  test: {
    globals: true,
    testTimeout: 10000,
    // 包含 shared 测试（纯函数测试，不依赖 backend）
    include: [
      'src/**/*.{test,spec}.ts',
      '../shared/__tests__/**/*.{test,spec}.ts',
    ],
  },
})
