import { PACKAGE_ID } from "./constants.js";
import { playSound } from "./screen-fx.js";

/**
 * Christmas jingles on a natural 20. A set names one in its pack: `jingle: "sugar-plum"` for a set with
 * its own tune, or `jingle: "random"` for one from the pool. The files are made by tools/make-jingles.py
 * and are all about the same length. They follow the player's **Jingles** switch. The pick comes from the
 * message id and the roller's set, so everyone at the table hears the same tune.
 */
export const JINGLE_POOL = [
  "jingle-bells",
  "hark",
  "joy-to-the-world",
  "deck-the-halls",
  "carol-of-the-bells",
  "we-wish-you",
  "o-come-all-ye-faithful",
  "angels-on-high",
  "sleigh-bells",
  "ice-chime",
];

/** Tunes in the pool that are Dicey sounds of their own rather than jingle-*.ogg, with their volume. */
const OWN_FILES = { "sleigh-bells": ["sleigh-bells.ogg", 0.4], "ice-chime": ["ice-chime.ogg", 0.6] };

/** The same pick on every client: it comes from the message id, not from chance. */
function pick(seed) {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return JINGLE_POOL[h % JINGLE_POOL.length];
}

export function playJingle(name, seed) {
  const tune = name === "random" ? pick(seed) : name;
  const [file, volume] = OWN_FILES[tune] ?? [`jingle-${tune}.ogg`, 0.5];
  playSound({ src: `modules/${PACKAGE_ID}/assets/sounds/${file}`, volume }, { setting: "jingles" });
}
