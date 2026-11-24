/**
 * Dicey's settings as a declaration of the shared Outrider panel schema (schema 1, with the
 * `policy` flag and the `checklist` type proposed in om-outpost's HANDOFF-panel-dicey-policy-and-checklist).
 * `policy` is `true` (free, default or forced) or a list of the modes the GM may pick. Plain data: the window (settings-app.js) draws it, and Outpost can host it as is. Labels and
 * hints are i18n keys; defaults and scope come from the registration (settings.js), not from here.
 */
import { DATA_ID } from "./constants.js";
import { HOLIDAYS, standing } from "./holiday-calendar.js";

const L = (key) => `DICEY.Settings.${key}`;
const field = (key, type, extra = {}) => ({ key, type, label: L(`${key}.Name`), hint: L(`${key}.Hint`), policy: true, ...extra });

/** The holiday checklist's options, re-read when a value changes: [id, label, { icon, badge? }]. */
export const holidayOptions = (today = new Date()) =>
  HOLIDAYS.map((h) => [h.id, h.label, { icon: h.icon, ...(standing(h, today)?.inSeason && { badge: "DICEY.Holidays.InSeason" }) }]);

export const declaration = {
  schema: 1,
  id: DATA_ID,
  title: L("Title"),
  icon: "dice",
  sections: [
    {
      id: "holidays",
      label: L("Tab.holidays"),
      icon: "fa-solid fa-gift",
      groups: [
        {
          fields: [
            field("holidayDice", "switch"),
            field("holidayPick", "select", { options: [["featured", L("holidayPick.featured")], ["random", L("holidayPick.random")]] }),
            field("holidaySkip", "checklist", { store: "unchecked", optionsFn: holidayOptions }),
            field("holidayFx", "switch", { policy: ["free", "default"] }),
          ],
        },
      ],
    },
    {
      id: "browser",
      label: L("Tab.browser"),
      icon: "fa-solid fa-table-cells-large",
      groups: [{ fields: [field("holidaysInAll", "switch"), field("inSeasonFirst", "switch")] }],
    },
  ],
};
