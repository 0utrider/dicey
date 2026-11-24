import { registerSettings } from "../settings.js";
import { registerMenu } from "../settings-app.js";

/** Settings and the settings window. First in the feature list: other features read settings. */
export const id = "settings";

export function init() {
  registerSettings();
  registerMenu();
}
