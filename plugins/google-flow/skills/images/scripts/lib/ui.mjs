// Every Google Flow selector and UI action lives in this file. Flow's interface changes often; when something
// breaks, run `node flow.mjs inspect`, compare with SEL below and fix it here. Last verified: 2026-11-22.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FLOW_URL } from "./paths.mjs";
import { jitter, sleep } from "./log.mjs";

export const SEL = {
  composer: 'div[role="textbox"][aria-label="What do you want to create?"]',
  tile: "flow-grid-tile-container",
  tileMedia: "img[data-media-id], video[data-media-id]",
  account: '[aria-label^="Google Account"]',
  settingsTrigger: "Settings trigger", // button: opens the composer settings popover
  startButton: "Start generation", // button
  modelButton: "Select model family", // button inside the settings popover
  reusePrompt: "Reuse prompt", // button on each tile: puts the tile's prompt back into the composer
  newProject: /New project/i, // button on the Flow home page
  // Menu items carry their Material icon ligature in the accessible name, e.g. "download Download".
  downloadItem: /^(download\s*)?Download$/i,
  originalSize: /original/i,
  // Radio names also carry ligatures: "image Image", "crop_9_16 9:16", "x1".
  imageRadio: /(^|\s)Image$/,
  progress: /\b\d{1,3}%/,
  failed: /\bFailed\b/,
  unusual: /unusual activity/i,
  // Buttons on a tile that are not its title.
  tileChrome: /^(Favorite|Reuse prompt|More options|Download|Retry|Delete|Expand prompt|Trash batch)$/,
};

export const pause = (min, max = min) => sleep(jitter(min, max));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const normalize = (s) => (s ?? "").replace(/\s+/g, " ").trim();

export async function dismiss(page) {
  await page.keyboard.press("Escape").catch(() => {});
}

export async function isSignedIn(page) {
  await page.locator(SEL.account).first().waitFor({ state: "attached", timeout: 8000 }).catch(() => {});
  return (await page.locator(SEL.account).count()) > 0;
}

export const inProject = (page) => /\/project\/[0-9a-f-]{36}/.test(page.url());

async function waitForComposer(page) {
  await page.locator(SEL.composer).waitFor({ state: "visible", timeout: 30_000 });
}

