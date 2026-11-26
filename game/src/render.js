// Meridian Sky Courier — everything the pilot sees.
// A pinhole camera chases the plane over a heightfield archipelago: the
// ground is a projected grid coloured by what it is (sea, sand, grass,
// rock, snow), runways are drawn as strips with lights, rings glow ahead,
// and the courier plane itself is drawn in the frame, banking with the
// turn. All art is drawn in code; the game ships no image files.

import { PALETTES } from './config.js';
import { groundHeight, groundKind, runwayAt, PEAKS, RUNWAYS } from './terrain.js';
import { clamp, lerp, degToRad } from './random.js';

const TAU = Math.PI * 2;

// --- camera ---------------------------------------------------------------
export function makeCamera(plane, width, height) {
  const fx = Math.sin(plane.heading);
  const fz = -Math.cos(plane.heading);
  const cam = {
    x: plane.x - fx * 13,
    z: plane.z - fz * 13,
    y: plane.y + 4.4,
  };
  // Look slightly ahead of the plane and a touch below its nose.
  const look = { x: plane.x + fx * 42, y: plane.y - 1.5, z: plane.z + fz * 42 };
  const fwd = norm3(look.x - cam.x, look.y - cam.y, look.z - cam.z);
  const right = norm3(-fwd.z, 0, fwd.x);
  const up = cross3(right, fwd);
  return {
    pos: cam, fwd, right, up,
    focal: height * 1.02,
    width, height,
    horizonY: projectPoint({ pos: cam, fwd, right, up, focal: height * 1.02, width, height },
      cam.x + fwd.x * 9000, cam.y, cam.z + fwd.z * 9000)?.y ?? height * 0.42,
  };
}

