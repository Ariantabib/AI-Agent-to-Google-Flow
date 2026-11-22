#!/usr/bin/env node
// flow-agent — batch image generation in Google Flow, driven through your own signed-in Chrome.
// Run `node flow.mjs help` for commands. Docs: https://github.com/Ariantabib/AI-Agent-to-Google-Flow
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { connect, cdpUp, findChrome } from "./lib/browser.mjs";
import { log, result } from "./lib/log.mjs";
import { CONFIG_NAME, FLOW_URL, HOME, RUNTIME_DIR } from "./lib/paths.mjs";
import { installRuntime, playwrightAvailable } from "./lib/playwright.mjs";
import { DEFAULTS, loadConfig, loadManifest, loadPrompts, saveConfig } from "./lib/project.mjs";
import { writeGallery } from "./lib/gallery.mjs";
import { describePage, gotoProject, inProject, isSignedIn, readComposerSettings } from "./lib/ui.mjs";
import { run } from "./lib/runner.mjs";

const HELP = `flow-agent — batch image generation in Google Flow

Usage: node flow.mjs <command> [run-dir] [options]

Commands
  setup                 Install the one dependency (playwright-core) into ${RUNTIME_DIR}
  doctor                Check Node, Chrome, sign-in and the open Flow project (add --launch to start Chrome)
  login                 Open the dedicated Flow Chrome window so you can sign in to Google
  open                  Open the Flow project from the config (or --project) and report its state
  init                  Write ${CONFIG_NAME} in the current folder from the options below
  config                Print the resolved configuration
  run <run-dir>         Generate every prompt in <run-dir>/prompts.json, batch by batch (resumable)
  batch <run-dir>       Same as run, but only one batch
  collect <run-dir>     Download finished images of the run without submitting anything
  gallery <run-dir>     Rebuild <run-dir>/index.html
  inspect               Dump Flow's current buttons/radios/tiles (and --shot <file.png>) to fix UI changes

Options
  --config <file>       Config file (default: ${CONFIG_NAME} in this folder or a parent)
  --project <target>    latest | new | current | https://flow.google.com/project/...
  --aspect <ratio>      9:16 | 16:9 | 1:1 | 4:3 | 3:4
  --model <name>        Flow model label, e.g. "Nano Banana 2.1"
  --quality <q>         Low | Medium | High
  --batch <n>           Prompts per batch (default 10)
  --attempts <n>        Tries per prompt before giving up (default 3)
  --retry               Give items that ran out of attempts a fresh set of tries
  --topic <text>        Project topic (init)
  --out <dir>           Output folder (init)
  --port <n>            Chrome remote-debugging port (default 9333)
  --profile <dir>       Chrome profile folder (default ${join(HOME, "chrome-profile")})
  --launch              doctor: start Chrome if it is not running
  --shot <file.png>     inspect: also save a screenshot
`;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else (out[key] = next), i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const [command = "help", target] = args._;

function resolvedConfig() {
  const { path, config } = loadConfig(args.config);
  const flag = (k, f = (v) => v) => (args[k] !== undefined && args[k] !== true ? f(args[k]) : undefined);
  const over = {
    flowProject: flag("project"),
    aspectRatio: flag("aspect"),
    model: flag("model"),
    quality: flag("quality"),
    batchSize: flag("batch", Number),
    maxAttempts: flag("attempts", Number),
    cdpPort: flag("port", Number),
    chromeProfile: flag("profile", (v) => resolve(v)),
    topic: flag("topic"),
    outputDir: flag("out", (v) => resolve(v)),
  };
  for (const [k, v] of Object.entries(over)) if (v !== undefined) config[k] = v;
  if (!(config.batchSize >= 1 && config.batchSize <= 20)) throw new Error("batchSize must be between 1 and 20.");
  return { path, config };
}

async function needPlaywright() {
  if (!(await playwrightAvailable())) throw new Error("playwright-core is not installed yet. Run: node flow.mjs setup");
}

// Connects to the Flow Chrome, checks sign-in and opens `project` (latest | new | current | URL).
async function openSession(config, project = config.flowProject ?? "latest") {
  await needPlaywright();
  const s = await connect({ port: config.cdpPort, profile: config.chromeProfile });
  if (!(await isSignedIn(s.page))) {
    await s.page.goto(FLOW_URL, { waitUntil: "domcontentloaded" });
    if (!(await isSignedIn(s.page))) throw new Error("Not signed in. Run `login`, sign in to Google in the Flow Chrome window, then retry.");
  }
  await gotoProject(s.page, project);
  return s;
}

