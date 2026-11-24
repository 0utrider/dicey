/** The prod package id. Use it for settings, flags and stored theme ids, so a dev build works on the world's real data. */
export const DATA_ID = "dicey";

/**
 * The id this copy is installed under, read from the module's own folder: "dicey" for prod,
 * "dicey-dev" for a dev build. Use it for file paths, the socket channel and compendium references.
 */
export const PACKAGE_ID = new URL(import.meta.url).pathname.match(/\/modules\/([^/]+)\//)?.[1] ?? DATA_ID;

/** True when this is a dev build and the prod module is also active in the world; the dev build then stays idle. */
export const prodActive = () => PACKAGE_ID !== DATA_ID && !!game.modules.get(DATA_ID)?.active;

/**
 * Namespace for theme ids registered with Dicer. Theme ids end up in world data (damage map, actor
 * choices), so they use DATA_ID. Dicer only accepts the id of an installed module, so a dev build
 * on a machine without the prod module falls back to its own id.
 */
export const themeScope = () => (game.modules.get(DATA_ID) ? DATA_ID : PACKAGE_ID);
