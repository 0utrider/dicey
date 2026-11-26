import { DATA_ID, PACKAGE_ID } from "../constants.js";
import { HOLIDAYS } from "../holiday-calendar.js";
import { effective } from "../settings.js";
import { SCREEN_FX, clearScreenFx, playScreenFx, screenFxShowing, setMenorahNight } from "../screen-fx.js";
import { HOLIDAY_SETS, isLoaded, loadHoliday } from "./themes.js";
import { JINGLE_POOL, playJingle } from "../jingles.js";

/**
 * Effects test: a GM window for trying Dicey's effects (macro "Dicey Effects Test", or
 * `game.modules.get(id).api.effectsTest()`).
 *
 * A full roll does what a real game does: for a moment this user's default Dicer theme becomes one of
 * our sets, a d20 is rolled with its result fixed (20, 1 or anything between) and posted to chat, so
 * Dicer throws the dice with the set's look, rule effects and sounds, and Dicey's screen
 * effects follow. Once the roll finishes, the user's own default is put back. If the page goes away
 * mid-roll, the next load puts it back (`RESTORE`).
 */

export const id = "effectsTest";

const RESTORE = `${DATA_ID}.effectsTestRestore`; // localStorage: this user's default while a test roll runs
const OUTCOMES = { nat20: 20, nat1: 1, land: null };
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const holidayLabel = (h) => t(HOLIDAYS.find((x) => x.id === h)?.label ?? h);
const holidayIcon = (h) => HOLIDAYS.find((x) => x.id === h)?.icon ?? "fa-solid fa-dice-d20";

/** This user's default as Dicer keeps it: the user flag and the client setting. */
const snapshot = () => ({
  global: foundry.utils.deepClone(game.user.flags?.dicer?.appearance?.global ?? null),
  theme: game.settings.get("dicer", "theme"),
});

async function setDefault({ global, theme }) {
  await game.user.update({ "flags.dicer.appearance.-=global": null });
  if (global) await game.user.update({ "flags.dicer.appearance.global": global });
  await game.settings.set("dicer", "theme", theme ?? "default");
}

/** Puts back a default left over from a test roll that did not finish (the page was closed mid-roll). */
async function restoreLeftover() {
  const saved = localStorage.getItem(RESTORE);
  if (!saved) return;
  localStorage.removeItem(RESTORE);
  try {
    await setDefault(JSON.parse(saved));
  } catch (err) {
    console.warn(`${PACKAGE_ID} | could not put back the dice set from an unfinished test roll`, err);
  }
}

