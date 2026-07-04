#!/usr/bin/env bash
# 程序说明：启动 the-star-way 后端和前端（Linux/macOS 版本）
# 功能与 start.ps1 等价：固定 Node 版本、检查 native 模块、按需重建、后台启动并等待就绪
# 用法：./start.sh [--backend-port 3210] [--frontend-port 5173] [--open-browser]
set -euo pipefail

# ===== 默认参数 =====
BACKEND_PORT=3210
FRONTEND_PORT=5173
OPEN_BROWSER=0

# ===== 解析命令行参数 =====
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-port)
      BACKEND_PORT="$2"; shift 2 ;;
    --frontend-port)
      FRONTEND_PORT="$2"; shift 2 ;;
    --open-browser)
      OPEN_BROWSER=1; shift ;;
    -h|--help)
      echo "Usage: ./start.sh [--backend-port 3210] [--frontend-port 5173] [--open-browser]"
      exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ===== 路径常量 =====
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
RUNTIME_DIR="$PROJECT_ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/pids.json"
REQUIRED_NODE_VERSION="24.15.0"

# ===== 工具函数 =====

# 查找可用端口：从 $1 开始递增直到找到未监听的端口
find_available_port() {
  local port="$1"
  while [[ "$port" -le 65535 ]]; do
    # 用 ss 检查端口监听状态（兼容大多数 Linux），失败回退到 /dev/tcp 探测
    if command -v ss >/dev/null 2>&1; then
      if ! ss -ltn "sport = :$port" 2>/dev/null | grep -q ":$port"; then
        echo "$port"; return 0
      fi
    elif command -v lsof >/dev/null 2>&1; then
      if ! lsof -iTCP:"$port" -sTCP:LISTEN -P -n 2>/dev/null | grep -q ":$port"; then
        echo "$port"; return 0
      fi
    else
      # 退化方案：尝试用 bash /dev/tcp 连接，连不上则视为端口空闲
      if ! (echo >"/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1; then
        echo "$port"; return 0
      fi
    fi
    port=$((port + 1))
  done
  echo "No available port starting from $1" >&2
  return 1
}

# 清理上次启动残留进程（按 PID 文件）
cleanup_previous() {
  if [[ -f "$PID_FILE" ]]; then
    # 用 python 解析 JSON（避免依赖 jq），失败静默
    python3 - "$PID_FILE" <<'PY' 2>/dev/null || true
import json, os, signal, sys
pid_file = sys.argv[1]
try:
    with open(pid_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for key in ('backend', 'frontend'):
        pid = data.get(key)
        if pid:
            try:
                os.kill(int(pid), signal.SIGTERM)
            except (ProcessLookupError, ValueError, PermissionError):
                pass
except Exception:
    pass
PY
    rm -f "$PID_FILE"
  fi
}

# 等待 URL 就绪：最多等待 $2 秒，期间每 300ms 探测一次
wait_ready() {
  local url="$1"
  local timeout="$2"
  local deadline=$((SECONDS + timeout))
  # 用 curl 探测（-s 静默 -o /dev/null 丢弃响应体 -m 2 单次超时）
  while [[ $SECONDS -lt $deadline ]]; do
    if command -v curl >/dev/null 2>&1; then
      if curl -s -o /dev/null -m 2 "$url" 2>/dev/null; then
        return 0
      fi
    else
      # 无 curl 时退化到 bash /dev/tcp
      local host port
      host="$(echo "$url" | sed -E 's|^https?://([^:/]+).*|\1|')"
      port="$(echo "$url" | sed -E 's|^https?://[^:/]+:([0-9]+).*|\1|')"
      if (echo >"/dev/tcp/$host/$port") >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 0.3
  done
  return 1
}

# 显示日志末尾 $1 行
show_log() {
  local path="$1"
  local lines="${2:-20}"
  [[ -f "$path" ]] && tail -n "$lines" "$path"
}

# 校验 Node 版本必须与 REQUIRED_NODE_VERSION 完全一致
assert_node_version() {
  local node_cmd="$1"
  local actual_version
  actual_version="$("$node_cmd" -p "process.versions.node" 2>/dev/null | tr -d '[:space:]')"
  if [[ "$actual_version" != "$REQUIRED_NODE_VERSION" ]]; then
    echo "Node.js version mismatch. Required v$REQUIRED_NODE_VERSION, current v$actual_version at $node_cmd." >&2
    echo "Use the project .node-version/.nvmrc and rerun corepack pnpm rebuild better-sqlite3." >&2
    return 1
  fi
}

# 解析 pnpm 命令：优先 corepack，回退 PATH 中的 pnpm
resolve_pnpm_command() {
  if command -v corepack >/dev/null 2>&1; then
    echo "corepack pnpm"
  elif command -v pnpm >/dev/null 2>&1; then
    echo "pnpm"
  else
    echo "pnpm not found. Install Node.js + corepack first." >&2
    return 1
  fi
}

# ===== Main =====

# 依赖检查
if ! command -v node >/dev/null 2>&1; then
  echo "STARTUP FAILED: node not found in PATH" >&2
  exit 1
fi
NODE_CMD="$(command -v node)"
NODE_DIR="$(dirname "$NODE_CMD")"
# 把 node 目录前置到 PATH，避免子进程命中其他 Node
export PATH="$NODE_DIR:$PATH"

# 目录检查
if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "STARTUP FAILED: Missing backend dir: $BACKEND_DIR" >&2
  exit 1
fi
if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "STARTUP FAILED: Missing frontend dir: $FRONTEND_DIR" >&2
  exit 1
fi

# 版本校验
assert_node_version "$NODE_CMD"

# pnpm 命令
PNPM_RUNTIME="$(resolve_pnpm_command)"
# 兼容 corepack pnpm 形式：拆分前缀和实际命令
if [[ "$PNPM_RUNTIME" == "corepack pnpm" ]]; then
  PNPM_CMD="corepack"
  PNPM_ARGS_PREFIX=("pnpm")
else
  PNPM_CMD="$PNPM_RUNTIME"
  PNPM_ARGS_PREFIX=()
fi

# 依赖检查
if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  echo "STARTUP FAILED: Backend deps missing. Run: cd backend && $PNPM_RUNTIME install" >&2
  exit 1
fi
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "STARTUP FAILED: Frontend deps missing. Run: cd frontend && $PNPM_RUNTIME install" >&2
  exit 1
fi
BACKEND_TSX="$BACKEND_DIR/node_modules/tsx/dist/cli.mjs"
FRONTEND_VITE="$FRONTEND_DIR/node_modules/vite/bin/vite.js"
if [[ ! -f "$BACKEND_TSX" ]]; then
  echo "STARTUP FAILED: Backend tsx CLI missing: $BACKEND_TSX" >&2
  exit 1
fi
if [[ ! -f "$FRONTEND_VITE" ]]; then
  echo "STARTUP FAILED: Frontend vite CLI missing: $FRONTEND_VITE" >&2
  exit 1
fi

# 清理上次残留 + 创建运行时目录
cleanup_previous
mkdir -p "$RUNTIME_DIR"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
FRONTEND_LOG="$RUNTIME_DIR/frontend.log"
: > "$BACKEND_LOG"
: > "$FRONTEND_LOG"

# 查找端口
ACTUAL_BACKEND="$(find_available_port "$BACKEND_PORT")"
ACTUAL_FRONTEND="$(find_available_port "$FRONTEND_PORT")"

echo "Starting..."

# 检查 native 模块：用与启动同一个 Node 加载验证，失败则 rebuild
echo "Checking native modules..."
if ! (cd "$BACKEND_DIR" && "$NODE_CMD" -e "const Database = require('better-sqlite3'); new Database(':memory:').close()") >"$RUNTIME_DIR/native-check.log" 2>&1; then
  echo "Rebuilding better-sqlite3 for Node.js $("$NODE_CMD" -v | tr -d '[:space:]') ..."
  if ! (cd "$BACKEND_DIR" && "$PNPM_CMD" "${PNPM_ARGS_PREFIX[@]}" rebuild better-sqlite3) >"$RUNTIME_DIR/rebuild.log" 2>&1; then
    echo "--- native check error ---" >&2
    tail -n 20 "$RUNTIME_DIR/native-check.log" >&2 || true
    echo "--- rebuild error ---" >&2
    tail -n 40 "$RUNTIME_DIR/rebuild.log" >&2 || true
    echo "STARTUP FAILED: better-sqlite3 rebuild failed. Try manually: cd backend && $PNPM_RUNTIME rebuild better-sqlite3" >&2
    exit 1
  fi
  echo "Rebuild done."
fi

# 启动后端：后台运行，输出重定向到日志文件
echo "Starting backend on port $ACTUAL_BACKEND..."
(
  cd "$BACKEND_DIR"
  export PORT="$ACTUAL_BACKEND"
  "$NODE_CMD" "$BACKEND_TSX" src/api/start.ts >"$BACKEND_LOG" 2>&1 &
  echo $! > "$RUNTIME_DIR/backend.pid"
)
BACKEND_PID="$(cat "$RUNTIME_DIR/backend.pid")"
echo "Backend PID: $BACKEND_PID"

# 启动前端：后台运行，注入 VITE_API_BASE 指向后端
echo "Starting frontend on port $ACTUAL_FRONTEND..."
(
  cd "$FRONTEND_DIR"
  export VITE_API_BASE="http://localhost:$ACTUAL_BACKEND"
  "$NODE_CMD" "$FRONTEND_VITE" --host 127.0.0.1 --port "$ACTUAL_FRONTEND" >"$FRONTEND_LOG" 2>&1 &
  echo $! > "$RUNTIME_DIR/frontend.pid"
)
FRONTEND_PID="$(cat "$RUNTIME_DIR/frontend.pid")"
echo "Frontend PID: $FRONTEND_PID"

# 写 PID 文件（JSON 格式，与 ps1 版本兼容）
cat > "$PID_FILE" <<EOF
{
  "backend": $BACKEND_PID,
  "frontend": $FRONTEND_PID
}
EOF

# 等待后端就绪
if ! wait_ready "http://localhost:$ACTUAL_BACKEND/api/users" 30; then
  echo "" >&2
  echo "--- Backend log (last 20 lines) ---" >&2
  show_log "$BACKEND_LOG" 20 >&2 || true
  echo "" >&2
  echo "STARTUP FAILED: Backend startup timeout (30s). See log above." >&2
  # 清理半启动进程
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  exit 1
fi

# 等待前端就绪
if ! wait_ready "http://localhost:$ACTUAL_FRONTEND/" 30; then
  echo "" >&2
  echo "--- Frontend log (last 20 lines) ---" >&2
  show_log "$FRONTEND_LOG" 20 >&2 || true
  echo "" >&2
  echo "STARTUP FAILED: Frontend startup timeout (30s). See log above." >&2
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  exit 1
fi

# 输出结果
echo ""
if [[ "$ACTUAL_BACKEND" != "$BACKEND_PORT" ]]; then
  echo "Backend port $BACKEND_PORT in use, using $ACTUAL_BACKEND"
fi
if [[ "$ACTUAL_FRONTEND" != "$FRONTEND_PORT" ]]; then
  echo "Frontend port $FRONTEND_PORT in use, using $ACTUAL_FRONTEND"
fi
echo "Backend:  http://localhost:$ACTUAL_BACKEND/"
echo "Frontend: http://localhost:$ACTUAL_FRONTEND/"
echo ""
echo "Press Ctrl+C to stop."

# 可选：自动打开浏览器
if [[ "$OPEN_BROWSER" == "1" ]]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$ACTUAL_FRONTEND/" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "http://localhost:$ACTUAL_FRONTEND/" >/dev/null 2>&1 || true
  fi
fi

# 注册退出清理：Ctrl+C 或异常退出时杀掉子进程
cleanup_on_exit() {
  echo ""
  echo "Stopping..."
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  exit 0
}
trap cleanup_on_exit INT TERM

# 主循环：每 2 秒检查子进程是否还活着，任一退出则停止全部
while true; do
  sleep 2
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Backend exited"
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "Frontend exited"
    break
  fi
done

cleanup_on_exit
