import { PACKAGE_ID } from "./constants.js";
import { effective } from "./settings.js";
import { hanukkahNight } from "./holiday-calendar.js";

/**
 * Dicey's own screen effects: light drawings (SVG and CSS, no images) laid over the board for a few
 * seconds, with an optional sound. A set names one in its pack: `screen: { nat20: "lights-xmas", nat1: "lights-krampus" }`.
 * Names are `<kind>-<holiday>` (`lights-xmas`, `candles-hanukkah`) so other holidays can add their own.
 *
 *   lights-xmas     a pine garland round the screen with holly, small bulbs blinking in it (silent: the set's jingle plays)
 *   lights-krampus  the same garland wrecked: swags snapped, torn or gone, scraps of pine, holly
 *                   trodden flat, dead, flickering and fallen bulbs, snapped wires sparking
 *   candles-hanukkah      a menorah on the hotbar with tonight's candles lighting: shamash, then left to right
 *   candles-hanukkah-out  the same menorah, its flames going out one by one, each with a wisp of smoke
 *   leaves   autumn leaves drifting down the screen
 *   snow     soft snowflakes falling; snow-silent-night falls longer, through the music box tune
 *   coins    foil-wrapped gelt, gold and silver, tumbling down
 *   splat    gravy (or jelly) thrown at the glass, dripping down; splat-cranberry, splat-pie, splat-jelly
 *   splat-small  a little gravy beside each die that just landed, for ordinary rolls
 *   dreidel  a four-sided dreidel spins, wobbles and falls to show gimel (dreidel-win, gelt spills) or nun (dreidel-nun)
 *
 * Every client draws its own copy. Nothing here touches the canvas. Reduced motion keeps the
 * drawing but stops the blinking and swaying (see styles/screen-fx.css).
 */

const NS = "http://www.w3.org/2000/svg";
const BULB_COLOURS = ["#ff3b3b", "#35d36b", "#ffd23f", "#3fa8ff", "#ff7bd0"];
const el = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
};
const rand = (a, b) => a + Math.random() * (b - a);
const sound = (file, volume) => ({ src: `modules/${PACKAGE_ID}/assets/sounds/${file}`, volume });

/** A point on a quadratic curve [p0, c, p1] at t, and the curve's sideways normal there. */
const quad = (p0, c, p1) => (t) => [0, 1].map((k) => (1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * c[k] + t * t * p1[k]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * A small bulb at p, pointing along the unit vector n turned by `tilt` degrees: socket, glass and a
 * highlight. `state` is "lit", "dead" or "flicker".
 */
function bulb(parent, p, n, colour, i, state = "lit", tilt = 0, size = 0.8) {
  const angle = (Math.atan2(n[1], n[0]) * 180) / Math.PI - 90 + tilt;
  const outer = el("g", { transform: `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${size})` }, parent);
  // drawn pointing down (+y); the outer group turns it
  const g = el("g", { class: `dicey-bulb dicey-${state} dicey-p${i % 3}`, style: `--c:${colour};--d:${(i % 7) * 0.13}s` }, outer);
  el("rect", { x: -4, y: -3, width: 8, height: 9, rx: 1.5, fill: "#1b3a24" }, g);
  el("ellipse", { class: "dicey-glass", cx: 0, cy: 14, rx: 7, ry: 10, fill: colour }, g);
  el("ellipse", { cx: -2.2, cy: 11, rx: 2, ry: 3.4, fill: "#fff", opacity: 0.7 }, g);
}

/**
 * The swags of a garland all the way round the screen, as quadratic curves sagging inward, with the
 * inward normal of their edge. Ties sit just past the edge, about every 280 px.
 */
function swags(w, h, jitter = false) {
  const e = -6;
  const corners = [[e, e], [w - e, e], [w - e, h - e], [e, h - e]];
  const normals = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const out = [];
  corners.forEach((a, side) => {
    const b = corners[(side + 1) % 4];
    const n = normals[side];
    const count = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 280));
    // tie points along the edge, nudged off the even spacing when `jitter` asks for it
    const at = Array.from({ length: count + 1 }, (_, i) => (i === 0 || i === count || !jitter ? i / count : (i + rand(-0.3, 0.3)) / count));
    for (let i = 0; i < count; i++) {
      const p0 = lerp(a, b, at[i]);
      const p1 = lerp(a, b, at[i + 1]);
      const m = lerp(p0, p1, jitter ? rand(0.35, 0.65) : 0.5);
      const sag = jitter ? rand(16, 40) : 26;
      out.push({ p0, p1, c: [m[0] + n[0] * sag * 2, m[1] + n[1] * sag * 2], n });
    }
  });
  return out;
}

