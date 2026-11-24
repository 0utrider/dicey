import { PACKAGE_ID } from "../constants.js";
import { HOLIDAYS, HOLIDAY_BY_ID, standing } from "../holiday-calendar.js";
import { effective, onSettingsChange } from "../settings.js";
import { REGISTERED, HOLIDAY_SETS, COMING_SOON, isLoaded, loadHoliday } from "./themes.js";
import { DiceySettings } from "../settings-app.js";

/**
 * Dicey in Dicer's theme browser.
 *
 * - Two tabs after Dicer's own: "Dicey" (our regular sets, with holiday sets in season first) and
 *   "Holidays" (every holiday set, in season first, then in the order they come up).
 * - All: holiday sets out of season are left out, and Dicey's in-season sets move up to just after
 *   the sets this user already uses (their default and any assigned to a slot). Both are settings.
 * - Every Dicey card gets the Outrider brand frame; holiday cards carry their holiday as the badge.
 * - Holidays far off are not registered with Dicer until needed: the Holidays tab shows one static
 *   card per holiday (the Dicey logo, no 3D thumbnail) that loads its sets when clicked. Holidays not
 *   released yet share a single static "Coming soon" card.
 *
 * Dicer renders the browser from a context object, and Foundry hands that object to
 * `preRenderApplicationV2` before the template runs, so cards and tabs are changed there without
 * touching Dicer's code. Dicer's own filter stays on "all" while one of our tabs is open; this
 * module keeps its tab per browser window.
 */

export const id = "holidays";

const BROWSER_ID = "dicer-theme-browser";
const TABS = { diceyAll: "Dicey", diceyHolidays: "Holidays" };

/** A date to use instead of today, for checking the windows (see api.holidays.preview). */
let previewDate = null;
export const today = () => previewDate ?? new Date();

const state = new WeakMap();
function stateOf(app) {
  let s = state.get(app);
  if (!s) state.set(app, (s = { tab: null, dicerFilter: "all", pickFirst: false, later: [], soon: [] }));
  return s;
}

const label = (holiday) => game.i18n.localize(holiday.label);

/** `{ holiday, inSeason, start, end }` for a holiday theme, or null for any other theme. */
function holidayOf(themeId, date) {
  const holiday = HOLIDAY_BY_ID.get(REGISTERED.get(themeId)?.holiday);
  if (!holiday) return null;
  const s = standing(holiday, date);
  return { holiday, inSeason: !!s?.inSeason, start: s?.start ?? null, end: s?.end ?? null };
}

/** In season first, then by the date the window opens, featured first within a holiday, then by name. */
function bySeason(a, b) {
  if (a.info.inSeason !== b.info.inSeason) return a.info.inSeason ? -1 : 1;
  const t = (a.info.start?.getTime() ?? Infinity) - (b.info.start?.getTime() ?? Infinity);
  if (t) return t;
  const f = (REGISTERED.get(b.card.id)?.featured ? 1 : 0) - (REGISTERED.get(a.card.id)?.featured ? 1 : 0);
  return f || a.card.name.localeCompare(b.card.name);
}

