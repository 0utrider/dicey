import { PACKAGE_ID, themeScope } from "../constants.js";
import { HOLIDAY_BY_ID, standing } from "../holiday-calendar.js";
import { registerFonts, resolveFont } from "../fonts.js";
import { ledMaterial } from "../led-material.js";
import { effective } from "../settings.js";
import { SCREEN_FX } from "../screen-fx.js";

export const id = "themes";

const FREE_PACK = "data/free/dicey-themes.json";
const HOLIDAY_PACK = "data/holidays/dicey-holidays.json";
const ROSTER = "data/holidays/roster.json";

/** Holidays whose window opens within this many days are loaded up front, with those in season. */
export const UPCOMING_DAYS = 30;

/**
 * Every theme registered with Dicer, by Dicer theme id:
 * `{ slug, name, holiday, featured, group, screen, jingle, sounds }` (holiday id or null; featured marks the lead set of a
 * holiday; group "damage" for the damage type sets).
 */
export const REGISTERED = new Map();

/**
 * Every holiday set in the pack, registered or not, by holiday id: `[{ id, slug, name, featured, screen, jingle }]`.
 * Only released holidays are listed; the rest are "coming soon".
 */
export const HOLIDAY_SETS = new Map();

/**
 * What a roll with each of our sets plays, by Dicer theme id: `{ screen, jingle, sounds }`. Every set
 * in the free pack and every released holiday is here, registered on this client or not, so a player
 * whose browser has not loaded a holiday still sees and hears another player's roll with it.
 */
export const SET_INFO = new Map();

/** True when a pack entry plays sounds of its own: a rule sound of ours, a jingle, or a screen effect with one. */
function ownSounds(entry) {
  // damage dice turn up in most rolls: their short landing sounds leave the dice pets alone
  if (entry.group === "damage") return false;
  return (
    !!entry.jingle ||
    (entry.rules ?? []).some((r) => typeof r.sound?.src === "string" && (r.sound.src.startsWith("dicey:") || r.sound.src.includes("/assets/sounds/"))) ||
    Object.values(entry.screen ?? {}).some((name) => !!SCREEN_FX[name]?.sound)
  );
}

function noteInfo(entry) {
  SET_INFO.set(`${themeScope()}.${entry.slug}`, { screen: entry.screen ?? null, jingle: entry.jingle ?? null, sounds: ownSounds(entry) });
}

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

/** The LED switch, read safely: On if settings are not ready yet. */
function ledsOn() {
  try {
    return effective("ledDice") !== false;
  } catch {
    return true;
  }
}

/** Dicer 1.4.14 and later let a theme quiet the dice pets for its own rolls (`pets: { volume }`). */
export const dicerQuietsPets = () => foundry.utils.isNewerVersion(game.modules.get("dicer")?.version ?? "0", "1.4.13");

/** The quiet-pets switch, read safely: On if settings are not ready yet. */
function quietPetsOn() {
  try {
    return effective("quietPets") !== false;
  } catch {
    return true;
  }
}

/** A rule's sound written as `{ src: "dicey:name" }` plays Dicey's own file assets/sounds/name.ogg. */
function resolveSound(rule) {
  const src = rule?.sound?.src;
  if (typeof src !== "string" || !src.startsWith("dicey:")) return rule;
  return { ...rule, sound: { ...rule.sound, src: `modules/${PACKAGE_ID}/assets/sounds/${src.slice(6)}.ogg` } };
}

/** Die types a landing sound is split over when it must skip a natural 20 or 1 (see quietLandings). */
const LANDING_DICE = ["d2", "d3", "d4", "d6", "d8", "d10", "d12", "d100"];

/**
 * A landing rule (no die, no result) plays on every die, a natural 20 too, where it lands on top of the
 * set's own crit sound or jingle. Dicer rules cannot leave out one value, so the sound moves to rules of
 * its own: the d20 over a range that skips 20 (and 1, when the set has its own natural 1), and one rule
 * per other die type. The original rule keeps its effect.
 */
function quietLandings(rules, { skip20, skip1 }) {
  if (!skip20 && !skip1) return rules;
  const out = [];
  for (const rule of rules) {
    const landing = rule.sound && !rule.result && (!rule.die || rule.die === "any");
    if (!landing) {
      out.push(rule);
      continue;
    }
    const { sound, ...rest } = rule;
    if (rest.effect || rest.moment || rest.macro) out.push(rest);
    out.push({ id: `${rule.id}-d20`, name: rule.name, die: "d20", result: { kind: "range", from: skip1 ? 2 : 1, to: skip20 ? 19 : 20 }, sound });
    for (const die of LANDING_DICE) out.push({ id: `${rule.id}-${die}`, name: rule.name, die, sound });
  }
  return out;
}

