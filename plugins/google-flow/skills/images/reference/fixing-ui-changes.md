# Fixing it when Google Flow's interface changes

Flow is a web app that changes without notice. All selectors live in one place: the `SEL` object at the top of
`scripts/lib/ui.mjs`. Runs are resumable, so after a fix just run the same command again.

## 1. See what Flow shows now

```bash
node flow.mjs inspect --shot ui.png
```

`RESULT` lists visible buttons (`aria-label` or text), radios with their checked state, open menu items, text
boxes, and tile/media counts. Look at `ui.png` too. For a menu or popover, open it first (by hand in the Flow
window, or with a tiny Playwright snippet) and run `inspect` again while it is open.

## 2. Match the symptom

| Error | Likely change | Where in `SEL` |
| --- | --- | --- |
| `Could not open Flow's generation settings` | Settings button renamed, or the "Image" radio label changed | `settingsTrigger`, `imageRadio` |
| `Flow has no "9:16" option` | Aspect radio labels changed (they carry icon ligatures like `crop_9_16 9:16`) | aspect regex in `ensureSettings` |
| `Model "…" not found` | Model renamed — the error lists the available ones; update the config | config `model` |
| `did not accept the prompt` | Composer box or Start button renamed | `composer`, `startButton` |
| `Tile menu has no Download item` | Context-menu labels changed (the error lists what was offered) | `downloadItem`, `originalSize` |
| Images never saved, prompts not matched | "Reuse prompt" button renamed | `reusePrompt` |
| Never finishes waiting | Progress no longer shown as `NN%` on tiles | `progress` |
| `Not signed in` while signed in | Account button label changed | `account` |

Things learned so far (2026-11): menu items and radios include Material icon ligature text in their accessible
names (`"download Download"`, `"crop_9_16 9:16"`), so match with regexes, not exact strings. A tile's "More
options" button may only offer Delete; downloading uses the right-click menu. Failed tiles disappear on reload.

## 3. Fix, test small, share

1. Edit `SEL` (or the function using it) in `scripts/lib/ui.mjs`.
2. `node --check scripts/lib/ui.mjs`
3. Test with a 1–2 prompt run folder before resuming a big run.
4. Open an issue or PR on https://github.com/Ariantabib/AI-Agent-to-Google-Flow with the `inspect` output so
   everyone gets the fix.
