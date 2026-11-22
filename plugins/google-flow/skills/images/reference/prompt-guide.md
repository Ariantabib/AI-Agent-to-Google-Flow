# Prompt guide for batch image exploration

What worked well in practice (50-image style exploration for a mobile game, all generated on the first try).

## Structure: shared base + one varied part

Write a **base** that pins down everything that must stay the same across the batch, then add **one varied
part** per image. Every prompt is the full text (base + variation) — Flow sees each prompt alone.

```
<format & framing>   Vertical 9:16 mobile game screenshot, portrait orientation, strict top-down 2D view, …
<subject & action>   one small hero slightly above the center, auto-firing at a swarm of enemies, …
<hard rules>         Readability rule: calm low-saturation background; hero, enemies and pickups highly saturated.
<UI / details>       Minimal clean HUD: thin XP bar across the top, a small timer reading 03:42, …
<VARIATION>          Theme: deep ocean floor. Style: painterly underwater, murky teal-grey sand, …
```

- Put the aspect ratio and framing in words too ("Vertical 9:16 …") — it reinforces the composer setting.
- State the project's non-negotiable visual rules explicitly in the base (palette logic, camera, readability).
- Quote short on-image text exactly (`a banner reading XP FEVER`); keep it to a few words.
- Name the variation by **theme + rendering style + key subjects with colours**: "Theme: candy factory. Style:
  glossy soft 3D-rendered sprites, pale biscuit floor, hero is a gummy-bear, enemies are sour candy monsters".

## Mixing a batch

For an exploration of N images, a good mix is roughly:
- ~70 % **style/theme variations** of the core scene (pixel art, papercraft, clay, ink, vector neon, painterly,
  stained glass, blueprint, felt, origami, chalkboard, noir with accent colour, …),
- ~10 % **mechanic or idea visualisations** (one specific feature per image),
- ~20 % **other assets**: character line-up sheet, enemy/item sheets, key-art poster, UI screens (menu,
  level-up, victory), store screenshot, map.

Order the list so similar items sit together; names should say what is different (`07-pixel-16bit`).

## Keep it original and safe

- Describe styles with neutral words ("16-bit pixel art", "inspired by Persian miniature painting"), never
  "in the style of <living artist>" or "like <existing game/film>".
- No real people, logos, brand names or copyrighted characters.
- "original fictional characters" in the base helps keep designs original.

## Variations of a favourite

When the user picks favourites, make a new run with the same base, the chosen variation, and small changes:
palette swaps, camera distance, time of day, density, character silhouettes. Repeating an identical prompt
2–4 times also gives distinct takes.
