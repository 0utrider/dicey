/**
 * Feature registry. Each feature module exports:
 *   id      - settings namespace (camelCase)
 *   init()  - register settings, hooks, API (runs on Foundry `init`)
 *   ready() - optional; runtime setup (runs on `ready`)
 *
 * Add a feature: create features/<name>.js, import it here, append to FEATURES.
 */
import * as themes from "./themes.js";
import * as damageMap from "./damage-map.js";

export const FEATURES = [themes, damageMap];
