import { DATA_ID, PACKAGE_ID } from "../constants.js";
import { HOLIDAYS, standing } from "../holiday-calendar.js";
import { DiceySettings } from "../settings-app.js";
import { effective, isLocked, policyOf, setOwn } from "../settings.js";

/**
 * A player's first load in a world with Dicey on: a small popup saying what their settings are right
 * now (the GM may have changed them before this player logged in), with a button that opens the
 * settings window. Shown once per world on each browser; the GM never sees it.
 */

export const id = "welcome";

const t = (key) => game.i18n.localize(key);
const esc = (text) => foundry.utils.escapeHTML(String(text));

/** A line under a control: "set by your GM" when locked, "your GM's default" when they gave one. */
function who(key) {
  if (isLocked(key)) return t("DICEY.Settings.LockedByGM");
  const mode = policyOf(key).mode;
  return mode === "default" && !game.user.isGM ? t("DICEY.Welcome.GmDefault") : "";
}

function row(key, control) {
  const note = who(key);
  return `<div class="dicey-welcome-row">
    <div class="dicey-welcome-text"><strong>${esc(t(`DICEY.Settings.${key}.Name`))}</strong>
      <span>${esc(t(`DICEY.Settings.${key}.Hint`))}</span>${note ? `<em>${esc(note)}</em>` : ""}</div>${control}</div>`;
}

const toggle = (key, on) =>
  `<label class="dicey-set-toggle"><input type="checkbox" name="${key}" ${on ? "checked" : ""} ${isLocked(key) ? "disabled" : ""}><span class="dicey-set-slider"></span></label>`;

function content() {
  const dice = effective("holidayDice") === true;
  const screen = effective("screenFx") !== false;
  const sound = effective("fxSound") !== false;
  const pick = effective("holidayPick");
  const skipped = new Set(effective("holidaySkip") ?? []);
  const now = HOLIDAYS.filter((h) => !skipped.has(h.id) && standing(h)?.inSeason).map((h) => t(h.label));
  const season = now.length ? game.i18n.format("DICEY.Welcome.InSeason", { list: now.join(", ") }) : t("DICEY.Welcome.NoneInSeason");
  const select = `<select name="holidayPick" ${isLocked("holidayPick") ? "disabled" : ""}>${["random", "featured"]
    .map((v) => `<option value="${v}" ${pick === v ? "selected" : ""}>${esc(t(`DICEY.Settings.holidayPick.${v}`))}</option>`)
    .join("")}</select>`;
  return `<div class="dicey-welcome-body">
    <header class="dicey-welcome-hero">
      <img src="modules/${PACKAGE_ID}/assets/icons/dicey-64.webp" alt="">
      <div><h2>${esc(t("DICEY.Welcome.Title"))}</h2><p>${esc(t("DICEY.Welcome.Intro"))}</p></div>
    </header>
    <p class="dicey-welcome-season"><i class="fa-solid fa-gift"></i> ${esc(season)}</p>
    <div class="dicey-welcome-rows">
      ${row("holidayDice", toggle("holidayDice", dice))}
      ${row("holidayPick", select)}
      ${row("screenFx", toggle("screenFx", screen))}
      ${row("fxSound", toggle("fxSound", sound))}
    </div>
    <p class="dicey-welcome-foot">${esc(t("DICEY.Welcome.Foot"))}</p>
  </div>`;
}

/** Controls here save as they change, as a player's own choice (same as Save in the settings window). */
function wire(dialog) {
  const root = dialog.element;
  const sync = () => {
    const dice = root.querySelector('[name="holidayDice"]')?.checked;
    root.querySelector('[name="holidayPick"]')?.closest(".dicey-welcome-row")?.classList.toggle("dimmed", !dice);
  };
  sync();
  root.addEventListener("change", async (event) => {
    const input = event.target;
    const key = input?.name;
    if (!key || input.disabled) return;
    const value = input.type === "checkbox" ? input.checked : input.value;
    try {
      await setOwn(key, value);
    } catch (err) {
      console.warn(`${DATA_ID} | welcome popup could not save ${key}`, err);
    }
    sync();
  });
}

export async function show() {
  const action = await foundry.applications.api.DialogV2.wait({
    classes: ["dicey-welcome"],
    window: { title: "DICEY.Welcome.Title", icon: "fa-solid fa-dice-d20" },
    position: { width: 460 },
    content: content(),
    render: (event, dialog) => wire(dialog),
    buttons: [
      { action: "open", label: t("DICEY.Welcome.Open"), icon: "fa-solid fa-sliders" },
      { action: "close", label: t("DICEY.Welcome.Close"), icon: "fa-solid fa-check", default: true },
    ],
    rejectClose: false,
  });
  if (action === "open") new DiceySettings().render({ force: true });
}

export function ready() {
  if (game.user.isGM || game.settings.get(DATA_ID, "welcomed") === game.world.id) return;
  // Marked first: a refresh or an error must not bring it back every time.
  game.settings.set(DATA_ID, "welcomed", game.world.id).then(() => show()).catch((err) => console.warn(`${DATA_ID} | welcome popup failed`, err));
}