/** Close to Dicer's search: every word of the query appears in the name or the holiday. */
function matchesQuery(text, query) {
  const words = String(query ?? "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const hay = text.toLocaleLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Cards this user already uses: their default and anything assigned to a slot. */
const inUse = (card) => card.isDefault || card.slotCount > 0;

function prepare(app, context) {
  if (app.id !== BROWSER_ID || !Array.isArray(context?.cards) || !Array.isArray(context.filters)) return;
  if (!REGISTERED.size) return;
  const st = stateOf(app);
  st.dicerFilter = context.filter;
  if (context.filter !== "all") st.tab = null;

  const date = today();
  const hideOffSeason = effective("holidaysInAll") !== false;
  // Names carry no "Dicey:" prefix; the tag says whose set it is: the holiday, or the module.
  const decorate = (card) => {
    const info = holidayOf(card.id, date);
    if (REGISTERED.has(card.id)) {
      card.sourceLabel = info ? label(info.holiday) : game.i18n.localize("DICEY.Tag.Card");
      card.showBadge = true;
    }
    return { card, info };
  };
  const all = context.cards.map(decorate);

  // Counts follow the search, as Dicer's do.
  let diceyCount = 0;
  let holidayCount = 0;
  let offSeason = 0;
  for (const [themeId, { name }] of REGISTERED) {
    const info = holidayOf(themeId, date);
    if (!matchesQuery(`${name} ${info ? label(info.holiday) : ""}`, context.query)) continue;
    if (info) holidayCount++;
    if (info && !info.inSeason) offSeason++;
    else diceyCount++;
  }
  // Holidays not loaded yet: one placeholder each, counted by their sets.
  const later = [];
  for (const [holidayId, sets] of HOLIDAY_SETS) {
    if (isLoaded(holidayId)) continue;
    const holiday = HOLIDAY_BY_ID.get(holidayId);
    const names = `${label(holiday)} ${sets.map((x) => x.name).join(" ")}`;
    if (!matchesQuery(names, context.query)) continue;
    holidayCount += sets.length;
    later.push({ holiday, sets: sets.length, start: standing(holiday, date)?.start ?? null });
  }
  later.sort((a, b) => (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity));
  const soonText = `${game.i18n.localize("DICEY.Holidays.SoonName")} ${COMING_SOON.map((h) => label(HOLIDAY_BY_ID.get(h))).join(" ")}`;
  st.later = st.tab === "diceyHolidays" ? later : [];
  st.soon = st.tab === "diceyHolidays" && COMING_SOON.length && matchesQuery(soonText, context.query) ? COMING_SOON : [];

  if (st.tab === "diceyHolidays") {
    context.cards = all.filter((c) => c.info).sort(bySeason).map((c) => c.card);
  } else if (st.tab === "diceyAll") {
    // In season first, then the all-year sets, then the damage type sets in their own section at the end.
    const ours = all.filter((c) => REGISTERED.has(c.card.id) && (!c.info || c.info.inSeason));
    const isDamage = (c) => REGISTERED.get(c.card.id)?.group === "damage";
    const byName = (a, b) => a.card.name.localeCompare(b.card.name, game.i18n.lang);
    context.cards = [
      ...ours.filter((c) => c.info).sort(bySeason),
      ...ours.filter((c) => !c.info && !isDamage(c)).sort(byName),
      ...ours.filter((c) => !c.info && isDamage(c)).sort(byName),
    ].map((c) => c.card);
  } else if (context.filter === "all") {
    let cards = hideOffSeason ? all.filter((c) => !c.info || c.info.inSeason) : all;
    if (effective("inSeasonFirst") !== false) {
      const pinned = cards.filter((c) => inUse(c.card));
      const season = cards.filter((c) => !inUse(c.card) && c.info?.inSeason).sort(bySeason);
      const rest = cards.filter((c) => !pinned.includes(c) && !season.includes(c));
      cards = [...pinned, ...season, ...rest];
    }
    context.cards = cards.map((c) => c.card);
  }
  context.hasCards = context.cards.length > 0 || st.later.length > 0 || st.soon.length > 0;
  context.noMatch = !context.hasCards && String(context.query ?? "").trim() !== "";

  for (const f of context.filters) {
    if (f.id === "all" && hideOffSeason) f.count = Math.max(0, f.count - offSeason);
    if (st.tab) f.active = false;
  }
  context.filters.push(
    { id: "diceyAll", label: game.i18n.localize("DICEY.Tabs.Dicey"), active: st.tab === "diceyAll", count: diceyCount },
    { id: "diceyHolidays", label: game.i18n.localize("DICEY.Tabs.Holidays"), active: st.tab === "diceyHolidays", count: holidayCount },
  );
}

const fmtDate = (date) => date?.toLocaleDateString(game.i18n.lang, { month: "short", day: "numeric" }) ?? "";

function seasonHint(info) {
  if (info.inSeason) return game.i18n.format("DICEY.Holidays.InSeasonUntil", { date: fmtDate(info.end) });
  return game.i18n.format("DICEY.Holidays.Returns", { date: fmtDate(info.start) });
}

function decorateCard(el, themeId, date) {
  const info = holidayOf(themeId, date);
  el.classList.add("dicey-card");
  el.classList.toggle("dicey-damage", REGISTERED.get(themeId)?.group === "damage");
  if (!info) {
    // The preview panel is narrow: a short tag leaves room for the name.
    const tag = el.querySelector(".dicer-detail-head .dicer-badge");
    if (tag) tag.textContent = game.i18n.localize("DICEY.Tag.Short");
    return;
  }
  el.classList.add("dicey-holiday");
  el.classList.toggle("dicey-in-season", info.inSeason);
  el.classList.toggle("dicey-featured", !!REGISTERED.get(themeId)?.featured);
  const badge = el.querySelector(".dicer-card-meta .dicer-badge, .dicer-detail-head .dicer-badge");
  if (!badge) return;
  if (!badge.querySelector(".dicey-icon")) {
    const icon = document.createElement("i");
    icon.className = `dicey-icon ${info.holiday.icon}`;
    badge.prepend(icon, " ");
  }
  badge.removeAttribute("title");
  const featured = REGISTERED.get(themeId)?.featured ? ` (${game.i18n.localize("DICEY.Holidays.Featured")})` : "";
  badge.dataset.tooltip = `${label(info.holiday)}${featured}: ${seasonHint(info)}`;
}

function sectionHeader(text, icon) {
  const h = document.createElement("div");
  h.className = "dicey-section";
  h.innerHTML = `<i class="${icon}"></i> <span></span>`;
  h.querySelector("span").textContent = text;
  return h;
}

const LOGO = () => `modules/${PACKAGE_ID}/assets/icons/dicey-256.webp`;

/** A static card: the Dicey logo instead of a 3D thumbnail, so it costs nothing to show. */
function staticCard({ name, badge, icon, tooltip, kind, holidayId }) {
  const card = document.createElement("div");
  card.className = `dicer-theme-card dicey-card dicey-static dicey-${kind}`;
  card.tabIndex = 0;
  if (holidayId) card.dataset.diceyHoliday = holidayId;
  if (tooltip) card.dataset.tooltip = tooltip;
  card.innerHTML = `<div class="dicer-stage"><img class="dicey-static-art" alt=""><span class="dicey-static-mark"><i></i></span></div>
    <div class="dicer-card-name"></div><div class="dicer-card-meta"><span class="dicer-badge"></span></div>`;
  card.querySelector("img").src = LOGO();
  card.querySelector(".dicey-static-mark i").className = icon;
  card.querySelector(".dicer-card-name").textContent = name;
  card.querySelector(".dicer-badge").textContent = badge;
  return card;
}

function placeholderCards(st) {
  const out = [];
  if (st.later.length) {
    out.push(sectionHeader(game.i18n.localize("DICEY.Holidays.Later"), "fa-solid fa-calendar"));
    for (const { holiday, sets, start } of st.later) {
      out.push(
        staticCard({
          kind: "later",
          holidayId: holiday.id,
          name: label(holiday),
          icon: holiday.icon,
          badge: `${game.i18n.format("DICEY.Holidays.Sets", { count: sets })} · ${fmtDate(start)}`,
          tooltip: game.i18n.format("DICEY.Holidays.LoadHint", { holiday: label(holiday) }),
        }),
      );
    }
  }
  if (st.soon.length) {
    const names = st.soon.map((h) => label(HOLIDAY_BY_ID.get(h))).join(", ");
    out.push(sectionHeader(game.i18n.localize("DICEY.Holidays.Soon"), "fa-solid fa-hourglass-half"));
    out.push(
      staticCard({
        kind: "soon",
        name: game.i18n.localize("DICEY.Holidays.SoonName"),
        icon: "fa-solid fa-hourglass-half",
        badge: game.i18n.format("DICEY.Holidays.SoonBadge", { count: st.soon.length }),
        tooltip: game.i18n.format("DICEY.Holidays.SoonHint", { names }),
      }),
    );
  }
  return out;
}

function tabIcon(button, id) {
  if (button.classList.contains("dicey-tab")) return;
  button.classList.add("dicey-tab");
  if (id === "diceyAll") {
    const img = document.createElement("img");
    img.className = "dicey-tab-icon";
    img.src = `modules/${PACKAGE_ID}/assets/icons/dicey-mark-64.webp`;
    img.alt = "";
    button.prepend(img);
  } else {
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-gift";
    button.prepend(icon);
  }
}

/** An icon-only button for Dicey's settings, between Dicer's Dice tray and its settings cog. */
function addSettingsButton(element) {
  const bar = element.querySelector(".dicer-toolbar-actions");
  if (!bar || bar.querySelector(".dicey-open-settings")) return;
  const label = game.i18n.localize("DICEY.Settings.Open");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dicer-icon dicey-open-settings";
  button.dataset.tooltip = label;
  button.setAttribute("aria-label", label);
  const img = document.createElement("img");
  img.src = `modules/${PACKAGE_ID}/assets/icons/dicey-mark-64.webp`;
  img.alt = "";
  button.append(img);
  const cog = bar.querySelector('[data-action="openSettings"]');
  if (cog) cog.before(button);
  else bar.append(button);
}

function openSettings() {
  const open = foundry.applications.instances.get("dicey-settings");
  if (open) return open.bringToFront?.() ?? open.render(true);
  return new DiceySettings().render(true);
}

function render(app, element) {
  if (app.id !== BROWSER_ID || !(element instanceof HTMLElement)) return;
  const st = stateOf(app);
  if (!element.dataset.diceyBound) {
    element.dataset.diceyBound = "";
    element.addEventListener("click", (ev) => onClick(app, ev), true);
  }

  const date = today();
  for (const card of element.querySelectorAll(".dicer-theme-card[data-theme]")) {
    if (REGISTERED.has(card.dataset.theme)) decorateCard(card, card.dataset.theme, date);
  }
  const detail = element.querySelector(".dicer-theme-detail[data-theme]");
  if (detail && REGISTERED.has(detail.dataset.theme)) decorateCard(detail, detail.dataset.theme, date);
  for (const id of Object.keys(TABS)) {
    const button = element.querySelector(`.dicer-segmented [data-filter="${id}"]`);
    if (button) tabIcon(button, id);
  }
  addSettingsButton(element);

  if (!st.tab) return;
  const grid = element.querySelector(".dicer-theme-grid");
  if (!grid) return;
  const cards = [...grid.querySelectorAll(".dicer-theme-card")];
  const firstIn = cards.find((c) => c.classList.contains("dicey-in-season"));
  const firstOut = cards.find((c) => c.classList.contains("dicey-holiday") && !c.classList.contains("dicey-in-season"));
  const plain = (c) => !c.classList.contains("dicey-holiday");
  const firstPlain = cards.find((c) => plain(c) && !c.classList.contains("dicey-damage"));
  const firstDamage = cards.find((c) => plain(c) && c.classList.contains("dicey-damage"));
  if (firstIn) firstIn.before(sectionHeader(game.i18n.localize("DICEY.Holidays.InSeason"), "fa-solid fa-star"));
  if (firstOut) firstOut.before(sectionHeader(game.i18n.localize("DICEY.Holidays.ComingUp"), "fa-solid fa-calendar-days"));
  if (firstPlain) firstPlain.before(sectionHeader(game.i18n.localize("DICEY.Holidays.AllYear"), "fa-solid fa-bomb"));
  if (firstDamage) firstDamage.before(sectionHeader(game.i18n.localize("DICEY.Holidays.DamageTypes"), "fa-solid fa-fire-flame-curved"));
  if (st.tab === "diceyHolidays") {
    grid.querySelector(".dicer-empty")?.remove();
    const unreadable = grid.querySelector(".dicer-unreadable");
    for (const node of placeholderCards(st)) grid.insertBefore(node, unreadable);
  }

  // Opening a tab with a set selected that is not in it: select its first card instead.
  if (st.pickFirst) {
    st.pickFirst = false;
    if (!grid.querySelector(".dicer-theme-card.is-selected")) cards[0]?.click();
  }
}

function onClick(app, ev) {
  if (ev.target.closest?.(".dicey-open-settings")) {
    ev.preventDefault();
    ev.stopPropagation();
    openSettings();
    return;
  }
  // A holiday placeholder: register its sets with Dicer, then show them.
  const later = ev.target.closest?.(".dicey-later[data-dicey-holiday]");
  if (later) {
    ev.preventDefault();
    ev.stopPropagation();
    later.classList.add("is-loading");
    loadHoliday(later.dataset.diceyHoliday);
    app.render();
    return;
  }
  if (ev.target.closest?.(".dicey-soon")) return;

  const btn = ev.target.closest?.(".dicer-segmented button[data-filter]");
  if (!btn || !ev.isTrusted) return;
  const st = stateOf(app);
  const filter = btn.dataset.filter;

  if (filter in TABS) {
    ev.preventDefault();
    ev.stopPropagation();
    if (st.tab === filter) return;
    st.tab = filter;
    st.pickFirst = true;
    // Our tabs draw from Dicer's All list; switching Dicer to All renders, otherwise render here.
    if (st.dicerFilter === "all") app.render();
    else app.element.querySelector('.dicer-segmented button[data-filter="all"]')?.click();
    return;
  }

  if (!st.tab) return;
  st.tab = null;
  // Dicer does not re-render when its own filter is already the one clicked.
  if (filter === st.dicerFilter) app.render();
}

const rerender = () => foundry.applications.instances.get(BROWSER_ID)?.render();

export function init() {
  Hooks.on("preRenderApplicationV2", prepare);
  Hooks.on("renderApplicationV2", render);
  onSettingsChange(rerender);
  Hooks.on("dicey.themesChanged", rerender);

  const api = game.modules.get(PACKAGE_ID).api;
  api.holidays = {
    calendar: HOLIDAYS,
    /** Holidays in season on a date (default today). */
    inSeason: (date = today()) => HOLIDAYS.filter((h) => standing(h, date)?.inSeason).map((h) => h.id),
    /** Dev: show holidays that are not released yet. Takes effect on reload. */
    drafts(on = true) {
      try {
        if (on) localStorage.setItem(`${PACKAGE_ID}.drafts`, "1");
        else localStorage.removeItem(`${PACKAGE_ID}.drafts`);
      } catch {}
      return "Reload Foundry (F5) to apply.";
    },
    /** Show the browser as on another day, e.g. preview("2026-12-20"); preview() goes back to today. */
    preview(isoDate) {
      previewDate = isoDate ? new Date(`${isoDate}T00:00:00`) : null;
      if (previewDate && Number.isNaN(previewDate.getTime())) previewDate = null;
      rerender();
      return today().toDateString();
    },
  };
}
