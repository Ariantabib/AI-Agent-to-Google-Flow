# AI Agent → Google Flow

**Let your AI agent generate images in [Google Flow](https://flow.google.com) — dozens at a time, paced, resumable, with a gallery at the end.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node 20+](https://img.shields.io/badge/node-%3E%3D20-339933)
![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757)

[فارسی](README.fa.md)

You tell your agent *"give me 50 style explorations for my project"*. It asks a few setup questions once,
writes the prompts, and drives Google Flow in your own signed-in Chrome. Each batch of 10 is submitted,
waited for and downloaded before the next one starts, so you end up with every image named and in a folder,
plus a browsable gallery.

It ships as a **Claude Code plugin** (skill + CLI) and as a plain **Node CLI** you can use from any agent or by hand.

---

## Contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Install in Claude Code](#install-in-claude-code)
- [First run](#first-run)
- [Use without Claude Code](#use-without-claude-code)
- [Configuration](#configuration)
- [Output](#output)
- [How it works](#how-it-works)
- [Account safety & privacy](#account-safety--privacy)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Contributing](#contributing) · [Credits](#credits) · [License](#license)

## What it does

- **Asks first, once.** Project topic, where to save, aspect ratio, model, which Flow project. Saved to
  `flow-images.config.json`, so it never asks again unless you want it to.
- **Batches of 10.** It submits 10 prompts, waits until all of them have rendered, downloads all of them, then
  starts the next 10. Flow renders a batch in parallel (about 2–3 minutes per 10 images).
- **Pastes, doesn't type.** Each prompt goes into Flow's composer in one insert.
- **Knows which image is which.** Every finished tile is matched to its prompt through Flow's own *Reuse prompt*,
  then saved as `07-pixel-16bit.jpg`, never as Flow's auto title.
- **Recovers from failures.** Failed tiles or *"We noticed some unusual activity"* → refresh, cool down,
  resubmit those prompts in a later batch (3 tries). If two batches in a row mostly fail, it stops and tells you.
- **Resumable.** Interrupted? Run the same command again. Images that finished meanwhile are collected first,
  nothing is generated twice.
- **Leaves your stuff alone.** Uses a separate Chrome profile; images that were already in the Flow project
  before the run are never touched.
- **Gallery.** `index.html` in every run folder: all images in a grid, hover a card to see its prompt.
- **Images only.** Image generation is free on Flow's plans; the tool never generates video (which costs credits).

## Requirements

| | |
| --- | --- |
| **Google account** with access to [Google Flow](https://flow.google.com) | Image generation is included in Flow's plans. |
| **Google Chrome** | The regular desktop Chrome (Windows, macOS or Linux). |
| **Node.js 20+** | `node -v` to check. [nodejs.org](https://nodejs.org) |
| **Claude Code** (optional) | For the plugin. Any agent that can run shell commands works with the CLI. |

One npm dependency, `playwright-core`, is installed on first use. No browser download, because it drives your Chrome.

## Install in Claude Code

In Claude Code, run:

```
/plugin marketplace add Ariantabib/AI-Agent-to-Google-Flow
/plugin install google-flow@ai-agent-to-google-flow
```

Then just ask, in any project:

> Generate 20 images in Google Flow exploring visual styles for this project.

or call the skill directly: `/google-flow:images`.

## First run

1. **Environment check.** The agent runs `doctor`. If needed it installs `playwright-core` (`setup`) and opens a
   **separate Chrome window** on Google Flow (`login`).
2. **Sign in.** You sign in to Google in that window, yourself. The agent never handles your password. The login
   stays in the dedicated profile (`~/.flow-agent/chrome-profile`) for next time. Your everyday Chrome
   profile is never used.
3. **Setup questions.** The agent asks:
   - What is the project? (It reads your README or design docs and proposes a summary.)
   - Where should the images be saved? (default `./flow-images`)
   - Which Flow project: the most recent, a new one, or a specific URL?
   - Aspect ratio: 9:16, 16:9, 1:1, 4:3 or 3:4?
   - Which model? (e.g. Nano Banana 2.1 / Pro / 2 Lite)
4. **The request.** How many images and what to explore. The agent writes the prompts (see the
   [prompt guide](plugins/google-flow/skills/images/reference/prompt-guide.md)), shows you the list, and runs.
5. **Result.** A run folder with every image, a `manifest.json`, and `index.html`.

## Use without Claude Code

The CLI works on its own, or from any agent that can run commands (Codex, Cursor, Gemini CLI, …).

```bash
# no install: runs straight from GitHub
npx github:Ariantabib/AI-Agent-to-Google-Flow help

# or clone it
git clone https://github.com/Ariantabib/AI-Agent-to-Google-Flow.git
cd AI-Agent-to-Google-Flow && npm install
alias flow-agent="node $PWD/plugins/google-flow/skills/images/scripts/flow.mjs"
```

Then, from your project folder:

```bash
flow-agent login                                   # sign in once in the window that opens
flow-agent init --topic "Cozy café brand moodboard" --out ./flow-images --aspect 1:1 --model "Nano Banana 2.1"
mkdir -p flow-images/2026-11-22-moodboard          # put a prompts.json in it (format below)
flow-agent run flow-images/2026-11-22-moodboard
```

`prompts.json`:

```json
{ "items": [
  { "name": "latte-art-closeup", "prompt": "Close-up of latte art in a speckled ceramic cup, warm morning light, …" },
  { "name": "storefront-dusk",   "prompt": "A small corner café at dusk, warm window glow, …" }
] }
```

A plain array of strings also works. Full reference: [docs/CLI.md](docs/CLI.md). Examples: [examples/](examples).

**Other agents:** point them at
[`plugins/google-flow/skills/images/SKILL.md`](plugins/google-flow/skills/images/SKILL.md). It is plain
Markdown instructions plus the CLI commands, so it works as an `AGENTS.md` include or a custom instruction.

## Configuration

`flow-images.config.json` (searched in the current folder and its parents):

| Key | Default | Meaning |
| --- | --- | --- |
| `topic` | `""` | What the project is; used for prompts and the gallery title |
| `outputDir` | `./flow-images` | Where run folders go (relative to the config file) |
| `flowProject` | `latest` | `latest`, `new`, `current`, or a `https://flow.google.com/project/…` URL |
| `aspectRatio` | *keep Flow's* | `9:16`, `16:9`, `1:1`, `4:3`, `3:4` |
| `model` | *keep Flow's* | Model label as shown in Flow, e.g. `Nano Banana 2.1` |
| `quality` | *keep Flow's* | `Low`, `Medium`, `High` |
| `batchSize` | `10` | Prompts per batch (1–20; 10 is the tested, safe value) |
| `maxAttempts` | `3` | Tries per prompt before it is reported as failed |
| `cdpPort` | `9333` | Chrome remote-debugging port |
| `chromeProfile` | `~/.flow-agent/chrome-profile` | Dedicated Chrome profile folder |

Environment overrides: `FLOW_AGENT_HOME`, `FLOW_AGENT_PROFILE`, `FLOW_AGENT_CDP_PORT`, `FLOW_AGENT_CHROME`.

## Output

```
flow-images/
└── 2026-11-22-style-exploration/
    ├── prompts.json        # what you asked for
    ├── manifest.json       # status per item, Flow media ids, attempts (makes runs resumable)
    ├── index.html          # gallery
    ├── 01-cosmic-neon-void.jpg
    ├── 02-bioluminescent-fungi.jpg
    └── …
```

## How it works

```
your agent ──► flow.mjs ──CDP──► Chrome (dedicated profile, signed in) ──► flow.google.com
                  │
                  ├─ ensureSettings  Image · aspect ratio · model · x1
                  ├─ submit batch    paste prompt → Start (×10, a few seconds apart)
                  ├─ settle          wait until no tile shows NN%
                  ├─ collect         Reuse prompt → match → right-click Download → rename
                  └─ failures        refresh → cool down → resubmit later (max 3 tries)
```

Details, design decisions and the state files: [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md).

## Account safety & privacy

Please read this before you use it.

- **This is unofficial automation of a Google web app.** It is not affiliated with or endorsed by Google. Google
  may consider automated use against its terms, and Flow does detect bursts (*"We noticed some unusual
  activity"*). The tool keeps human-scale pacing (one batch at a time, pauses, cool-downs, stops after repeated
  failures). It does **not** try to hide automation or get around Google's checks, and it never will. Use it
  on your own responsibility; a secondary Google account is a sensible choice.
- **You sign in yourself.** The tool never sees or types your password.
- **Local only.** No server, no telemetry. The only network traffic is Chrome talking to Google Flow. The
  debugging port listens on `127.0.0.1` only; close the Flow Chrome window when you are done, because while it
  is open other programs on your computer could control that window.
- **Separate profile.** Your everyday Chrome profile, passwords and cookies are never opened.
- Follow Google's [Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy):
  no real people without consent, no copyrighted characters, nothing harmful.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `playwright-core is not installed` | `flow-agent setup` |
| `Not signed in` | `flow-agent login`, sign in inside the window that opens |
| `Chrome started but its debugging port … never answered` | Close every window of the Flow Chrome profile and retry; or use another `--port` |
| Many tiles fail with *"unusual activity"* | Wait a while (an hour or more), keep `batchSize` at 10, then `run` again; it resumes |
| `Could not open Flow's generation settings` / `Tile menu has no Download item` | Flow changed its UI → [fixing UI changes](plugins/google-flow/skills/images/reference/fixing-ui-changes.md) |
| `Model "…" not found` | The error lists the available models; update `model` in the config |

More: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## FAQ

**Does it cost credits?** Image generation was free on Flow's plans when this was written (Nano Banana models,
2026-11). The tool only generates images. Check your plan in Flow if unsure.

**Why not an MCP server?** The value here is the *workflow rules* (ask first, batch, download, retry, stop),
which a skill expresses directly. A small CLI is easy for any agent to call, and easy to fix when Flow's UI changes.

**Can it do video?** Not in this version, by design. Video costs credits and needs a different review loop.

**Can I use my existing Chrome profile?** No. Chrome blocks remote debugging on the default profile, and a
separate profile keeps your personal data out of reach. Sign in once in the dedicated window.

**Mac / Linux?** Yes. Chrome is found in the usual locations; set `FLOW_AGENT_CHROME` if yours is elsewhere.

## Contributing

Flow's interface changes often. If something breaks, `flow-agent inspect --shot ui.png` shows what Flow looks like
now, and every selector lives in the `SEL` table in
[`scripts/lib/ui.mjs`](plugins/google-flow/skills/images/scripts/lib/ui.mjs). Issues and PRs are welcome.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

Built with [Claude Code](https://claude.com/claude-code). The dedicated-profile + CDP approach was inspired by
[GTAI-1/flow-mcp](https://github.com/GTAI-1/flow-mcp) (ISC).

## License

[MIT](LICENSE)
