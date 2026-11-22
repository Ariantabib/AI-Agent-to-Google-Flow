// The batch loop. Rules (see SKILL.md): paste prompts, submit one batch (default 10), wait for the whole batch,
// download all of it, then the next batch. Failed generations are refreshed away and resubmitted in a later
// batch. If two batches in a row mostly fail, stop and let the human decide.
import { existsSync, mkdirSync, renameSync, rmdirSync } from "node:fs";
import { extname, join } from "node:path";
import { log } from "./log.mjs";
import { writeGallery } from "./gallery.mjs";
import { downloadTile, ensureSettings, normalize, pause, readTilePrompt, readTiles, reload, routeDownloads, settle, submitPrompt } from "./ui.mjs";

// Word-bigram Dice similarity, used only when Flow returns a prompt that is not byte-identical.
function dice(a, b) {
  const grams = (s) => {
    const w = s.toLowerCase().split(/\s+/);
    const m = new Map();
    for (let i = 0; i < w.length - 1; i++) m.set(`${w[i]} ${w[i + 1]}`, (m.get(`${w[i]} ${w[i + 1]}`) ?? 0) + 1);
    return m;
  };
  const A = grams(a), B = grams(b);
  let inter = 0, total = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0), (total += n);
  for (const n of B.values()) total += n;
  return total ? (2 * inter) / total : 0;
}

function matchItem(text, items, manifest) {
  const open = items.filter((it) => manifest.items[it.id].status !== "done");
  const rank = (it) => (manifest.items[it.id].status === "submitted" ? 0 : 1);
  const exact = open.filter((it) => normalize(it.prompt) === text).sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  if (exact.length) return exact[0];
  const scored = open.map((it) => ({ it, s: dice(normalize(it.prompt), text) })).sort((a, b) => b.s - a.s);
  return scored[0] && scored[0].s >= 0.92 ? scored[0].it : null;
}

// Downloads every finished tile that belongs to this run and has not been saved yet.
export async function collect(page, { items, manifest, runDir, inbox }) {
  const ignore = new Set(manifest.ignoreByProject?.[manifest.project] ?? []);
  const mapped = new Set(Object.values(manifest.items).map((s) => s.mediaId).filter(Boolean));
  const tiles = (await readTiles(page)).filter((t) => t.mediaId && t.kind === "img" && !ignore.has(t.mediaId) && !mapped.has(t.mediaId));
  let saved = 0;
  for (const t of tiles) {
    let text;
    try {
      text = await readTilePrompt(page, t.mediaId);
    } catch (e) {
      log(`  could not read the prompt of "${t.title ?? t.mediaId}": ${e.message}`);
      continue;
    }
    const it = matchItem(text, items, manifest);
    if (!it) {
      ignore.add(t.mediaId); // someone else's image in this Flow project
      continue;
    }
    const st = manifest.items[it.id];
    try {
      const file = await downloadTile(page, t.mediaId, inbox);
      const dest = join(runDir, `${it.id}-${it.name}${extname(file).toLowerCase() || ".jpg"}`);
      if (existsSync(dest)) renameSync(dest, `${dest}.old`);
      renameSync(file, dest);
      Object.assign(st, { status: "done", mediaId: t.mediaId, file: dest, title: t.title, error: null });
      saved++;
      log(`  saved ${it.id}-${it.name}`);
    } catch (e) {
      st.error = e.message;
      log(`  download failed for ${it.id}: ${e.message}`);
    }
    manifest.save();
    await pause(900, 1600);
  }
  manifest.ignoreByProject = { ...(manifest.ignoreByProject ?? {}), [manifest.project]: [...ignore] };
  manifest.save();
  return saved;
}

