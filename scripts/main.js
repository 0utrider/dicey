import { DATA_ID, PACKAGE_ID, prodActive } from "./constants.js";
import { FEATURES } from "./features/index.js";

function runPhase(phase) {
  for (const feature of FEATURES) {
    try {
      feature[phase]?.();
    } catch (err) {
      console.error(`${PACKAGE_ID} | feature "${feature.id}" failed during ${phase}`, err);
    }
  }
}

Hooks.once("init", () => {
  if (prodActive()) return;
  game.modules.get(PACKAGE_ID).api = {};
  runPhase("init");
});

Hooks.once("ready", () => {
  if (prodActive()) {
    ui.notifications.error(
      `${PACKAGE_ID} is not loaded because ${DATA_ID} is active in this world. Disable one of them.`,
      { permanent: true },
    );
    return;
  }
  runPhase("ready");
});