// target: "current" | "latest" | "new" | a https://flow.google.com/project/... URL
export async function gotoProject(page, target = "latest") {
  if (/^https:\/\//.test(target)) {
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await waitForComposer(page);
    return page.url();
  }
  if (target === "current" && inProject(page)) {
    await waitForComposer(page);
    return page.url();
  }
  await page.goto(FLOW_URL, { waitUntil: "domcontentloaded" });
  await pause(3000, 4000);
  if (!(await isSignedIn(page))) throw new Error("Not signed in to Google Flow. Sign in inside the Flow Chrome window, then retry.");
  if (target !== "new") {
    const href = await page.locator('a[href^="/project/"]').first().getAttribute("href", { timeout: 8000 }).catch(() => null);
    if (href) {
      await page.goto(new URL(href, FLOW_URL).href, { waitUntil: "domcontentloaded" });
      await waitForComposer(page);
      return page.url();
    }
  }
  await page.getByRole("button", { name: SEL.newProject }).first().click();
  await page.waitForURL(/\/project\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await waitForComposer(page);
  return page.url();
}

// ---------- composer settings ----------

async function openSettings(page) {
  const probe = page.getByRole("radio", { name: SEL.imageRadio }).first();
  for (let i = 0; i < 3; i++) {
    if (await probe.isVisible().catch(() => false)) return;
    await page.getByRole("button", { name: SEL.settingsTrigger }).click();
    await probe.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  }
  if (!(await probe.isVisible().catch(() => false))) throw new Error("Could not open Flow's generation settings.");
}

async function pickRadio(page, name, label) {
  const radio = page.getByRole("radio", { name }).first();
  if (!(await radio.isVisible().catch(() => false))) {
    const all = await page.getByRole("radio").evaluateAll((rs) => rs.map((r) => (r.getAttribute("aria-label") || r.innerText).replace(/\s+/g, " ").trim()));
    throw new Error(`Flow has no "${label}" option. Available: ${all.join(", ")}`);
  }
  if ((await radio.getAttribute("aria-checked")) !== "true") {
    await radio.click();
    await pause(400, 700);
  }
}

async function pickModel(page, model) {
  const button = page.getByRole("button", { name: SEL.modelButton });
  if (!(await button.isVisible().catch(() => false))) throw new Error("Flow's model picker was not found in the settings.");
  if ((await button.innerText()).toLowerCase().includes(model.toLowerCase())) return;
  await button.click();
  const items = page.getByRole("menuitem");
  await items.first().waitFor({ state: "visible", timeout: 5000 });
  const names = (await items.allInnerTexts()).map(normalize);
  // Prefer an exact label match ("Nano Banana 2" must not pick "Nano Banana 2 Lite").
  let i = names.findIndex((n) => n.replace(/^\S*\s/, "").toLowerCase() === model.toLowerCase());
  if (i < 0) i = names.findIndex((n) => n.toLowerCase().includes(model.toLowerCase()));
  if (i < 0) {
    await dismiss(page);
    throw new Error(`Model "${model}" not found. Available: ${names.join(", ")}`);
  }
  await items.nth(i).click();
  await pause(600, 900);
}

// Puts the composer on Image, the wanted aspect ratio/quality/model, and one output per prompt.
export async function ensureSettings(page, { aspectRatio, model, quality } = {}) {
  await openSettings(page);
  await pickRadio(page, SEL.imageRadio, "Image");
  if (model) await pickModel(page, model);
  if (aspectRatio) await pickRadio(page, new RegExp(`(^|\\s)${esc(aspectRatio)}$`), aspectRatio);
  if (quality) await pickRadio(page, new RegExp(`^${esc(quality)}$`, "i"), quality);
  await pickRadio(page, /^x1$/, "x1");
  await dismiss(page);
  await pause(300, 500);
  return normalize(await page.getByRole("button", { name: SEL.settingsTrigger }).innerText());
}

export async function readComposerSettings(page) {
  const t = page.getByRole("button", { name: SEL.settingsTrigger });
  return (await t.isVisible().catch(() => false)) ? normalize(await t.innerText()) : null;
}

// ---------- composer ----------

export async function clearComposer(page) {
  const box = page.locator(SEL.composer);
  await box.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
}

// Pastes the whole prompt in one insert (no per-key typing) and starts the generation.
export async function submitPrompt(page, prompt) {
  const box = page.locator(SEL.composer);
  await clearComposer(page);
  await page.keyboard.insertText(prompt);
  await pause(250, 450);
  await page.getByRole("button", { name: SEL.startButton }).click();
  for (let i = 0; i < 40; i++) {
    if (normalize(await box.innerText()).length === 0) return;
    await sleep(250);
  }
  throw new Error("Flow did not accept the prompt (the composer did not clear).");
}

// ---------- tiles ----------

export async function readTiles(page) {
  return page.locator(SEL.tile).evaluateAll(
    (tiles, re) => {
      const progress = new RegExp(re.progress);
      const failed = new RegExp(re.failed);
      const unusual = new RegExp(re.unusual, "i");
      const chrome = new RegExp(re.tileChrome);
      return tiles.map((t, index) => {
        const media = t.querySelector("img[data-media-id], video[data-media-id]");
        const text = t.innerText || "";
        const title = [...t.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")).find((l) => l && !chrome.test(l)) ?? null;
        return {
          index,
          mediaId: media?.getAttribute("data-media-id") ?? null,
          kind: media ? media.tagName.toLowerCase() : null,
          progress: progress.test(text),
          failed: failed.test(text),
          unusual: unusual.test(text),
          title,
        };
      });
    },
    { progress: SEL.progress.source, failed: SEL.failed.source, unusual: SEL.unusual.source, tileChrome: SEL.tileChrome.source },
  );
}

const tileById = (page, mediaId) => page.locator(`${SEL.tile}:has([data-media-id="${mediaId}"])`).first();

async function hover(page, tile) {
  await tile.scrollIntoViewIfNeeded();
  const box = await tile.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await pause(500, 800);
}

// Waits until no tile shows a progress percentage (twice in a row), or the timeout.
export async function settle(page, { timeoutMs = 8 * 60_000, minMs = 8000, onTick } = {}) {
  await sleep(minMs);
  const end = Date.now() + timeoutMs;
  let quiet = 0;
  while (Date.now() < end) {
    const tiles = await readTiles(page);
    const busy = tiles.filter((t) => t.progress).length;
    onTick?.(busy, tiles);
    quiet = busy === 0 ? quiet + 1 : 0;
    if (quiet >= 2) return true;
    await sleep(4000);
  }
  return false;
}

// Reads a finished tile's full prompt through "Reuse prompt", then clears the composer again.
export async function readTilePrompt(page, mediaId) {
  const tile = tileById(page, mediaId);
  await hover(page, tile);
  await tile.getByRole("button", { name: SEL.reusePrompt }).first().click();
  await pause(700, 1000);
  const text = normalize(await page.locator(SEL.composer).innerText());
  await clearComposer(page);
  await pause(200, 400);
  return text;
}

// Sends Chrome's downloads to `dir` for this session (Flow Chrome profile only).
export async function routeDownloads(browser, dir) {
  const cdp = await browser.newBrowserCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir, eventsEnabled: true });
}

