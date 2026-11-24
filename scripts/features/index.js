/**
 * Feature registry. Each feature module exports:
 *   id      - settings namespace (camelCase)
 *   init()  - register settings, hooks, API (runs on Foundry `init`)
 *   ready() - optional; runtime setup (runs on `ready`)
 *
 * Add a feature: create features/<name>.js, import it here, append to FEATURES.
 */
import * as settings from "./settings.js";
import * as themes from "./themes.js";
import * as damageMap from "./damage-map.js";
import * as holidays from "./holidays.js";
import * as holidayDice from "./holiday-dice.js";
import * as holidayFx from "./holiday-fx.js";
import * as welcome from "./welcome.js";
import * as content from "./content.js";

export const FEATURES = [settings, themes, damageMap, holidays, holidayDice, holidayFx, welcome, content];
