// Meridian Sky Courier — one mission at a time.
// A mission is a run through its rings in order, coins to pick up on the
// way, balloons to avoid and a runway to land on at the end. This module
// owns the mission state: what is collected, what is left, the clock, the
// score and the medal the pilot takes home. Best results are kept in
// localStorage so the mission select can show them.

import { MISSIONS, SCORE, MEDAL, STORAGE_KEY } from './config.js';
import { RUNWAYS } from './terrain.js';
import { distanceTo } from './physics.js';

const BALLOON_COLOURS = [
  { colour: '#d94f3d', colourLight: '#ff8a7a' },
  { colour: '#3d7ad9', colourLight: '#7aa8ff' },
  { colour: '#e0a83c', colourLight: '#ffd76e' },
  { colour: '#4fae62', colourLight: '#8ad99a' },
];

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { best: {}, totalCoins: 0, completed: 0 };
    const parsed = JSON.parse(raw);
    return {
      best: parsed.best || {},
      totalCoins: parsed.totalCoins || 0,
      completed: parsed.completed || 0,
    };
  } catch {
    return { best: {}, totalCoins: 0, completed: 0 };
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private mode or a full store: the game plays on without saving.
  }
}

export function medalFor(mission, seconds) {
  if (seconds <= mission.parSeconds * MEDAL.gold) return 'gold';
  if (seconds <= mission.parSeconds * MEDAL.silver) return 'silver';
  return 'bronze';
}

export function medalRank(medal) {
  return { gold: 3, silver: 2, bronze: 1, none: 0 }[medal] || 0;
}

export function startMission(missionId) {
  const mission = MISSIONS.find((m) => m.id === missionId);
  const rings = mission.rings.map((r, i) => ({
    ...r, r: 26, done: false, index: i,
  }));
  const coins = mission.coins.map((c) => ({ ...c, taken: false }));
  const balloons = mission.balloons.map((b, i) => ({
    ...b,
    r: 12,
    ...BALLOON_COLOURS[i % BALLOON_COLOURS.length],
    hit: false,
  }));
  return {
    mission,
    rings,
    coins,
    balloons,
    nextRing: 0,
    coinsGot: 0,
    score: 0,
    elapsed: 0,
    timeLeft: mission.timeLimit,
    done: false, // all rings flown
    finished: false, // landed after the rings
    failed: false,
    failReason: '',
    landedRunway: null,
    // Guidance for the HUD arrow, filled in each frame by updateMission.
    nextRingDist: 0,
    nextRingOnScreen: true,
    nextRingAngle: 0,
    nextRingScreenX: 0,
    nextRingScreenY: 0,
  };
}

// The ring the pilot is chasing right now, or null once they are all flown.
export function nextRingOf(state) {
  return state.rings[state.nextRing] || null;
}

// Called every frame: ring passes, coin pickups, balloon strikes, the clock.
export function updateMission(state, plane, dt, onEvent) {
  if (state.finished || state.failed) return;
  state.elapsed += dt;
  state.timeLeft = Math.max(0, state.mission.timeLimit - state.elapsed);
  if (state.timeLeft <= 0 && !state.done) {
    state.failed = true;
    state.failReason = 'Out of time — the parcels never arrived.';
    onEvent({ type: 'fail', reason: state.failReason });
    return;
  }

  const ring = nextRingOf(state);
  if (ring) {
    const d = distanceTo(plane.x, plane.z, ring.x, ring.z);
    const dy = Math.abs(plane.y - ring.y);
    state.nextRingDist = d;
    // Passed through the hoop: close in plan and close in height, and
    // A pass counts if the plane is inside the ring's own circle: flying
    // through the drawn ring should always count, so the capture uses the
    // full radius rather than a shrunk one (a near-miss through the rim
    // that does not count feels broken, not challenging).
    if (d < ring.r && dy < ring.r) {
      ring.done = true;
      state.nextRing++;
      state.score += SCORE.ring;
      onEvent({ type: 'ring', index: ring.index, total: state.rings.length });
      if (state.nextRing >= state.rings.length) {
        state.done = true;
        onEvent({ type: 'allRings' });
      }
    }
  }

  for (const coin of state.coins) {
    if (coin.taken) continue;
    const d = Math.hypot(plane.x - coin.x, plane.y - coin.y, plane.z - coin.z);
    if (d < 14) {
      coin.taken = true;
      state.coinsGot++;
      state.score += SCORE.coin;
      onEvent({ type: 'coin' });
    }
  }

  for (const balloon of state.balloons) {
    if (balloon.hit) continue;
    const d = Math.hypot(plane.x - balloon.x, plane.y - balloon.y, plane.z - balloon.z);
    if (d < balloon.r + 4) {
      balloon.hit = true;
      plane.damage = Math.min(100, plane.damage + 25);
      plane.speed *= 0.65;
      onEvent({ type: 'balloon', damage: plane.damage });
      if (plane.damage >= 100) {
        state.failed = true;
        state.failReason = 'The hull gave out after the balloon strike.';
        onEvent({ type: 'fail', reason: state.failReason });
        return;
      }
    }
  }
}

