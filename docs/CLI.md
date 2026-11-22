# CLI reference

```
node plugins/google-flow/skills/images/scripts/flow.mjs <command> [run-dir] [options]
```

(`flow-agent` below, after `npm install` / `npx github:Ariantabib/AI-Agent-to-Google-Flow`.)

Every command prints progress lines (`[hh:mm:ss] …`) and finishes with **one** line:

```
RESULT {"…": …}
```

On error the process exits with code 1 and prints `ERROR <message>` plus `RESULT {"ok":false,"error":"…"}`.

## Commands

### `setup`
Installs `playwright-core` into `~/.flow-agent/runtime` (skipped if it is already resolvable, e.g. after `npm install`).
No browser is downloaded.

### `doctor [--launch]`
Reports `node`, `playwright`, `chrome` (path), `config` (path or null), `chromeRunning`, `signedIn`, `inProject`,
`url`, `composer` (current settings pill, e.g. `🍌 Nano Banana 2.1 crop_9_16 x1`), `ready`, and `next` (what to do).
Without `--launch` it does not start Chrome.

### `login`
Starts the dedicated Chrome (if needed) on flow.google.com so you can sign in. `RESULT {signedIn, profile, url}`.

### `open [--project latest|new|current|<url>]`
Opens the project from the config (or the flag) and reports the composer settings. `new` creates a project.

### `init [options]`
Writes `flow-images.config.json` in the current folder (or `--config <file>`) from defaults + options:
`--topic --out --project --aspect --model --quality --batch --attempts --port --profile`.

### `config`
Prints `{ path, config }` after applying options.

### `run <run-dir> [--retry]`
Generates every item of `<run-dir>/prompts.json` in batches; resumable. On a resumed run it returns to the Flow
project stored in `manifest.json`. `--retry` gives items that used up their attempts a fresh set.

`RESULT {runDir, project, total, done, failed[], pending[], batches, gallery, stopped}`:
- `failed`: ids that used all attempts
- `pending`: ids not done but with attempts left (e.g. the run was stopped)
- `stopped`: null, or why it stopped early (e.g. two batches in a row mostly failed)

### `batch <run-dir>`
Like `run` but at most one batch.

### `collect <run-dir>`
Downloads finished images that belong to the run (matched by prompt) without submitting anything.

### `gallery <run-dir>`
Rebuilds `<run-dir>/index.html` from `manifest.json`.

### `inspect [--shot <file.png>]`
Dumps what Flow shows (buttons, radios, menu items, text boxes, tile/media counts) and optionally a screenshot.
Does not start Chrome. Use it to update selectors after a Flow UI change.

## Options

| Option | Meaning |
| --- | --- |
| `--config <file>` | Use this config file instead of searching for `flow-images.config.json` |
| `--project <target>` | `latest`, `new`, `current` or a project URL |
| `--aspect <ratio>` | `9:16`, `16:9`, `1:1`, `4:3`, `3:4` |
| `--model <name>` | e.g. `"Nano Banana 2.1"` (exact label preferred; partial match as fallback) |
| `--quality <q>` | `Low`, `Medium`, `High` |
| `--batch <n>` | Prompts per batch, 1–20 (default 10) |
| `--attempts <n>` | Tries per prompt (default 3) |
| `--port <n>` | Chrome remote-debugging port (default 9333) |
| `--profile <dir>` | Chrome profile folder (default `~/.flow-agent/chrome-profile`) |

## Files

### `prompts.json` (you write it)

```json
{ "items": [ { "id": "01", "name": "short-name", "prompt": "Full English prompt" } ] }
```

`id` is optional (auto-numbered, zero-padded), `name` is optional (derived from the prompt) and becomes part of
the file name. A plain array of strings or objects is accepted too. Identical prompts are fine: each item is one image.

### `manifest.json` (the tool writes it)

```json
{
  "createdAt": "…",
  "project": "https://flow.google.com/project/…",
  "ignoreByProject": { "<project url>": ["<media ids that existed before the run>"] },
  "items": {
    "01": { "status": "done", "attempts": 1, "mediaId": "…", "file": "…/01-short-name.jpg", "title": "Flow's title", "error": null }
  }
}
```

`status`: `pending` → `submitted` → `done` | `failed`. Delete an item's entry to regenerate it.

## Environment variables

| Variable | Default |
| --- | --- |
| `FLOW_AGENT_HOME` | `~/.flow-agent` (runtime + default profile) |
| `FLOW_AGENT_PROFILE` | `$FLOW_AGENT_HOME/chrome-profile` |
| `FLOW_AGENT_CDP_PORT` | `9333` |
| `FLOW_AGENT_CHROME` | auto-detected Chrome path |
