import { DATA_ID, PACKAGE_ID } from "../constants.js";
import { HOLIDAYS, standing } from "../holiday-calendar.js";
import { effective, onSettingsChange } from "../settings.js";
import { REGISTERED } from "./themes.js";
import { today } from "./holidays.js";

/**
 * Holiday dice: while a holiday is in season, set this user's default Dicer theme to one of its sets,
 * and put the previous default back once no holiday is in season (or the setting is turned off).
 *
 * Featured: the featured set of the holiday that started most recently, so a new holiday takes over
 * from one still running. Random: a holiday in season at random, then one of its sets, picked again on every load.
 *
 * Dicer keeps a user's default in its client setting `theme` and in the user flag
 * `dicer.appearance.global`; both are written the way Dicer's own "Use as my default" writes them.
 */

export const id = "holidayDice";

const lookFor = (themeId) => ({ theme: themeId, appearance: null, colorset: null, look: null, system: null, chosen: true });
const CLEARED = { theme: "default", appearance: null, colorset: null, look: null, system: null, chosen: null };

const dicerTheme = () => game.settings.get("dicer", "theme");
const record = () => game.settings.get(DATA_ID, "holidayRestore") ?? {};
const setRecord = (r) => game.settings.set(DATA_ID, "holidayRestore", r);

/** Dicer's "lock player looks" with a world default: players cannot pick their own, so leave it alone. */
function dicerLocked() {
  try {
    return !game.user.isGM && !!game.settings.get("dicer", "lockPlayerLooks") && !!game.settings.get("dicer", "worldDefaultTheme");
  } catch {
    return false;
  }
}

/** In-season holidays this user has not skipped, newest start first, with their sets. */
export function liveHolidays(date = today()) {
  const skip = new Set(effective("holidaySkip") ?? []);
  const sets = [...REGISTERED].filter(([, t]) => t.holiday);
  return HOLIDAYS.filter((h) => !skip.has(h.id))
    .map((h) => ({ holiday: h, s: standing(h, date) }))
    .filter(({ s }) => s?.inSeason)
    .sort((a, b) => b.s.start - a.s.start)
    .map(({ holiday }) => ({
      holiday,
      sets: sets.filter(([, t]) => t.holiday === holiday.id).map(([themeId, t]) => ({ id: themeId, ...t })),
    }))
    .filter((h) => h.sets.length);
}

const pickOf = (list, rng) => list[Math.floor(rng() * list.length)];

/**
 * The set to put on. Random: one in-season holiday at random (so a holiday with many sets does not crowd
 * out one with few), then one of its sets at random; never the set already on when something else exists.
 * Featured: the featured set of the holiday that started most recently.
 */
export function choose(live, mode, current, rng = Math.random) {
  if (!live.length) return null;
  if (mode === "random") {
    const fresh = live.filter((h) => h.sets.some((s) => s.id !== current));
    const holiday = pickOf(fresh.length ? fresh : live, rng);
    const others = holiday.sets.filter((s) => s.id !== current);
    return pickOf(others.length ? others : holiday.sets, rng).id;
  }
  const { sets } = live[0];
  return (sets.find((s) => s.featured) ?? sets[0]).id;
}

async function setDefault(themeId, global) {
  await game.user.setFlag("dicer", "appearance", { global: global ?? (themeId === "default" ? CLEARED : lookFor(themeId)) });
  await game.settings.set("dicer", "theme", themeId);
}

let running = null;
/** Brings this user's default in line with the holiday settings. Safe to call any time. */
export function apply() {
  running = (running ?? Promise.resolve()).then(applyNow).catch((err) =>
    console.error(`${PACKAGE_ID} | holiday dice failed`, err),
  );
  return running;
}

async function applyNow() {
  if (!game.ready || !REGISTERED.size || dicerLocked()) return;
  const rec = record();
  const current = dicerTheme();
  const live = effective("holidayDice") ? liveHolidays() : [];

  if (!live.length) {
    // Season over or switched off: put back what was there, unless the user has moved on since.
    if (rec.applied && current === rec.applied) await setDefault(rec.theme ?? "default", rec.global ?? null);
    if (rec.applied) await setRecord({});
    return;
  }

  const pick = choose(live, effective("holidayPick"), current);
  if (!pick) return;
  const onHolidaySet = !!REGISTERED.get(current)?.holiday;
  // Remember the user's own choice; a holiday set on now is ours to replace, not theirs to restore.
  const prev = rec.applied && onHolidaySet
    ? { theme: rec.theme, global: rec.global }
    : { theme: current, global: foundry.utils.deepClone(game.user.flags?.dicer?.appearance?.global ?? null) };
  if (pick !== current) await setDefault(pick);
  await setRecord({ applied: pick, ...prev });
}

export function init() {
  Hooks.on("dicey.themesLoaded", () => (game.ready ? apply() : Hooks.once("ready", apply)));
  onSettingsChange((key) => {
    if (["holidayDice", "holidayPick", "holidaySkip", "policies"].includes(key)) apply();
  });
}
