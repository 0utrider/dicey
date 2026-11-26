/**
 * Blinking LEDs in a die: a material hook for Dicer (`api.registerTheme(theme, { material })`).
 * Small lights sit at fixed spots in the die's own space, so they turn with it as it tumbles, each
 * blinking on its own beat. Added to the die's emission, so they glow over any body.
 *
 * A pack entry asks for it with `leds: { colors, density, size, strength, scale }`, all optional:
 *   colors    LED colours (hex strings, up to 6)
 *   density   0..1, share of grid cells that hold an LED (default 0.35)
 *   size      LED radius as a share of its cell (default 0.22)
 *   strength  brightness (default 1.6)
 *   scale     cells across a unit radius (default 3.2)
 *
 * Each LED beats every 1.2, 1.5, 2, 2.4 or 3 seconds: all divide Dicer's shared clock (`uTime` wraps
 * at 3600), so a blink never jumps at the wrap. Dicer leaves the hook off for the "safe" quality tier and ghost dice.
 */

const hex = (c) => {
  const n = parseInt(String(c).replace("#", ""), 16);
  const v = Number.isFinite(n) ? n : 0xffffff;
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255].map((x) => x.toFixed(3));
};
const num = (v, d, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** The fragment shader code for a set of options. */
export function ledChunk(opts = {}) {
  const colours = (Array.isArray(opts.colors) && opts.colors.length ? opts.colors : ["#ff3b3b", "#35d36b", "#ffd23f", "#3fa8ff"]).slice(0, 6);
  const density = num(opts.density, 0.35, 0.05, 1);
  const size = num(opts.size, 0.22, 0.08, 0.45);
  const strength = num(opts.strength, 1.6, 0.2, 6);
  const scale = num(opts.scale, 3.2, 1, 12);
  const palette = colours.map((c, i) => `if (i == ${i}) return vec3(${hex(c).join(", ")});`).join("\n\t");
  return `
float diceyLedHash(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
vec3 diceyLedColour(int i) {
	${palette}
	return vec3(1.0);
}
vec3 diceyLeds(vec3 pos) {
	vec3 q = pos * ${scale.toFixed(2)};
	vec3 cell = floor(q);
	vec3 total = vec3(0.0);
	for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
		vec3 c = cell + vec3(float(x), float(y), float(z));
		float h = diceyLedHash(c);
		if (h > ${density.toFixed(3)}) continue;
		vec3 centre = c + 0.2 + 0.6 * vec3(diceyLedHash(c + 7.1), diceyLedHash(c + 13.3), diceyLedHash(c + 29.7));
		float d = length(q - centre) / ${size.toFixed(3)};
		float spot = exp(-d * d * 4.0);
		float halo = 0.16 * exp(-d * 1.8);
		// each LED: its own beat (all of these divide the 3600 s clock) and phase
		int pi = int(mod(floor(h * 613.0), 5.0));
		float period = pi == 0 ? 1.2 : pi == 1 ? 1.5 : pi == 2 ? 2.0 : pi == 3 ? 2.4 : 3.0;
		float phase = fract(h * 91.7);
		float on = smoothstep(0.15, 0.55, 0.5 + 0.5 * sin(6.2831853 * (uTime / period + phase)));
		int ci = int(mod(floor(h * 977.0), ${colours.length}.0));
		total += diceyLedColour(ci) * (spot + halo) * mix(0.12, 1.0, on);
	}
	return total * ${strength.toFixed(2)};
}`;
}

/** A Dicer material (`{ cacheKey, beforeShaderCompile }`) for the options. */
export function ledMaterial(cacheKey, opts) {
  const chunk = ledChunk(opts);
  return {
    cacheKey,
    beforeShaderCompile(shader) {
      const hook = "#include <emissivemap_fragment>";
      if (!shader.fragmentShader.includes(hook)) throw new Error("emissivemap_fragment not found");
      shader.fragmentShader = shader.fragmentShader
        .replace("void main()", `${chunk}\nvoid main()`)
        .replace(hook, `${hook}\n\ttotalEmissiveRadiance += diceyLeds( vDicerPosition );`);
    },
  };
}
