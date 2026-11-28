import { themeScope } from "../constants.js";
import { HOLIDAYS } from "../holiday-calendar.js";
import { effective, onSettingsChange } from "../settings.js";
import { REGISTERED, HOLIDAY_SETS, isLoaded, loadHoliday, quietDamageSet } from "./themes.js";

export const id = "damageMap";

const EDITOR_ID = "dicer-damage-map-editor";

/** Damage type -> the slug of our set, which is also the id of Dicer's built-in set for that type. */
export const TYPE_SETS = {
  ...Object.fromEntries(
    ["acid", "bleed", "cold", "electricity", "fire", "force", "mental", "poison", "precision", "sonic", "spirit", "vitality", "void"].map((t) => [t, t]),
  ),
  bludgeoning: "physical",
  piercing: "physical",
  slashing: "physical",
  lightning: "electricity",
  thunder: "sonic",
  radiant: "vitality",
  necrotic: "void",
  psychic: "mental",
  healing: "vitality",
};

let applied = false;

/** True when the GM gave this damage type a custom sound in Dicer's damage type map (Dicer's own test). */
function hasCustomSound(type) {
  let all = null;
  try {
    all = game.settings.get("dicer", "damageTypeSounds");
  } catch {
    return false;
  }
  const entry = all?.[type];
  return !!entry && typeof entry === "object" && typeof entry.src === "string" && !!entry.src;
}

/** Dicer 1.5.2 lets a custom damage sound replace a registered theme's landing sounds itself. */
const NATIVE_CUSTOM_SOUND = "1.5.2";

/** True on a Dicer older than 1.5.2, where a custom sound needs our quiet copy of the set. */
function needsQuietCopy() {
  const version = game.modules.get("dicer")?.version;
  return !version || foundry.utils.isNewerVersion(NATIVE_CUSTOM_SOUND, version);
}

/**
 * Makes our damage sets the default for each damage type, through Dicer's module defaults: they sit
 * under the GM's World choice and a player's override, and nothing is stored in Dicer's settings.
 * On a Dicer older than 1.5.2, a type with a custom sound gets the set's quiet copy, so the custom
 * sound replaces ours. From 1.5.2, Dicer does that itself.
 * Dicer cannot remove a default, so switching off hands each type back to its built-in set by name.
 */
function applyDefaults() {
  if (!game.dice3d?.addDamageTypeDefaults || !REGISTERED.size) return;
  const on = effective("damageSets") !== false;
  if (!on && !applied) return;
  const scope = themeScope();
  const quiet = needsQuietCopy();
  const map = {};
  for (const [type, slug] of Object.entries(TYPE_SETS)) {
    if (!REGISTERED.has(`${scope}.${slug}`)) continue;
    if (!on) map[type] = slug;
    else map[type] = (quiet && hasCustomSound(type) && quietDamageSet(slug)) || `${scope}.${slug}`;
  }
  game.dice3d.addDamageTypeDefaults(map);
  applied = on;
}

/**
 * Dicer's damage type map builds its dropdowns from a closed list, so registered add-on themes
 * never appear. After the editor renders, every row's WORLD CHOICE and MY OVERRIDE select is laid
 * out as:
 *
 *   Default
 *   [Things Got Dicey: damage types]   our damage sets, first since they are made for this list
 *   [Dicer]                            Dicer's own Theme: and Colorset: choices, unchanged
 *   [Things Got Dicey]                 our other sets, holiday sets included
 *   ...anything other modules add
 *
 * Values are theme ids, which Dicer's resolver accepts. Our groups get a quiet purple tint (CSS).
 */

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

function group(label, kind, themes) {
  const g = el("optgroup", { label });
  g.dataset.dicey = kind;
  for (const t of themes) g.append(el("option", { value: t.id, textContent: t.name }));
  return g;
}

const byName = (a, b) => a.name.localeCompare(b.name, game.i18n.lang);

/**
 * Our sets for the second group: regular sets A to Z, then every released holiday set as
 * "Holiday · Set", sorted by holiday name and then set name.
 */
function otherSets() {
  const plain = [...REGISTERED]
    .filter(([, t]) => !t.holiday && t.group !== "damage")
    .map(([themeId, t]) => ({ id: themeId, name: t.name }))
    .sort(byName);
  const holiday = HOLIDAYS.map((h) => ({ label: game.i18n.localize(h.label), sets: HOLIDAY_SETS.get(h.id) ?? [] }))
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
    .flatMap(({ label, sets }) => [...sets].sort(byName).map((s) => ({ id: s.id, name: `${label} · ${s.name}` })));
  return [...plain, ...holiday];
}

function markChosen(select, scope) {
  select.classList.toggle("dicey-chosen", select.value.startsWith(`${scope}.`));
}

function layout(select, scope, damage, others) {
  if (select.querySelector("optgroup[data-dicey]")) return;
  const current = select.value;
  // Dicer lists an unknown stored id as its raw string; drop it so our entry replaces it.
  for (const opt of select.querySelectorAll(`option[value^="${scope}."]`)) opt.remove();

  const def = select.querySelector('option[value="default"]');
  // Dicer's own choices are the flat options with plain ids (theme ids of modules carry a dot).
  const dicerOwn = [...select.children].filter((o) => o.tagName === "OPTION" && o !== def && !o.value.includes("."));
  const dicer = el("optgroup", { label: game.i18n.localize("DICEY.DamageMap.Dicer") });
  dicer.dataset.diceyDicer = "";
  dicer.append(...dicerOwn);

  const ours = group(game.i18n.localize("DICEY.DamageMap.DamageTypes"), "damage", damage);
  const rest = group(game.i18n.localize("DICEY.DamageMap.Sets"), "sets", others);
  const anchor = def ?? null;
  if (anchor) anchor.after(ours, dicer, rest);
  else select.prepend(ours, dicer, rest);

  select.value = current;
  markChosen(select, scope);
  select.addEventListener("change", () => {
    markChosen(select, scope);
    // A holiday set picked out of season: register it now so rolls can use it this session.
    for (const [holidayId, sets] of HOLIDAY_SETS) {
      if (!isLoaded(holidayId) && sets.some((s) => s.id === select.value)) loadHoliday(holidayId);
    }
  });
}

function addOptions(app, element) {
  if (app.id !== EDITOR_ID) return;
  const scope = themeScope();
  const damage = [...REGISTERED]
    .filter(([, t]) => t.group === "damage")
    .map(([themeId, t]) => ({ id: themeId, name: t.name }))
    .sort(byName);
  if (!damage.length && !REGISTERED.size) return;
  const others = otherSets();
  for (const select of element.querySelectorAll('select[name$=".world"], select[name$=".user"]')) {
    layout(select, scope, damage, others);
  }
}

export function init() {
  Hooks.on("renderApplicationV2", addOptions);
  // either can come first: our themes registering, or Dicer's dice API appearing
  Hooks.on("dicey.themesLoaded", applyDefaults);
  Hooks.once("diceSoNiceReady", applyDefaults);
  onSettingsChange((key) => key === "damageSets" && applyDefaults());
  // the GM adds or clears a custom damage type sound in Dicer's damage type map
  Hooks.on("updateSetting", (setting) => setting.key === "dicer.damageTypeSounds" && applyDefaults());
  Hooks.on("createSetting", (setting) => setting.key === "dicer.damageTypeSounds" && applyDefaults());
}
