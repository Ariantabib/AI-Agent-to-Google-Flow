# Changelog

## 1.0.0 (2026-11-22)

First public release.

- Claude Code plugin `google-flow` with the `images` skill: first-run setup questions, batching rules,
  prompt guide, UI-change repair guide.
- `flow.mjs` CLI: `setup`, `doctor`, `login`, `open`, `init`, `config`, `run`, `batch`, `collect`, `gallery`, `inspect`.
- Batches of 10 (configurable 1–20); each batch is downloaded before the next one is submitted.
- Prompts pasted in one insert; images matched to prompts through Flow's *Reuse prompt*.
- Failure handling: refresh + cool-down + resubmit later (3 tries), stop after two bad batches in a row.
- Resumable runs (`manifest.json`), images already in the Flow project are never touched.
- Gallery page per run.
- Verified against Google Flow's UI of 2026-11-22 (Nano Banana 2.1 / Pro / 2 Lite).
