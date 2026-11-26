import { DATA_ID, PACKAGE_ID } from "../constants.js";
import { effective } from "../settings.js";
import { SET_INFO, dicerQuietsPets } from "./themes.js";
import { playScreenFx } from "../screen-fx.js";
import { playJingle } from "../jingles.js";

/**
 * Holiday effects: when a roll made with one of our sets finishes, play the set's own screen effect
 * (`screen: { nat20, nat1, land }`, see screen-fx.js) and, on a natural 20, its jingle. A natural 20 on
 * any d20 wins over a natural 1, which wins over a plain landing. Every client plays its own copy,
 * since every client gets Dicer's roll-finished event. (JB2A scene effects used to play here too; they
 * are shelved, see docs/shelved-jb2a-effects.md.)
 */

export const id = "holidayFx";

/** The theme a message's dice used: the speaker actor's choice, the roller's default, the world's. */
function themeOf(message) {
  const api = game.modules.get("dicer")?.api;
  try {
    const actor = ChatMessage.getSpeakerActor(message.speaker);
    const chosen = actor ? api?.getActorTheme?.(actor) : null;
    if (chosen) return chosen;
  } catch {}
  const own = message.author?.flags?.dicer?.appearance?.global?.theme;
  if (own && own !== "default") return own;
  try {
    return game.settings.get("dicer", "worldDefaultTheme") || null;
  } catch {
    return null;
  }
}

function outcome(message) {
  let nat20 = false;
  let nat1 = false;
  for (const roll of message.rolls ?? []) {
    for (const die of roll.dice ?? []) {
      if (die.faces !== 20) continue;
      for (const r of die.results ?? []) {
        if (r.active === false || r.discarded) continue;
        if (r.result === 20) nat20 = true;
        if (r.result === 1) nat1 = true;
      }
    }
  }
  return nat20 ? "nat20" : nat1 ? "nat1" : "land";
}

function onRollComplete(messageId) {
  if (!messageId) return;
  const message = game.messages.get(messageId);
  if (!message?.rolls?.length) return;
  const set = SET_INFO.get(themeOf(message));
  if (!set?.screen && !set?.jingle) return;
  const result = outcome(message);
  try {
    const own = set.screen?.[result];
    if (own && effective("screenFx") !== false) playScreenFx(own);
    // after the screen effect, so a jingle sits on top of its sleigh bells
    if (set.jingle && result === "nat20") playJingle(set.jingle, messageId);
  } catch (err) {
    console.warn(`${PACKAGE_ID} | holiday effect failed`, err);
  }
}

/*
 * Quiet pets: while a roll with one of our sets that has its own sounds is on screen, this client's
 * Dicer pet sounds are off (setting `quietPets`, on by default), so pet yelps do not pile on top of the
 * set's sounds. Dicer 1.4.14 and later do this per roll from the theme's `pets.volume` (set in
 * features/themes.js). Older Dicer has no per-roll switch, so there its client setting `petSounds` is
 * turned off at roll start and back on once every such roll has finished. The localStorage note puts
 * it back if the page goes away mid-roll.
 */
const PETS_NOTE = `${DATA_ID}.petsMuted`;
const quieting = new Map(); // message id -> timeout

const petSounds = (on) => game.settings.set("dicer", "petSounds", on).catch(() => {});

function onRollStart(messageId) {
  const message = game.messages.get(messageId);
  if (!message?.rolls?.length || effective("quietPets") === false) return;
  const set = SET_INFO.get(themeOf(message));
  if (!set?.sounds) return;
  // Dicer 1.4.14+ quiets the pets from the theme, but cheers were still heard under a jingle, so a
  // natural 20 on a jingle set also turns the pet sounds off by hand for the roll
  if (dicerQuietsPets() && !(set.jingle && outcome(message) === "nat20")) return;
  if (!quieting.size) {
    let on = false;
    try {
      on = game.settings.get("dicer", "petSounds") !== false;
    } catch {}
    if (!on) return; // already silent: nothing to put back
    localStorage.setItem(PETS_NOTE, "1");
    petSounds(false);
  }
  clearTimeout(quieting.get(messageId));
  quieting.set(messageId, setTimeout(() => endQuiet(messageId), 20000));
}

function endQuiet(messageId) {
  if (!quieting.has(messageId)) return;
  clearTimeout(quieting.get(messageId));
  quieting.delete(messageId);
  // a little after the roll, so the pet's reaction to the result is quiet too
  if (!quieting.size) setTimeout(() => {
    if (quieting.size || !localStorage.getItem(PETS_NOTE)) return;
    localStorage.removeItem(PETS_NOTE);
    petSounds(true);
  }, 1500);
}

export function init() {
  Hooks.on("diceSoNiceRollStart", onRollStart);
  Hooks.on("diceSoNiceRollComplete", (id) => {
    onRollComplete(id);
    endQuiet(id);
  });
}

export function ready() {
  if (!localStorage.getItem(PETS_NOTE)) return;
  localStorage.removeItem(PETS_NOTE);
  petSounds(true);
}
