import { PACKAGE_ID } from "./constants.js";
import { declaration } from "./settings-declaration.js";
import { clearOwn, defaultOf, effective, hasOwnValue, isLocked, modesFor, policyOf, setOwn, setPolicy } from "./settings.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const t = (key) => game.i18n.localize(key);

const OUTPOST_URL = "https://0utrider.github.io/outpost/";

/** Whether two field values are the same (2 vs "2", "#FF9D00" vs "#ff9d00", arrays by their sorted members). */
const same = (a, b) => norm(a) === norm(b);
const norm = (v) => (Array.isArray(v) ? [...v].sort().join("\u0001") : String(v ?? "").toLowerCase());

/** A section's fields this user may see (`gmOnly` ones are for the GM). */
const fieldsIn = (section) => section.groups.flatMap((g) => g.fields).filter((f) => !f.gmOnly || game.user.isGM);
const fieldsOf = () => declaration.sections.flatMap(fieldsIn);
const optionsOf = (f) => (f.optionsFn ? f.optionsFn() : f.options) ?? [];

/**
 * Dicey's settings window, drawn from the declaration (settings-declaration.js) in the shared panel
 * way: nothing is stored until Save, Save writes only the keys that changed, every field has its own
 * reset, a changed field is marked, Reset Defaults changes the form only, and the wheel never edits a
 * value. A GM also gets an "Everyone" choice per field (see settings.js).
 */
