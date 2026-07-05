/**
 * the-star-way 共享层入口
 * 仅导出运行时无关的类型、纯函数和常量
 * 不依赖 better-sqlite3、node:http 等 Node native 模块
 */
export * from './api-contracts/index.js'
export * from './ai/index.js'
export * from './classification/index.js'
export * from './scoring/index.js'
export * from './sync/index.js'
