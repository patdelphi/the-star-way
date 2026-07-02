import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 程序说明：验证项目启动脚本固定 Node/pnpm 入口，避免 native 模块按一个 Node 编译、再被另一个 Node 加载。
describe("start-project.ps1", () => {
  const script = readFileSync(resolve(__dirname, "../../../start-project.ps1"), "utf8");

  it("passes resolved node and pnpm paths into child processes", () => {
    expect(script).toContain("$NodeCmd");
    expect(script).toContain("$PnpmCmd");
    expect(script).toContain("$env:STARWAY_NODE_CMD");
    expect(script).toContain("$env:STARWAY_PNPM_CMD");
    expect(script).toContain("new Database(':memory:').close()");
    expect(script).toContain("$BackendTsx");
    expect(script).toContain("$FrontendVite");
    expect(script).toContain("& `$env:STARWAY_NODE_CMD '$BackendTsx' src/api/start.ts");
    expect(script).toContain("& `$env:STARWAY_NODE_CMD '$FrontendVite'");
    expect(script).not.toContain("pnpm exec tsx src/api/start.ts");
    expect(script).not.toContain("pnpm exec vite");
  });
});