// Judge a touchdown: where it happened, how hard, and whether the mission
// is complete. Returns an outcome the main loop turns into a screen.
export function judgeTouchdown(state, plane, info) {
  const mission = state.mission;
  if (info.ground <= 0.4 && !info.onRunway) {
    return { outcome: 'crash', reason: 'Ditched in the sea — the courier goes down with the mail.' };
  }
  if (!info.onRunway) {
    if (info.sink > 10 || info.speed > 55) {
      return { outcome: 'crash', reason: 'Came down hard on rough ground.' };
    }
    return { outcome: 'rough', reason: 'Down in the rough — throttle up to take off again.' };
  }
  if (info.sink > 10) {
    return { outcome: 'crash', reason: 'Slammed onto the strip — the undercarriage gave way.' };
  }
  if (info.sink > 6) {
    plane.damage = Math.min(100, plane.damage + 40);
    if (plane.damage >= 100) {
      return { outcome: 'crash', reason: 'A hard landing broke the plane apart.' };
    }
    return { outcome: 'hard', reason: 'A hard landing — the hull took a beating.' };
  }
  if (info.speed > 48) {
    plane.damage = Math.min(100, plane.damage + 15);
    return { outcome: 'fast', reason: 'Too fast on touchdown — ease off the throttle next time.' };
  }
  if (!state.done) {
    return { outcome: 'early', reason: `Landed early — ${state.rings.length - state.nextRing} ring(s) still to fly.` };
  }
  // A clean landing on the mission's own strip, rings all flown.
  const target = RUNWAYS[mission.finishRunway];
  const correctStrip = info.runway === mission.finishRunway;
  if (!correctStrip) {
    return { outcome: 'early', reason: `Wrong strip — this is ${RUNWAYS[info.runway].name}. The mission needs ${target.name}.` };
  }
  const timeBonus = Math.round(state.timeLeft * SCORE.timeBonusPerSecond);
  const damagePenalty = Math.round(plane.damage * SCORE.damagePenaltyPerPoint);
  const total = state.score + SCORE.landing + timeBonus - damagePenalty;
  state.score = total;
  state.finished = true;
  state.landedRunway = info.runway;
  return {
    outcome: 'landed',
    correctStrip,
    runwayName: target.name,
    timeBonus,
    damagePenalty,
    total,
    medal: medalFor(mission, state.elapsed),
    seconds: state.elapsed,
  };
}

export function recordResult(progress, missionId, result) {
  const prev = progress.best[missionId];
  const better = !prev || result.total > prev.score
    || (result.total === prev.score && result.seconds < prev.seconds);
  if (better) {
    progress.best[missionId] = {
      score: result.total,
      seconds: Math.round(result.seconds),
      medal: result.medal,
    };
  }
  progress.totalCoins += result.coinsGot || 0;
  const wasCompleted = !!prev;
  if (!wasCompleted) progress.completed++;
  saveProgress(progress);
  return { better, wasCompleted };
}

export function unlockedMissions(progress) {
  // Mission 1 is always open; each finished mission opens the next.
  const unlocked = [1];
  for (let i = 1; i < MISSIONS.length; i++) {
    if (progress.best[i]) unlocked.push(i + 1);
  }
  return unlocked;
}
