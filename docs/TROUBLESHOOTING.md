# Troubleshooting

Start with `flow-agent doctor` (or `node …/flow.mjs doctor`). Its `next` field says what to do.

## Setup

**`playwright-core is not installed`**
Run `flow-agent setup`. It needs `npm` on your PATH. Behind a proxy, configure npm's proxy first.

**`Google Chrome not found`**
Install Google Chrome, or set `FLOW_AGENT_CHROME` to the executable, e.g.
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` or `C:\Program Files\Google\Chrome\Application\chrome.exe`.

**`Chrome started but its debugging port … never answered`**
Another Chrome instance is already using the dedicated profile without the debugging port. Close all windows of
that profile and retry. Or pick another port: `--port 9334` (and use it consistently, e.g. in the config).

**flow.google.com does not load**
The Flow Chrome uses your system's network settings. If Flow is not available in your region, use a system-wide
VPN. Chrome flags such as `--proxy-server` are not added by the tool.

## Sign-in

**`Not signed in`**
`flow-agent login`, then sign in inside the Chrome window that opens. The session is stored in the dedicated
profile. If Google asks you to verify, do it in that window.

**Signed in, but Flow shows a landing page**
Open Flow once by hand in that window (accept any first-run screens), then retry.

## During a run

**Tiles fail with *"We noticed some unusual activity"***
Flow thinks the traffic is automated or too fast. The tool refreshes, cools down and resubmits later. If it keeps
happening, the run stops by itself after two bad batches. Wait (an hour or more), keep `batchSize` at 10 or
lower, then run the same command again; it resumes. Close other automation in that browser (extensions that
modify pages can trigger the same message).

**`Flow did not accept the prompt`**
The composer did not clear after *Start*. Usually a UI change or an open dialog. Check the Flow window; if a
dialog is open, close it and re-run. Otherwise see [fixing UI changes](../plugins/google-flow/skills/images/reference/fixing-ui-changes.md).

**Images are generated but not saved**
`flow-agent collect <run-dir>` downloads finished images without submitting anything. If it saves nothing, the
*Reuse prompt* button or the download menu changed; run `flow-agent inspect --shot ui.png`.

**Wrong aspect ratio or model**
Set `aspectRatio` / `model` in the config. `model` must match a label Flow shows; the error lists the options.

**The run was interrupted (laptop slept, terminal closed)**
Run the same `run` command again. It reopens the same Flow project, collects what finished, and continues.

**I want to regenerate one image**
Delete its file and its entry in `manifest.json` (or set `"status": "pending", "attempts": 0`), then `run` again.

## Still stuck

Open an issue with the `doctor` output, the last 30 lines of the run, and (if UI-related) the `inspect` output:
https://github.com/Ariantabib/AI-Agent-to-Google-Flow/issues