/** Pine needles along curves (functions t -> [x, y]): a dark core, then three greens. */
function pine(parent, curves) {
  const g = el("g", { class: "dicey-garland" }, parent);
  const shades = ["#123a1e", "#24602f", "#3f8a48"];
  const needles = shades.map(() => []);
  const core = [];
  for (const { curve, len } of curves) {
    const steps = Math.max(6, Math.round(len / 4.5));
    const line = [];
    for (let k = 0; k <= steps; k++) {
      const [cx, cy] = curve(k / steps);
      line.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
      for (let j = 0; j < 4; j++) {
        const ang = rand(0, Math.PI * 2);
        const l = rand(7, 15);
        const off = rand(-5, 5);
        needles[(k + j) % 3].push(`M${(cx + off * Math.sin(ang)).toFixed(1)},${(cy + off * Math.cos(ang)).toFixed(1)}l${(Math.cos(ang) * l).toFixed(1)},${(Math.sin(ang) * l).toFixed(1)}`);
      }
    }
    core.push(`M${line.join(" L")}`);
  }
  el("path", { d: core.join(" "), fill: "none", stroke: "#0e2c17", "stroke-width": 13, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  needles.forEach((list, i) => el("path", { d: list.join(""), fill: "none", stroke: shades[i], "stroke-width": 2.2, "stroke-linecap": "round" }, g));
}

/** Bulbs woven along a curve, about every 46 px, each at its own angle. */
function weave(parent, curve, len, n, start, state = () => "lit") {
  const count = Math.max(1, Math.round(len / 46));
  for (let j = 0; j < count; j++) {
    const i = start + j;
    const p = curve((j + 0.5) / count);
    bulb(parent, p, n, BULB_COLOURS[i % BULB_COLOURS.length], i, state(i), rand(-35, 35), rand(0.7, 0.9));
  }
  return count;
}

const curveLength = (curve) => {
  let len = 0;
  let prev = curve(0);
  for (let k = 1; k <= 12; k++) {
    const next = curve(k / 12);
    len += Math.hypot(next[0] - prev[0], next[1] - prev[1]);
    prev = next;
  }
  return len;
};

/** Christmas lights: a pine garland round the whole screen, bulbs blinking in it, holly at the ties. */
function lightsXmas(svg, w, h) {
  const list = swags(w, h).map((s) => {
    const curve = quad(s.p0, s.c, s.p1);
    return { ...s, curve, len: curveLength(curve) };
  });
  pine(svg, list);
  let i = 0;
  for (const s of list) i += weave(svg, s.curve, s.len, s.n, i);
  for (const s of list) holly(svg, Math.min(w - 14, Math.max(14, s.p0[0])), Math.min(h - 14, Math.max(14, s.p0[1])), 1, rand(0, 360));
}

/** A spray of sparks at p that keeps flaring. */
function sparks(parent, p) {
  const g = el("g", { class: "dicey-sparks", transform: `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})` }, parent);
  const delay = rand(0, 0.8).toFixed(2);
  el("circle", { class: "dicey-spark-core", r: 4, fill: "#fffbe0", style: `--sd:${delay}s` }, g);
  for (let k = 0; k < 7; k++) {
    const a = rand(0, Math.PI * 2);
    const l = rand(16, 34);
    el("path", { class: "dicey-spark", d: `M${(Math.cos(a) * 3).toFixed(1)},${(Math.sin(a) * 3).toFixed(1)} l${(Math.cos(a) * l).toFixed(1)},${(Math.sin(a) * l + rand(4, 10)).toFixed(1)}`, style: `--sd:${(+delay + rand(0, 0.25)).toFixed(2)}s` }, g);
  }
}

/** Furthest any wreckage reaches into the screen, in px: it should frame the board, not cover it. */
const DEPTH = 90;

/** The part of a curve between t0 and t1, as a curve of its own. */
const part = (curve, t0, t1) => (t) => curve(t0 + (t1 - t0) * t);

/**
 * A loose end hanging from `a` (on the edge): it reaches into the screen by at most `reach`, drifting
 * along the edge toward `b` and, on a side edge, down. Returns its curve.
 */
function hang(a, b, n, reach) {
  const depth = Math.min(DEPTH, reach);
  const slide = lerp(a, b, rand(0.15, 0.45));
  const fall = n[0] !== 0 ? rand(10, 50) : 0;
  const end = [slide[0] + n[0] * depth, slide[1] + n[1] * depth + fall];
  const bend = rand(0.3, 0.7);
  const c = [a[0] + (end[0] - a[0]) * bend + n[0] * rand(-15, 10), a[1] + (end[1] - a[1]) * (1 - bend) + n[1] * rand(-15, 10)];
  return quad(a, c, end);
}

/** A point within `depth` px of a random edge, and that edge's inward normal. */
function nearEdge(w, h, lo, hi) {
  const side = Math.floor(Math.random() * 4);
  const along = rand(0.03, 0.97);
  const d = rand(lo, hi);
  return [
    [[along * w, d], [0, 1]],
    [[w - d, along * h], [-1, 0]],
    [[along * w, h - d], [0, -1]],
    [[d, along * h], [1, 0]],
  ][side];
}

/** A holly leaf or berry knocked loose and trodden on: flattened, bruised, the berries split. */
function squashed(parent, p) {
  const g = el("g", { transform: `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${rand(0, 360).toFixed(0)})` }, parent);
  const LEAF = "M0,0 L6,-6 L10,-3 L15,-9 L19,-4 L25,-8 L30,0 L25,8 L19,4 L15,9 L10,3 L6,6 Z";
  const kind = Math.random();
  if (kind < 0.55) {
    // a leaf, flattened and bruised; sometimes torn short
    const fill = ["#1f6b33", "#2c5a24", "#3d5a26", "#4b5523"][Math.floor(Math.random() * 4)];
    const leaf = el("g", { transform: `scale(${rand(0.7, 1.05).toFixed(2)} ${rand(0.35, 0.8).toFixed(2)}) translate(-15 0)` }, g);
    const torn = Math.random() < 0.4;
    const shape = torn ? "M0,0 L6,-6 L10,-3 L15,-9 L18,-3 L16,1 L19,5 L15,9 L10,3 L6,6 Z" : LEAF;
    el("path", { d: shape, fill, stroke: "#0f3a1c", "stroke-width": 1, "stroke-linejoin": "round" }, leaf);
    el("path", { d: torn ? "M2,0 L16,0" : "M2,0 L27,0", stroke: "#6a8a4a", "stroke-width": 1, opacity: 0.45 }, leaf);
  } else {
    // berries: a whole one or two, and a squashed one with a smear of juice
    for (let k = 0, m = 1 + Math.floor(Math.random() * 2); k < m; k++) {
      el("circle", { cx: rand(-8, 8), cy: rand(-8, 8), r: rand(3.4, 4.6), fill: "#c4161c", stroke: "#7a0c10", "stroke-width": 0.8 }, g);
    }
    const sx = rand(5, 8);
    el("path", { d: `M${-sx},0 Q${-sx * 0.5},${-rand(2, 4)} 0,${-rand(1, 3)} Q${sx * 0.6},${-rand(2, 4)} ${sx},0 Q${sx * 0.4},${rand(2, 4)} 0,${rand(1.5, 3)} Q${-sx * 0.5},${rand(2, 4)} ${-sx},0 Z`, fill: "#8e0d16", opacity: 0.85 }, g);
    el("ellipse", { cx: rand(-2, 2), cy: 0, rx: sx * 0.45, ry: 1.6, fill: "#d8243a" }, g);
  }
}

/**
 * Krampus got to the lights: the same garland as lights-xmas, each swag wrecked its own way (left up,
 * sagging, torn short, snapped, hanging from one end, gone), bulbs dead, flickering or fallen out,
 * holly trodden flat, scraps of pine, and sparks at the broken ends. Nothing reaches more than
 * DEPTH px into the screen.
 */
function lightsKrampus(svg, w, h) {
  const pieces = [];
  const ends = [];
  const ties = [];
  for (const s of swags(w, h, true)) {
    const curve = quad(s.p0, s.c, s.p1);
    const roll = Math.random();
    if (roll < 0.22) {
      pieces.push({ curve, n: s.n });
      ties.push(s.p0);
    } else if (roll < 0.42) {
      // torn: only a stretch of it is left, ragged at both ends
      const t0 = rand(0, 0.35);
      const t1 = rand(0.5, 1);
      pieces.push({ curve: part(curve, t0, t1), n: s.n });
      if (t0 > 0.05) ends.push(curve(t0));
      if (t1 < 0.95) ends.push(curve(t1));
      if (t0 < 0.1) ties.push(s.p0);
    } else if (roll < 0.64) {
      // snapped: both halves hang loose
      for (const [from, to] of [[s.p0, s.p1], [s.p1, s.p0]]) {
        if (Math.random() < 0.85) {
          const c = hang(from, to, s.n, rand(30, DEPTH));
          pieces.push({ curve: c, n: s.n });
          ends.push(c(1));
        }
      }
    } else if (roll < 0.84) {
      // one tie gave way: it hangs from the other end
      const [from, to] = Math.random() < 0.5 ? [s.p0, s.p1] : [s.p1, s.p0];
      const c = hang(from, to, s.n, rand(55, DEPTH));
      pieces.push({ curve: c, n: s.n });
      ends.push(c(1));
    }
    // else: gone
  }
  // scraps of pine, few or many, short or long
  for (let k = 0, m = 4 + Math.floor(Math.random() * 8); k < m; k++) {
    const [base] = nearEdge(w, h, 6, DEPTH - 20);
    const a = rand(0, Math.PI * 2);
    const l = rand(12, 50);
    const p0 = [base[0] - (Math.cos(a) * l) / 2, base[1] - (Math.sin(a) * l) / 2];
    const p1 = [base[0] + (Math.cos(a) * l) / 2, base[1] + (Math.sin(a) * l) / 2];
    pieces.push({ curve: quad(p0, [base[0] + rand(-10, 10), base[1] + rand(-10, 10)], p1), n: [0, 1], scrap: true });
  }
  for (const piece of pieces) piece.len = curveLength(piece.curve);
  pine(svg, pieces);
  // trodden holly under the lights
  for (let k = 0, m = 10 + Math.floor(Math.random() * 12); k < m; k++) squashed(svg, nearEdge(w, h, 4, DEPTH - 10)[0]);
  const state = () => {
    const roll = Math.random();
    return roll < 0.5 ? "dead" : roll < 0.8 ? "flicker" : "lit";
  };
  let i = 0;
  for (const piece of pieces) {
    if (piece.scrap) continue;
    // bulbs at uneven gaps, some missing
    const count = Math.max(1, Math.round(piece.len / rand(38, 60)));
    for (let j = 0; j < count; j++, i++) {
      if (Math.random() < 0.2) continue;
      const t = Math.min(0.98, Math.max(0.02, (j + rand(0.2, 0.8)) / count));
      bulb(svg, piece.curve(t), piece.n, BULB_COLOURS[Math.floor(Math.random() * BULB_COLOURS.length)], i, state(), rand(-60, 60), rand(0.65, 0.9));
    }
  }
  // bulbs that fell out, lying anywhere along the edge
  for (let k = 0, m = 3 + Math.floor(Math.random() * 5); k < m; k++, i++) {
    const [p, n] = nearEdge(w, h, 8, DEPTH - 15);
    bulb(svg, p, n, BULB_COLOURS[Math.floor(Math.random() * BULB_COLOURS.length)], i, Math.random() < 0.75 ? "dead" : "flicker", rand(-180, 180), rand(0.6, 0.8));
  }
  // a few snapped wire ends trailing in from any edge
  const wires = el("g", { class: "dicey-wire dicey-wire-broken" }, svg);
  for (let k = 0, m = 1 + Math.floor(Math.random() * 3); k < m; k++) {
    const [p, n] = nearEdge(w, h, -6, -6);
    const len = rand(30, DEPTH - 10);
    const side = [-n[1], n[0]];
    const lean = rand(-25, 25);
    const tip = [p[0] + n[0] * len + side[0] * lean, p[1] + n[1] * len + side[1] * lean];
    const c = [p[0] + n[0] * len * 0.5 + side[0] * rand(-20, 20), p[1] + n[1] * len * 0.5 + side[1] * rand(-20, 20)];
    el("path", { d: `M${p[0].toFixed(1)},${p[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${tip[0].toFixed(1)},${tip[1].toFixed(1)}` }, wires);
    ends.push(tip);
  }
  // what holly survived on the ties
  for (const t of ties) if (Math.random() < 0.55) holly(svg, Math.min(w - 14, Math.max(14, t[0])), Math.min(h - 14, Math.max(14, t[1])), rand(0.85, 1.05), rand(0, 360));
  // sparks on some of the broken ends, not all
  for (const p of ends) if (Math.random() < 0.55) sparks(svg, p);
}

/** A sprig of holly at (x, y): three spiky leaves and three berries. */
function holly(parent, x, y, scale = 1, turn = 0) {
  const g = el("g", { class: "dicey-holly", transform: `translate(${x} ${y}) rotate(${turn}) scale(${scale})` }, parent);
  const LEAF = "M0,0 L6,-6 L10,-3 L15,-9 L19,-4 L25,-8 L30,0 L25,8 L19,4 L15,9 L10,3 L6,6 Z";
  for (const [angle, fill] of [[-28, "#1f6b33"], [200, "#185a2b"], [96, "#237a3a"]]) {
    const leaf = el("g", { transform: `rotate(${angle})` }, g);
    el("path", { d: LEAF, fill, stroke: "#0f3a1c", "stroke-width": 1, "stroke-linejoin": "round" }, leaf);
    el("path", { d: "M2,0 L27,0", stroke: "#4fa060", "stroke-width": 1, opacity: 0.6 }, leaf);
  }
  for (const [bx, by] of [[-4, -3], [4, -4], [0, 4]]) {
    el("circle", { cx: bx, cy: by, r: 4.6, fill: "#c4161c", stroke: "#7a0c10", "stroke-width": 0.8 }, g);
    el("circle", { cx: bx - 1.4, cy: by - 1.5, r: 1.3, fill: "#fff", opacity: 0.65 }, g);
  }
}

/** A candle flame, its base at the origin: the body, and a wider glow drawn round it. */
const FLAME = "M0,0 C5,-2 6.5,-10 4,-18 C2.5,-24 1,-29 0,-34 C-1,-29 -2.5,-24 -4,-18 C-6.5,-10 -5,-2 0,0 Z";

function defs(svg) {
  const d = el("defs", {}, svg);
  const stops = (grad, list) => list.forEach(([offset, colour]) => el("stop", { offset, "stop-color": colour }, grad));
  // brass turned on a lathe: dark at the edges, a bright band just left of centre
  stops(el("linearGradient", { id: "dicey-brass", x1: "0", x2: "1", y1: "0", y2: "0" }, d), [
    ["0", "#4a330e"], ["0.18", "#8f6820"], ["0.4", "#f3d98a"], ["0.52", "#d3a644"], ["0.8", "#7a5718"], ["1", "#3d2a0b"],
  ]);
  stops(el("linearGradient", { id: "dicey-wax", x1: "0", x2: "1", y1: "0", y2: "0" }, d), [
    ["0", "#a89c82"], ["0.28", "#e9dfc6"], ["0.45", "#fffaef"], ["0.7", "#e3d8bd"], ["1", "#968a71"],
  ]);
  // warm light the flame throws down the top of its candle
  stops(el("linearGradient", { id: "dicey-wax-glow", x1: "0", x2: "0", y1: "0", y2: "1" }, d), [
    ["0", "rgba(255,186,90,.55)"], ["1", "rgba(255,186,90,0)"],
  ]);
  stops(el("linearGradient", { id: "dicey-flame", x1: "0", x2: "0", y1: "1", y2: "0" }, d), [
    ["0", "#fff8de"], ["0.35", "#ffe07a"], ["0.7", "#ffab33"], ["1", "#ff7a1a"],
  ]);
  stops(el("radialGradient", { id: "dicey-flame-glow", cx: "50%", cy: "80%", r: "65%" }, d), [
    ["0", "rgba(255,200,90,.9)"], ["0.6", "rgba(255,130,30,.45)"], ["1", "rgba(255,90,0,0)"],
  ]);
  stops(el("radialGradient", { id: "dicey-halo" }, d), [
    ["0", "rgba(255,196,110,.42)"], ["0.45", "rgba(255,170,70,.14)"], ["1", "rgba(255,150,40,0)"],
  ]);
  const blur = (id, sd) => el("feGaussianBlur", { stdDeviation: sd }, el("filter", { id, x: "-50%", y: "-50%", width: "200%", height: "200%" }, d));
  blur("dicey-soft", 1.1);
  blur("dicey-shadow", 5);
}

let nightOverride = null;
/** For testing: draw night `n` (1 to 8) instead of tonight's; null goes back to the calendar. */
export function setMenorahNight(n) {
  nightOverride = n >= 1 && n <= 8 ? Math.round(n) : null;
}
/** The night the menorah shows: tonight's night of Hanukkah, or all eight outside it. */
export const menorahNight = () => nightOverride ?? hanukkahNight() ?? 8;

/** The eight cups, left to right, with the shamash (4) in the middle. */
const CUPS = [0, 1, 2, 3, 5, 6, 7, 8];

/**
 * A Hanukkah menorah standing on the hotbar: a domed foot and turned stem, four nested arms rising to
 * a level row of eight cups, the shamash raised in the middle. It holds tonight's candles
 * (`menorahNight`): on night n, n candles in the rightmost cups. Lighting follows custom: the shamash
 * first, then the candles left to right, the newest first. Put out (`out`), the flames gutter in a
 * loose order, the shamash last, each leaving a wisp of smoke.
 */
function menorah(svg, w, h, out = false) {
  defs(svg);
  const DARK = "#4a330e";
  const BRASS = "#b8862a";
  const SHINE = "#f6dc8e";
  const GAP = 40; // between cups
  const DEPTH = 0.6; // each arm is a half ellipse this deep for its half-width
  const LOW = -66; // where the outer arm meets the stem: high enough to leave a bare stem below
  const CUP = LOW - 4 * GAP * DEPTH; // the cups' rim, all at one height
  const RAISE = 14; // how much higher the shamash sits
  const CANDLE = 46;
  const night = menorahNight();
  const used = CUPS.slice(8 - night);
  // about 340 units wide and 250 tall: keep it modest, inside half the width and under a third of the height
  const s = Math.min(1.1, (w * 0.5) / 340, (h * 0.3) / 250);
  // stand it on the hotbar (or the screen's foot), not behind it
  const hotbar = document.getElementById("hotbar")?.getBoundingClientRect();
  const floor = hotbar?.height ? hotbar.top - 10 : h - 12;
  const base = Math.min(h - 12, floor);
  const group = el("g", { transform: `translate(${w / 2} ${base}) scale(${s})` }, svg);
  el("ellipse", { cx: 0, cy: 2, rx: 78, ry: 7, fill: "rgba(0,0,0,.45)", filter: "url(#dicey-shadow)" }, group);
  const metal = el("g", { class: "dicey-menorah" }, group);
  // arms: for each pair of cups, a half ellipse from the left cup down to the stem and up to the right one, drawn as a tube
  for (let k = 4; k >= 1; k--) {
    const x = k * GAP;
    const ry = x * DEPTH;
    const c = 0.5523; // cubic Bezier quarter-ellipse handle
    const d = `M${-x},${CUP} C${-x},${CUP + c * ry} ${-c * x},${CUP + ry} 0,${CUP + ry} C${c * x},${CUP + ry} ${x},${CUP + c * ry} ${x},${CUP}`;
    el("path", { d, fill: "none", stroke: DARK, "stroke-width": 6.4, "stroke-linecap": "round" }, metal);
    el("path", { d, fill: "none", stroke: BRASS, "stroke-width": 4.6, "stroke-linecap": "round" }, metal);
    el("path", { d, fill: "none", stroke: SHINE, "stroke-width": 1.3, opacity: 0.75, transform: "translate(-0.8 -1.2)" }, metal);
  }
  // turned stem with two knops, on a domed foot
  el("rect", { x: -4.5, y: CUP - RAISE, width: 9, height: -CUP + RAISE - 20, fill: "url(#dicey-brass)" }, metal);
  for (const [y, rx] of [[CUP + 2, 7], [LOW, 7.5], [-36, 6.5]]) el("ellipse", { cx: 0, cy: y, rx, ry: 3.6, fill: "url(#dicey-brass)" }, metal);
  el("path", { d: "M-52,0 C-50,-6 -30,-10 -15,-14 C-10,-16 -7,-20 -6,-26 L6,-26 C7,-20 10,-16 15,-14 C30,-10 50,-6 52,0 Z", fill: "url(#dicey-brass)" }, metal);
  el("ellipse", { cx: 0, cy: 0, rx: 52, ry: 3, fill: DARK }, metal);
  el("path", { d: "M-40,-5 C-26,-9 -16,-12 -9,-16", stroke: SHINE, "stroke-width": 1.2, fill: "none", opacity: 0.55 }, metal);

  // when each flame lights, and the order they go out
  const lightOrder = [4, ...used];
  const outOrder = [...used].sort(() => Math.random() - 0.5).concat(4);
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * GAP;
    const rim = i === 4 ? CUP - RAISE : CUP;
    const g = el("g", { transform: `translate(${x} 0)` }, group);
    // a tulip cup with a lip
    el("path", { d: `M-9,${rim - 7} C-9,${rim - 1} -5,${rim + 3} -3,${rim + 5} L3,${rim + 5} C5,${rim + 3} 9,${rim - 1} 9,${rim - 7} Z`, fill: "url(#dicey-brass)" }, g);
    el("ellipse", { cx: 0, cy: rim - 7, rx: 9.5, ry: 2.2, fill: SHINE }, g);
    el("ellipse", { cx: 0, cy: rim - 7, rx: 7.2, ry: 1.4, fill: "#2e2006" }, g);
    if (i !== 4 && !used.includes(i)) continue; // an empty cup tonight

    // a slightly tapered wax candle with a softened top and one drip
    const tall = i === 4 ? CANDLE + 4 : CANDLE;
    const tip = rim - 7 - tall;
    el("path", { d: `M-6,${rim - 7} L-5.4,${tip + 1} Q-2.5,${tip - 0.6} 0,${tip + 0.8} Q2.5,${tip - 0.6} 5.4,${tip + 1} L6,${rim - 7} Z`, fill: "url(#dicey-wax)" }, g);
    const side = Math.random() < 0.5 ? -1 : 1;
    const len = rand(6, 14);
    el("path", { d: `M${side * 5.5},${tip + 1} C${side * 6.6},${tip + 4} ${side * 6.4},${tip + len - 2} ${side * 5.6},${tip + len} C${side * 4.6},${tip + len - 1} ${side * 4.6},${tip + 4} ${side * 4.8},${tip + 1} Z`, fill: "#f2e9d4", opacity: 0.9 }, g);
    el("path", { d: `M0,${tip + 0.5} q-0.6,-3 0.8,-6`, stroke: "#241708", "stroke-width": 1.3, fill: "none", "stroke-linecap": "round" }, g);

    const step = out ? outOrder.indexOf(i) : lightOrder.indexOf(i);
    // fixed beats (only the order of the candles is random), so a sound file can keep time with them
    const delay = (out ? step * 0.18 + 1.0 : step * 0.26 + 0.2).toFixed(2);
    const fire = el("g", { class: out ? "dicey-flame dicey-out" : "dicey-flame", style: `--delay:${delay}s`, transform: `translate(0.6 ${tip - 3})` }, g);
    el("circle", { cx: 0, cy: -14, r: 48, fill: "url(#dicey-halo)", class: "dicey-halo" }, fire);
    el("rect", { x: -6, y: 3, width: 12, height: 22, fill: "url(#dicey-wax-glow)", class: "dicey-halo" }, fire);
    const tongue = el("g", { class: "dicey-tongue" }, el("g", { transform: "scale(0.62)" }, fire));
    el("path", { d: FLAME, fill: "url(#dicey-flame-glow)", transform: "scale(1.45 1.25)", filter: "url(#dicey-soft)" }, tongue);
    el("path", { d: FLAME, fill: "url(#dicey-flame)", opacity: 0.95 }, tongue);
    el("ellipse", { cx: 0, cy: -3, rx: 2.6, ry: 4, fill: "rgba(90,140,255,.6)", filter: "url(#dicey-soft)" }, tongue);
    el("ellipse", { cx: 0, cy: -9, rx: 2, ry: 5, fill: "#fffef6", opacity: 0.85, filter: "url(#dicey-soft)" }, tongue);
    if (out) {
      // the wick's offset sits on a group: the wisp's CSS transform would replace a transform on the path itself
      const wick = el("g", { transform: `translate(0.6 ${tip - 5})` }, g);
      el("path", { d: "M0,-2 C-7,-22 7,-40 -3,-64 C-9,-80 5,-92 0,-108", class: "dicey-smoke", style: `--delay:${delay}s`, fill: "none" }, wick);
      el("path", { d: "M0,-2 C5,-18 -5,-34 3,-54 C8,-68 -2,-78 2,-90", class: "dicey-smoke thin", style: `--delay:${delay}s`, fill: "none" }, wick);
    }
  }
}

const rnd = (n) => Math.floor(Math.random() * n);

/** Things falling from above: `make(group, i)` draws one at the origin. They start at staggered times. */
function falling(svg, w, h, count, make, { fall = [2.4, 3.6], delay = 1.2, drift = 140, spin = 360 } = {}) {
  for (let i = 0; i < count; i++) {
    const outer = el("g", { transform: `translate(${rand(0, w)} -50)` }, svg);
    const inner = el("g", {
      class: "dicey-fall",
      style: `--fall:${h + 120}px;--drift:${rand(-drift, drift)}px;--spin:${rand(-spin, spin)}deg;--dur:${rand(...fall).toFixed(2)}s;--delay:${rand(0, delay).toFixed(2)}s`,
    }, outer);
    make(inner, i);
  }
}

const LEAF = ["#c8501a", "#e08a1e", "#b5301b", "#d9a21f", "#8a4a14", "#a8a22a"];
function leaves(svg, w, h) {
  falling(svg, w, h, 34, (g, i) => {
    const sway = el("g", { class: "dicey-sway", style: `--s:${rand(0.9, 1.6).toFixed(2)}s` }, g);
    const s = rand(0.7, 1.35);
    el("path", { d: "M0,-18 C14,-12 14,8 0,20 C-14,8 -14,-12 0,-18 Z", fill: LEAF[i % LEAF.length], transform: `scale(${s})` }, sway);
    el("path", { d: "M0,-16 L0,24", stroke: "rgba(60,25,0,.5)", "stroke-width": 1.6, transform: `scale(${s})` }, sway);
  });
}

function snow(svg, w, h, { count = 70, fall = [3, 4.6], delay = 1.2 } = {}) {
  falling(svg, w, h, count, (g) => {
    const r = rand(2, 6);
    el("circle", { r, fill: "#fff", opacity: rand(0.55, 0.95), class: "dicey-flake" }, g);
  }, { fall, delay, drift: 90, spin: 0 });
}

/** Gold and silver foil for the gelt, in bands like crinkled foil catching the light. */
function geltDefs(svg) {
  const d = el("defs", {}, svg);
  const bands = (id, stops) => {
    const g = el("linearGradient", { id, x1: "0", y1: "0", x2: "1", y2: "1" }, d);
    stops.forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, g));
  };
  bands("dicey-gelt-gold", [["0", "#fff6c2"], ["0.16", "#f1c64c"], ["0.34", "#a8741a"], ["0.5", "#ffe48a"], ["0.66", "#c08a26"], ["0.82", "#fff0a8"], ["1", "#8a5e14"]]);
  bands("dicey-gelt-silver", [["0", "#ffffff"], ["0.16", "#d4dae3"], ["0.34", "#7f8898"], ["0.5", "#f3f5f9"], ["0.66", "#9aa3b2"], ["0.82", "#ffffff"], ["1", "#626b7a"]]);
  return d;
}

