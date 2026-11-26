// Meridian Sky Courier — the archipelago itself.
// Islands are smooth Gaussian hills rising out of the sea, so the height at
// any point is one cheap formula the physics, the renderer and the minimap
// all share. Runways are flat strips carved into their islands; peaks are
// the tall cones the pilot must respect.

import { clamp, smoothstep } from './random.js';

// name, centre, radius, peak height, and the falloff that shapes the shore.
export const ISLANDS = [
  { name: 'Meridian', x: 0, z: 0, radius: 950, peak: 62, shore: 0.9 },
  { name: 'Kestrel', x: -400, z: -2200, radius: 720, peak: 88, shore: 0.85 },
  { name: 'Coral', x: 2400, z: -600, radius: 820, peak: 46, shore: 0.95 },
  { name: 'Turtle', x: 300, z: 2400, radius: 760, peak: 70, shore: 0.9 },
  { name: 'Gull', x: -2600, z: 800, radius: 680, peak: 108, shore: 0.8 },
  { name: 'Beacon Rock', x: 2600, z: -2600, radius: 420, peak: 128, shore: 0.7 },
];

// Twin peaks that frame Gull Isle's pass, plus a lone sea stack.
export const PEAKS = [
  { x: -2780, z: 560, height: 165, radius: 190 },
  { x: -2420, z: 1080, height: 175, radius: 210 },
  { x: 1450, z: 1650, height: 95, radius: 150 },
  { x: -1500, z: -2600, height: 80, radius: 130 },
];

// Runway strips: centre, heading (degrees, 0 = north), length, width, altitude.
export const RUNWAYS = {
  home: { name: 'Meridian Field', x: 0, z: 260, headingDeg: 0, length: 460, width: 38, altitude: 7 },
  kestrel: { name: 'Kestrel Strip', x: -400, z: -2080, headingDeg: 170, length: 380, width: 32, altitude: 8 },
  coral: { name: 'Coral Strip', x: 2400, z: -480, headingDeg: 95, length: 400, width: 34, altitude: 6 },
  gull: { name: 'Gull Gap Strip', x: -2600, z: 900, headingDeg: 10, length: 340, width: 30, altitude: 9 },
};

function islandHeight(island, x, z) {
  const dx = (x - island.x) / island.radius;
  const dz = (z - island.z) / island.radius;
  const d2 = dx * dx + dz * dz;
  if (d2 > 2.2) return 0;
  // A soft dome with a slightly flattened top and a beach that falls away.
  const dome = Math.exp(-d2 * 1.6);
  const ridge = 0.16 * Math.sin(dx * 9 + 1.3) * Math.cos(dz * 8 - 0.6) * Math.exp(-d2 * 2.5);
  return island.peak * dome * island.shore + island.peak * ridge;
}

function peakHeight(peak, x, z) {
  const dx = x - peak.x;
  const dz = z - peak.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > peak.radius) return 0;
  const t = 1 - d / peak.radius;
  return peak.height * t * t * (0.85 + 0.15 * Math.sin(d * 0.11));
}

// Precomputed runway frames: the along axis runs down the strip, the across
// axis runs beside it. Trigonometry is done once here, not per height query.
const RUNWAY_FRAMES = Object.fromEntries(Object.entries(RUNWAYS).map(([key, r]) => {
  const a = (r.headingDeg * Math.PI) / 180;
  return [key, {
    alongX: -Math.sin(a), alongZ: -Math.cos(a),
    acrossX: Math.cos(a), acrossZ: -Math.sin(a),
  }];
}));

// Is a point inside a runway rectangle? Returns the runway or null.
export function runwayAt(x, z) {
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const f = RUNWAY_FRAMES[key];
    const dx = x - r.x;
    const dz = z - r.z;
    const along = f.alongX * dx + f.alongZ * dz;
    const across = f.acrossX * dx + f.acrossZ * dz;
    if (Math.abs(along) <= r.length / 2 && Math.abs(across) <= r.width / 2) {
      return { key, runway: r, along, across };
    }
  }
  return null;
}

