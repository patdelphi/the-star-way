/**
 * API 服务启动脚本
 * 直接调用 startApiServer，绕过 import.meta.url 检测
 */
import { loadEnv } from '../config/env.js'
import { startApiServer } from './api-server.js'

loadEnv()

const port = parseInt(process.env.PORT || '3210', 10)
startApiServer(port)
