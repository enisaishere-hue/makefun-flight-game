// Meridian Sky Courier — the instruments and the menus.
// The HUD is ordinary DOM over the canvas: altitude, speed and heading in
// big lit figures, a compass strip, fuel and damage gauges, the mission
// objective and a live minimap of the archipelago. The title screen, the
// mission select, the pause sheet and the end-of-mission sheets are DOM too,
// so they stay crisp and clickable at any window size.

import { headingDeg } from './random.js';
import { PLANE } from './config.js';
import { drawMinimapBase } from './terrain.js';

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function buildHud(root) {
  root.innerHTML = `
    <div id="hud" class="hud" hidden>
      <div class="hud-top">
        <div class="instruments">
          <div class="gauge"><span class="label">ALT</span><span class="value" id="hud-alt">0</span><span class="unit">m</span></div>
          <div class="gauge"><span class="label">SPD</span><span class="value" id="hud-spd">0</span><span class="unit">kt</span></div>
          <div class="gauge"><span class="label">HDG</span><span class="value" id="hud-hdg">000</span><span class="unit">°</span></div>
          <div class="gauge"><span class="label">VSI</span><span class="value" id="hud-vsi">0</span><span class="unit">m/s</span></div>
        </div>
        <div class="compass"><canvas id="compass-strip" width="360" height="34"></canvas></div>
        <div class="mission-box">
          <div class="mission-name" id="hud-mission">Mission</div>
          <div class="mission-objective" id="hud-objective">—</div>
          <div class="mission-clock"><span id="hud-timer">0:00</span> · <span id="hud-score">0</span> pts</div>
        </div>
      </div>
      <div class="hud-left">
        <div class="bar-row"><span class="bar-label">FUEL</span><div class="bar"><div id="hud-fuel" class="bar-fill fuel"></div></div></div>
        <div class="bar-row"><span class="bar-label">HULL</span><div class="bar"><div id="hud-hull" class="bar-fill hull"></div></div></div>
        <div class="bar-row"><span class="bar-label">THR</span><div class="bar"><div id="hud-thr" class="bar-fill thr"></div></div></div>
        <div class="rings-row" id="hud-rings"></div>
      </div>
      <div class="hud-right">
        <canvas id="minimap" width="168" height="168"></canvas>
        <div class="minimap-caption">MERIDIAN ARCHIPELAGO</div>
      </div>
      <div class="hud-centre" id="hud-toast"></div>
      <div class="hud-bottom">
        <span class="keys">↑↓ pitch · ←→ bank · W/S throttle · Shift boost · P pause · M sound</span>
        <button id="hud-pause-btn" type="button">II Pause</button>
      </div>
      <div class="hud-arrow" id="hud-arrow" hidden>➤</div>
    </div>
    <div id="screen" class="screen"></div>
  `;
  const minimap = root.querySelector('#minimap');
  // The island picture never changes: paint it once onto an offscreen canvas
  // and blit it every frame instead of re-sampling the heightfield.
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = 168;
  baseCanvas.height = 168;
  drawMinimapBase(baseCanvas.getContext('2d'), 168);
  return {
    hud: root.querySelector('#hud'),
    screen: root.querySelector('#screen'),
    alt: root.querySelector('#hud-alt'),
    spd: root.querySelector('#hud-spd'),
    hdg: root.querySelector('#hud-hdg'),
    vsi: root.querySelector('#hud-vsi'),
    compass: root.querySelector('#compass-strip'),
    mission: root.querySelector('#hud-mission'),
    objective: root.querySelector('#hud-objective'),
    timer: root.querySelector('#hud-timer'),
    score: root.querySelector('#hud-score'),
    fuel: root.querySelector('#hud-fuel'),
    hull: root.querySelector('#hud-hull'),
    thr: root.querySelector('#hud-thr'),
    rings: root.querySelector('#hud-rings'),
    minimap,
    minimapBase: baseCanvas,
    toast: root.querySelector('#hud-toast'),
    pauseBtn: root.querySelector('#hud-pause-btn'),
    arrow: root.querySelector('#hud-arrow'),
  };
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function updateHud(ui, state) {
  const { plane, mission, missionState, score, timeLeft, coinsGot } = state;
  ui.alt.textContent = String(Math.round(plane.y));
  ui.spd.textContent = String(Math.round(plane.speed * 1.944));
  ui.hdg.textContent = String(Math.round(headingDeg(plane.heading))).padStart(3, '0');
  const vsi = Math.round(plane.verticalSpeed);
  ui.vsi.textContent = (vsi > 0 ? '+' : '') + vsi;
  ui.mission.textContent = `M${mission.id} · ${mission.name}`;
  const next = missionState.rings[missionState.nextRing];
  ui.objective.textContent = missionState.done
    ? 'All rings flown — land on the strip!'
    : next
      ? `Ring ${missionState.nextRing + 1} of ${missionState.rings.length} · ${Math.round(missionState.nextRingDist)} m ahead`
      : '—';
  ui.timer.textContent = fmtTime(timeLeft);
  ui.timer.style.color = timeLeft < 45 ? '#ff6b5e' : '';
  ui.score.textContent = String(score);
  ui.fuel.style.width = `${(plane.fuel / PLANE.fuelCapacity) * 100}%`;
  const fuelFrac = plane.fuel / PLANE.fuelCapacity;
  ui.fuel.style.background = fuelFrac < 0.2 ? '#ff5a4e' : fuelFrac < 0.45 ? '#f7c948' : '#5ed97a';
  ui.hull.style.width = `${100 - plane.damage}%`;
  ui.hull.style.background = plane.damage > 60 ? '#ff5a4e' : '#5ed97a';
  ui.thr.style.width = `${Math.round(plane.throttle * 100)}%`;
  if (plane.engineOut) ui.objective.textContent = 'ENGINE OUT — glide to a strip!';
  // Ring pips: filled gold for flown rings, outline for the rest.
  let pips = '';
  for (let i = 0; i < missionState.rings.length; i++) {
    pips += `<span class="pip ${i < missionState.nextRing ? 'done' : i === missionState.nextRing ? 'next' : ''}">◯</span>`;
  }
  pips += `<span class="coin-count">◆ ${coinsGot}</span>`;
  ui.rings.innerHTML = pips;
  drawCompass(ui.compass, plane.heading);
  drawMinimap(ui.minimap, state, ui.minimapBase);
  // Off-screen guidance arrow toward the next ring.
  const arrow = ui.arrow;
  if (next && missionState.nextRingOnScreen === false) {
    arrow.hidden = false;
    arrow.style.transform = `translate(-50%,-50%) rotate(${missionState.nextRingAngle}deg)`;
    arrow.style.left = `${missionState.nextRingScreenX}px`;
    arrow.style.top = `${missionState.nextRingScreenY}px`;
  } else {
    arrow.hidden = true;
  }
}

function drawCompass(canvas, heading) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8,18,30,0.55)';
  ctx.fillRect(0, 0, w, h);
  const deg = headingDeg(heading);
  const pxPerDeg = w / 120;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 5) {
    let a = Math.round(deg + d);
    a = ((a % 360) + 360) % 360;
    const x = w / 2 + d * pxPerDeg;
    const major = a % 45 === 0;
    const mid = a % 15 === 0;
    ctx.strokeStyle = major ? '#ffd76e' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, h - 6);
    ctx.lineTo(x, h - (major ? 18 : mid ? 13 : 9));
    ctx.stroke();
    if (major) {
      const label = COMPASS_POINTS[Math.round(a / 45) % 8];
      ctx.fillStyle = '#ffd76e';
      ctx.fillText(a === 0 ? 'N' : label, x, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(String(a).padStart(3, '0'), x, 26);
      ctx.font = 'bold 12px system-ui, sans-serif';
    }
  }
  // Centre lubber line.
  ctx.fillStyle = '#ff6b5e';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 5, 0);
  ctx.lineTo(w / 2 + 5, 0);
  ctx.lineTo(w / 2, 7);
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(canvas, state, baseCanvas) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const { plane, missionState } = state;
  ctx.drawImage(baseCanvas, 0, 0);
  const scale = size / 6000;
  const px = (plane.x + 3000) * scale;
  const pz = (plane.z + 3000) * scale;
  // Coins still on the map.
  ctx.fillStyle = '#f7c948';
  for (const c of missionState.coins) {
    if (c.taken) continue;
    ctx.beginPath();
    ctx.arc((c.x + 3000) * scale, (c.z + 3000) * scale, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Next ring: a pulsing amber dot.
  const next = missionState.rings[missionState.nextRing];
  if (next) {
    const pulse = 3 + Math.sin(performance.now() / 240) * 1.5;
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.arc((next.x + 3000) * scale, (next.z + 3000) * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,176,32,0.6)';
    ctx.beginPath();
    ctx.arc((next.x + 3000) * scale, (next.z + 3000) * scale, pulse + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The plane: a white triangle pointing along its heading.
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(plane.heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0d3f63';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

let toastTimer = 0;
export function showToast(ui, text, ms = 2600) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

// --- screens (title, mission select, pause, results) ----------------------
export function showScreen(ui, html) {
  ui.screen.innerHTML = html;
  ui.screen.hidden = false;
}

export function hideScreen(ui) {
  ui.screen.innerHTML = '';
  ui.screen.hidden = true;
}
