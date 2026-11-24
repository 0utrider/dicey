import { DATA_ID } from "../constants.js";
import { HOLIDAYS, standing } from "../holiday-calendar.js";
import { DiceySettings } from "../settings-app.js";
import { effective, lowDefaultApplies, policyOf } from "../settings.js";

/**
 * A player's first load in a world with Dicey on: a small popup saying what their settings are right
 * now (the GM may have changed them before this player logged in), with a button that opens the
 * settings window. Shown once per world on each browser; the GM never sees it.
 */

export const id = "welcome";

const t = (key) => game.i18n.localize(key);
const esc = (text) => foundry.utils.escapeHTML(String(text));

/** "(set by your GM)" or "(your GM's default)" when the GM has a say in this value. */
function whoSays(key) {
  const mode = policyOf(key).mode;
  return mode === "forced" ? ` ${t("DICEY.Welcome.GmSet")}` : mode === "default" ? ` ${t("DICEY.Welcome.GmDefault")}` : "";
}

const onOff = (on) => t(on ? "DICEY.Welcome.On" : "DICEY.Welcome.Off");

function content() {
  const dice = effective("holidayDice") === true;
  const fx = effective("holidayFx") !== false;
  const skipped = new Set(effective("holidaySkip") ?? []);
  const now = HOLIDAYS.filter((h) => !skipped.has(h.id) && standing(h)?.inSeason).map((h) => t(h.label));
  const rows = [
    [t("DICEY.Settings.holidayDice.Name"), `${onOff(dice)}${whoSays("holidayDice")}`],
    ...(dice ? [[t("DICEY.Settings.holidayPick.Name"), `${t(`DICEY.Settings.holidayPick.${effective("holidayPick")}`)}${whoSays("holidayPick")}`]] : []),
    [t("DICEY.Settings.holidayFx.Name"), `${onOff(fx)}${lowDefaultApplies("holidayFx") ? "" : whoSays("holidayFx")}`],
  ];
  const list = rows.map(([name, value]) => `<li><strong>${esc(name)}:</strong> ${esc(value)}</li>`).join("");
  const season = now.length ? game.i18n.format("DICEY.Welcome.InSeason", { list: now.join(", ") }) : t("DICEY.Welcome.NoneInSeason");
  // Off for a Low-quality player by default (even over a GM default): say why, so nobody wonders where the effects are.
  const low = lowDefaultApplies("holidayFx") ? `<p class="notes">${esc(t("DICEY.Welcome.FxLow"))}</p>` : "";
  return `<p>${esc(t("DICEY.Welcome.Intro"))}</p><ul>${list}</ul><p>${esc(season)}</p>${low}`;
}

export async function show() {
  const action = await foundry.applications.api.DialogV2.wait({
    window: { title: "DICEY.Welcome.Title", icon: "fa-solid fa-bomb" },
    position: { width: 420 },
    content: content(),
    buttons: [
      { action: "open", label: t("DICEY.Welcome.Open"), icon: "fa-solid fa-sliders", default: true },
      { action: "close", label: t("DICEY.Welcome.Close"), icon: "fa-solid fa-xmark" },
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
