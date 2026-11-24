import { DATA_ID, PACKAGE_ID } from "../constants.js";
import { macrosNeedSync, packsNeedPlacement, supported, syncModuleMacros, syncModulePacks } from "../lib/outrider-mods.js";

/**
 * World content: the Macros compendium (Dicey Settings, Dice Themes) is copied into
 * world macros in the shared "Outrider's Mods" folder, the same way the other Outrider modules do it
 * (scripts/lib/outrider-mods.js, copied verbatim from om-MASTER). Only the active GM syncs, once per
 * module version, and again whenever a pack or macro is found out of place.
 */

export const id = "content";

/**
 * The pack's macro icons name this module under its prod id (`modules/dicey/...`). A dev build is
 * installed as `dicey-dev`, so its synced macros would show a broken icon: point them at this install.
 */
async function fixDevIcons() {
  if (PACKAGE_ID === DATA_ID) return;
  const from = `modules/${DATA_ID}/`;
  for (const macro of game.macros) {
    if (macro.getFlag(PACKAGE_ID, "syncedFrom") && macro.img?.startsWith(from)) {
      await macro.update({ img: `modules/${PACKAGE_ID}/${macro.img.slice(from.length)}` });
    }
  }
}

/** The scopes a synced macro's source id can sit under: a prod install and a dev install of this module. */
const SCOPES = [DATA_ID, `${DATA_ID}-dev`];

/**
 * The shared helper marks a synced macro with `flags[<installed id>].syncedFrom`, and finds it again
 * by that flag only. A world that runs the dev build and later the prod one (or the other way round)
 * would not recognize the other's macros and would add a second set. So every synced macro carries
 * its source id under both scopes. Read raw and written with update(): getFlag and setFlag refuse the
 * scope of a module that is not active.
 */
export async function alignFlags(macros = game.macros) {
  for (const macro of macros) {
    const id = SCOPES.map((scope) => macro.flags?.[scope]?.syncedFrom).find(Boolean);
    if (!id) continue;
    const update = {};
    for (const scope of SCOPES) if (macro.flags?.[scope]?.syncedFrom !== id) update[`flags.${scope}.syncedFrom`] = id;
    if (Object.keys(update).length) await macro.update(update);
  }
}

async function syncWorldContent() {
  await alignFlags(); // before the helper looks for the macros it made, so none is made twice
  await syncModulePacks(PACKAGE_ID, { folderNames: [] });
  await syncModuleMacros(PACKAGE_ID);
  await alignFlags();
  await fixDevIcons();
}

export async function ready() {
  if (!supported() || !game.users.activeGM?.isSelf) return;
  await alignFlags().catch((err) => console.warn(`${PACKAGE_ID} | could not align the synced macro flags`, err));
  const version = game.modules.get(PACKAGE_ID).version;
  const updated = game.settings.get(DATA_ID, "syncedVersion") !== version;
  if (!updated && !packsNeedPlacement(PACKAGE_ID) && !macrosNeedSync(PACKAGE_ID)) return;
  try {
    await syncWorldContent();
    await game.settings.set(DATA_ID, "syncedVersion", version);
  } catch (err) {
    console.warn(`${PACKAGE_ID} | World content sync failed`, err);
  }
}
