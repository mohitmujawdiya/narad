import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const DEFAULT_PORT = 3000;

async function waitForPort(port: number, timeoutMs = 60_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status < 500) return true;
    } catch {
      // not ready yet
    }
    await sleep(500);
  }
  return false;
}

async function main(): Promise<void> {
  // Ensure deps installed
  if (!existsSync(path.join(PROJECT_ROOT, "node_modules"))) {
    console.log("Installing deps…");
    await new Promise<void>((res, rej) => {
      const p = spawn("pnpm", ["install"], { stdio: "inherit", cwd: PROJECT_ROOT });
      p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`pnpm install exited ${code}`))));
    });
  }

  // Migrate
  await new Promise<void>((res, rej) => {
    const p = spawn("pnpm", ["db:migrate"], { stdio: "inherit", cwd: PROJECT_ROOT });
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`pnpm db:migrate exited ${code}`))));
  });

  // Seed (idempotent)
  await new Promise<void>((res, rej) => {
    const p = spawn("pnpm", ["seed"], { stdio: "inherit", cwd: PROJECT_ROOT });
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`pnpm seed exited ${code}`))));
  });

  // Boot dev server
  console.log(`Starting dev server on port ${DEFAULT_PORT}…`);
  const dev = spawn("pnpm", ["dev"], {
    stdio: ["ignore", "inherit", "inherit"],
    cwd: PROJECT_ROOT,
    detached: false,
  });

  const ready = await waitForPort(DEFAULT_PORT);
  if (!ready) {
    console.error("Dev server didn't become ready within 60s.");
    dev.kill();
    process.exit(1);
  }

  // Open browser
  const url = `http://localhost:${DEFAULT_PORT}`;
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(opener, [url], { stdio: "ignore", detached: true }).unref();

  console.log(`Narad is running at ${url}`);
  // keep process alive (dev server is the foreground)
  dev.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
