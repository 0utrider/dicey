/**
 * Settings, and the GM's say over them.
 *
 * Player settings are client settings. For each one the GM can choose, in Dicey's settings window,
 * how much say players have:
 *   free    - each player chooses
 *   default - players get the GM's value until they change it themselves
 *   forced  - players get the GM's value and cannot change it
 * The GM's choice and value live in the world setting `policies`. A GM always uses their own value.
 *
 * Everything is registered under DATA_ID so a dev build works on the world's real settings.
 */
import { DATA_ID } from "./constants.js";
import { declaration } from "./settings-declaration.js";

export const MODES = ["free", "default", "forced"];

/** The modes a GM may pick for a setting: its declaration's `policy` list, else all of them. */
export function modesFor(key) {
  const field = declaration.sections.flatMap((s) => s.groups.flatMap((g) => g.fields)).find((f) => f.key === key);
  return Array.isArray(field?.policy) ? field.policy : MODES;
}

/** The player settings Dicey registers: type and default. The window itself is declared in settings-declaration.js. */
export const SETTINGS = {
  holidayDice: { type: Boolean, default: true },
  holidayPick: { type: String, default: "random" },
  holidaySkip: { type: Array, default: [] },
  screenFx: { type: Boolean, default: true },
  fxSound: { type: Boolean, default: true },
  jingles: { type: Boolean, default: true },
  ledDice: { type: Boolean, default: true },
  quietPets: { type: Boolean, default: true },
  holidaysInAll: { type: Boolean, default: true },
  inSeasonFirst: { type: Boolean, default: true },
};

/**
 * Whether this client's dice quality is Low: the tier Dicer resolved (it follows "auto", the GM's cap
 * and drops for a slow GPU) when it reports one, else a Low setting or a Low world cap.
 */
export function lowQuality() {
  try {
    const tier = game.dice3d?._debug?.tier;
    if (typeof tier === "string") return tier === "low";
    return game.settings.get("dicer", "quality") === "low" || game.settings.get("dicer", "qualityCap") === "low";
  } catch {
    return false;
  }
}

/** Settings that start Off for a player on Low quality (their performance), until that player chooses. */
const OFF_ON_LOW = new Set(["ledDice"]);

/** A setting's default for this client: the registered one, except where Low quality turns it Off. */
export const defaultOf = (key) =>
  OFF_ON_LOW.has(key) && lowQuality() ? false : foundry.utils.deepClone(game.settings.settings.get(`${DATA_ID}.${key}`)?.default);

const listeners = new Set();
/** Runs `fn` after any Dicey setting or policy changes. */
export const onSettingsChange = (fn) => listeners.add(fn);
const changed = (key) => {
  for (const fn of listeners) {
    try {
      fn(key);
    } catch (err) {
      console.error(`${DATA_ID} | settings listener failed`, err);
    }
  }
};

export function registerSettings() {
  for (const [key, def] of Object.entries(SETTINGS)) {
    game.settings.register(DATA_ID, key, {
      scope: "client",
      config: false,
      type: def.type === Array ? Array : def.type,
      default: def.default,
      onChange: () => changed(key),
    });
  }
  game.settings.register(DATA_ID, "policies", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: () => changed("policies"),
  });
  // What the holiday switch replaced, so it can be put back when the season ends.
  // The module version whose world content (the Macros pack) was last synced by a GM (features/content.js).
  game.settings.register(DATA_ID, "syncedVersion", { scope: "world", config: false, type: String, default: "" });
  // The keys this user saved themselves (hasOwnValue); a key not listed follows a default.
  game.settings.register(DATA_ID, "ownKeys", { scope: "client", config: false, type: Array, default: [] });
  // The world this client last saw the welcome popup in (features/welcome.js).
  game.settings.register(DATA_ID, "welcomed", { scope: "client", config: false, type: String, default: "" });
  game.settings.register(DATA_ID, "holidayRestore", { scope: "client", config: false, type: Object, default: {} });
}

export const policies = () => game.settings.get(DATA_ID, "policies") ?? {};

/** The GM's choice for a setting: `{ mode, value }`, mode "free" when unset. */
export function policyOf(key) {
  const p = policies()[key];
  return modesFor(key).includes(p?.mode) ? p : { mode: "free", value: undefined };
}

/**
 * True once this user has saved their own value for a client setting: the key is in `ownKeys`, the
 * list Save adds to and a reset clears. (Not Foundry's client storage, which is not public API.)
 */
export const hasOwnValue = (key) => ownKeys().includes(key);
const ownKeys = () => {
  const list = game.settings.get(DATA_ID, "ownKeys");
  return Array.isArray(list) ? list : [];
};


/** The value in effect for this user, after the GM's policy. */
export function effective(key) {
  // A setting that starts Off on Low quality: a value this user never stored is Off for them, whatever
  // the GM's default says (the older machine wins). Everything else reads the stored value as before,
  // so a wrong "never stored" answer cannot hide a choice.
  if (OFF_ON_LOW.has(key) && lowQuality() && !hasOwnValue(key)) return false;
  const own = game.settings.get(DATA_ID, key);
  if (game.user?.isGM) return own;
  const p = policyOf(key);
  if (p.mode === "forced" && p.value !== undefined) return p.value;
  if (p.mode === "default" && p.value !== undefined && !hasOwnValue(key)) return p.value;
  return own;
}

/** True when `key` is Off for this user only because their quality is Low (they never chose; a GM default does not change it). */
export const lowDefaultApplies = (key) => OFF_ON_LOW.has(key) && lowQuality() && !hasOwnValue(key);

/** True when the GM has locked this setting for players (never for a GM). */
export const isLocked = (key) => !game.user?.isGM && policyOf(key).mode === "forced";

export async function setOwn(key, value) {
  await game.settings.set(DATA_ID, key, value);
  if (!hasOwnValue(key)) await game.settings.set(DATA_ID, "ownKeys", [...ownKeys(), key]);
  // A GM's value is what a policy hands out, so keep it in step.
  if (game.user?.isGM && policyOf(key).mode !== "free") await setPolicy(key, policyOf(key).mode);
}

/** Gives a setting back to its default: the stored value is reset and the key leaves `ownKeys`, so a GM's default (or the Low-quality default) applies again. */
export async function clearOwn(key) {
  if (!SETTINGS[key]) return;
  await game.settings.set(DATA_ID, key, foundry.utils.deepClone(SETTINGS[key].default));
  if (hasOwnValue(key)) await game.settings.set(DATA_ID, "ownKeys", ownKeys().filter((k) => k !== key));
  if (game.user?.isGM && policyOf(key).mode !== "free") await setPolicy(key, policyOf(key).mode);
}

export async function setPolicy(key, mode) {
  if (!game.user?.isGM || !modesFor(key).includes(mode)) return;
  const all = foundry.utils.deepClone(policies());
  if (mode === "free") delete all[key];
  else all[key] = { mode, value: game.settings.get(DATA_ID, key) };
  await game.settings.set(DATA_ID, "policies", all);
}
