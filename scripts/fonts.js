import { PACKAGE_ID } from "./constants.js";

/**
 * Fonts Dicey ships for dice numbers (assets/fonts, licenses beside each file). Packs name them as
 * "dicey:<key>"; at registration they become Dicer's "file:<path>" form, which Dicer turns into a
 * digit atlas at runtime. The path uses PACKAGE_ID so a dev build reads its own copy.
 */
export const FONTS = {
  lexend: { file: "Lexend-Bold.woff2", label: "Lexend", use: "readable sans, any material" },
  "zilla-slab": { file: "ZillaSlab-Bold.woff2", label: "Zilla Slab", use: "readable slab serif" },
  "patrick-hand": { file: "PatrickHand-Regular.woff2", label: "Patrick Hand", use: "neat handwriting" },
  "mountains-of-christmas": { file: "MountainsOfChristmas-Bold.woff2", label: "Mountains of Christmas", use: "festive" },
  "press-start-2p": { file: "PressStart2P-Regular.woff2", label: "Press Start 2P", use: "retro pixel" },
  cinzel: { file: "Cinzel-Bold.woff2", label: "Cinzel", use: "classical capitals, stately" },
  "pirata-one": { file: "PirataOne-Regular.woff2", label: "Pirata One", use: "blackletter with a pirate swagger" },
  "chakra-petch": { file: "ChakraPetch-Bold.woff2", label: "Chakra Petch", use: "squared sci-fi numerals" },
  "grenze-gotisch": { file: "GrenzeGotisch-SemiBold.woff2", label: "Grenze Gotisch", use: "gothic, readable at small sizes" },
  "berkshire-swash": { file: "BerkshireSwash-Regular.woff2", label: "Berkshire Swash", use: "festive, storybook" },
  "elsie-swash-caps": { file: "ElsieSwashCaps-Black.woff2", label: "Elsie Swash Caps", use: "festive, whimsical, magic" },
  creepster: { file: "Creepster-Regular.woff2", label: "Creepster", use: "B-movie horror, dripping" },
  "metal-mania": { file: "MetalMania-Regular.woff2", label: "Metal Mania", use: "dark fantasy, gothic horror" },
  nosifer: { file: "Nosifer-Regular.woff2", label: "Nosifer", use: "melting horror; its drips hang low, so the digits sit high on the face" },
  dynapuff: { file: "DynaPuff-SemiBold.woff2", label: "DynaPuff", use: "bouncy, bubbly, cheerful" },
  "alfa-slab-one": { file: "AlfaSlabOne-Regular.woff2", label: "Alfa Slab One", use: "woodblock poster" },
  "black-ops-one": { file: "BlackOpsOne-Regular.woff2", label: "Black Ops One", use: "military stencil" },
};

/** Dicer's font value for a pack's font value: "dicey:<key>" becomes a file path, anything else passes. */
export function resolveFont(font) {
  if (typeof font !== "string" || !font.startsWith("dicey:")) return font;
  const f = FONTS[font.slice(6)];
  return f ? `file:modules/${PACKAGE_ID}/assets/fonts/${f.file}` : undefined;
}

/**
 * Offers every font above in Dicer's appearance editor, as a row of buttons under Dicey's name
 * (api.registerFont, Dicer 1.4.16 and later). A pick there is the same `file:` font a pack names.
 */
export function registerFonts(api) {
  if (typeof api?.registerFont !== "function") return;
  for (const [key, f] of Object.entries(FONTS)) {
    api.registerFont(PACKAGE_ID, { id: `${PACKAGE_ID}.${key}`, label: f.label, file: `modules/${PACKAGE_ID}/assets/fonts/${f.file}` });
  }
}
