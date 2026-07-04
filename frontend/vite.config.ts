import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const srcPath = new URL("./src", import.meta.url).pathname.replace(/^\/([A-Za-z]:\/)/, "$1")
// shared 层路径（跨端共用的类型和纯逻辑）
const sharedPath = new URL("../shared", import.meta.url).pathname.replace(/^\/([A-Za-z]:\/)/, "$1")

// 从 .runtime/port.json 读取后端实际端口（后端端口占用时自动递增）
function getBackendPort(): number {
  try {
    const portFile = join(__dirname, "..", ".runtime", "port.json")
    const data = JSON.parse(readFileSync(portFile, "utf-8"))
    return data.port || 3210
  } catch {
    return 3210
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": srcPath,
      "@shared": sharedPath,
    },
  },
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${getBackendPort()}`,
        changeOrigin: true,
      },
    },
  },
})
