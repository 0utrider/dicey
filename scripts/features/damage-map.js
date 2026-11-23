import { MODULE_ID } from "../constants.js";

export const id = "damageMap";

const EDITOR_ID = "dicer-damage-map-editor";

/**
 * Dicer's damage type map builds its dropdowns from a closed list, so registered add-on themes
 * never appear. After the editor renders, add this module's themes to every row's WORLD CHOICE and
 * MY OVERRIDE select under their own group. Values are theme ids, which Dicer's resolver accepts.
 */
function addOptions(app, element) {
  if (app.id !== EDITOR_ID) return;
  const api = game.modules.get("dicer")?.api;
  const themes = api?.listThemes?.(MODULE_ID) ?? [];
  if (!themes.length) return;
  const label = game.i18n.localize("DICEY.Group");

  for (const select of element.querySelectorAll('select[name$=".world"], select[name$=".user"]')) {
    if (select.querySelector(`optgroup[data-dicey]`)) continue;
    const current = select.value;
    // Dicer lists an unknown stored id as its raw string; drop it so the entry below replaces it.
    for (const opt of select.querySelectorAll(`option[value^="${MODULE_ID}."]`)) opt.remove();
    const group = document.createElement("optgroup");
    group.label = label;
    group.dataset.dicey = "";
    for (const theme of themes) {
      const opt = document.createElement("option");
      opt.value = theme.id;
      opt.textContent = theme.name;
      group.append(opt);
    }
    select.append(group);
    select.value = current;
  }
}

export function init() {
  Hooks.on("renderApplicationV2", addOptions);
}
