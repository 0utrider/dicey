import { PACKAGE_ID } from "../constants.js";
import { effective } from "../settings.js";
import { REGISTERED } from "./themes.js";

/**
 * Scene effects for holiday sets: when a roll made with one of our sets finishes, play a Sequencer
 * effect (JB2A art) on the speaker's token, or in the middle of the screen when there is none.
 *
 * Each set lists its effects in the pack as `fx: { nat20, nat1, land }`; a value is a Sequencer
 * database path (a folder path picks a random file inside it) or `{ file, scale, screen }`.
 * A natural 20 on any d20 wins over a natural 1, which wins over a plain landing.
 *
 * Needs Sequencer and a JB2A module; without them nothing happens. Every client plays its own copy
 * (`locally`), since every client gets Dicer's roll-finished event.
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

function play(spec, message) {
  const { file, scale = 1, screen = false } = typeof spec === "string" ? { file: spec } : spec;
  if (!file || !Sequencer.Database.entryExists(file)) return;
  const token = canvas.ready ? canvas.tokens?.get(message.speaker?.token) : null;
  const seq = new Sequence({ moduleName: PACKAGE_ID, softFail: true });
  const fx = seq.effect().file(file).locally();
  if (token && !screen) fx.atLocation(token).scaleToObject(2.5 * scale);
  else fx.screenSpace().screenSpaceAnchor({ x: 0.5, y: 0.45 }).screenSpaceScale({ x: scale, y: scale });
  seq.play();
}

function onRollComplete(messageId) {
  if (!messageId || !game.modules.get("sequencer")?.active || !globalThis.Sequencer) return;
  if (effective("holidayFx") === false) return;
  const message = game.messages.get(messageId);
  if (!message?.rolls?.length) return;
  const set = REGISTERED.get(themeOf(message));
  if (!set?.fx) return;
  const spec = set.fx[outcome(message)];
  if (spec) {
    try {
      play(spec, message);
    } catch (err) {
      console.warn(`${PACKAGE_ID} | holiday effect failed`, err);
    }
  }
}

export function init() {
  Hooks.on("diceSoNiceRollComplete", onRollComplete);
}
