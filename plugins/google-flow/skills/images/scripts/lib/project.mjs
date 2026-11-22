// Config (flow-images.config.json), the prompt list of a run (prompts.json) and its state (manifest.json).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { CONFIG_NAME, DEFAULT_PORT, DEFAULT_PROFILE } from "./paths.mjs";

export const DEFAULTS = {
  topic: "",
  outputDir: "./flow-images",
  flowProject: "latest", // "latest" | "new" | "current" | a project URL
  aspectRatio: null, // "9:16" | "16:9" | "1:1" | "4:3" | "3:4"; null keeps Flow's current setting
  model: null, // e.g. "Nano Banana 2.1"; null keeps Flow's current model
  quality: null, // "Low" | "Medium" | "High"; null keeps Flow's current setting
  batchSize: 10,
  maxAttempts: 3,
  cdpPort: DEFAULT_PORT,
  chromeProfile: DEFAULT_PROFILE,
};

const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
const writeJson = (p, data) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(`${p}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${p}.tmp`, p);
};

// Finds flow-images.config.json in `start` or its parents. Returns { path, config } (path null if none).
export function loadConfig(explicit, start = process.cwd()) {
  let path = explicit ? resolve(explicit) : null;
  if (!path) {
    for (let dir = resolve(start); ; dir = dirname(dir)) {
      if (existsSync(join(dir, CONFIG_NAME))) {
        path = join(dir, CONFIG_NAME);
        break;
      }
      if (dirname(dir) === dir) break;
    }
  }
  const raw = path && existsSync(path) ? readJson(path) : {};
  const config = { ...DEFAULTS, ...raw };
  const base = path ? dirname(path) : process.cwd();
  config.outputDir = isAbsolute(config.outputDir) ? config.outputDir : resolve(base, config.outputDir);
  return { path, config };
}

export function saveConfig(path, config) {
  writeJson(path, config);
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";

// prompts.json: either an array of strings/objects or { items: [...] }. Each item: { id?, name?, prompt }.
export function loadPrompts(runDir) {
  const file = join(runDir, "prompts.json");
  if (!existsSync(file)) throw new Error(`No prompts.json in ${runDir}`);
  const data = readJson(file);
  const list = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(list) || !list.length) throw new Error("prompts.json has no items.");
  const width = String(list.length).length < 2 ? 2 : String(list.length).length;
  const seen = new Set();
  return list.map((it, i) => {
    const o = typeof it === "string" ? { prompt: it } : it;
    if (!o.prompt?.trim()) throw new Error(`Item ${i + 1} in prompts.json has no prompt.`);
    const id = String(o.id ?? i + 1).padStart(width, "0");
    if (seen.has(id)) throw new Error(`Duplicate id "${id}" in prompts.json.`);
    seen.add(id);
    return { id, name: slug(o.name ?? o.prompt.split(/\s+/).slice(0, 6).join(" ")), prompt: o.prompt.trim() };
  });
}

// manifest.json keeps everything needed to resume: which items are done, which Flow media belong to them,
// and which media in the Flow project existed before this run (so they are never touched).
export function loadManifest(runDir, items) {
  const file = join(runDir, "manifest.json");
  const m = existsSync(file) ? readJson(file) : { createdAt: new Date().toISOString(), project: null, ignore: [], items: {} };
  for (const it of items) {
    m.items[it.id] ??= { status: "pending", attempts: 0, mediaId: null, file: null, title: null, error: null };
  }
  m.save = () => {
    const { save, ...rest } = m;
    writeJson(file, rest);
  };
  return m;
}
