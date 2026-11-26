// Meridian Sky Courier — the game itself: loop, input, screens and poses.
// This is the file the browser runs first. It wires the plane, the mission,
// the renderer, the HUD and the sound together, steps the world sixty times
// a second, and owns the screens between flights: title, mission select,
// pause, success and crash. It also owns the screenshot poses (?shot=),
// which freeze the game into a chosen moment so the entry's pictures are
// reproducible renders of this code.

import { MISSIONS, PALETTES } from './config.js';
import { makePlaneState, stepPlane } from './physics.js';
import { drawFrame, makeClouds, projectPoint, makeCamera } from './render.js';
import { buildHud, updateHud, showToast, showScreen, hideScreen } from './hud.js';
import { makeAudio } from './audio.js';
import {
  loadProgress, startMission, nextRingOf, updateMission,
  judgeTouchdown, recordResult, unlockedMissions,
} from './missions.js';
import { RUNWAYS, nearestRunway, runwayAt, groundHeight } from './terrain.js';
import { degToRad } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = buildHud(document.getElementById('ui'));
const audio = makeAudio();
const clouds = makeClouds(20261126);

const progress = loadProgress();
let screen = 'title'; // title | select | flying | paused | done | crashed
let missionState = null;
let plane = null;
let keys = {};
let lastTime = 0;
let shotMode = null;
let shotReady = false;
let paused = false;
let runwayCalloutDone = false;