function norm3(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function cross3(a, b) {
  return norm3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

// Project a world point to screen space. Null when behind the camera.
export function projectPoint(cam, x, y, z) {
  const dx = x - cam.pos.x;
  const dy = y - cam.pos.y;
  const dz = z - cam.pos.z;
  const cz = dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z;
  if (cz < 1.2) return null;
  const cx = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
  const cy = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
  return {
    x: cam.width / 2 + (cx / cz) * cam.focal,
    y: cam.height / 2 - (cy / cz) * cam.focal,
    dist: cz,
    scale: cam.focal / cz,
  };
}

// --- colour helpers -------------------------------------------------------
function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * factor), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * factor), 0, 255);
  const b = clamp(Math.round((n & 255) * factor), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function mixHex(a, b, t) {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((na >> 16) & 255, (nb >> 16) & 255, t));
  const g = Math.round(lerp((na >> 8) & 255, (nb >> 8) & 255, t));
  const bl = Math.round(lerp(na & 255, nb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

// --- sky ------------------------------------------------------------------
function drawSky(ctx, cam, palette, time) {
  const { width: w, height: h } = cam;
  const horizon = clamp(cam.horizonY, h * 0.18, h * 0.85);
  const grad = ctx.createLinearGradient(0, 0, 0, horizon);
  grad.addColorStop(0, palette.skyTop);
  grad.addColorStop(0.62, palette.skyMid);
  grad.addColorStop(1, palette.skyLow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, horizon + 1);
  // Sun (or low dusk sun) with a soft halo.
  const sunX = palette.sunX * w;
  const sunY = palette.sunY * h;
  const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
  halo.addColorStop(0, palette.sun);
  halo.addColorStop(0.25, palette.sun + 'cc');
  halo.addColorStop(1, palette.sun + '00');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
  ctx.fillStyle = palette.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, palette.night ? 26 : 30, 0, TAU);
  ctx.fill();
  void time;
}

// --- clouds ---------------------------------------------------------------
export function makeClouds(seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const clouds = [];
  for (let i = 0; i < 42; i++) {
    clouds.push({
      x: (rnd() - 0.5) * 5600,
      z: (rnd() - 0.5) * 5600,
      y: 260 + rnd() * 170,
      size: 60 + rnd() * 130,
      drift: rnd() * TAU,
    });
  }
  return clouds;
}

function drawClouds(ctx, cam, clouds, time, palette) {
  ctx.save();
  for (const c of clouds) {
    const driftX = Math.sin(time * 0.008 + c.drift) * 40;
    const p = projectPoint(cam, c.x + driftX, c.y, c.z);
    if (!p || p.dist > 2600) continue;
    const s = c.size * p.scale * 0.9;
    if (s < 4) continue;
    const alpha = clamp(0.85 - p.dist / 3200, 0.08, 0.85);
    ctx.fillStyle = palette.night ? `rgba(230,220,240,${alpha * 0.55})` : `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.38, 0, 0, TAU);
    ctx.ellipse(p.x - s * 0.5, p.y + s * 0.08, s * 0.55, s * 0.26, 0, 0, TAU);
    ctx.ellipse(p.x + s * 0.5, p.y + s * 0.06, s * 0.6, s * 0.28, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// --- ground ---------------------------------------------------------------
const ROW_DISTANCES = [18, 30, 46, 66, 90, 120, 155, 195, 245, 300, 365, 440, 530, 640, 770];
const COLS = 13;

function groundColour(palette, kind, height, dist) {
  let base = palette.ground[kind] || palette.seaDeep;
  if (kind === 'sea') {
    base = dist > 500 ? palette.seaFar : mixHex(palette.seaDeep, palette.seaShallow, clamp(height / 2 + 0.5, 0, 1));
  }
  // Distance haze: far ground fades toward the sky's low colour.
  const fog = clamp((dist - 180) / 560, 0, 0.72);
  if (fog > 0) return mixHex(base, palette.skyLow, fog);
  return base;
}

function drawGround(ctx, cam, plane, palette) {
  const fx = Math.sin(plane.heading);
  const fz = -Math.cos(plane.heading);
  const rx = -fz; // right vector on the ground plane
  const rz = fx;
  const horizon = clamp(cam.horizonY, 0, cam.height);
  // Fill everything below the horizon with far sea first.
  ctx.fillStyle = palette.seaFar;
  ctx.fillRect(0, horizon, cam.width, cam.height - horizon);

  for (let row = ROW_DISTANCES.length - 1; row >= 0; row--) {
    const d0 = ROW_DISTANCES[row];
    const d1 = row + 1 < ROW_DISTANCES.length ? ROW_DISTANCES[row + 1] : d0 + 140;
    const half0 = d0 * 0.85 + 26;
    const half1 = d1 * 0.85 + 26;
    for (let col = 0; col < COLS; col++) {
      const t0 = col / COLS;
      const t1 = (col + 1) / COLS;
      const pts = [];
      let ok = true;
      for (const [d, half, t] of [[d0, half0, t0], [d0, half0, t1], [d1, half1, t1], [d1, half1, t0]]) {
        const lateral = (t * 2 - 1) * half;
        const wx = plane.x + fx * d + rx * lateral;
        const wz = plane.z + fz * d + rz * lateral;
        const wy = groundHeight(wx, wz);
        const p = projectPoint(cam, wx, wy, wz);
        if (!p) { ok = false; break; }
        pts.push({ p, wx, wz, wy });
      }
      if (!ok) continue;
      const mid = pts[1];
      const kind = groundKind(mid.wy);
      const dist = (d0 + d1) / 2;
      const strip = runwayAt(mid.wx, mid.wz);
      let colour = groundColour(palette, kind, mid.wy, dist);
      if (strip) colour = shade(palette.runway, 1 + clamp(0.12 - dist / 4000, 0, 0.12));
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(pts[0].p.x, pts[0].p.y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].p.x, pts[i].p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// --- runways: centreline dashes and edge lights ---------------------------
function drawRunwayDetails(ctx, cam, palette, time) {
  for (const r of Object.values(RUNWAYS)) {
    const a = degToRad(r.headingDeg);
    const dx = Math.sin(a);
    const dz = -Math.cos(a);
    const px = -dz; // across
    const pz = dx;
    const segments = 14;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const c0x = r.x + dx * ((t0 - 0.5) * r.length);
      const c0z = r.z + dz * ((t0 - 0.5) * r.length);
      const c1x = r.x + dx * ((t1 - 0.5) * r.length);
      const c1z = r.z + dz * ((t1 - 0.5) * r.length);
      // Centreline dash on every other segment.
      if (i % 2 === 0) {
        const w2 = 1.1;
        const q = [
          projectPoint(cam, c0x + px * w2, r.altitude + 0.15, c0z + pz * w2),
          projectPoint(cam, c0x - px * w2, r.altitude + 0.15, c0z - pz * w2),
          projectPoint(cam, c1x - px * w2, r.altitude + 0.15, c1z - pz * w2),
          projectPoint(cam, c1x + px * w2, r.altitude + 0.15, c1z + pz * w2),
        ];
        if (q.every(Boolean)) {
          ctx.fillStyle = palette.runwayLine;
          ctx.beginPath();
          ctx.moveTo(q[0].x, q[0].y);
          for (let k = 1; k < 4; k++) ctx.lineTo(q[k].x, q[k].y);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Edge lights at dusk and night.
      if (palette.night) {
        for (const side of [-1, 1]) {
          const ex = c0x + px * side * (r.width / 2 - 1);
          const ez = c0z + pz * side * (r.width / 2 - 1);
          const p = projectPoint(cam, ex, r.altitude + 0.6, ez);
          if (!p || p.dist > 1200) continue;
          const blink = 0.65 + 0.35 * Math.sin(time * 0.004 + i);
          ctx.fillStyle = `rgba(255,214,110,${blink})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, clamp(90 / p.dist, 1.5, 5), 0, TAU);
          ctx.fill();
        }
      }
    }
  }
}

