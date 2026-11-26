import { PACKAGE_ID } from "../constants.js";
import { HOLIDAY_BY_ID, standing } from "../holiday-calendar.js";
import { effective } from "../settings.js";

/**
 * Pet hats: seasonal models Dicer's dice pets wear (Dicer's `registerPetAccessory`, which older Dicer
 * does not have: then nothing is registered). A hat is worn while its holiday is in season and this
 * user has not skipped that holiday. The effects test can put one on out of season (`forceHat`).
 *
 * `kinds` fits the hat to each pet: `scale`, `offset` in pet heights (x is the pet's left, y up,
 * z forward), `tilt` in degrees (x below 0 leans it back, z leans it sideways) and `bone`, another bone
 * of the pet's model than its head. `tilt` and `bone` need a Dicer that knows them; an older one leaves
 * the hat upright on the head.
 */

export const id = "petHats";

export const HATS = [
  {
    slug: "santa-hat",
    label: "DICEY.Hat.santa-hat",
    holiday: "christmas",
    model: "assets/models/santa-hat.glb", // tools/make-santa-hat.py
    kinds: {
      cat: { offset: { y: -0.18, z: -0.06 }, tilt: { x: -12 } }, // ears through
      fox: { offset: { y: -0.18 } }, // ears through
      owl: { offset: { z: -0.08 }, tilt: { x: -25, z: -15 } }, // eyes clear, over one ear
      mimic: { scale: 0.85, offset: { y: -0.6, z: -0.75 }, tilt: { x: -50 } }, // centred behind the lid's hinge, square to the open lid's top (the lid moves by shape keys, no bone)
      raven: { tilt: { x: -12 } },
      spider: { bone: "tail_1", offset: { y: 0.04, z: -0.15 }, tilt: { x: -20 } }, // on its rear hump, riding the abdomen's bone
      skull: { offset: { z: -0.05 }, tilt: { x: -20 } }, // on the crown of the skull
      drone: { offset: { y: -0.1, z: -0.05 }, tilt: { x: -15, z: -12 } }, // antenna beside it
      slime: { scale: 1.15, offset: { y: -0.08, z: -0.16 }, tilt: { x: -15 } }, // back, clear of the eyes
      frog: { offset: { y: -0.03, z: -0.12 }, tilt: { x: -15 } },
      ghost: { offset: { z: -0.05 }, tilt: { x: -20 } },
      mushroom: { offset: { z: -0.08 }, tilt: { x: -20 } },
      eye: { offset: { y: -0.08, z: -0.2 }, tilt: { x: -42 } }, // on the skin behind the eyeball
      golem: { offset: { y: -0.15, z: -0.1 }, tilt: { x: -20 } },
      lantern: { offset: { y: -0.2, z: -0.3 }, tilt: { x: -55 } }, // over the handle
      robot: { offset: { x: -0.15, z: -0.1 }, tilt: { x: -40 } }, // square on its slanted top, right half
      jester: { offset: { x: 0.2, y: -0.15 }, tilt: { z: -50 } }, // badly, over its own hat
    },
  },
];

const hatId = (hat) => `${PACKAGE_ID}.${hat.slug}`;
let forced = null; // the slug the effects test put on, or null: the calendar decides

/** Whether this Dicer can dress its pets. */
export const petHatsSupported = () => typeof game.modules.get("dicer")?.api?.registerPetAccessory === "function";

/** Whether `hat` is in season for this user (its holiday's window, and not skipped). */
export function hatInSeason(hat) {
  const holiday = HOLIDAY_BY_ID.get(hat.holiday);
  if (!holiday) return false;
  if (new Set(effective("holidaySkip") ?? []).has(hat.holiday)) return false;
  return !!standing(holiday)?.inSeason;
}

export const forcedHat = () => forced;

/** Registers every hat with Dicer (again: Dicer then dresses its pets anew). False when it cannot. */
function register() {
  const api = game.modules.get("dicer")?.api;
  if (typeof api?.registerPetAccessory !== "function") return false;
  for (const hat of HATS) {
    api.registerPetAccessory(PACKAGE_ID, {
      id: hatId(hat),
      model: `modules/${PACKAGE_ID}/${hat.model}`,
      kinds: hat.kinds,
      when: () => (forced ? forced === hat.slug : hatInSeason(hat)),
    });
  }
  return true;
}

/** Puts `slug` on every pet whatever the date (null: back to the calendar). This client only. */
export function forceHat(slug) {
  forced = HATS.some((h) => h.slug === slug) ? slug : null;
  register();
}

export function init() {
  Hooks.once("dicer.ready", () => {
    try {
      register();
    } catch (err) {
      console.warn(`${PACKAGE_ID} | could not register the pet hats`, err);
    }
  });
}