function resize() {
  // One CSS pixel per canvas pixel: the screenshots come out at exactly the
  // window size, which is what the entry's 1280-pixel cap wants.
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', resize);
resize();

// --- screens ----------------------------------------------------------------
function medalStars(medal) {
  if (!medal) return '<span class="stars none">☆☆☆</span>';
  const filled = medal === 'gold' ? 3 : medal === 'silver' ? 2 : 1;
  const colour = medal === 'gold' ? 'gold' : medal === 'silver' ? 'silver' : 'bronze';
  return `<span class="stars ${colour}">${'★'.repeat(filled)}${'☆'.repeat(3 - filled)}</span>`;
}

function showTitle() {
  screen = 'title';
  ui.hud.hidden = true;
  const total = MISSIONS.length;
  const done = progress.completed;
  showScreen(ui, `
    <div class="panel title-panel">
      <div class="kicker">MERIDIAN ARCHIPELAGO · SKY COURIER SERVICE</div>
      <h1>SKY COURIER<span>Meridian Run</span></h1>
      <p class="tagline">Fly the mail across six islands. Thread the rings, mind the fuel,
      and bring her down on the strip — in one piece.</p>
      <div class="title-stats">
        <div><b>${done}/${total}</b><span>missions flown</span></div>
        <div><b>${progress.totalCoins}</b><span>sky coins</span></div>
        <div><b>${Object.values(progress.best).filter((b) => b.medal === 'gold').length}</b><span>gold medals</span></div>
      </div>
      <div class="title-buttons">
        <button class="btn primary" id="btn-fly">Fly the next run →</button>
        <button class="btn" id="btn-missions">Choose a mission</button>
        <button class="btn" id="btn-how">How to fly</button>
      </div>
      <p class="footnote">Keyboard + mouse · works offline · your best times stay on this machine</p>
    </div>`);
  document.getElementById('btn-fly').onclick = () => {
    audio.unlock(); audio.click();
    const unlocked = unlockedMissions(progress);
    const next = MISSIONS.find((m) => unlocked.includes(m.id) && !progress.best[m.id]) || MISSIONS[0];
    beginMission(next.id);
  };
  document.getElementById('btn-missions').onclick = () => { audio.click(); showSelect(); };
  document.getElementById('btn-how').onclick = () => { audio.click(); showHow(); };
}

function showSelect() {
  screen = 'select';
  const unlocked = unlockedMissions(progress);
  const cards = MISSIONS.map((m) => {
    const best = progress.best[m.id];
    const locked = !unlocked.includes(m.id);
    const palette = PALETTES[m.palette];
    return `<button class="mission-card ${locked ? 'locked' : ''}" data-id="${m.id}" ${locked ? 'disabled' : ''}>
      <span class="mc-num">M${m.id}</span>
      <span class="mc-name">${m.name}</span>
      <span class="mc-sub">${m.subtitle} · ${palette.name}</span>
      <span class="mc-brief">${m.brief}</span>
      <span class="mc-meta">${m.rings.length} rings · par ${Math.floor(m.parSeconds / 60)}:${String(m.parSeconds % 60).padStart(2, '0')} · ${m.timeLimit / 60} min limit</span>
      <span class="mc-best">${locked ? '🔒 Finish the previous run to unlock' : best ? `${medalStars(best.medal)} Best ${best.score} pts · ${Math.floor(best.seconds / 60)}:${String(best.seconds % 60).padStart(2, '0')}` : 'Not flown yet'}</span>
    </button>`;
  }).join('');
  showScreen(ui, `
    <div class="panel select-panel">
      <h2>Choose a run</h2>
      <p class="panel-sub">Every run starts on Meridian Field with a full tank. Land on the named strip after the last ring.</p>
      <div class="mission-grid">${cards}</div>
      <button class="btn" id="btn-back">← Back</button>
    </div>`);
  document.getElementById('btn-back').onclick = () => { audio.click(); showTitle(); };
  document.querySelectorAll('.mission-card:not(.locked)').forEach((card) => {
    card.onclick = () => { audio.unlock(); audio.click(); beginMission(Number(card.dataset.id)); };
  });
}

function showHow() {
  screen = 'select';
  showScreen(ui, `
    <div class="panel how-panel">
      <h2>How to fly</h2>
      <table class="keys-table">
        <tr><td><b>↑ / ↓</b></td><td>Pitch the nose up and down — climb and descend.</td></tr>
        <tr><td><b>← / →</b></td><td>Bank the wings — the plane turns where it banks.</td></tr>
        <tr><td><b>W / S</b></td><td>Throttle up and down. Full throttle is fast and thirsty.</td></tr>
        <tr><td><b>Shift</b></td><td>Boost — extra speed at extra fuel burn.</td></tr>
        <tr><td><b>P</b></td><td>Pause. <b>M</b> mutes the sound.</td></tr>
      </table>
      <h3>The job</h3>
      <p>Fly through each glowing ring in order — the next one pulses amber and the minimap marks it.
      Gold coins along the way are worth 25 points each. Balloons cost you 25 hull and a chunk of speed.
      Below 26 m/s the wing stalls and the nose drops, so keep the speed up in the turns.</p>
      <h3>Landing</h3>
      <p>Once every ring is flown, come down on the mission's strip: slow (under 48 m/s), gentle (sink under
      6 m/s), lined up with the runway. A hard landing hurts the hull; a crash ends the run. Out of fuel,
      glide — the engine is quiet but the wings still fly.</p>
      <button class="btn primary" id="btn-how-back">Got it — back</button>
    </div>`);
  document.getElementById('btn-how-back').onclick = () => { audio.click(); showTitle(); };
}

function showPaused() {
  paused = true;
  screen = 'paused';
  showScreen(ui, `
    <div class="panel pause-panel">
      <h2>Paused</h2>
      <p class="panel-sub">${missionState.mission.name} — ${missionState.nextRing} of ${missionState.rings.length} rings flown, ${Math.round(missionState.score)} points.</p>
      <div class="title-buttons">
        <button class="btn primary" id="btn-resume">Resume flying</button>
        <button class="btn" id="btn-restart">Restart this run</button>
        <button class="btn" id="btn-quit">Quit to title</button>
      </div>
    </div>`);
  document.getElementById('btn-resume').onclick = () => { audio.click(); resumeFlight(); };
  document.getElementById('btn-restart').onclick = () => { audio.click(); beginMission(missionState.mission.id); };
  document.getElementById('btn-quit').onclick = () => { audio.click(); showTitle(); };
}

function resumeFlight() {
  paused = false;
  screen = 'flying';
  hideScreen(ui);
}

function showDone(result) {
  screen = 'done';
  const m = missionState.mission;
  const best = progress.best[m.id];
  const isRecord = best && best.score === result.total;
  const next = MISSIONS.find((x) => x.id === m.id + 1);
  showScreen(ui, `
    <div class="panel done-panel">
      <div class="kicker">RUN COMPLETE · ${m.name.toUpperCase()}</div>
      <h2>${result.correctStrip ? 'Down safe on ' + result.runwayName : 'Down — wrong strip!'}</h2>
      <div class="medal-big">${medalStars(result.medal)}</div>
      <p class="panel-sub">${result.medal === 'gold' ? 'Gold. The Meridian postmaster buys you a drink.' : result.medal === 'silver' ? 'Silver — a clean run, just off gold pace.' : 'Bronze — delivered, but the clock was not kind.'}</p>
      <table class="score-table">
        <tr><td>Rings flown</td><td>${missionState.rings.length} × 100</td><td>${missionState.rings.length * 100}</td></tr>
        <tr><td>Sky coins</td><td>${missionState.coinsGot} × 25</td><td>${missionState.coinsGot * 25}</td></tr>
        <tr><td>Landing</td><td></td><td>250</td></tr>
        <tr><td>Time bonus</td><td>${Math.round(missionState.timeLeft)} s left</td><td>+${result.timeBonus}</td></tr>
        <tr><td>Hull damage</td><td>${Math.round(plane.damage)}%</td><td>−${result.damagePenalty}</td></tr>
        <tr class="total"><td>Total</td><td>${isRecord ? '★ New best!' : ''}</td><td>${result.total} pts</td></tr>
      </table>
      <p class="panel-sub">Time ${Math.floor(result.seconds / 60)}:${String(Math.floor(result.seconds % 60)).padStart(2, '0')} · par ${Math.floor(m.parSeconds / 60)}:${String(m.parSeconds % 60).padStart(2, '0')}</p>
      <div class="title-buttons">
        <button class="btn primary" id="btn-again">Fly it again</button>
        ${next ? `<button class="btn" id="btn-next">Next run: ${next.name} →</button>` : ''}
        <button class="btn" id="btn-done-title">Title screen</button>
      </div>
    </div>`);
  document.getElementById('btn-again').onclick = () => { audio.click(); beginMission(m.id); };
  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.onclick = () => { audio.click(); beginMission(next.id); };
  document.getElementById('btn-done-title').onclick = () => { audio.click(); showTitle(); };
}

function showCrashed(reason) {
  screen = 'crashed';
  const m = missionState.mission;
  showScreen(ui, `
    <div class="panel crash-panel">
      <div class="kicker">RUN FAILED · ${m.name.toUpperCase()}</div>
      <h2>${reason}</h2>
      <p class="panel-sub">Rings flown: ${missionState.nextRing} of ${missionState.rings.length} · Coins: ${missionState.coinsGot} · Time in the air: ${Math.floor(missionState.elapsed / 60)}:${String(Math.floor(missionState.elapsed % 60)).padStart(2, '0')}</p>
      <div class="title-buttons">
        <button class="btn primary" id="btn-retry">Try again</button>
        <button class="btn" id="btn-crash-title">Title screen</button>
      </div>
    </div>`);
  document.getElementById('btn-retry').onclick = () => { audio.click(); beginMission(m.id); };
  document.getElementById('btn-crash-title').onclick = () => { audio.click(); showTitle(); };
}

// --- mission flow -----------------------------------------------------------
function beginMission(id) {
  missionState = startMission(id);
  plane = makePlaneState(missionState.mission.start);
  runwayCalloutDone = false;
  paused = false;
  screen = 'flying';
  hideScreen(ui);
  ui.hud.hidden = false;
  const m = missionState.mission;
  showToast(ui, `M${m.id} · ${m.name} — ${m.rings.length} rings, land on ${RUNWAYS[m.finishRunway].name}`, 4200);
}

function onMissionEvent(ev) {
  if (!missionState) return;
  if (ev.type === 'ring') {
    audio.ring();
    showToast(ui, ev.index + 1 >= ev.total ? 'Last ring! Now land on the strip.' : `Ring ${ev.index + 1} of ${ev.total} — +100`, 1800);
  } else if (ev.type === 'coin') {
    audio.coin();
  } else if (ev.type === 'allRings') {
    showToast(ui, `All rings flown — land on ${RUNWAYS[missionState.mission.finishRunway].name}`, 3600);
  } else if (ev.type === 'balloon') {
    audio.bump();
    showToast(ui, `Balloon strike! Hull ${Math.round(100 - plane.damage)}% left`, 2200);
  } else if (ev.type === 'fail') {
    audio.crash();
    showCrashed(ev.reason);
  }
}

function handleTouchdown(info) {
  if (!missionState || missionState.finished || missionState.failed) return;
  const outcome = judgeTouchdown(missionState, plane, info);
  if (outcome.outcome === 'crash') {
    audio.crash();
    missionState.failed = true;
    showCrashed(outcome.reason);
  } else if (outcome.outcome === 'landed') {
    audio.land();
    audio.win();
    const result = { ...outcome, coinsGot: missionState.coinsGot };
    recordResult(progress, missionState.mission.id, result);
    showDone(result);
  } else if (outcome.outcome === 'hard' || outcome.outcome === 'fast') {
    audio.bump();
    showToast(ui, outcome.reason, 2600);
  } else {
    showToast(ui, outcome.reason, 2600);
  }
}

// --- input ------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  audio.unlock();
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'p' && screen === 'flying') showPaused();
  else if (e.key.toLowerCase() === 'p' && screen === 'paused') resumeFlight();
  if (e.key.toLowerCase() === 'm') {
    audio.setMuted(!audio.muted);
    showToast(ui, audio.muted ? 'Sound off' : 'Sound on', 1200);
  }
  if (e.key === 'Enter' && screen === 'title') {
    document.getElementById('btn-fly')?.click();
  }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