// --- peaks: crisp cones over the heightfield ------------------------------
function drawPeaks(ctx, cam, palette) {
  for (const peak of PEAKS) {
    const apex = projectPoint(cam, peak.x, peak.height, peak.z);
    if (!apex || apex.dist > 2400) continue;
    const basePts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * TAU;
      const p = projectPoint(cam, peak.x + Math.cos(a) * peak.radius, groundHeight(peak.x + Math.cos(a) * peak.radius, peak.z + Math.sin(a) * peak.radius), peak.z + Math.sin(a) * peak.radius);
      if (p) basePts.push(p);
    }
    if (basePts.length < 3) continue;
    ctx.fillStyle = shade(palette.ground.rock, 0.92);
    ctx.beginPath();
    ctx.moveTo(basePts[0].x, basePts[0].y);
    for (const p of basePts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    // Snow cap near the apex.
    const capY = apex.y + (basePts[0].y - apex.y) * 0.3;
    const left = basePts[Math.floor(basePts.length * 0.25)];
    const right = basePts[Math.floor(basePts.length * 0.75)];
    ctx.fillStyle = palette.ground.snow;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(apex.x - (apex.x - left.x) * 0.32, capY);
    ctx.lineTo(apex.x + (right.x - apex.x) * 0.32, capY);
    ctx.closePath();
    ctx.fill();
  }
}

// --- rings, coins, balloons ------------------------------------------------
function drawRing(ctx, cam, ring, isNext, time) {
  const heading = degToRad(ring.headingDeg);
  const nx = Math.sin(heading);
  const nz = -Math.cos(heading);
  const rx = -nz;
  const rz = nx;
  const centre = projectPoint(cam, ring.x, ring.y, ring.z);
  if (!centre || centre.dist > 2200) return;
  const N = 26;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const px = ring.x + rx * Math.cos(a) * ring.r;
    const py = ring.y + Math.sin(a) * ring.r;
    const pz = ring.z + rz * Math.cos(a) * ring.r;
    const p = projectPoint(cam, px, py, pz);
    if (p) pts.push(p);
  }
  if (pts.length < 4) return;
  const pulse = isNext ? 0.75 + 0.25 * Math.sin(time * 0.006) : 0.55;
  const colour = isNext ? `rgba(255,214,80,${pulse})` : 'rgba(140,220,255,0.5)';
  const width = clamp(centre.scale * 1.6, 2, 14);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width * 2.6;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = width;
  ctx.stroke();
  // Inner chevron pointing the way through.
  if (isNext) {
    ctx.fillStyle = `rgba(255,236,160,${pulse})`;
    ctx.beginPath();
    ctx.moveTo(centre.x, centre.y - centre.scale * 6);
    ctx.lineTo(centre.x - centre.scale * 4, centre.y + centre.scale * 2);
    ctx.lineTo(centre.x + centre.scale * 4, centre.y + centre.scale * 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCoin(ctx, cam, coin, time) {
  const p = projectPoint(cam, coin.x, coin.y, coin.z);
  if (!p || p.dist > 900) return;
  const spin = Math.abs(Math.sin(time * 0.004 + coin.x * 0.01));
  const r = clamp(p.scale * 6, 2, 16);
  ctx.fillStyle = '#f7c948';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, Math.max(r * spin, 1.5), r, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, Math.max(r * spin * 0.5, 1), r * 0.5, 0, 0, TAU);
  ctx.fill();
}

function drawBalloon(ctx, cam, balloon, time) {
  const driftX = Math.sin(time * 0.0006 + balloon.x * 0.013) * 24;
  const driftY = Math.sin(time * 0.0009 + balloon.z * 0.017) * 6;
  const p = projectPoint(cam, balloon.x + driftX, balloon.y + driftY, balloon.z);
  if (!p || p.dist > 2000) return;
  const r = clamp(p.scale * 11, 3, 60);
  const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
  grad.addColorStop(0, balloon.colourLight || '#ff8a7a');
  grad.addColorStop(1, balloon.colour || '#d94f3d');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 1.12, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 0.45, r * 1.12, 0, -1.1, 1.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 0.45, r * 1.12, 0, Math.PI - 1.1, Math.PI + 1.1);
  ctx.stroke();
  // Basket.
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(p.x - r * 0.28, p.y + r * 1.25, r * 0.56, r * 0.42);
}

