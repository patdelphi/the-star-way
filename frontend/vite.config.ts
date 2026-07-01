import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const srcPath = new URL("./src", import.meta.url).pathname.replace(/^\/([A-Za-z]:\/)/, "$1")

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
})
