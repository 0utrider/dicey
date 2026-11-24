/**
 * Holiday windows. Each holiday has a `window(year)` that returns the [start, end] dates (local time,
 * both days inclusive) of the run that belongs to that year. A window may start in the year before,
 * as New Year does. Windows overlap on purpose where holidays run into each other.
 *
 * Plain date math, no Foundry calls, so it can be tested on its own.
 */

/** A local date at midnight. Month is 1-based. */
const d = (y, m, day) => new Date(y, m - 1, day);

const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** The nth weekday (0 = Sunday) of a month. */
function nthWeekday(y, m, weekday, n) {
  const first = d(y, m, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return d(y, m, 1 + offset + (n - 1) * 7);
}

/** Western (Gregorian) Easter Sunday, anonymous Gregorian algorithm. */
export function easter(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const dd = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return d(y, month, day);
}

/** US Thanksgiving: the fourth Thursday of November. */
export const thanksgiving = (y) => nthWeekday(y, 11, 4, 4);

/** Lunar New Year (first day). Lunisolar, so a table; outside it the window falls back to a broad span. */
const LUNAR_NEW_YEAR = {
  2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13],
  2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [2, 8],
};

function lunarNewYearWindow(y) {
  const known = LUNAR_NEW_YEAR[y];
  if (!known) return [d(y, 1, 21), d(y, 2, 20)];
  const day = d(y, ...known);
  // Two weeks of lead-in, one week after.
  return [addDays(day, -14), addDays(day, 7)];
}

/**
 * The calendar, in year order. `icon` is a Font Awesome class for the card badge. `label` is an
 * i18n key.
 */
export const HOLIDAYS = [
  { id: "new-year", label: "DICEY.Holiday.new-year", icon: "fa-solid fa-champagne-glasses",
    window: (y) => [d(y - 1, 12, 20), d(y, 1, 7)] },
  { id: "lunar-new-year", label: "DICEY.Holiday.lunar-new-year", icon: "fa-solid fa-dragon",
    window: lunarNewYearWindow },
  { id: "valentines", label: "DICEY.Holiday.valentines", icon: "fa-solid fa-heart",
    window: (y) => [d(y, 2, 1), d(y, 2, 15)] },
  // Two weeks up to Fat Tuesday, 47 days before Easter.
  { id: "mardi-gras", label: "DICEY.Holiday.mardi-gras", icon: "fa-solid fa-masks-theater",
    window: (y) => [addDays(easter(y), -61), addDays(easter(y), -47)] },
  { id: "st-patricks", label: "DICEY.Holiday.st-patricks", icon: "fa-solid fa-clover",
    window: (y) => [d(y, 3, 1), d(y, 3, 18)] },
  { id: "easter", label: "DICEY.Holiday.easter", icon: "fa-solid fa-egg",
    window: (y) => [addDays(easter(y), -14), addDays(easter(y), 1)] },
  { id: "earth-day", label: "DICEY.Holiday.earth-day", icon: "fa-solid fa-earth-americas",
    window: (y) => [d(y, 4, 15), d(y, 4, 23)] },
  { id: "summer-solstice", label: "DICEY.Holiday.summer-solstice", icon: "fa-solid fa-sun",
    window: (y) => [d(y, 6, 14), d(y, 6, 28)] },
  { id: "independence-day", label: "DICEY.Holiday.independence-day", icon: "fa-solid fa-flag-usa",
    window: (y) => [d(y, 6, 25), d(y, 7, 6)] },
  { id: "halloween", label: "DICEY.Holiday.halloween", icon: "fa-solid fa-ghost",
    window: (y) => [d(y, 10, 1), d(y, 11, 1)] },
  { id: "day-of-the-dead", label: "DICEY.Holiday.day-of-the-dead", icon: "fa-solid fa-skull",
    window: (y) => [d(y, 10, 28), d(y, 11, 3)] },
  { id: "veterans-day", label: "DICEY.Holiday.veterans-day", icon: "fa-solid fa-medal",
    window: (y) => [d(y, 11, 4), d(y, 11, 18)] },
  // Through the long weekend.
  { id: "thanksgiving", label: "DICEY.Holiday.thanksgiving", icon: "fa-solid fa-drumstick-bite",
    window: (y) => [addDays(thanksgiving(y), -14), addDays(thanksgiving(y), 3)] },
  // From the day after Thanksgiving, so the two share the long weekend.
  { id: "christmas", label: "DICEY.Holiday.christmas", icon: "fa-solid fa-tree",
    window: (y) => [addDays(thanksgiving(y), 1), d(y, 12, 26)] },
  { id: "winter-solstice", label: "DICEY.Holiday.winter-solstice", icon: "fa-solid fa-snowflake",
    window: (y) => [d(y, 12, 14), d(y, 12, 28)] },
];

export const HOLIDAY_BY_ID = new Map(HOLIDAYS.map((h) => [h.id, h]));

const startOfDay = (date) => d(date.getFullYear(), date.getMonth() + 1, date.getDate());

/**
 * Where a holiday stands on a date: `{ inSeason, start, end }` for the window that contains the date,
 * or else the next one to start.
 */
export function standing(holiday, date = new Date()) {
  const today = startOfDay(date);
  const y = today.getFullYear();
  let next = null;
  for (const year of [y - 1, y, y + 1, y + 2]) {
    const [start, end] = holiday.window(year);
    if (today >= start && today <= end) return { inSeason: true, start, end };
    if (start > today && (!next || start < next.start)) next = { inSeason: false, start, end };
  }
  return next;
}

/** Days from `date` until the holiday's window starts (0 when in season). */
export function daysUntil(holiday, date = new Date()) {
  const s = standing(holiday, date);
  if (!s || s.inSeason) return 0;
  return Math.round((s.start - startOfDay(date)) / 86_400_000);
}
