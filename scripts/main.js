import { MODULE_ID } from "./constants.js";
import { FEATURES } from "./features/index.js";

function runPhase(phase) {
  for (const feature of FEATURES) {
    try {
      feature[phase]?.();
    } catch (err) {
      console.error(`${MODULE_ID} | feature "${feature.id}" failed during ${phase}`, err);
    }
  }
}

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = {};
  runPhase("init");
});

Hooks.once("ready", () => runPhase("ready"));