ui.pauseBtn.addEventListener('click', () => {
  if (screen === 'flying') { audio.click(); showPaused(); }
});

function readInput() {
  return {
    left: !!keys['arrowleft'] || !!keys['a'],
    right: !!keys['arrowright'] || !!keys['d'],
    up: !!keys['arrowup'],
    down: !!keys['arrowdown'],
    throttleUp: !!keys['w'] || !!keys['='] || !!keys['+'],
    throttleDown: !!keys['s'] || !!keys['-'],
    boost: !!keys['shift'],
  };
}

// --- screenshot poses -------------------------------------------------------
const SHOT_POSES = {
  // Mid-flight through a ring over the lagoon, afternoon light.
  cover: { mission: 2, ringIndex: 2, beforeRing: 260, altitude: 108, headingDeg: -8, speed: 55 },
  // Night approach to the home strip, runway lights ahead.
  night: { mission: 4, ringIndex: 8, beforeRing: 700, altitude: 70, headingDeg: 175, speed: 42 },
  // Low through the Gull mountain gap, balloons in the pass.
  pass: { mission: 5, ringIndex: 3, beforeRing: 320, altitude: 112, headingDeg: -85, speed: 58 },
};

function applyShotPose(name) {
  const pose = SHOT_POSES[name];
  if (!pose) return false;
  missionState = startMission(pose.mission);
  // Fly the earlier rings so the pose shows real progress on the HUD.
  for (let i = 0; i < pose.ringIndex; i++) {
    missionState.rings[i].done = true;
    missionState.nextRing = i + 1;
    missionState.score += 100;
  }
  missionState.coinsGot = 2;
  missionState.coins[0].taken = true;
  missionState.coins[1].taken = true;
  missionState.score += 50;
  const ring = missionState.rings[pose.ringIndex];
  const a = degToRad(ring.headingDeg);
  const fx = Math.sin(a);
  const fz = -Math.cos(a);
  plane = makePlaneState({
    x: ring.x - fx * pose.beforeRing,
    z: ring.z - fz * pose.beforeRing,
    headingDeg: ring.headingDeg,
    altitude: pose.altitude,
    speed: pose.speed,
  });
  plane.throttle = 0.72;
  missionState.nextRingDist = pose.beforeRing;
  screen = 'flying';
  hideScreen(ui);
  ui.hud.hidden = false;
  return true;
}