export async function run({ browser, page, items, manifest, runDir, config, maxBatches = Infinity, submit = true }) {
  const inbox = join(runDir, ".inbox");
  mkdirSync(inbox, { recursive: true });
  await routeDownloads(browser, inbox);

  // Remember what was already in this Flow project before the run, so it is never downloaded or touched.
  manifest.project = page.url().match(/^https:\/\/[^/]+\/project\/[0-9a-f-]{36}/)?.[0] ?? page.url();
  manifest.ignoreByProject ??= {};
  if (!manifest.ignoreByProject[manifest.project]) {
    const before = (await readTiles(page)).map((t) => t.mediaId).filter(Boolean);
    const ours = new Set(Object.values(manifest.items).map((s) => s.mediaId).filter(Boolean));
    manifest.ignoreByProject[manifest.project] = before.filter((id) => !ours.has(id));
    log(`project ${manifest.project} (${before.length} existing images left untouched)`);
  }
  manifest.save();

  // Resume: pick up anything that finished while we were away.
  const resumed = await collect(page, { items, manifest, runDir, inbox });
  if (resumed) log(`recovered ${resumed} finished image(s) from an earlier session`);

  let batches = 0, badStreak = 0, submitErrors = 0, stopped = null;
  while (submit && batches < maxBatches) {
    const queue = items
      .filter((it) => manifest.items[it.id].status !== "done" && manifest.items[it.id].attempts < config.maxAttempts)
      .sort((a, b) => manifest.items[a.id].attempts - manifest.items[b.id].attempts || a.id.localeCompare(b.id));
    if (!queue.length) break;
    const batch = queue.slice(0, config.batchSize);
    batches++;
    log(`batch ${batches}: ${batch.map((it) => it.id).join(", ")} (${queue.length - batch.length} more after this)`);

    const settings = await ensureSettings(page, config);
    log(`composer: ${settings}`);

    for (const it of batch) {
      const st = manifest.items[it.id];
      st.attempts++;
      try {
        await submitPrompt(page, it.prompt);
        st.status = "submitted";
        st.error = null;
        submitErrors = 0;
        log(`  submitted ${it.id}-${it.name}`);
      } catch (e) {
        st.status = "failed";
        st.error = e.message;
        submitErrors++;
        log(`  submit failed for ${it.id}: ${e.message}`);
        if (submitErrors >= 3) {
          stopped = "Flow stopped accepting prompts (3 errors in a row). Run `inspect` to check for UI changes.";
          break;
        }
      }
      manifest.save();
      await pause(2000, 3500);
    }
    if (stopped) break;

    log("  waiting for Flow to finish the batch…");
    const ok = await settle(page, { onTick: (busy) => busy && log(`  ${busy} still rendering`) });
    if (!ok) log("  some tiles were still rendering after 8 min; collecting what is ready");

    const tiles = await readTiles(page);
    const failedTiles = tiles.filter((t) => t.failed).length;
    const unusual = tiles.some((t) => t.unusual);
    await collect(page, { items, manifest, runDir, inbox });

    const failed = batch.filter((it) => manifest.items[it.id].status !== "done");
    for (const it of failed) {
      const st = manifest.items[it.id];
      st.status = "failed";
      st.error ??= unusual ? "Flow reported unusual activity" : "generation failed";
    }
    manifest.save();
    log(`  batch ${batches}: ${batch.length - failed.length}/${batch.length} saved${failed.length ? `, failed: ${failed.map((i) => i.id).join(", ")}` : ""}`);

    if (failedTiles || failed.length) {
      log(`  refreshing Flow${unusual ? ' (it reported "unusual activity")' : ""}; failed prompts go into a later batch`);
      await reload(page);
      await pause(unusual ? 60_000 : 20_000, unusual ? 90_000 : 30_000);
    }
    badStreak = failed.length * 2 >= batch.length ? badStreak + 1 : 0;
    if (badStreak >= 2) {
      stopped = "Two batches in a row mostly failed. Pausing so a human can check the Flow window and the account.";
      break;
    }
    const remaining = items.some((it) => manifest.items[it.id].status !== "done" && manifest.items[it.id].attempts < config.maxAttempts);
    if (remaining && batches < maxBatches) await pause(8000, 15000);
  }
  try {
    rmdirSync(inbox); // only succeeds when empty
  } catch {
    // leftovers stay for inspection
  }

  const gallery = writeGallery(runDir, items, manifest, { title: config.topic || "Flow images", aspectRatio: config.aspectRatio });
  const done = items.filter((it) => manifest.items[it.id].status === "done");
  const notDone = items.filter((it) => manifest.items[it.id].status !== "done");
  return {
    runDir,
    project: manifest.project,
    total: items.length,
    done: done.length,
    failed: notDone.filter((it) => manifest.items[it.id].attempts >= config.maxAttempts).map((it) => it.id),
    pending: notDone.filter((it) => manifest.items[it.id].attempts < config.maxAttempts).map((it) => it.id),
    batches,
    gallery,
    stopped,
  };
}
