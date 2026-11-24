/**
 * Flag helpers scoped to DATA_ID. Foundry's setFlag/getFlag/unsetFlag throw for a scope whose
 * module is not active, which is the case for DATA_ID while a dev build runs, so these go through
 * doc.flags and doc.update instead.
 */
import { DATA_ID } from "./constants.js";

export function getFlag(doc, key) {
  return foundry.utils.getProperty(doc.flags?.[DATA_ID] ?? {}, key);
}

export function setFlag(doc, key, value) {
  return doc.update({ [`flags.${DATA_ID}.${key}`]: value });
}

export function unsetFlag(doc, key) {
  return doc.update({ [`flags.${DATA_ID}.-=${key}`]: null });
}