function register(entry) {
  // fx: shelved JB2A effects (docs/shelved-jb2a-effects.md), dropped if an old pack still has them
  const { slug, tier, holiday, featured, group, fx, screen, jingle, leds, ...theme } = entry;
  if (Array.isArray(theme.rules)) theme.rules = theme.rules.map(resolveSound);
  if (Array.isArray(theme.rules)) theme.rules = quietLandings(theme.rules, { skip20: !!(screen?.nat20 || jingle), skip1: !!screen?.nat1 });
  const scope = themeScope();
  const themeId = `${scope}.${slug}`;
  if (REGISTERED.has(themeId)) return true;
  if (theme.appearance?.numbers?.font) {
    theme.appearance = { ...theme.appearance, numbers: { ...theme.appearance.numbers, font: resolveFont(theme.appearance.numbers.font) } };
  }
  const sounds = ownSounds(entry);
  // quiet the dice pets on its rolls (older Dicer: features/holiday-fx.js does it by hand); the switch takes effect on reload
  if (sounds && quietPetsOn() && dicerQuietsPets()) theme.pets = { volume: 0 };
  const options = { moduleId: scope };
  // a material hook is taken when the theme registers, so the switch takes effect on reload
  if (leds && ledsOn()) options.material = ledMaterial(`${scope}-leds-${slug}`.slice(0, 64), leds);
  const done = dicerApi.registerTheme({ ...theme, id: themeId, perType: {} }, options);
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
    screen: screen ?? null,
    jingle: jingle ?? null,
    sounds,
  });
  return true;
}

const DAMAGE_ENTRIES = new Map(); // slug -> pack entry of a damage set, for its quiet copy
const QUIET = new Set(); // theme ids of the quiet copies registered so far

/**
 * A damage set's quiet copy: the same look and effects, without its rule sounds. A damage type the GM
 * gave a custom sound in Dicer's damage type map uses it, so the custom sound replaces ours as it
 * replaces Dicer's own. Dicer only swaps a built-in set's landing sound. The copy is left out of the
 * theme browser and Dicey's lists (it is not in REGISTERED). Returns its theme id, or null.
 */
export function quietDamageSet(slug) {
  const scope = themeScope();
  const themeId = `${scope}.${slug}-quiet`;
  if (QUIET.has(themeId)) return themeId;
  const entry = DAMAGE_ENTRIES.get(slug);
  if (!entry || !dicerApi) return null;
  const { slug: _s, tier, holiday, featured, group, fx, screen, jingle, leds, ...theme } = entry;
  theme.rules = (theme.rules ?? [])
    .map(({ sound, ...rule }) => rule)
    .filter((rule) => rule.effect || rule.moment || rule.macro);
  if (theme.appearance?.numbers?.font) {
    theme.appearance = { ...theme.appearance, numbers: { ...theme.appearance.numbers, font: resolveFont(theme.appearance.numbers.font) } };
  }
  if (!dicerApi.registerTheme({ ...theme, id: themeId, perType: {} }, { moduleId: scope, showInAll: false })) return null;
  QUIET.add(themeId);
  return themeId;
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

/** Theme ids of ours that this world already uses: a default, the damage map, any user's choice, an actor's. */
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
  // every user, not only this one: their dice must draw (and play their effects) on this client too
  for (const user of game.users ?? []) scan(user.flags?.dicer);
  for (const actor of game.actors ?? []) scan(actor.flags?.dicer);
  return found;
}

async function loadAll(api) {
  dicerApi = api;
  let ok = 0;
  let total = 0;

  const free = await fetchJson(FREE_PACK);
  total += free.length;
  for (const e of free) {
    noteInfo(e);
    if (e.group === "damage") DAMAGE_ENTRIES.set(e.slug, e);
    if (register(e)) ok++;
  }

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
    for (const e of entries) noteInfo(e);
    HOLIDAY_SETS.set(
      holidayId,
      entries.map((e) => ({ id: `${scope}.${e.slug}`, slug: e.slug, name: e.name, featured: e.featured === true, screen: e.screen ?? null, jingle: e.jingle ?? null })),
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

/** Loads any pending holiday whose sets a changed document now uses (another player picks one mid-game). */
function loadUsed(changes) {
  const text = JSON.stringify(changes?.flags?.dicer ?? null);
  if (!pending.size || text === "null") return;
  const scope = themeScope();
  for (const [holidayId, entries] of [...pending]) {
    if (entries.some((e) => text.includes(`${scope}.${e.slug}`))) loadHoliday(holidayId);
  }
}

export function init() {
  Hooks.on("updateUser", (_doc, changes) => loadUsed(changes));
  Hooks.on("updateActor", (_doc, changes) => loadUsed(changes));
  Hooks.once("dicer.ready", async (api) => {
    try {
      registerFonts(api);
    } catch (err) {
      console.error(`${PACKAGE_ID} | failed to register fonts`, err);
    }
    try {
      await loadAll(api);
      Hooks.callAll("dicey.themesLoaded");
    } catch (err) {
      console.error(`${PACKAGE_ID} | failed to register themes`, err);
    }
  });
}
