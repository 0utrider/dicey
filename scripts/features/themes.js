import { PACKAGE_ID, themeScope } from "../constants.js";
import { HOLIDAY_BY_ID, standing } from "../holiday-calendar.js";
import { resolveFont } from "../fonts.js";

export const id = "themes";

const FREE_PACK = "data/free/dicey-themes.json";
const HOLIDAY_PACK = "data/holidays/dicey-holidays.json";
const ROSTER = "data/holidays/roster.json";

/** Holidays whose window opens within this many days are loaded up front, with those in season. */
export const UPCOMING_DAYS = 30;

/**
 * Every theme registered with Dicer, by Dicer theme id:
 * `{ slug, name, holiday, featured, group, fx }` (holiday id or null; featured marks the lead set of a
 * holiday; group "damage" for the damage type sets).
 */
export const REGISTERED = new Map();

/**
 * Every holiday set in the pack, registered or not, by holiday id: `[{ id, slug, name, featured }]`.
 * Only released holidays are listed; the rest are "coming soon".
 */
export const HOLIDAY_SETS = new Map();

/** Holidays that have sets but are not released yet: shown as one "Coming soon" card. */
export const COMING_SOON = [];

const pending = new Map(); // holiday id -> raw pack entries not yet registered
let dicerApi = null;

/** Dev builds can show unreleased holidays: api.holidays.drafts(true), then reload. */
const draftsOn = () => {
  try {
    return localStorage.getItem(`${PACKAGE_ID}.drafts`) === "1";
  } catch {
    return false;
  }
};

async function fetchJson(path) {
  const res = await fetch(`modules/${PACKAGE_ID}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function register(entry) {
  const { slug, tier, holiday, featured, group, fx, ...theme } = entry;
  const scope = themeScope();
  const themeId = `${scope}.${slug}`;
  if (REGISTERED.has(themeId)) return true;
  if (theme.appearance?.numbers?.font) {
    theme.appearance = { ...theme.appearance, numbers: { ...theme.appearance.numbers, font: resolveFont(theme.appearance.numbers.font) } };
  }
  const done = dicerApi.registerTheme({ ...theme, id: themeId, perType: {} }, { moduleId: scope });
  if (!done) {
    console.warn(`${PACKAGE_ID} | Dicer rejected theme "${slug}"`);
    return false;
  }
  REGISTERED.set(themeId, {
    slug,
    name: theme.name,
    holiday: HOLIDAY_BY_ID.has(holiday) ? holiday : null,
    featured: featured === true,
    group: group ?? null,
    fx: fx ?? null,
  });
  return true;
}

/** True once a holiday's sets are registered with Dicer. */
export const isLoaded = (holidayId) => HOLIDAY_SETS.has(holidayId) && !pending.has(holidayId);

/** Registers a holiday's sets with Dicer (on demand, e.g. from its placeholder card). */
export function loadHoliday(holidayId) {
  const entries = pending.get(holidayId);
  if (!entries || !dicerApi) return 0;
  pending.delete(holidayId);
  let ok = 0;
  for (const e of entries) if (register(e)) ok++;
  Hooks.callAll("dicey.themesChanged", holidayId);
  return ok;
}

/** Theme ids of ours that this world or user already uses (a default, damage map, an actor). */
function idsInUse() {
  const scope = themeScope();
  const found = new Set();
  const scan = (value) => {
    if (value == null) return;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    for (const m of text.matchAll(new RegExp(`${scope.replace(/[-.]/g, "\\$&")}\\.([a-z0-9-]+)`, "g"))) found.add(m[1]);
  };
  const get = (key) => {
    try {
      return game.settings.get("dicer", key);
    } catch {
      return null;
    }
  };
  for (const key of ["theme", "worldDefaultTheme", "damageTypeMap", "damageThemeOverrides"]) scan(get(key));
  scan(game.user?.flags?.dicer);
  for (const actor of game.actors ?? []) scan(actor.flags?.dicer);
  return found;
}

async function loadAll(api) {
  dicerApi = api;
  let ok = 0;
  let total = 0;

  const free = await fetchJson(FREE_PACK);
  total += free.length;
  for (const e of free) if (register(e)) ok++;

  const [holidays, roster] = await Promise.all([fetchJson(HOLIDAY_PACK), fetchJson(ROSTER)]);
  const released = new Set(roster.released ?? []);
  const scope = themeScope();
  const byHoliday = new Map();
  for (const e of holidays) {
    if (!HOLIDAY_BY_ID.has(e.holiday)) {
      console.warn(`${PACKAGE_ID} | theme "${e.slug}" names an unknown holiday "${e.holiday}"`);
      continue;
    }
    if (!byHoliday.has(e.holiday)) byHoliday.set(e.holiday, []);
    byHoliday.get(e.holiday).push(e);
  }

  const inUse = idsInUse();
  const now = new Date();
  for (const [holidayId, entries] of byHoliday) {
    if (!released.has(holidayId) && !draftsOn()) {
      COMING_SOON.push(holidayId);
      continue;
    }
    HOLIDAY_SETS.set(
      holidayId,
      entries.map((e) => ({ id: `${scope}.${e.slug}`, slug: e.slug, name: e.name, featured: e.featured === true })),
    );
    const s = standing(HOLIDAY_BY_ID.get(holidayId), now);
    const soon = s && (s.inSeason || (s.start - now) / 86_400_000 <= UPCOMING_DAYS);
    const used = entries.some((e) => inUse.has(e.slug));
    if (soon || used) {
      total += entries.length;
      for (const e of entries) if (register(e)) ok++;
    } else pending.set(holidayId, entries);
  }
  console.log(
    `${PACKAGE_ID} | registered ${ok}/${total} themes with Dicer; ${pending.size} holidays load on demand, ` +
      `${COMING_SOON.length} coming soon`,
  );
}

export function init() {
  Hooks.once("dicer.ready", async (api) => {
    try {
      await loadAll(api);
      Hooks.callAll("dicey.themesLoaded");
    } catch (err) {
      console.error(`${PACKAGE_ID} | failed to register themes`, err);
    }
  });
}