export class DiceySettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dicey-settings",
    tag: "form",
    classes: ["dicey-settings"],
    window: { title: "DICEY.Settings.Title", icon: "dicey-glyph", resizable: true },
    position: { width: 1040, height: 680 },
    form: { handler: DiceySettings.#onSubmit, closeOnSubmit: false, submitOnChange: false },
    actions: {
      // not "tab": that name is Foundry's own tab action, which takes the click first
      diceyTab: DiceySettings.#onTab,
      reset: DiceySettings.#onReset,
      resetAll: DiceySettings.#onResetAll,
      openThemes: DiceySettings.#onOpenThemes,
      openTest: DiceySettings.#onOpenTest,
      openOutpost: DiceySettings.#onOpenOutpost,
    },
  };

  static PARTS = {
    body: { template: `modules/${PACKAGE_ID}/templates/settings.hbs`, scrollable: [".dicey-set-panel"] },
  };

  #tab = declaration.sections[0].id;
  #query = "";
  #base = new Map(); // key -> { value, mode }: what each field held when it was last drawn or saved
  #hook = null;
  #cleared = new Set(); // fields reset in the form (and not edited since): Save gives them back to their default

  async _prepareContext() {
    const isGM = game.user.isGM;
    const row = (f) => {
      const policy = policyOf(f.key).mode;
      const locked = isLocked(f.key);
      const value = effective(f.key);
      const r = {
        key: f.key,
        label: t(f.label),
        hint: t(f.hint),
        locked,
        lockNote: policy === "forced" ? t("DICEY.Settings.LockedByGM") : policy === "default" && !isGM ? t("DICEY.Settings.DefaultByGM") : "",
        isSwitch: f.type === "switch",
        isSelect: f.type === "select",
        isChecklist: f.type === "checklist",
        checked: value === true,
        policyBox: isGM && !!f.policy,
        policy: modesFor(f.key).map((m) => ({ value: m, label: t(`DICEY.Settings.Mode.${m}`), selected: m === policy })),
        policyMode: policy,
      };
      if (r.isSelect) r.options = optionsOf(f).map(([v, label]) => ({ value: v, label: t(label), selected: v === value }));
      if (r.isChecklist) {
        const set = new Set(Array.isArray(value) ? value : []);
        r.items = optionsOf(f).map(([v, label, extra = {}]) => ({
          value: v,
          label: t(label),
          icon: extra.icon,
          badge: extra.badge ? t(extra.badge) : "",
          checked: f.store === "unchecked" ? !set.has(v) : set.has(v),
        }));
      }
      return r;
    };
    return {
      isGM,
      query: this.#query,
      icon: `modules/${PACKAGE_ID}/assets/icons/dicey-64.webp`,
      outpostIcon: `modules/${PACKAGE_ID}/assets/icons/outpost-128.webp`,
      note: isGM ? t("DICEY.Settings.NoteGM") : t("DICEY.Settings.Note"),
      tabs: declaration.sections
        .filter((s) => fieldsIn(s).length)
        .map((s) => ({
          id: s.id,
          icon: s.icon,
          label: t(s.label),
          active: s.id === this.#tab,
          rows: fieldsIn(s).map(row),
        })),
    };
  }

  /** The wheel never edits a value: it scrolls the window instead (branding doc, standing behaviours). */
  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    this.element.addEventListener(
      "wheel",
      (event) => {
        if (!event.target.closest?.("range-picker, input[type=number], select")) return;
        event.stopImmediatePropagation();
        event.target.blur?.();
      },
      { capture: true, passive: true },
    );
    // Field events (the window element lives across renders, so these are added once).
    for (const event of ["input", "change"]) this.element.addEventListener(event, (ev) => this.#mark(ev.target.closest("[data-row]")));
    // a hand edit after a reset is a choice again (a reset fires its own events first, flagged by #resetting)
    this.element.addEventListener("input", (ev) => {
      const key = ev.target.closest("[data-row]")?.dataset.row;
      if (key && !this.#resetting) this.#cleared.delete(key);
    });
    // a setting changed elsewhere while this window is open (another window, another GM)
    this.#hook = Hooks.on("updateSetting", (setting) => this.#elsewhere(setting?.key));
  }

  _onClose(options) {
    if (this.#hook !== null) Hooks.off("updateSetting", this.#hook);
    this.#hook = null;
    super._onClose?.(options);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    this.#base.clear();
    for (const f of fieldsOf()) this.#base.set(f.key, { value: this.#read(f), mode: this.#mode(f) });
    this.#cleared.clear();
    el.querySelector(".dicey-set-search")?.addEventListener("input", (ev) => {
      this.#query = ev.currentTarget.value;
      this.#filter();
    });
    for (const f of fieldsOf()) this.#mark(this.#row(f.key));
    this.#filter();
  }

  // --- reading and writing the form ---------------------------------------------------------
  #row(k) {
    return this.element.querySelector(`[data-row="${k}"]`);
  }

  /** The value a field shows now, in the shape the setting stores. */
  #read(f) {
    const row = this.#row(f.key);
    if (f.type === "switch") return row.querySelector(`[name="${f.key}"]`).checked;
    if (f.type === "select") return row.querySelector(`[name="${f.key}"]`).value;
    const boxes = [...row.querySelectorAll(`[name="${f.key}"]`)];
    return boxes.filter((b) => b.checked !== (f.store === "unchecked")).map((b) => b.value);
  }

  #mode(f) {
    return this.#row(f.key)?.querySelector(`[name="policy.${f.key}"]`)?.value ?? policyOf(f.key).mode;
  }

  /** Puts a value in a field and fires what a hand edit would, so the mark and the reset button follow. */
  #write(f, value) {
    const row = this.#row(f.key);
    const set = (el, fn) => {
      fn(el);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    if (f.type === "switch") set(row.querySelector(`[name="${f.key}"]`), (el) => (el.checked = value === true));
    else if (f.type === "select") set(row.querySelector(`[name="${f.key}"]`), (el) => (el.value = value ?? ""));
    else {
      const list = new Set(Array.isArray(value) ? value : []);
      for (const box of row.querySelectorAll(`[name="${f.key}"]`)) set(box, (el) => (el.checked = f.store === "unchecked" ? !list.has(el.value) : list.has(el.value)));
    }
  }

  /** Marks a row changed since it was drawn, and dims its reset button while it sits at its default. */
  #mark(row) {
    const f = fieldsOf().find((x) => x.key === row?.dataset.row);
    const base = f && this.#base.get(f.key);
    if (!base) return;
    const changed = !same(this.#read(f), base.value) || this.#mode(f) !== base.mode;
    row.classList.toggle("is-changed", changed);
    const atDefault = same(this.#read(f), defaultOf(f.key)) && this.#mode(f) === "free";
    const button = row.querySelector(".dicey-set-reset-field");
    if (button) button.disabled = atDefault || isLocked(f.key);
  }

  #elsewhere(storageKey) {
    const k = String(storageKey ?? "").split(".").pop();
    if (!this.rendered) return;
    if (k === "policies") return void this.render(); // a GM changed who may change what: draw it again
    const f = fieldsOf().find((x) => x.key === k);
    if (!f) return;
    const row = this.#row(k);
    const now = effective(k);
    if (!row || same(now, this.#base.get(k)?.value)) return;
    const edited = row.classList.contains("is-changed");
    this.#base.get(k).value = now;
    if (!edited) this.#write(f, now);
    row.classList.add("is-elsewhere");
    row.title = t("DICEY.Settings.ChangedElsewhere");
    this.#mark(row);
  }

  /** Search: show matching rows across every tab, hide the tab nav while searching. */
  #filter() {
    const el = this.element;
    const words = this.#query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    el.classList.toggle("dicey-searching", words.length > 0);
    for (const row of el.querySelectorAll(".dicey-set-row")) {
      const text = row.textContent.toLocaleLowerCase();
      row.hidden = words.length > 0 && !words.every((w) => text.includes(w));
    }
    for (const panel of el.querySelectorAll(".dicey-set-panel")) {
      panel.classList.toggle("has-match", !!panel.querySelector(".dicey-set-row:not([hidden])"));
    }
  }

  // --- actions -----------------------------------------------------------------------------------
  /** Tabs switch in place: the form keeps what was typed on the other tab. */
  static #onTab(event, target) {
    this.#tab = target.dataset.tab;
    for (const el of this.element.querySelectorAll("[data-tab]")) el.classList.toggle("active", el.dataset.tab === this.#tab);
    for (const el of this.element.querySelectorAll("[data-panel]")) el.classList.toggle("active", el.dataset.panel === this.#tab);
  }

  /** One field back to its registered default, and its "Everyone" choice back to the player's choice. Form only. */
  static #onReset(event, target) {
    const f = fieldsOf().find((x) => x.key === target.dataset.key);
    if (f) this.#reset(f);
  }

  /** Opens Dicer's Dice Themes window, the way its own settings menu does. */
  static #onOpenThemes() {
    const menu = game.modules.get("dicer")?.active && game.settings.menus.get("dicer.themeBrowser");
    if (menu) new menu.type().render({ force: true });
    else ui.notifications.warn(game.i18n.localize("DICEY.Settings.NoDicer"));
  }

  /** The effects test stays under the dice, so this window gets out of its way (unsaved changes are kept). */
  static async #onOpenTest() {
    await this.minimize();
    game.modules.get(PACKAGE_ID).api.effectsTest();
  }

  /** A new tab, so the game stays open. */
  static #onOpenOutpost() {
    window.open(OUTPOST_URL, "_blank", "noopener,noreferrer");
  }

  /** Every field back to its default. Form only: nothing is stored until Save. */
  static #onResetAll() {
    for (const f of fieldsOf()) this.#reset(f);
  }

  #resetting = false;

  #reset(f) {
    if (isLocked(f.key)) return;
    this.#resetting = true;
    try {
      this.#write(f, defaultOf(f.key));
    } finally {
      this.#resetting = false;
    }
    this.#cleared.add(f.key);
    const select = this.#row(f.key)?.querySelector(`[name="policy.${f.key}"]`);
    if (select && select.value !== "free") {
      select.value = "free";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /** Saves what changed since the window was drawn, and nothing else. */
  static async #onSubmit() {
    let saved = 0;
    for (const f of fieldsOf()) {
      const base = this.#base.get(f.key);
      if (!base || isLocked(f.key)) continue;
      const value = this.#read(f);
      const mode = this.#mode(f);
      if (this.#cleared.has(f.key)) {
        // reset in the form: give the value back (a GM default or the Low default applies again), even if it looks the same
        if (hasOwnValue(f.key) || !same(value, base.value)) {
          await clearOwn(f.key);
          saved++;
        }
      } else if (!same(value, base.value)) {
        await setOwn(f.key, value);
        saved++;
      }
      if (game.user.isGM && f.policy && mode !== base.mode) {
        await setPolicy(f.key, mode);
        saved++;
      }
    }
    if (saved) ui.notifications.info(t("DICEY.Settings.Saved"));
    await this.render();
  }
}

export function registerMenu() {
  game.settings.registerMenu(PACKAGE_ID, "settingsWindow", {
    name: "DICEY.Settings.Title",
    label: "DICEY.Settings.Open",
    hint: "DICEY.Settings.MenuHint",
    icon: "dicey-glyph",
    type: DiceySettings,
    restricted: false,
  });
}