/** A small menorah pressed into the foil, drawn for a coin of radius 20. */
const GELT_MENORAH = "M-6,9 L6,9 M0,9 L0,-6 M-12,-6 Q-12,4 0,4 Q12,4 12,-6 M-8,-6 Q-8,1 0,1 Q8,1 8,-6 M-4,-6 Q-4,-2 0,-2 Q4,-2 4,-6";

/** One foil-wrapped coin at the origin: an edge that shows as it turns, banded foil, a raised rim, the menorah, and sometimes a glint. */
function gelt(parent, r, silver, flipSeconds) {
  const flip = el("g", { class: "dicey-flip", style: `--f:${flipSeconds.toFixed(2)}s` }, parent);
  // the coin's thickness: a darker disc just behind, seen when the face turns edge-on
  el("circle", { cx: r * 0.14, r, fill: silver ? "#59616f" : "#6e4a0e" }, flip);
  el("circle", { r, fill: `url(#dicey-gelt-${silver ? "silver" : "gold"})` }, flip);
  // a raised rim: light on its top left, shadow on its bottom right
  el("circle", { r: r * 0.84, fill: "none", stroke: "rgba(255,255,255,.55)", "stroke-width": r * 0.07, transform: `translate(${-r * 0.03} ${-r * 0.03})` }, flip);
  el("circle", { r: r * 0.84, fill: "none", stroke: "rgba(0,0,0,.28)", "stroke-width": r * 0.06, transform: `translate(${r * 0.03} ${r * 0.03})` }, flip);
  const k = r / 20;
  const emblem = el("g", { transform: `scale(${k})`, fill: "none", "stroke-linecap": "round", "stroke-width": 1.6 }, flip);
  el("path", { d: GELT_MENORAH, stroke: "rgba(255,255,255,.6)", transform: "translate(-0.6 -0.6)" }, emblem);
  el("path", { d: GELT_MENORAH, stroke: silver ? "rgba(40,48,62,.55)" : "rgba(90,58,8,.6)" }, emblem);
  for (let x = -12; x <= 12; x += 4) el("circle", { cx: x, cy: x === 0 ? -9 : -8, r: 1.1, fill: silver ? "rgba(40,48,62,.5)" : "rgba(90,58,8,.55)" }, emblem);
  // crinkles in the foil
  for (let i = 0; i < 3; i++) {
    const a = rand(0, 6.283);
    const d0 = rand(0.2, 0.7) * r;
    el("path", { d: `M${Math.cos(a) * d0},${Math.sin(a) * d0} l${rand(-0.3, 0.3) * r},${rand(-0.3, 0.3) * r}`, stroke: "rgba(255,255,255,.4)", "stroke-width": 0.8 }, flip);
  }
  // darker as it turns edge-on, in step with the flip
  el("circle", { r, fill: "#000", class: "dicey-gelt-shade" }, flip);
  if (Math.random() < 0.35) {
    const gl = el("path", { d: `M0,${-r * 0.5} L${r * 0.08},${-r * 0.08} L${r * 0.5},0 L${r * 0.08},${r * 0.08} L0,${r * 0.5} L${-r * 0.08},${r * 0.08} L${-r * 0.5},0 L${-r * 0.08},${-r * 0.08} Z`, fill: "#fff", class: "dicey-glint", style: `--g:${rand(0, 1.2).toFixed(2)}s` }, parent);
    gl.setAttribute("transform", `translate(${-r * 0.4} ${-r * 0.45})`);
  }
  return flip;
}