// --- main loop --------------------------------------------------------------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000 || 0.016, 0.05);
  lastTime = now;

  if (screen === 'flying' && !paused && missionState && plane) {
    if (shotMode) {
      // A screenshot pose is frozen: the plane holds its place so the
      // captured frame is the same every time it is taken.
      updateHud(ui, {
        plane,
        mission: missionState.mission,
        missionState,
        score: missionState.score,
        timeLeft: missionState.timeLeft,
        coinsGot: missionState.coinsGot,
      });
      if (!shotReady) {
        shotReady = true;
        window.__shotReady = true;
      }
    } else {
      const input = readInput();
      const info = stepPlane(plane, input, missionState.mission.wind, dt);
      updateMission(missionState, plane, dt, onMissionEvent);
      if (info.event === 'touchdown') handleTouchdown(info);
      // A fast touchdown only warns, so a pilot who rolls to a stop on the
      // right strip after it still finishes the run.
      if (plane.onGround && missionState.done && !missionState.finished && !missionState.failed && plane.speed < 6) {
        const strip = runwayAt(plane.x, plane.z);
        if (strip && strip.key === missionState.mission.finishRunway) {
          handleTouchdown({ event: 'touchdown', sink: 0, speed: plane.speed, ground: groundHeight(plane.x, plane.z), onRunway: true, runway: strip.key });
        }
      }
      audio.update(plane);
    }
    // Runway callout when the destination strip comes into range.
    if (missionState.done && !runwayCalloutDone) {
      const near = nearestRunway(plane.x, plane.z);
      if (near && near.key === missionState.mission.finishRunway && near.dist < 900) {
        runwayCalloutDone = true;
        showToast(ui, `${near.runway.name} ahead — slow down and line up`, 3200);
      }
    }
    // Next-ring guidance for the HUD arrow: project the ring, clamp to the frame.
    const ring = nextRingOf(missionState);
    if (ring) {
      const cam = makeCamera(plane, canvas.width, canvas.height);
      const p = projectPoint(cam, ring.x, ring.y, ring.z);
      const margin = 90;
      if (p && p.x > margin && p.x < canvas.width - margin && p.y > margin && p.y < canvas.height - margin) {
        missionState.nextRingOnScreen = true;
      } else {
        const cx = p ? p.x : canvas.width / 2;
        const cy = p ? p.y : canvas.height / 2;
        const ang = Math.atan2(cy - canvas.height / 2, cx - canvas.width / 2);
        missionState.nextRingOnScreen = false;
        missionState.nextRingAngle = (ang * 180) / Math.PI + 90;
        missionState.nextRingScreenX = canvas.width / 2 + Math.cos(ang) * (Math.min(canvas.width, canvas.height) / 2 - 70);
        missionState.nextRingScreenY = canvas.height / 2 + Math.sin(ang) * (Math.min(canvas.width, canvas.height) / 2 - 70);
      }
    }
    updateHud(ui, {
      plane,
      mission: missionState.mission,
      missionState,
      score: missionState.score,
      timeLeft: missionState.timeLeft,
      coinsGot: missionState.coinsGot,
    });
  }

  // Draw the world whenever a flight is on screen; menus draw a slow
  // backdrop flight of their own so the title never sits on black.
  if (screen === 'flying' || screen === 'paused' || screen === 'done' || screen === 'crashed') {
    if (plane && missionState) {
      drawFrame(ctx, {
        plane,
        mission: missionState.mission,
        paletteName: missionState.mission.palette,
        clouds,
        time: now,
        rings: missionState.rings,
        coins: missionState.coins,
        balloons: missionState.balloons,
        nextRingIndex: missionState.nextRing,
        rain: !!missionState.mission.rain,
      });
    }
  } else {
    // Idle backdrop: a slow orbit over the home island for the menus.
    const demoPlane = {
      x: Math.sin(now / 26000) * 700,
      z: Math.cos(now / 26000) * 700,
      y: 150,
      heading: (now / 26000 + Math.PI / 2) % (Math.PI * 2),
      pitch: 0,
      bank: 0.25,
      speed: 50,
      throttle: 0.6,
      fuel: 100,
      damage: 0,
      verticalSpeed: 0,
      onGround: false,
      engineOut: false,
    };
    drawFrame(ctx, {
      plane: demoPlane,
      mission: MISSIONS[0],
      paletteName: 'morning',
      clouds,
      time: now,
      rings: [],
      coins: [],
      balloons: [],
      nextRingIndex: -1,
      rain: false,
    });
  }
}

// --- boot -------------------------------------------------------------------
(function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 1);
  void seed;
  if (shot === 'menu') {
    showTitle();
  } else if (shot && SHOT_POSES[shot]) {
    shotMode = shot;
    applyShotPose(shot);
  } else {
    showTitle();
  }
  window.__game = {
    get screen() { return screen; },
    get plane() { return plane; },
    get missionState() { return missionState; },
    get progress() { return progress; },
    beginMission,
    showTitle,
  };
  window.__shotReady = false;
  requestAnimationFrame(frame);
})();
