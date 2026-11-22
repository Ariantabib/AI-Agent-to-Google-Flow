// Resolves playwright-core: first from a normal node_modules (npm/npx install of this repo),
// then from flow-agent's private runtime folder (used when running as a Claude Code plugin).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PLAYWRIGHT_VERSION, RUNTIME_DIR } from "./paths.mjs";

const runtimeEntry = () => join(RUNTIME_DIR, "node_modules", "playwright-core", "index.mjs");

export async function loadPlaywright() {
  try {
    return await import("playwright-core");
  } catch {
    // fall through to the runtime folder
  }
  if (existsSync(runtimeEntry())) return import(pathToFileURL(runtimeEntry()).href);
  throw new Error('playwright-core is not installed. Run: node flow.mjs setup');
}

export async function playwrightAvailable() {
  try {
    await loadPlaywright();
    return true;
  } catch {
    return false;
  }
}

// Installs playwright-core into ~/.flow-agent/runtime. No browser download: we drive the user's own Chrome.
export function installRuntime() {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  const pkg = join(RUNTIME_DIR, "package.json");
  if (!existsSync(pkg)) writeFileSync(pkg, JSON.stringify({ name: "flow-agent-runtime", private: true }, null, 2));
  const win = process.platform === "win32";
  const res = spawnSync(win ? "npm.cmd" : "npm", ["install", `playwright-core@${PLAYWRIGHT_VERSION}`, "--no-fund", "--no-audit"], {
    cwd: RUNTIME_DIR,
    stdio: "inherit",
    shell: win,
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" },
  });
  if (res.status !== 0) throw new Error(`npm install failed (exit ${res.status}). Is Node.js/npm on PATH?`);
  return RUNTIME_DIR;
}
