# How it works

## The pieces

```
plugins/google-flow/
├── .claude-plugin/plugin.json        Claude Code plugin manifest
└── skills/images/
    ├── SKILL.md                      The agent's instructions: setup questions, rules, workflow
    ├── reference/
    │   ├── prompt-guide.md           How to write a good exploration batch
    │   └── fixing-ui-changes.md      What to do when Flow's UI changes
    └── scripts/
        ├── flow.mjs                  CLI entry point (commands, options, RESULT line)
        └── lib/
            ├── paths.mjs             ~/.flow-agent locations, env overrides
            ├── playwright.mjs        resolve / install playwright-core
            ├── browser.mjs           find + launch Chrome, connect over CDP
            ├── ui.mjs                ALL Flow selectors and UI actions (the only file that knows Flow's DOM)
            ├── project.mjs           config, prompts.json, manifest.json
            ├── runner.mjs            the batch loop and prompt→image matching
            └── gallery.mjs           index.html
```

The **skill** holds the judgement (what to ask, how to write prompts, when to stop and talk to the user).
The **CLI** holds the mechanics and enforces the rules, so an agent cannot accidentally break them.

## Why these rules

They come from a real 50-image run:

| Observation | Rule |
| --- | --- |
| Generating one image at a time with long pauses took ~1 hour for 50 | Submit a batch; Flow renders it in parallel |
| 30 prompts submitted back-to-back → 12 failed with *"unusual activity"* | Max 10 per batch, and download the whole batch before the next |
| After that, 30 more in batches of 10 → 0 failures | 10 is the default and tested value |
| Failed tiles cannot be retried in place after the warning; they vanish on reload | Refresh, then resubmit the prompt in a later batch |
| Typing long prompts key by key is slow and looks robotic | Insert the whole prompt at once |
| Flow titles images itself and reuses titles ("Hero fighting enemies in game" ×5) | Match by the tile's real prompt via *Reuse prompt* |

## The batch loop (`runner.mjs`)

1. **Snapshot** the media already in the Flow project (stored per project in `manifest.json` → never touched).
2. **Collect** anything from this run that finished while nobody was watching (resume).
3. Pick the next batch: items not done with attempts left, fewest attempts first, then by id.
4. **ensureSettings**: open the composer settings, select *Image*, model, aspect ratio, quality, *x1*.
5. **Submit** each prompt: clear composer → `insertText(prompt)` → *Start generation* → wait for the composer
   to clear (= accepted) → 2–3.5 s pause.
6. **Settle**: poll the tiles until none shows a `NN%` progress label twice in a row (max 8 min).
7. **Collect**: for every new image tile, click *Reuse prompt*, read the composer text, clear it, and match the
   text to an open item (exact match after whitespace normalisation; fallback: word-bigram similarity ≥ 0.92).
   Unmatched tiles are someone else's and get ignored. Matched tiles are downloaded with right-click →
   *Download* → *original size* into `<run>/.inbox` (Chrome's download folder is set over CDP for this
   profile), then renamed to `<id>-<name>.<ext>`.
8. Items of the batch that are not done are marked failed. If any tile failed: reload the page, cool down
   20–30 s (60–90 s after *"unusual activity"*). If two batches in a row lost half or more, **stop**.
9. Pause 8–15 s, next batch. At the end write `index.html` and print the `RESULT` line.

## Chrome

- Real Google Chrome, started with `--user-data-dir=<dedicated profile>` and `--remote-debugging-port=9333`.
  If something already listens on the port, the tool connects to it instead of starting a new Chrome.
- Chrome (since v136) ignores remote debugging on the default profile, so a separate profile is required anyway.
  It also keeps the automation away from your personal browsing data.
- Playwright connects with `connectOverCDP`. Only `playwright-core` is needed (no bundled browsers).

## Why a skill + CLI and not an MCP server

An MCP server gives an agent tools; what makes this reliable is a *procedure*. A skill states the procedure in
plain language, and the CLI enforces the mechanical parts. Fixing a selector is a one-line edit any agent can
make, and the same CLI works from Claude Code, other agents, CI, or by hand.
