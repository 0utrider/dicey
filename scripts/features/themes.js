import { MODULE_ID } from "../constants.js";

export const id = "themes";

const PACKS = [`modules/${MODULE_ID}/data/free/dicey-themes.json`];

/** Registers every theme in a JSON pack with Dicer. Entries use Dicer's sparse appearance format. */
async function loadPack(api, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const entries = await res.json();
  let ok = 0;
  for (const { slug, tier, ...theme } of entries) {
    const done = api.registerTheme(
      { ...theme, id: `${MODULE_ID}.${slug}`, perType: {} },
      { moduleId: MODULE_ID },
    );
    if (done) ok++;
    else console.warn(`${MODULE_ID} | Dicer rejected theme "${slug}"`);
  }
  return { ok, total: entries.length };
}

export function init() {
  Hooks.once("dicer.ready", async (api) => {
    try {
      let ok = 0;
      let total = 0;
      for (const url of PACKS) {
        const r = await loadPack(api, url);
        ok += r.ok;
        total += r.total;
      }
      console.log(`${MODULE_ID} | registered ${ok}/${total} themes with Dicer`);
    } catch (err) {
      console.error(`${MODULE_ID} | failed to register themes`, err);
    }
  });
}