// --- the courier plane, drawn in the frame --------------------------------
function drawPlane(ctx, cam, plane, time) {
  const cx = cam.width / 2;
  const cy = cam.height * 0.56 + Math.sin(plane.pitch) * 26;
  const bank = plane.bank;
  const w = Math.min(cam.width, 1280) * 0.16;
  const h = w * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bank * 0.9);
  const bob = Math.sin(time * 0.012) * 1.5;
  ctx.translate(0, bob);
  // Soft shadow of the plane on the ground below it.
  const groundY = groundHeight(plane.x, plane.z);
  const shadow = projectPoint(cam, plane.x, groundY + 0.4, plane.z);
  if (shadow && plane.y - groundY < 220) {
    const sr = clamp((1 - (plane.y - groundY) / 260) * w * 0.55, 4, w * 0.55);
    ctx.fillStyle = `rgba(10,20,30,${clamp(0.3 * (1 - (plane.y - groundY) / 260), 0.03, 0.3)})`;
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, sr, sr * 0.22, 0, 0, TAU);
    ctx.fill();
  }
  // Wings: broad, slightly swept, cream with a sunset stripe.
  ctx.fillStyle = '#f4ead2';
  ctx.strokeStyle = '#b98a3e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.quadraticCurveTo(-w * 0.55, -h * 0.42, -w * 0.08, -h * 0.18);
  ctx.lineTo(w * 0.08, -h * 0.18);
  ctx.quadraticCurveTo(w * 0.55, -h * 0.42, w, 0);
  ctx.quadraticCurveTo(w * 0.5, h * 0.22, w * 0.1, h * 0.3);
  ctx.lineTo(-w * 0.1, h * 0.3);
  ctx.quadraticCurveTo(-w * 0.5, h * 0.22, -w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Sunset stripe across the wings.
  ctx.fillStyle = '#e2603a';
  ctx.beginPath();
  ctx.moveTo(-w * 0.98, -h * 0.06);
  ctx.lineTo(-w * 0.12, -h * 0.02);
  ctx.lineTo(-w * 0.12, h * 0.1);
  ctx.lineTo(-w * 0.98, h * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.98, -h * 0.06);
  ctx.lineTo(w * 0.12, -h * 0.02);
  ctx.lineTo(w * 0.12, h * 0.1);
  ctx.lineTo(w * 0.98, h * 0.08);
  ctx.closePath();
  ctx.fill();
  // Fuselage: nose away from the viewer, tail toward it.
  const fus = ctx.createLinearGradient(0, -h * 1.9, 0, h * 1.1);
  fus.addColorStop(0, '#f7efdc');
  fus.addColorStop(0.55, '#efdcae');
  fus.addColorStop(1, '#d9b06a');
  ctx.fillStyle = fus;
  ctx.beginPath();
  ctx.moveTo(0, -h * 2.05);
  ctx.quadraticCurveTo(w * 0.16, -h * 1.5, w * 0.17, -h * 0.4);
  ctx.quadraticCurveTo(w * 0.18, h * 0.7, w * 0.1, h * 1.05);
  ctx.lineTo(-w * 0.1, h * 1.05);
  ctx.quadraticCurveTo(-w * 0.18, h * 0.7, -w * 0.17, -h * 0.4);
  ctx.quadraticCurveTo(-w * 0.16, -h * 1.5, 0, -h * 2.05);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#a87c33';
  ctx.stroke();
  // Cabin windows: a warm lit strip along the fuselage.
  ctx.fillStyle = '#2c4a66';
  ctx.beginPath();
  ctx.roundRect(-w * 0.09, -h * 1.55, w * 0.18, h * 0.85, w * 0.08);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,130,0.85)';
  ctx.beginPath();
  ctx.roundRect(-w * 0.06, -h * 1.45, w * 0.12, h * 0.65, w * 0.05);
  ctx.fill();
  // Tailplane and fin, closest to the viewer.
  ctx.fillStyle = '#e2603a';
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, h * 0.95);
  ctx.lineTo(0, h * 0.62);
  ctx.lineTo(w * 0.42, h * 0.95);
  ctx.lineTo(w * 0.3, h * 1.12);
  ctx.lineTo(-w * 0.3, h * 1.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4ead2';
  ctx.strokeStyle = '#b98a3e';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  ctx.lineTo(-w * 0.07, h * 1.28);
  ctx.lineTo(w * 0.07, h * 1.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Navigation lights: red left, green right, white strobe at the tail.
  const strobe = 0.5 + 0.5 * Math.sin(time * 0.02);
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-w * 0.97, -h * 0.02, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#34c759';
  ctx.beginPath();
  ctx.arc(w * 0.97, -h * 0.02, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * strobe})`;
  ctx.beginPath();
  ctx.arc(0, h * 1.3, 4.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// --- rain -----------------------------------------------------------------
function drawRain(ctx, cam, time, seed) {
  ctx.save();
  ctx.strokeStyle = 'rgba(200,215,230,0.35)';
  ctx.lineWidth = 1;
  const count = 90;
  for (let i = 0; i < count; i++) {
    const x = ((i * 137.5 + seed * 7) % cam.width);
    const y = ((i * 89.3 + time * 0.9) % cam.height);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 6, y + 18);
    ctx.stroke();
  }
  ctx.restore();
}

// --- the whole frame --------------------------------------------------------
export function drawFrame(ctx, view) {
  const { plane, mission, paletteName, clouds, time, rings, coins, balloons, nextRingIndex, rain } = view;
  const palette = PALETTES[paletteName];
  const cam = makeCamera(plane, ctx.canvas.width, ctx.canvas.height);
  drawSky(ctx, cam, palette, time);
  drawClouds(ctx, cam, clouds, time, palette);
  drawGround(ctx, cam, plane, palette);
  drawPeaks(ctx, cam, palette);
  drawRunwayDetails(ctx, cam, palette, time);
  // Far objects first: balloons, then coins, then rings.
  const sortedBalloons = [...balloons].sort((a, b) => {
    const da = Math.hypot(a.x - plane.x, a.z - plane.z);
    const db = Math.hypot(b.x - plane.x, b.z - plane.z);
    return db - da;
  });
  for (const b of sortedBalloons) drawBalloon(ctx, cam, b, time);
  for (const c of coins) {
    if (!c.taken) drawCoin(ctx, cam, c, time);
  }
  rings.forEach((ring, i) => {
    if (!ring.done) drawRing(ctx, cam, ring, i === nextRingIndex, time);
  });
  drawPlane(ctx, cam, plane, time);
  if (rain) drawRain(ctx, cam, time, mission.id);
  // Gentle vignette so the frame reads as one picture.
  const vg = ctx.createRadialGradient(
    cam.width / 2, cam.height / 2, Math.min(cam.width, cam.height) * 0.42,
    cam.width / 2, cam.height / 2, Math.max(cam.width, cam.height) * 0.75,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(8,16,28,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cam.width, cam.height);
  return cam;
}