const finished = (dir) => readdirSync(dir).filter((f) => !/\.(crdownload|tmp)$/i.test(f));

// Right-click → Download → original size. Returns the path of the new file in `inbox`.
export async function downloadTile(page, mediaId, inbox) {
  const tile = tileById(page, mediaId);
  const before = new Set(finished(inbox));
  await hover(page, tile);
  await tile.click({ button: "right" });
  const item = page.getByRole("menuitem", { name: SEL.downloadItem });
  if (!(await item.isVisible({ timeout: 5000 }).catch(() => false))) {
    const offered = await page.getByRole("menuitem").allInnerTexts().catch(() => []);
    await dismiss(page);
    throw new Error(`Tile menu has no Download item (offered: ${offered.map(normalize).join(" | ") || "nothing"})`);
  }
  await item.click();
  const original = page.getByRole("menuitem", { name: SEL.originalSize }).first();
  if (await original.isVisible({ timeout: 2500 }).catch(() => false)) await original.click();
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    const f = finished(inbox).find((x) => !before.has(x) && existsSync(join(inbox, x)) && statSync(join(inbox, x)).size > 0);
    if (f) {
      await dismiss(page);
      return join(inbox, f);
    }
  }
  await dismiss(page);
  throw new Error("Download did not arrive within 60 s.");
}

export async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForComposer(page).catch(() => {});
  await pause(3000, 4500);
}

// Snapshot used by `inspect` when the UI changes.
export async function describePage(page) {
  return page.evaluate(() => {
    const label = (e) => (e.getAttribute("aria-label") || e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80);
    return {
      url: location.href,
      buttons: [...document.querySelectorAll("button,[role=button]")].map(label).filter(Boolean).slice(0, 120),
      radios: [...document.querySelectorAll("[role=radio]")].map((r) => `${label(r)}=${r.getAttribute("aria-checked")}`),
      menuitems: [...document.querySelectorAll("[role=menuitem]")].map(label),
      textboxes: [...document.querySelectorAll("[role=textbox],textarea")].map((e) => e.getAttribute("aria-label") || e.tagName),
      tiles: document.querySelectorAll("flow-grid-tile-container").length,
      media: document.querySelectorAll("img[data-media-id],video[data-media-id]").length,
    };
  });
}
