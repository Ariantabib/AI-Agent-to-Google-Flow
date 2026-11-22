// Writes <runDir>/index.html: every image of the run in a grid with its id and name; click to open full size.
import { writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function writeGallery(runDir, items, manifest, { title = "Flow images", aspectRatio } = {}) {
  const ratio = (aspectRatio ?? "1:1").replace(":", " / ");
  const done = items.filter((it) => manifest.items[it.id]?.file);
  const cards = items
    .map((it) => {
      const st = manifest.items[it.id];
      const label = `<span><b>${esc(it.id)}</b> ${esc(it.name.replace(/-/g, " "))}</span>`;
      if (!st?.file) return `<div class="card missing" title="${esc(it.prompt)}"><div class="ph">${esc(st?.status ?? "pending")}</div>${label}</div>`;
      const src = encodeURI(basename(st.file));
      return `<a class="card" href="${src}" target="_blank" title="${esc(it.prompt)}"><img loading="lazy" src="${src}" alt="${esc(it.name)}">${label}</a>`;
    })
    .join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
:root{color-scheme:light dark;--bg:#f6f6f4;--card:#fff;--fg:#1d1d1b;--muted:#6b6b66;--accent:#0a7cff}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--card:#1d1d1d;--fg:#e8e8e6;--muted:#9a9a96;--accent:#7ec8ff}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
.card{display:block;text-decoration:none;color:inherit;background:var(--card);border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgb(0 0 0/.12)}
.card img,.ph{display:block;width:100%;aspect-ratio:${ratio};object-fit:cover;background:#8882}
.ph{display:grid;place-items:center;color:var(--muted);text-transform:uppercase;font-size:12px;letter-spacing:.06em}
.card span{display:block;padding:8px 10px;text-transform:capitalize}.card b{color:var(--accent);margin-right:4px}
</style></head><body><h1>${esc(title)}</h1>
<p>${done.length} of ${items.length} images · generated with Google Flow · hover a card to see its prompt</p>
<div class="grid">${cards}</div></body></html>`;
  writeFileSync(join(runDir, "index.html"), html);
  return join(runDir, "index.html");
}