async function main() {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;

    case "setup": {
      if (await playwrightAvailable()) log("playwright-core already available");
      else {
        log(`installing playwright-core into ${RUNTIME_DIR} …`);
        installRuntime();
      }
      result({ ok: true, playwright: await playwrightAvailable(), chrome: findChrome() });
      return;
    }

    case "doctor": {
      const { path, config } = resolvedConfig();
      const node = Number(process.versions.node.split(".")[0]);
      const report = {
        node: process.versions.node,
        nodeOk: node >= 20,
        playwright: await playwrightAvailable(),
        chrome: findChrome(),
        config: path,
        cdpPort: config.cdpPort,
        chromeRunning: await cdpUp(config.cdpPort),
        signedIn: null,
        inProject: null,
        url: null,
        composer: null,
      };
      if (report.playwright && (report.chromeRunning || args.launch)) {
        const { page } = await connect({ port: config.cdpPort, profile: config.chromeProfile });
        report.chromeRunning = true;
        report.url = page.url();
        report.signedIn = await isSignedIn(page);
        report.inProject = inProject(page);
        report.composer = report.inProject ? await readComposerSettings(page) : null;
      }
      const next = [];
      if (!report.nodeOk) next.push("Install Node.js 20 or newer");
      if (!report.playwright) next.push("node flow.mjs setup");
      if (!report.chrome) next.push("Install Google Chrome (or set FLOW_AGENT_CHROME)");
      if (!report.config) next.push(`Create ${CONFIG_NAME} (the skill asks you, or: node flow.mjs init --topic "..." --out ./images)`);
      if (report.playwright && !report.chromeRunning) next.push("node flow.mjs login   (opens the Flow Chrome window)");
      if (report.signedIn === false) next.push("Sign in to Google in the Flow Chrome window");
      report.ready = report.nodeOk && report.playwright && !!report.chrome && report.signedIn === true;
      report.next = next;
      result(report);
      return;
    }

    case "login": {
      const { config } = resolvedConfig();
      await needPlaywright();
      const { page } = await connect({ port: config.cdpPort, profile: config.chromeProfile });
      if (!/flow\.google\.com/.test(page.url())) await page.goto(FLOW_URL, { waitUntil: "domcontentloaded" });
      const signedIn = await isSignedIn(page);
      log(signedIn ? "Already signed in." : "Sign in to Google in the Chrome window that just opened. Your login is kept in the dedicated profile.");
      result({ signedIn, profile: config.chromeProfile, url: page.url() });
      return;
    }

    case "open": {
      const { config } = resolvedConfig();
      const { page } = await openSession(config);
      result({ signedIn: true, url: page.url(), composer: await readComposerSettings(page) });
      return;
    }

    case "init": {
      const file = resolve(args.config ?? CONFIG_NAME);
      const { config } = resolvedConfig();
      const out = { ...DEFAULTS, ...config };
      delete out.chromeProfile;
      if (args.profile) out.chromeProfile = resolve(args.profile);
      saveConfig(file, out);
      result({ written: file, config: out });
      return;
    }

    case "config": {
      result(resolvedConfig());
      return;
    }

    case "run":
    case "batch":
    case "collect": {
      if (!target) throw new Error(`Usage: node flow.mjs ${command} <run-dir>`);
      const runDir = resolve(target);
      mkdirSync(runDir, { recursive: true });
      const { config } = resolvedConfig();
      const items = loadPrompts(runDir);
      const manifest = loadManifest(runDir, items);
      if (args.retry) for (const it of items) if (manifest.items[it.id].status !== "done") manifest.items[it.id].attempts = 0;
      manifest.save();
      log(`${items.length} prompts, batch size ${config.batchSize}, run folder ${runDir}`);
      // A resumed run goes back to the Flow project it started in (so "new" never creates a second project).
      const project = (args.project && args.project !== true ? args.project : null) ?? manifest.project ?? config.flowProject;
      const { browser, page } = await openSession(config, project);
      const summary = await run({
        browser,
        page,
        items,
        manifest,
        runDir,
        config,
        maxBatches: command === "batch" ? 1 : Infinity,
        submit: command !== "collect",
      });
      log(`done: ${summary.done}/${summary.total}${summary.stopped ? ` — stopped: ${summary.stopped}` : ""}`);
      log(`gallery: ${summary.gallery}`);
      result(summary);
      return;
    }

    case "gallery": {
      if (!target) throw new Error("Usage: node flow.mjs gallery <run-dir>");
      const runDir = resolve(target);
      const { config } = resolvedConfig();
      const items = loadPrompts(runDir);
      const manifest = loadManifest(runDir, items);
      result({ gallery: writeGallery(runDir, items, manifest, { title: config.topic || "Flow images", aspectRatio: config.aspectRatio }) });
      return;
    }

    case "inspect": {
      const { config } = resolvedConfig();
      await needPlaywright();
      const { page } = await connect({ port: config.cdpPort, profile: config.chromeProfile, launch: false });
      const info = await describePage(page);
      if (args.shot && args.shot !== true) {
        await page.screenshot({ path: resolve(args.shot) });
        info.screenshot = resolve(args.shot);
      }
      result(info);
      return;
    }

    default:
      console.log(HELP);
      throw new Error(`Unknown command "${command}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`ERROR ${err?.message ?? err}`);
    result({ ok: false, error: err?.message ?? String(err) });
    process.exit(1);
  });
