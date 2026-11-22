---
name: images
description: Generate batches of images with Google Flow (flow.google.com, Nano Banana models) by driving the user's own signed-in Chrome. Use when the user asks to generate, explore, mock up or batch-produce images, concepts, styles, variations, key art, UI mockups or moodboards "in Flow" / "with Google Flow" / "with Nano Banana", or asks for many images at once. On first use it asks for the project topic, output folder, aspect ratio, model and Flow project, saves them, then pastes prompts 10 at a time, downloads each batch before the next, resubmits failures, and builds a gallery.
---

# Google Flow — batch image generation

You drive Google Flow in a **dedicated Chrome window** (separate profile, signed in by the user) through the
`flow.mjs` CLI that ships with this skill. The CLI already enforces the batching rules; your job is setup,
writing good prompts, running batches, and reporting.

**Scripts:** `scripts/flow.mjs` inside this skill's base directory (shown as "Base directory for this skill"
when the skill loads). Below, `FLOW` means `node "<base directory>/scripts/flow.mjs"`. Every command prints
progress lines and ends with one `RESULT {json}` line — read that line.

## Rules (always)

1. **Ask before the first run** (step 2). Never invent the topic or the save location.
2. **Batches of 10.** Submit one batch, wait until all of it has finished, download all of it, then the next
   batch. Never queue the whole list at once — Flow flags bursts as spam ("unusual activity"). The CLI does this;
   do not bypass it with your own loops. Batch size may go up to 20 only if the user explicitly asks.
3. **Paste, don't type.** Prompts are inserted in one go (the CLI does it). Never simulate per-key typing.
4. **Failures:** when Flow fails tiles or shows "We noticed some unusual activity", the CLI refreshes the page,
   cools down, and resubmits those prompts in a later batch (3 tries each). If it stops with "two batches in a row
   mostly failed", **stop and tell the user** — do not retry in a loop. Suggest waiting a while.
5. **Images only.** Image generation is free on Flow's plans; video costs credits. This skill never makes video.
6. **The user signs in, never you.** Do not type passwords or handle Google sign-in pages. Do not try to hide
   the automation from Google or get around its checks; keep the human-scale pacing the CLI uses.
7. Keep everything the user asked for in the prompts; follow Google's generative AI policies (no real people's
   likeness without consent, no copyrighted characters or brand recreation).

## Workflow

### 1. Check the environment

```bash
FLOW doctor
```

- `playwright: false` → run `FLOW setup` (installs one npm package into `~/.flow-agent/runtime`; no browser download).
- `chrome: null` → ask the user to install Google Chrome (or set `FLOW_AGENT_CHROME`).
- `chromeRunning: false` or `signedIn: false/null` → run `FLOW login`, then tell the user: *"A separate Chrome
  window opened on Google Flow. Sign in with your Google account there and tell me when you're done."* Wait for
  them, then `FLOW doctor` again. The login stays in that profile for next time.

### 2. First-run configuration (ask, then save)

Look for `flow-images.config.json` in the current project (the CLI searches parents too; `FLOW config` shows
the resolved values and `path: null` when there is none). If it is missing, or a value below is missing, **ask the
user** — use the AskUserQuestion tool when available, otherwise ask in chat. Ask in the user's language.

| Key | Ask | Default to offer |
| --- | --- | --- |
| `topic` | What is the project? (one or two sentences: what it is, audience, mood). If the repo has a README / design doc, read it first and propose a summary for them to confirm. | — |
| `outputDir` | Where should images be saved? | `./flow-images` |
| `flowProject` | Which Flow project: the most recent one, a new one, or a specific project URL? | `latest` |
| `aspectRatio` | 9:16 (vertical), 16:9, 1:1, 4:3 or 3:4? | ask |
| `model` | Which model? (`FLOW open` shows the current one; Flow currently offers e.g. "Nano Banana 2.1", "Nano Banana Pro", "Nano Banana 2 Lite") | keep current |
| `batchSize` | Only if they bring it up. | `10` |

Write it with `FLOW init --topic "…" --out "…" --project latest --aspect 9:16 --model "Nano Banana 2.1"`
(run from the project root), or write the JSON file directly. Tell the user it's saved and can be edited.
Add the output folder to `.gitignore` if the project is a git repo and the user agrees.

### 3. Plan the request

Each request becomes a **run folder**: `<outputDir>/<YYYY-MM-DD>-<short-slug>/` containing `prompts.json`.
Ask only what you need for *this* request: how many images and what to explore (styles, variations of one idea,
specific screens/characters…). Then write `prompts.json`:

```json
{ "items": [
  { "name": "cosmic-neon-void", "prompt": "Full English prompt …" },
  { "name": "papercraft", "prompt": "…" }
] }
```

- `name` becomes the file name (`01-cosmic-neon-void.jpg`); ids are numbered automatically.
- Write every prompt in **English**, complete and self-contained (Flow sees each one alone). See
  `reference/prompt-guide.md` for the structure that works well (shared base + one varied part per image).
- Want several takes of the same idea? Repeat the same prompt as separate items — each item is one image.
- Show the user a compact list (id + name), then start. Do not paste all prompts into chat.

### 4. Run

```bash
FLOW run "<run folder>"
```

A batch of 10 takes about 2–3 minutes, so a 50-image run takes 15–25 minutes. In Claude Code, run it in the
background and wait for the completion notification instead of polling. The run is **resumable**: if anything
interrupts it, run the same command again — finished images are kept, and images that finished in Flow
meanwhile are collected first. `FLOW batch "<run folder>"` runs exactly one batch if the user wants to go step by step.

### 5. Report

From the `RESULT` line: images saved (`done`/`total`), failed ids, and the gallery path (`index.html` in the run
folder — a grid of all images with their names; hovering shows each prompt). Offer to:
- open the gallery,
- retry failed ones later (`FLOW run "<folder>" --retry`),
- make more variations of the styles they like (new run folder with those prompts).

## Commands

| Command | What it does |
| --- | --- |
| `doctor [--launch]` | Environment + sign-in + open project report |
| `setup` | Install playwright-core into `~/.flow-agent/runtime` |
| `login` | Open the dedicated Flow Chrome window for sign-in |
| `open [--project …]` | Open the configured Flow project; reports composer settings |
| `init …` | Write `flow-images.config.json` |
| `config` | Print the resolved config |
| `run <dir> [--retry]` | Full batched run (resumable) |
| `batch <dir>` | One batch only |
| `collect <dir>` | Download finished images of the run without submitting |
| `gallery <dir>` | Rebuild `index.html` |
| `inspect [--shot f.png]` | Dump Flow's current UI (for fixing selector drift) |

Options override the config for one call: `--project --aspect --model --quality --batch --attempts --port --profile --config`.

## When Flow's interface changes

Symptoms: `Could not open Flow's generation settings`, `Tile menu has no Download item`, `did not accept the
prompt`, timeouts. Follow `reference/fixing-ui-changes.md`: run `FLOW inspect --shot ui.png`, compare with the
`SEL` table at the top of `scripts/lib/ui.mjs`, fix the selector there, and re-run (runs resume). Tell the user
what changed; suggest opening an issue or PR on the repository so everyone gets the fix.
