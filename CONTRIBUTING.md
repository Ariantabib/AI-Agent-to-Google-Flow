# Contributing

Thanks for helping! The most valuable contributions are **fixes for Google Flow UI changes**, because Flow changes
without notice and every user hits the same break.

## Fixing a UI change

1. Reproduce with a tiny run folder (1–2 prompts).
2. `node plugins/google-flow/skills/images/scripts/flow.mjs inspect --shot ui.png`
3. Update the `SEL` table (or the function using it) in `plugins/google-flow/skills/images/scripts/lib/ui.mjs`.
   Prefer accessible roles and names (`getByRole`) over CSS classes; Flow's generated class names change.
   Use regexes for names: Flow puts icon ligature text into accessible names (`"download Download"`).
4. `npm run check`, then the tiny run again.
5. Update the "Last verified" date at the top of `ui.mjs` and add a line to `CHANGELOG.md`.
6. Open a PR with the `inspect` output (remove your account name/email from it).

## Other changes

- Keep the batching rules intact (batch ≤ 20, default 10, download before the next batch, stop after repeated
  failures). The tool must not add anything meant to hide automation or get around Google's checks; such PRs
  will be declined.
- No new runtime dependencies without a good reason; `playwright-core` is the only one.
- Plain ES modules, Node 20+, no build step.
- If you change commands or options, update `SKILL.md`, `docs/CLI.md` and the README.

## Reporting issues

Include: OS, Node version, `doctor` output, the last ~30 lines of the run, and for UI problems the `inspect` output.
