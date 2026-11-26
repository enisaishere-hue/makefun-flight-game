// Meridian Sky Courier — small seeded random helpers.
// The world, the weather and the screenshot poses all draw from one seeded
// generator, so a given seed always builds the same archipelago, the same
// gusts and the same ring layout. Nothing here reads Math.random.

// Mulberry32: a tiny, well-behaved seeded generator.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, low, high) {
  return low + rng() * (high - low);
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// A smooth 0..1 value that wobbles slowly with its input, for gusts and
// cloud drift. Built from a couple of sines so it needs no lookup table.
export function wobble(t, a, b) {
  return 0.5 + 0.5 * Math.sin(t * a + Math.sin(t * b) * 1.7);
}

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Shortest signed difference between two headings, in radians.
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const degToRad = (d) => (d * Math.PI) / 180;
export const radToDeg = (r) => (r * 180) / Math.PI;

// Heading in degrees where 0 is north (-z), 90 is east (+x), as the compass shows.
export function headingDeg(headingRad) {
  let d = radToDeg(headingRad) % 360;
  if (d < 0) d += 360;
  return d;
}