function coins(svg, w, h) {
  geltDefs(svg);
  falling(svg, w, h, 30, (g) => gelt(g, rand(14, 24), Math.random() < 0.28, rand(0.45, 0.85)), { fall: [1.6, 2.4], delay: 1.0, drift: 80, spin: 90 });
}

const DREIDEL_LETTERS = ["נ", "ג", "ה", "ש"]; // nun, gimel, hei, shin, round the four sides

/**
 * A dreidel spins on its point, slows, wobbles and falls, showing the letter it landed on: gimel
 * (`dreidel-win`, and a few gelt coins spill out) or nun (`dreidel-nun`, a puff of dust). The four-
 * sided body is drawn each frame from its turn angle, so the faces and their letters go round as on
 * a real top; the wobble and the fall are CSS (styles/screen-fx.css).
 */
function dreidel(svg, w, h, letter) {
  const win = letter === "ג";
  const d = geltDefs(svg);
  const stemGrad = el("linearGradient", { id: "dicey-dd-stem", x1: "0", x2: "1", y1: "0", y2: "0" }, d);
  [["0", "#0a1f5c"], ["0.35", "#5b8cf0"], ["0.55", "#9fbcff"], ["1", "#0d2c80"]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, stemGrad));
  el("feGaussianBlur", { stdDeviation: 4 }, el("filter", { id: "dicey-dd-blur", x: "-50%", y: "-50%", width: "200%", height: "200%" }, d));

  const s = Math.min(1.5, Math.max(0.8, h / 640));
  const stage = el("g", { transform: `translate(${w / 2} ${h * 0.56}) scale(${s})` }, svg);
  el("ellipse", { cx: 0, cy: 102, rx: 54, ry: 9, fill: "rgba(0,0,0,.4)", filter: "url(#dicey-dd-blur)", class: "dicey-dd-shadow" }, stage);
  const topple = el("g", { class: "dicey-dd-topple" }, stage);
  const wobble = el("g", { class: "dicey-dd-wobble" }, topple);

  const HALF = 44; // half the width of a side
  const R = HALF * Math.SQRT2;
  const TOP = -60;
  const BOT = 26;
  const TIP = 98;
  const TILT = 0.16; // we look down on it a little: nearer corners sit lower
  const sides = [0, 1, 2, 3].map((k) => {
    const g = el("g", {}, wobble);
    return {
      side: el("polygon", { stroke: "#081a4d", "stroke-width": 1.4, "stroke-linejoin": "round" }, g),
      tip: el("polygon", { stroke: "#081a4d", "stroke-width": 1.4, "stroke-linejoin": "round" }, g),
      glyph: Object.assign(el("text", { "text-anchor": "middle", "dominant-baseline": "central", class: "dicey-dd-face" }, g), { textContent: DREIDEL_LETTERS[k] }),
    };
  });
  const top = el("polygon", { fill: "#3d6fd8", stroke: "#081a4d", "stroke-width": 1.4 }, wobble);
  // the handle: a turned stem with a knob
  el("rect", { x: -7, y: TOP - 46, width: 14, height: 46, rx: 4, fill: "url(#dicey-dd-stem)" }, wobble);
  el("ellipse", { cx: 0, cy: TOP - 46, rx: 9, ry: 4, fill: "#7fa4f5" }, wobble);

  const shade = (light, k = 1) => {
    // between deep and bright lacquer blue
    const mix = (a, b) => Math.round((a + (b - a) * light) * k);
    return `rgb(${mix(9, 104)},${mix(34, 146)},${mix(108, 246)})`;
  };
  const target = DREIDEL_LETTERS.indexOf(letter);
  // the side k faces us when the turn angle is -(k + 1) * 90 degrees; a little past it shows a sliver of the next side
  const end = -(target + 1) * (Math.PI / 2) + 0.32;
  const SPIN = 1.9; // seconds of spinning
  const TURNS = 44; // radians still to go at the start
  const start = performance.now();

  const frame = (now) => {
    if (!svg.isConnected) return;
    const u = Math.min(1, (now - start) / 1000 / SPIN);
    const theta = end - TURNS * (1 - u) ** 3;
    const corners = [0, 1, 2, 3].map((j) => {
      const a = theta + Math.PI / 4 + (j * Math.PI) / 2;
      const x = R * Math.sin(a);
      const z = R * Math.cos(a);
      return { x, top: TOP + z * TILT, bot: BOT + z * TILT, z };
    });
    top.setAttribute("points", corners.map((c) => `${c.x.toFixed(1)},${c.top.toFixed(1)}`).join(" "));
    sides.forEach((f, k) => {
      const a = corners[k];
      const b = corners[(k + 1) % 4];
      const facing = Math.cos(theta + Math.PI / 2 + (k * Math.PI) / 2);
      const show = facing > 0.02;
      f.side.style.display = f.tip.style.display = f.glyph.style.display = show ? "" : "none";
      if (!show) return;
      const light = Math.max(0, Math.min(1, 0.45 + 0.55 * Math.cos(theta + Math.PI / 2 + (k * Math.PI) / 2 + 0.55)));
      f.side.setAttribute("points", `${a.x.toFixed(1)},${a.top.toFixed(1)} ${b.x.toFixed(1)},${b.top.toFixed(1)} ${b.x.toFixed(1)},${b.bot.toFixed(1)} ${a.x.toFixed(1)},${a.bot.toFixed(1)}`);
      f.side.setAttribute("fill", shade(light));
      f.tip.setAttribute("points", `${a.x.toFixed(1)},${a.bot.toFixed(1)} ${b.x.toFixed(1)},${b.bot.toFixed(1)} 0,${TIP}`);
      f.tip.setAttribute("fill", shade(light, 0.8));
      const cx = (a.x + b.x) / 2;
      const cy = (a.top + b.top + a.bot + b.bot) / 4;
      const sx = Math.abs(b.x - a.x) / (2 * HALF);
      f.glyph.setAttribute("transform", `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${sx.toFixed(3)} 1)`);
      f.glyph.style.opacity = Math.min(1, facing * 1.6).toFixed(2);
    });
    if (u < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (win) {
    // gimel takes the pot: a few gelt coins spill out as it falls
    for (let i = 0; i < 9; i++) {
      const spill = el("g", { class: "dicey-dd-spill", style: `--dx:${rand(-170, 170).toFixed(0)}px;--dy:${rand(90, 190).toFixed(0)}px;--sd:${(2.35 + i * 0.05).toFixed(2)}s` }, el("g", { transform: "translate(0 40)" }, stage));
      gelt(spill, rand(10, 15), Math.random() < 0.3, rand(0.4, 0.7));
    }
  } else {
    for (let i = 0; i < 7; i++) {
      el("circle", { cx: 0, cy: 96, r: rand(10, 20), fill: "rgba(190,180,160,.35)", filter: "url(#dicey-dd-blur)", class: "dicey-dd-dust", style: `--dx:${rand(-90, 90).toFixed(0)}px;--dy:${rand(-40, -10).toFixed(0)}px` }, stage);
    }
  }
  const glyph = el("text", { class: `dicey-dd-letter ${win ? "win" : "lose"}`, x: 0, y: -200, "text-anchor": "middle" }, stage);
  glyph.textContent = letter;
}

/** One blob thrown at the glass at (x, y), size k: a smack, spatter round it, a shine and `drips` runs. */
function blob(svg, x, y, k, colour, shine, delay, drips = 3) {
  const g = el("g", { class: "dicey-splat", style: `--delay:${delay.toFixed(2)}s`, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, svg);
  const body = el("g", { class: "dicey-splat-body", style: `--delay:${delay.toFixed(2)}s` }, g);
  el("circle", { r: 46 * k, fill: colour }, body);
  for (let j = 0; j < 9; j++) {
    const a = (j / 9) * 6.283 + rand(-0.2, 0.2);
    const dist = rand(40, 66) * k;
    el("circle", { cx: Math.cos(a) * dist, cy: Math.sin(a) * dist, r: rand(9, 24) * k, fill: colour }, body);
  }
  for (let j = 0; j < 7; j++) el("circle", { cx: rand(-130, 130) * k, cy: rand(-100, 100) * k, r: rand(2, 6) * Math.min(1, k * 1.6), fill: colour }, body);
  el("ellipse", { cx: -14 * k, cy: -18 * k, rx: 16 * k, ry: 9 * k, fill: shine }, body);
  for (let j = 0; j < drips; j++) {
    const dx = rand(-34, 34) * k;
    const len = rand(120, 260) * k;
    const wd = Math.max(4, 12 * k);
    el("rect", { class: "dicey-drip", x: dx - wd / 2, y: 10 * k, width: wd, height: len, rx: wd / 2, fill: colour, style: `--delay:${(delay + 0.3 + j * 0.15).toFixed(2)}s;--ms:${rand(2.2, 3.2).toFixed(2)}s` }, g);
  }
}

/** Something thrown at the glass: blobs that land with a smack, then drip. */
function splat(svg, w, h, colour = "#6b3a1a", shine = "rgba(255,220,170,.35)") {
  const spots = [[w * 0.5, h * 0.42, 1.6], [w * 0.22, h * 0.3, 1.0], [w * 0.78, h * 0.55, 1.2], [w * 0.36, h * 0.66, 0.8], [w * 0.66, h * 0.22, 0.7]];
  spots.forEach(([x, y, k], i) => blob(svg, x, y, k, colour, shine, i * 0.12));
}

/**
 * Where the last roll's dice came to rest, in screen pixels, with their size. Dicer keeps this only in
 * its debug data, so it can be missing; then there are none and nothing is drawn.
 */
function landedDice(w, h) {
  try {
    const area = game.dice3d?._debug?.lastRollArea;
    const px = Number(area?.diePx) || 48;
    return (area?.dice ?? [])
      .map((d) => ({ ...game.dice3d.getScreenPosition({ x: d.x, y: 0, z: d.z }), px }))
      .filter((p) => p.x > 0 && p.y > 0 && p.x < w && p.y < h);
  } catch {
    return [];
  }
}

/** A small splat beside each die that just landed (at most six), for an ordinary roll. */
function splatSmall(svg, w, h, colour = "#6b3a1a", shine = "rgba(255,220,170,.35)") {
  landedDice(w, h).slice(0, 6).forEach((p, i) => {
    const a = rand(0, 6.283);
    const off = p.px * rand(0.8, 1.1);
    blob(svg, p.x + Math.cos(a) * off, p.y + Math.sin(a) * off, (p.px / 48) * rand(0.28, 0.36), colour, shine, i * 0.06, 1);
  });
}


export const SCREEN_FX = {
  // no sound of its own: every set that hangs the lights plays a jingle (sleigh bells are one of them)
  // top: hung over Foundry's side panels too (the chat), still under its windows
  "lights-xmas": { ms: 4600, draw: lightsXmas, top: true },
  "lights-krampus": { ms: 3800, draw: lightsKrampus, sound: sound("wreck.ogg", 0.4), top: true },
  // timing and sound follow the night's candle count (one sound file per night, tools/make-sounds.py)
  "candles-hanukkah": {
    get ms() { return Math.round((2.3 + menorahNight() * 0.26) * 1000); },
    draw: (svg, w, h) => menorah(svg, w, h, false),
    get sound() { return sound(`candles-hanukkah-${menorahNight()}.ogg`, 0.3); },
  },
  "candles-hanukkah-out": {
    get ms() { return Math.round((2.7 + menorahNight() * 0.18) * 1000); },
    draw: (svg, w, h) => menorah(svg, w, h, true),
    get sound() { return sound(`candles-hanukkah-out-${menorahNight()}.ogg`, 0.3); },
  },
  leaves: { ms: 4800, draw: leaves },
  snow: { ms: 5200, draw: snow },
  // gentler and longer: falls for the whole Silent Night music box (5.3 s)
  "snow-silent-night": { ms: 6400, draw: (svg, w, h) => snow(svg, w, h, { count: 90, fall: [3.6, 5], delay: 2.6 }) },
  coins: { ms: 3800, draw: coins },
  splat: { ms: 4200, draw: (svg, w, h) => splat(svg, w, h, "#6b3a1a") },
  "splat-cranberry": { ms: 4200, draw: (svg, w, h) => splat(svg, w, h, "#9c1038", "rgba(255,190,210,.4)") },
  "splat-pie": { ms: 4200, draw: (svg, w, h) => splat(svg, w, h, "#d9801f", "rgba(255,235,180,.4)") },
  "splat-jelly": { ms: 4200, draw: (svg, w, h) => splat(svg, w, h, "#b3122b", "rgba(255,200,205,.45)") },
  "splat-small": { ms: 2400, draw: splatSmall, minor: true },
  "dreidel-win": { ms: 3800, draw: (svg, w, h) => dreidel(svg, w, h, "\u05d2") },
  "dreidel-nun": { ms: 3800, draw: (svg, w, h) => dreidel(svg, w, h, "\u05e0") },
};

let current = null;

export function playSound(spec, { setting = "fxSound" } = {}) {
  if (!spec || effective(setting) === false) return;
  try {
    // the interface channel already scales by the player's Interface volume
    foundry.audio.AudioHelper.play({ src: spec.src, volume: spec.volume, channel: "interface", loop: false }, false);
  } catch (err) {
    console.warn(`${PACKAGE_ID} | screen effect sound failed`, err);
  }
}

/** Draws the named screen effect, replacing one that is still showing. Returns false for an unknown name. */
export function playScreenFx(name) {
  const fx = SCREEN_FX[name];
  if (!fx) return false;
  // a minor effect (an ordinary roll) never cuts a bigger one short
  if (fx.minor && current) return false;
  clearScreenFx();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const root = document.createElement("div");
  root.className = fx.top ? "dicey-screen-fx dicey-screen-fx-top" : "dicey-screen-fx";
  root.setAttribute("aria-hidden", "true");
  root.style.setProperty("--ms", `${fx.ms}ms`);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  root.appendChild(svg);
  fx.draw(svg, w, h);
  document.body.appendChild(root);
  playSound(fx.sound);
  current = { root, timer: setTimeout(clearScreenFx, fx.ms + 100) };
  return true;
}

/** True while a screen effect is showing. */
export const screenFxShowing = () => current !== null;

export function clearScreenFx() {
  if (!current) return;
  clearTimeout(current.timer);
  current.root.remove();
  current = null;
}