// Ground height in metres at any (x, z): sea is 0, islands rise above it,
// runways are flattened to their strip altitude so the wheels sit level.
export function groundHeight(x, z) {
  let h = 0;
  for (const island of ISLANDS) h = Math.max(h, islandHeight(island, x, z));
  for (const peak of PEAKS) h = Math.max(h, peakHeight(peak, x, z));
  const strip = runwayAt(x, z);
  if (strip) {
    const r = strip.runway;
    const edge = smoothstep(r.width / 2, r.width / 2 - 6, Math.abs(strip.across));
    const endEdge = smoothstep(r.length / 2, r.length / 2 - 20, Math.abs(strip.along));
    const flat = Math.min(edge, endEdge);
    h = h * (1 - flat) + r.altitude * flat;
  }
  // Approach corridors: a graded valley extends past each threshold so a
  // pilot on final never meets a hillside on the centreline. Terrain inside
  // the corridor is capped at a gentle 5% glide slope rising from the strip;
  // outside the corridor, or below the slope, the island is untouched.
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const f = RUNWAY_FRAMES[key];
    const dx = x - r.x;
    const dz = z - r.z;
    const along = f.alongX * dx + f.alongZ * dz;
    const across = f.acrossX * dx + f.acrossZ * dz;
    const beyond = Math.abs(along) - r.length / 2;
    if (beyond > 0 && beyond < 650 && Math.abs(across) < 110) {
      const corridorAlt = r.altitude + beyond * 0.05;
      const fade = smoothstep(110, 55, Math.abs(across)) * smoothstep(650, 480, beyond);
      h = h * (1 - fade) + Math.min(h, corridorAlt) * fade;
    }
  }
  return Math.max(0, h);
}

// What the ground is made of at a height, for the renderer's colours.
export function groundKind(height) {
  if (height <= 0.4) return 'sea';
  if (height < 3.5) return 'sand';
  if (height < 42) return 'grass';
  if (height < 75) return 'meadow';
  if (height < 105) return 'rock';
  return 'snow';
}

// Distance from a point to the nearest runway centre line, for the HUD's
// "runway ahead" callout. Returns { runway, key, dist } or null past 1500 m.
export function nearestRunway(x, z) {
  let best = null;
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const d = Math.hypot(x - r.x, z - r.z);
    if ((!best || d < best.dist) && d < 1600) best = { key, runway: r, dist: d };
  }
  return best;
}

// A coarse picture of the islands for the minimap, drawn once at load.
export function drawMinimapBase(ctx, size) {
  const half = 3000;
  const scale = size / (half * 2);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0d3f63';
  ctx.fillRect(0, 0, size, size);
  for (let gx = 0; gx < size; gx += 3) {
    for (let gz = 0; gz < size; gz += 3) {
      const wx = (gx / scale - half);
      const wz = (gz / scale - half);
      const h = groundHeight(wx, wz);
      if (h <= 0.4) continue;
      ctx.fillStyle = h < 3.5 ? '#d8c98f' : h < 42 ? '#4e8f43' : h < 75 ? '#6aa355' : '#8a7f72';
      ctx.fillRect(gx, gz, 3, 3);
    }
  }
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const a = (r.headingDeg * Math.PI) / 180;
    const px = (r.x + half) * scale;
    const pz = (r.z + half) * scale;
    const len = r.length * scale;
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(2, r.width * scale);
    ctx.beginPath();
    ctx.moveTo(px - Math.sin(a) * len / 2, pz - Math.cos(a) * len / 2);
    ctx.lineTo(px + Math.sin(a) * len / 2, pz + Math.cos(a) * len / 2);
    ctx.stroke();
  }
}

export function clampToWorld(x, z) {
  return { x: clamp(x, -2950, 2950), z: clamp(z, -2950, 2950) };
}
