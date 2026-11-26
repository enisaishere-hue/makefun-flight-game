// Meridian Sky Courier — how the plane flies.
// A small, honest flight model: throttle sets the speed the engine wants,
// the wings bank the plane into a turn, the nose pitches it up or down, and
// below stall speed the wing gives up and the nose drops. Wind pushes the
// whole picture sideways. Fuel burns, damage accumulates, and the ground is
// always there to be respected.

import { WORLD, PLANE } from './config.js';
import { groundHeight, runwayAt } from './terrain.js';
import { clamp, angleDelta, degToRad } from './random.js';

export function makePlaneState(start) {
  return {
    x: start.x,
    z: start.z,
    y: start.altitude,
    heading: degToRad(start.headingDeg),
    pitch: 0, // radians, positive is nose up
    bank: 0, // radians, positive is right wing down
    speed: start.speed,
    throttle: 0.6,
    boost: false,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    verticalSpeed: 0,
    onGround: false,
    groundedSpeed: 0, // rolling speed while the wheels are down
    stalled: false,
    engineOut: false,
  };
}

// Keys held down, as { left, right, up, down, throttleUp, throttleDown, boost }.
export function stepPlane(p, input, wind, dt) {
  const prevY = p.y;

  // --- throttle -----------------------------------------------------------
  if (input.throttleUp) p.throttle = clamp(p.throttle + dt * 0.55, 0, 1);
  if (input.throttleDown) p.throttle = clamp(p.throttle - dt * 0.55, 0, 1);
  p.boost = !!input.boost && p.throttle > 0.85 && p.fuel > 0 && !p.engineOut;

  // --- bank and pitch targets from the stick ------------------------------
  const targetBank = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * degToRad(WORLD.maxBankDeg);
  const targetPitch = ((input.up ? 1 : 0) - (input.down ? 1 : 0)) * degToRad(WORLD.maxPitchDeg);
  const bankRate = p.onGround ? 0 : 2.4;
  p.bank += clamp(targetBank - p.bank, -bankRate * dt, bankRate * dt);
  p.pitch += clamp(targetPitch - p.pitch, -1.8 * dt, 1.8 * dt);

  // --- speed: the engine pulls toward its target, drag pulls back ---------
  // At idle the target sits well below stall speed: a plane with no thrust
  // cannot hold level flight, it trades height for speed or it sinks.
  const minSpeed = 14;
  let targetSpeed = minSpeed + (WORLD.cruiseSpeed - minSpeed) * p.throttle;
  if (p.boost) targetSpeed = WORLD.boostSpeed;
  if (p.engineOut || p.fuel <= 0) targetSpeed = 0;
  const accel = p.onGround ? 14 : 9;
  p.speed += clamp(targetSpeed - p.speed, -accel * dt * 1.4, accel * dt);
  p.speed = clamp(p.speed, 0, WORLD.maxSpeed + 12);

  // --- stall: too slow and the wing stops flying --------------------------
  p.stalled = !p.onGround && p.speed < WORLD.stallSpeed && p.pitch > -0.05;
  if (p.stalled) {
    p.pitch = Math.max(p.pitch - dt * 0.9, degToRad(-14));
  }

  // --- turning: banked wings pull the nose around -------------------------
  if (!p.onGround && p.speed > 4) {
    const turnRate = (WORLD.gravity * Math.tan(p.bank)) / Math.max(p.speed, 12);
    p.heading += turnRate * dt;
  }

  // --- climb and sink ------------------------------------------------------
  let climb = Math.sin(p.pitch) * p.speed;
  if (p.stalled) climb -= 14;
  if (p.onGround) climb = 0;
  p.verticalSpeed = climb;
  p.y += climb * dt;

  // --- forward motion, plus the wind shoving the plane sideways -----------
  const forwardX = Math.sin(p.heading);
  const forwardZ = -Math.cos(p.heading);
  p.x += forwardX * p.speed * dt;
  p.z += forwardZ * p.speed * dt;
  if (wind && wind.speed > 0) {
    const gust = 1 + (wind.gust || 0) * 0.4 * Math.sin(performance.now() / 2600);
    const wx = Math.sin(degToRad(wind.headingDeg)) * wind.speed * gust;
    const wz = -Math.cos(degToRad(wind.headingDeg)) * wind.speed * gust;
    p.x += wx * dt;
    p.z += wz * dt;
  }

  // --- stay inside the archipelago ----------------------------------------
  p.x = clamp(p.x, -2950, 2950);
  p.z = clamp(p.z, -2950, 2950);

  // --- fuel ----------------------------------------------------------------
  if (!p.onGround || p.speed > 5) {
    const burn = PLANE.fuelBurnIdle + p.throttle * PLANE.fuelBurnFull + (p.boost ? PLANE.boostBurn : 0);
    p.fuel = Math.max(0, p.fuel - burn * dt);
    if (p.fuel <= 0) p.engineOut = true;
  }

  // --- the ground ----------------------------------------------------------
  const ground = groundHeight(p.x, p.z);
  const wheelY = ground + WORLD.groundClearance;
  if (p.y <= wheelY) {
    p.y = wheelY;
    if (!p.onGround) {
      // Touchdown: this step returns what happened so the mission code can judge it.
      const sink = -climb;
      const strip = runwayAt(p.x, p.z);
      p.onGround = true;
      p.groundedSpeed = p.speed;
      p.pitch = 0;
      p.bank *= 0.3;
      return { event: 'touchdown', sink, speed: p.speed, ground, onRunway: !!strip, runway: strip ? strip.key : null };
    }
    p.onGround = true;
    // Rolling: throttle spins the wheels up, drag slows them down. Forward
    // motion already happened above, at the rolling speed.
    p.groundedSpeed = clamp(p.groundedSpeed + (p.throttle * 16 - 3.5) * dt, 0, WORLD.maxSpeed);
    p.speed = p.groundedSpeed;
    if (p.throttle > 0.75 && p.groundedSpeed > 30 && p.pitch > 0.02) {
      p.onGround = false;
      p.y += 0.5;
    }
    return { event: 'rolling' };
  }
  if (p.onGround && p.y > wheelY + 0.5) {
    p.onGround = false;
  }
  void prevY;
  return { event: 'airborne' };
}

// A gentle autopilot for screenshot poses: holds a steady course and altitude.
export function autopilotInput(p, targetHeadingDeg, targetAltitude) {
  const headingErr = angleDelta(p.heading, degToRad(targetHeadingDeg));
  const altErr = targetAltitude - p.y;
  return {
    left: headingErr < -0.03,
    right: headingErr > 0.03,
    up: altErr > 6,
    down: altErr < -6,
    throttleUp: p.speed < 52,
    throttleDown: p.speed > 58,
    boost: false,
  };
}

// Heading the pilot should fly to reach a point, in degrees.
export function bearingTo(fromX, fromZ, toX, toZ) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  let d = (Math.atan2(dx, -dz) * 180) / Math.PI;
  if (d < 0) d += 360;
  return d;
}

export function distanceTo(fromX, fromZ, toX, toZ) {
  return Math.hypot(toX - fromX, toZ - fromZ);
}