/** Rolls a d20 fixed at `value` with `themeId` as this user's default, then puts the default back. */
async function testRoll(themeId, value, { everyone = false } = {}) {
  const before = snapshot();
  localStorage.setItem(RESTORE, JSON.stringify(before));
  let hook = null;
  try {
    await setDefault({
      global: { theme: themeId, appearance: null, colorset: null, look: null, system: null, chosen: true },
      theme: themeId,
    });
    const roll = await new Roll("1d20").evaluate();
    roll.dice[0].results[0].result = value;
    roll._total = value;
    let messageId = null;
    const finished = new Promise((resolve) => {
      hook = Hooks.on("diceSoNiceRollComplete", (id) => id === messageId && resolve());
      setTimeout(resolve, 15000);
    });
    const message = await roll.toMessage(
      { flavor: t("DICEY.Test.Flavor") },
      { rollMode: everyone ? CONST.DICE_ROLL_MODES.PUBLIC : CONST.DICE_ROLL_MODES.SELF },
    );
    messageId = message.id;
    await finished;
  } finally {
    if (hook !== null) Hooks.off("diceSoNiceRollComplete", hook);
    await setDefault(before);
    localStorage.removeItem(RESTORE);
  }
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const valueFor = (outcome) => OUTCOMES[outcome] ?? 2 + Math.floor(Math.random() * 18);

/** Holidays whose sets have effects, with those sets: `[{ holiday, sets }]`, in calendar order. */
function holidaysWithEffects() {
  const out = [];
  for (const h of HOLIDAYS) {
    const sets = (HOLIDAY_SETS.get(h.id) ?? []).filter((s) => s.screen || s.jingle);
    if (sets.length) out.push({ holiday: h.id, sets });
  }
  return out;
}

const { ApplicationV2 } = foundry.applications.api;

export class EffectsTest extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "dicey-effects-test",
    classes: ["dicey-settings", "dicey-test"],
    window: { title: "DICEY.Test.Title", icon: "fa-solid fa-wand-magic-sparkles", resizable: true },
    position: { width: 620, height: 640 },
    actions: {
      fullRoll: EffectsTest.#onFullRoll,
      setRoll: EffectsTest.#onSetRoll,
      screenOnly: EffectsTest.#onScreenOnly,
      jingleOnly: EffectsTest.#onJingleOnly,
      stop: EffectsTest.#onStop,
    },
  };

  #busy = false;

  async _renderHTML() {
    const groups = holidaysWithEffects();
    const chip = (key, on) =>
      `<span class="dicey-test-chip ${on ? "on" : "off"}">${esc(t(key))}: ${esc(t(on ? "DICEY.Test.On" : "DICEY.Test.Off"))}</span>`;
    const btn = (action, label, data, cls = "") =>
      `<button type="button" class="dicey-test-btn ${cls}" data-action="${action}" ${Object.entries(data)
        .map(([k, v]) => `data-${k}="${esc(v)}"`)
        .join(" ")}>${label}</button>`;
    const outcomeLabel = (o) => esc(t(`DICEY.Test.Outcome.${o}`));

    const full = groups
      .map(({ holiday, sets }) => {
        const effects = new Map(); // "name|outcome" -> true
        for (const s of sets) for (const [o, name] of Object.entries(s.screen ?? {})) effects.set(`${name}|${o}`, { name, o });
        // jingles play on a natural 20: one button per tune, "random" for the sets that draw from the pool
        for (const s of sets) if (s.jingle) effects.set(`jingle:${s.jingle}|nat20`, { name: `jingle:${s.jingle}`, o: "nat20" });
        if (!effects.size) return "";
        const buttons = [...effects.values()]
          .map(({ name, o }) => btn("fullRoll", `${esc(name)} <small>${outcomeLabel(o)}</small>`, { holiday, effect: name, outcome: o }))
          .join("");
        return `<div class="dicey-test-group"><h4><i class="${holidayIcon(holiday)}"></i> ${esc(holidayLabel(holiday))}</h4><div class="dicey-test-row">${buttons}</div></div>`;
      })
      .join("");

    const bySet = groups
      .map(({ holiday, sets }) => {
        const rows = sets
          .map(
            (s) => `<div class="dicey-test-set"><span>${esc(s.name)}</span>${["nat20", "nat1", "land"]
              .map((o) => btn("setRoll", outcomeLabel(o), { holiday, theme: s.id, outcome: o }, "small"))
              .join("")}</div>`,
          )
          .join("");
        return `<div class="dicey-test-group"><h4><i class="${holidayIcon(holiday)}"></i> ${esc(holidayLabel(holiday))}</h4>${rows}</div>`;
      })
      .join("");

    const only = Object.keys(SCREEN_FX)
      .map((name) => btn("screenOnly", esc(name), { effect: name }, "small"))
      .join("");
    // every tune: the pool and the ones a set names for itself
    const tunes = new Set(JINGLE_POOL);
    for (const { sets } of groups) for (const s of sets) if (s.jingle && s.jingle !== "random") tunes.add(s.jingle);
    const jingles = [...tunes].map((name) => btn("jingleOnly", esc(name), { tune: name }, "small")).join("");

    return `
      <div class="dicey-test-root">
        <header class="dicey-set-top">
          <img class="dicey-set-logo" src="modules/${PACKAGE_ID}/assets/icons/dicey-mark-64.webp" alt="">
          <div>
            <div class="dicey-test-title">${esc(t("DICEY.Test.Heading"))}</div>
            <div class="dicey-set-note">${esc(t("DICEY.Test.Note"))}</div>
          </div>
        </header>
        <div class="dicey-test-bar">
          ${chip("DICEY.Settings.screenFx.Name", effective("screenFx") !== false)}
          ${chip("DICEY.Settings.fxSound.Name", effective("fxSound") !== false)}
          ${chip("DICEY.Settings.jingles.Name", effective("jingles") !== false)}
          <label class="dicey-test-everyone"><input type="checkbox" name="everyone"> ${esc(t("DICEY.Test.Everyone"))}</label>
          ${btn("stop", `<i class="fa-solid fa-stop"></i> ${esc(t("DICEY.Test.Stop"))}`, {}, "small")}
        </div>
        <div class="dicey-test-body">
          <section><h3>${esc(t("DICEY.Test.Full"))}</h3><p class="dicey-set-note">${esc(t("DICEY.Test.FullHint"))}</p>${full}</section>
          <section><h3>${esc(t("DICEY.Test.BySet"))}</h3><p class="dicey-set-note">${esc(t("DICEY.Test.BySetHint"))}</p>${bySet}</section>
          <section><h3>${esc(t("DICEY.Test.Only"))}</h3><p class="dicey-set-note">${esc(t("DICEY.Test.OnlyHint"))}</p><div class="dicey-test-row">${only}</div></section>
          <section><h3>${esc(t("DICEY.Test.Jingles"))}</h3><p class="dicey-set-note">${esc(t("DICEY.Test.JinglesHint"))}</p><div class="dicey-test-row">${jingles}</div></section>
        </div>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onClose(options) {
    setMenorahNight(null);
    super._onClose(options);
  }

  get #everyone() {
    return !!this.element?.querySelector('input[name="everyone"]')?.checked;
  }

  /**
   * Runs one test with the window out of the way: minimised while it plays, back about 1.5 s after the
   * last screen effect has gone. The menorah shows a random night for each test (live rolls follow the
   * calendar).
   */
  async #play(work) {
    if (this.#busy) return ui.notifications.info(t("DICEY.Test.Busy"));
    this.#busy = true;
    this.element?.classList.add("busy");
    setMenorahNight(1 + Math.floor(Math.random() * 8));
    // The size to come back to, read while the window is at rest. Foundry measures it again as it
    // minimises, and a measure taken mid-transition brought the window back nearly minimised.
    const size = this.minimized ? null : { width: this.position.width, height: this.position.height };
    try {
      await this.minimize();
      await work();
      // the screen effect starts as the roll finishes; wait for it to go (at most 15 s). Dicer's own
      // moment (a crit card, a rule effect) has no signal, so give it 2 s whatever happens.
      await new Promise((r) => setTimeout(r, 2000));
      for (let waited = 0; waited < 15000; waited += 200) {
        await new Promise((r) => setTimeout(r, 200));
        if (!screenFxShowing()) break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`${PACKAGE_ID} | test failed`, err);
      ui.notifications.error(t("DICEY.Test.Failed"));
    } finally {
      setMenorahNight(null);
      // still busy until the window is back, so a click cannot start the next test mid-transition
      if (this.rendered) {
        await this.maximize();
        // Foundry restores the window through a CSS transition and caps the height at the computed
        // max-height. On a busy or background page the transition is still at the collapsed size when it
        // does, so the window stayed a header. Finish the transition, then set the size ourselves.
        for (const anim of this.element?.getAnimations?.() ?? []) anim.finish();
        if (size) this.setPosition(size);
      }
      this.#busy = false;
      this.element?.classList.remove("busy");
    }
  }

  #run(holiday, themeId, outcome) {
    return this.#play(async () => {
      if (!isLoaded(holiday)) loadHoliday(holiday);
      await testRoll(themeId, valueFor(outcome), { everyone: this.#everyone });
    });
  }

  /** One of the holiday's sets that plays this screen effect on this outcome, picked at random. */
  static #onFullRoll(_event, target) {
    const { holiday, effect, outcome } = target.dataset;
    const tune = effect.startsWith("jingle:") ? effect.slice(7) : null;
    const sets = (HOLIDAY_SETS.get(holiday) ?? []).filter((s) => (tune ? s.jingle === tune : s.screen?.[outcome] === effect));
    if (sets.length) this.#run(holiday, pick(sets).id, outcome);
  }

  static #onSetRoll(_event, target) {
    const { holiday, theme, outcome } = target.dataset;
    this.#run(holiday, theme, outcome);
  }

  static #onScreenOnly(_event, target) {
    this.#play(async () => playScreenFx(target.dataset.effect));
  }

  static #onJingleOnly(_event, target) {
    playJingle(target.dataset.tune, foundry.utils.randomID());
  }

  static #onStop() {
    clearScreenFx();
  }
}

export function open() {
  if (!game.user.isGM) return ui.notifications.warn(t("DICEY.Test.GMOnly"));
  new EffectsTest().render({ force: true });
}

export function init() {
  game.modules.get(PACKAGE_ID).api.effectsTest = open;
}

export function ready() {
  restoreLeftover();
}
