// Starts (or reuses) a real Google Chrome with a dedicated profile and remote debugging, then connects
// Playwright to it over CDP. The user's everyday Chrome profile is never touched: Chrome refuses remote
// debugging on its default profile anyway, and a separate profile keeps the agent away from personal data.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { FLOW_URL } from "./paths.mjs";
import { loadPlaywright } from "./playwright.mjs";
import { sleep } from "./log.mjs";

const FLOW_PAGE = /^https:\/\/(flow\.google\.com|labs\.google\/fx)/;

export function findChrome() {
  const local = process.env.LOCALAPPDATA;
  const candidates = [
    process.env.FLOW_AGENT_CHROME,
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    `${process.env.HOME ?? ""}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    // Windows (system-wide, 32-bit, per-user)
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    local ? `${local}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    // Linux
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/opt/google/chrome/chrome",
  ];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

export async function cdpUp(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function launchChrome({ port, profile, url = FLOW_URL }) {
  const chrome = findChrome();
  if (!chrome) throw new Error("Google Chrome not found. Install Chrome or set FLOW_AGENT_CHROME to its executable.");
  mkdirSync(profile, { recursive: true });
  const child = spawn(
    chrome,
    [`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--no-first-run", "--no-default-browser-check", url],
    { detached: true, stdio: "ignore" },
  );
  child.unref();
  for (let i = 0; i < 40; i++) {
    if (await cdpUp(port)) return;
    await sleep(500);
  }
  throw new Error(`Chrome started but its debugging port ${port} never answered. Close other Chrome windows that use the same profile and retry.`);
}

// Returns { browser, context, page } where page is a Flow tab (opened if needed).
export async function connect({ port, profile, launch = true }) {
  if (!(await cdpUp(port))) {
    if (!launch) throw new Error(`No Chrome is listening on port ${port}. Run: node flow.mjs open`);
    await launchChrome({ port, profile });
  }
  const { chromium } = await loadPlaywright();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Chrome has no browser context. Close the Flow Chrome window and retry.");
  let page = context.pages().find((p) => FLOW_PAGE.test(p.url()));
  if (!page) {
    page = await context.newPage();
    await page.goto(FLOW_URL, { waitUntil: "domcontentloaded" });
  }
  await page.bringToFront().catch(() => {});
  return { browser, context, page };
}
