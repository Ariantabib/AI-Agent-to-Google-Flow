# Examples

- [`flow-images.config.json`](flow-images.config.json): a project config (copy it to your project root and edit).
- [`cafe-moodboard/prompts.json`](cafe-moodboard/prompts.json): six prompts for a brand moodboard, showing
  the "shared base + one varied part" structure from the
  [prompt guide](../plugins/google-flow/skills/images/reference/prompt-guide.md).

Try it:

```bash
cp examples/flow-images.config.json ./flow-images.config.json
mkdir -p flow-images/cafe && cp examples/cafe-moodboard/prompts.json flow-images/cafe/
node plugins/google-flow/skills/images/scripts/flow.mjs run flow-images/cafe
```

A real-world run this tool was built from: 50 vertical (9:16) style explorations for a portrait arcade-survival
mobile game (35 theme/style variations of one gameplay scene, 5 mechanic visualisations, 10 UI/character/item
sheets), finished in about 25 minutes, batches of 10, zero failures once batching was used.
