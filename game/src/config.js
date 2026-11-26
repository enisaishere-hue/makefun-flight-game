// Meridian Sky Courier — tuning constants, world palettes and the mission table.
// Every number that shapes how the plane flies, how the world looks and what
// each mission asks of the pilot lives here, so the rest of the game reads it
// instead of hiding magic numbers in the physics or the renderer.

export const WORLD = {
  size: 6000, // the archipelago spans -3000..3000 on both axes, in metres
  seaLevel: 0,
  gravity: 9.81,
  stallSpeed: 26, // metres per second; slower than this and the nose drops
  maxSpeed: 88, // flat out, full throttle, level flight
  cruiseSpeed: 62, // the speed full throttle settles at without boost
  boostSpeed: 96, // Shift held: faster, thirstier
  maxBankDeg: 55, // how far the wings can roll into a turn
  maxPitchDeg: 18, // how far the nose can rise or fall
  ringRadius: 26, // metres; fly through the glowing hoop to collect it
  coinRadius: 6,
  groundClearance: 1.6, // metres of wheels below the fuselage
};

export const PLANE = {
  fuelCapacity: 140,
  // fuel burned per second: a trickle at idle, a gulp at full throttle.
  // A full tank lasts about four minutes at cruise — enough for the Grand
  // Tour with a margin, short enough that boost stays a real decision.
  fuelBurnIdle: 0.14,
  fuelBurnFull: 0.45,
  boostBurn: 1.8,
  damagePerBalloon: 25, // a balloon strike hurts, it does not kill outright
  damageHardLanding: 40,
  landingMaxSpeed: 48, // touch down slower than this or the gear complains
  landingMaxSink: 6, // metres per second of descent at touchdown
  crashSink: 10, // sink faster than this and the landing becomes a crash
};

// One palette per time of day. Missions pick one; the renderer and the HUD
// both read it, so sky, sea, light and instruments stay in one style.
export const PALETTES = {
  morning: {
    name: 'Morning',
    skyTop: '#2f6fb8', skyMid: '#7db3e2', skyLow: '#cfe8f5',
    sun: '#fff3c4', sunX: 0.72, sunY: 0.2,
    seaDeep: '#0d4d7a', seaShallow: '#2fa8a0', seaFar: '#7fb8d8',
    fog: 'rgba(207,232,245,0.55)',
    ground: { sand: '#e8d9a0', grass: '#5da24a', meadow: '#79b657', rock: '#8a7f72', snow: '#f2f6f8' },
    runway: '#3c4148', runwayLine: '#f5d76e',
    night: false,
  },
  afternoon: {
    name: 'Afternoon',
    skyTop: '#2a63a8', skyMid: '#6fa8d8', skyLow: '#d6ecf7',
    sun: '#ffedb0', sunX: 0.25, sunY: 0.16,
    seaDeep: '#0b4a78', seaShallow: '#25a39b', seaFar: '#6fb0d4',
    fog: 'rgba(214,236,247,0.5)',
    ground: { sand: '#e9dca6', grass: '#57a047', meadow: '#74b356', rock: '#8d8172', snow: '#f4f8fa' },
    runway: '#3a3f46', runwayLine: '#f5d76e',
    night: false,
  },
  storm: {
    name: 'Storm',
    skyTop: '#3a4450', skyMid: '#6b7683', skyLow: '#aab3ba',
    sun: '#e8e4d2', sunX: 0.68, sunY: 0.14,
    seaDeep: '#16384e', seaShallow: '#2c6b74', seaFar: '#5d7d8c',
    fog: 'rgba(170,179,186,0.6)',
    ground: { sand: '#cbbd8e', grass: '#4c8a42', meadow: '#5f9c4c', rock: '#7d7468', snow: '#e8edef' },
    runway: '#33373d', runwayLine: '#f5d76e',
    night: false,
  },
  dusk: {
    name: 'Dusk',
    skyTop: '#1c2a52', skyMid: '#7a4a7e', skyLow: '#f2a35e',
    sun: '#ff9e4d', sunX: 0.5, sunY: 0.34,
    seaDeep: '#12264a', seaShallow: '#2c4a6e', seaFar: '#6e5a7e',
    fog: 'rgba(242,163,94,0.4)',
    ground: { sand: '#b99a6e', grass: '#3f7a3a', meadow: '#527f45', rock: '#6b5f56', snow: '#dfe6ea' },
    runway: '#2e3238', runwayLine: '#ffd76e',
    night: true,
  },
};

// The six courier runs. Each one names its start and finish strips, the rings
// in order, the coins scattered along the way, the balloons in the sky, the
// wind that pushes the plane around, the par time for a gold medal and the
// palette the mission is flown in.
export const MISSIONS = [
  {
    id: 1, name: 'First Flight', subtitle: 'Lagoon Loop',
    brief: 'Your first run as a Meridian courier. Thread five rings over the home lagoon, then bring her down on the home strip. Gentle air, no surprises.',
    palette: 'morning', parSeconds: 150, timeLimit: 300,
    start: { x: 0, z: 420, headingDeg: 0, altitude: 90, speed: 45 },
    finishRunway: 'home',
    rings: [
      { x: 0, y: 95, z: -150, headingDeg: 0 },
      { x: -260, y: 100, z: -700, headingDeg: -18 },
      { x: -560, y: 110, z: -300, headingDeg: -55 },
      { x: -420, y: 105, z: 320, headingDeg: -125 },
      { x: 0, y: 95, z: 420, headingDeg: -180 },
    ],
    coins: [
      { x: -120, y: 98, z: -420 }, { x: -420, y: 106, z: -520 },
      { x: -520, y: 108, z: 40 }, { x: -220, y: 102, z: 380 },
      { x: 120, y: 96, z: 120 },
    ],
    balloons: [],
    wind: { speed: 0, headingDeg: 0, gust: 0 },
  },
  {
    id: 2, name: 'Island Hop', subtitle: 'Kestrel Mail',
    brief: 'The mail for Kestrel Isle is late. Cross the strait, thread seven rings, and set down on Kestrel’s short strip. A light sea breeze will nudge you sideways.',
    palette: 'afternoon', parSeconds: 210, timeLimit: 360,
    start: { x: 0, z: 420, headingDeg: 0, altitude: 90, speed: 45 },
    finishRunway: 'kestrel',
    rings: [
      { x: 0, y: 95, z: -150, headingDeg: 0 },
      { x: -180, y: 105, z: -900, headingDeg: -10 },
      { x: -350, y: 115, z: -1500, headingDeg: -8 },
      { x: -250, y: 120, z: -1950, headingDeg: 6 },
      { x: -420, y: 110, z: -2250, headingDeg: -20 },
      { x: -380, y: 100, z: -2560, headingDeg: -160 },
      { x: -400, y: 90, z: -2150, headingDeg: 170 },
    ],
    coins: [
      { x: -90, y: 100, z: -520 }, { x: -280, y: 110, z: -1200 },
      { x: -320, y: 116, z: -1750 }, { x: -330, y: 104, z: -2400 },
      { x: -500, y: 100, z: -2100 }, { x: 60, y: 92, z: -300 },
    ],
    balloons: [
      { x: -700, y: 160, z: -1200 }, { x: 200, y: 180, z: -1800 },
    ],
    wind: { speed: 4, headingDeg: 90, gust: 1.5 },
  },
  {
    id: 3, name: 'Storm Courier', subtitle: 'Coral Run',
    brief: 'A squall is sitting over Coral Isle and the medicine cannot wait. Fly through the rain, mind the gusts, thread eight rings and land on Coral in the wet.',
    palette: 'storm', parSeconds: 240, timeLimit: 420, rain: true,
    start: { x: 0, z: 420, headingDeg: 0, altitude: 90, speed: 45 },
    finishRunway: 'coral',
    rings: [
      { x: 120, y: 95, z: -250, headingDeg: 8 },
      { x: 700, y: 105, z: -500, headingDeg: 35 },
      { x: 1300, y: 115, z: -550, headingDeg: 55 },
      { x: 1900, y: 110, z: -700, headingDeg: 70 },
      { x: 2250, y: 100, z: -500, headingDeg: 100 },
      { x: 2400, y: 95, z: -200, headingDeg: 150 },
      { x: 2350, y: 90, z: 150, headingDeg: 175 },
      { x: 2400, y: 85, z: -450, headingDeg: -170 },
    ],
    coins: [
      { x: 400, y: 100, z: -380 }, { x: 1000, y: 110, z: -530 },
      { x: 1600, y: 112, z: -620 }, { x: 2100, y: 104, z: -620 },
      { x: 2380, y: 96, z: -40 }, { x: 2280, y: 88, z: 60 },
    ],
    balloons: [
      { x: 900, y: 170, z: -700 }, { x: 1700, y: 190, z: -350 },
      { x: 2600, y: 150, z: -900 },
    ],
    wind: { speed: 9, headingDeg: 250, gust: 5 },
  },
  {
    id: 4, name: 'Night Mail', subtitle: 'Beacon Lights',
    brief: 'Last light is gone and the beacon run is yours. Nine rings out to Beacon Rock and home again, by instruments and runway lights. Fly the gauges, not the dark.',
    palette: 'dusk', parSeconds: 270, timeLimit: 480,
    start: { x: 0, z: 420, headingDeg: 0, altitude: 90, speed: 45 },
    finishRunway: 'home',
    rings: [
      { x: 0, y: 100, z: -300, headingDeg: 0 },
      { x: 600, y: 110, z: -900, headingDeg: 25 },
      { x: 1300, y: 120, z: -1500, headingDeg: 30 },
      { x: 2000, y: 125, z: -2100, headingDeg: 35 },
      { x: 2550, y: 130, z: -2550, headingDeg: 40 },
      { x: 2200, y: 120, z: -1900, headingDeg: 140 },
      { x: 1500, y: 110, z: -1300, headingDeg: 150 },
      { x: 700, y: 105, z: -700, headingDeg: 160 },
      { x: 100, y: 95, z: -100, headingDeg: 175 },
    ],
    coins: [
      { x: 300, y: 104, z: -600 }, { x: 950, y: 114, z: -1200 },
      { x: 1650, y: 122, z: -1800 }, { x: 2400, y: 128, z: -2350 },
      { x: 1900, y: 116, z: -1600 }, { x: 1100, y: 108, z: -1000 },
      { x: 350, y: 100, z: -400 },
    ],
    balloons: [
      { x: 1000, y: 150, z: -1100 }, { x: 1800, y: 170, z: -1600 },
    ],
    wind: { speed: 5, headingDeg: 200, gust: 2 },
  },
  {
    id: 5, name: 'Mountain Pass', subtitle: 'Gull Gap',
    brief: 'Gull Isle’s clinic needs the supplies, and the only way in is low through the gap between its twin peaks. Eight low rings, balloons drifting in the pass, no room to climb out.',
    palette: 'morning', parSeconds: 220, timeLimit: 400,
    start: { x: 0, z: 420, headingDeg: 0, altitude: 90, speed: 45 },
    finishRunway: 'gull',
    rings: [
      { x: -500, y: 95, z: -100, headingDeg: -30 },
      { x: -1100, y: 100, z: 100, headingDeg: -60 },
      { x: -1700, y: 110, z: 350, headingDeg: -75 },
      { x: -2200, y: 115, z: 600, headingDeg: -85 },
      { x: -2500, y: 120, z: 750, headingDeg: -100 },
      { x: -2620, y: 115, z: 950, headingDeg: -140 },
      { x: -2580, y: 100, z: 1150, headingDeg: 170 },
      { x: -2600, y: 85, z: 850, headingDeg: 10 },
    ],
    coins: [
      { x: -800, y: 98, z: 0 }, { x: -1400, y: 106, z: 220 },
      { x: -2000, y: 112, z: 480 }, { x: -2400, y: 118, z: 680 },
      { x: -2600, y: 108, z: 1050 }, { x: -1900, y: 100, z: 300 },
    ],
    balloons: [
      { x: -1500, y: 150, z: 300 }, { x: -2100, y: 170, z: 550 },
      { x: -2450, y: 160, z: 850 }, { x: -2700, y: 140, z: 600 },
    ],
    wind: { speed: 7, headingDeg: 120, gust: 3 },
  },
  {
    id: 6, name: 'Grand Tour', subtitle: 'Meridian Circuit',
    brief: 'The whole archipelago in one sortie: twelve rings, every island, one tank of fuel and a hard clock. Fly clean, fly fast, and bring her home.',
    palette: 'afternoon', parSeconds: 330, timeLimit: 480,
    start: { x: 0, z: 420, headingDeg: 0, altitude: 90, speed: 45 },
    finishRunway: 'home',
    rings: [
      { x: 0, y: 95, z: -150, headingDeg: 0 },
      { x: -300, y: 105, z: -1200, headingDeg: -12 },
      { x: -400, y: 110, z: -2200, headingDeg: -5 },
      { x: 600, y: 115, z: -2600, headingDeg: 55 },
      { x: 1800, y: 120, z: -2500, headingDeg: 75 },
      { x: 2500, y: 115, z: -1800, headingDeg: 105 },
      { x: 2400, y: 100, z: -600, headingDeg: 130 },
      { x: 1800, y: 100, z: 600, headingDeg: 150 },
      { x: 900, y: 105, z: 1800, headingDeg: 160 },
      { x: 300, y: 100, z: 2400, headingDeg: 175 },
      { x: -800, y: 105, z: 1800, headingDeg: -140 },
      { x: -600, y: 100, z: 600, headingDeg: -120 },
    ],
    coins: [
      { x: -150, y: 100, z: -700 }, { x: -380, y: 108, z: -1700 },
      { x: 100, y: 112, z: -2450 }, { x: 1200, y: 118, z: -2600 },
      { x: 2450, y: 108, z: -1200 }, { x: 2100, y: 100, z: 0 },
      { x: 1300, y: 102, z: 1200 }, { x: 600, y: 104, z: 2100 },
      { x: -250, y: 102, z: 2100 }, { x: -700, y: 102, z: 1200 },
    ],
    balloons: [
      { x: 900, y: 170, z: -2000 }, { x: -1000, y: 160, z: -800 },
      { x: 1500, y: 180, z: 900 }, { x: -300, y: 150, z: 2600 },
    ],
    wind: { speed: 6, headingDeg: 160, gust: 2.5 },
  },
];

export const SCORE = {
  ring: 100,
  coin: 25,
  landing: 250,
  timeBonusPerSecond: 5,
  damagePenaltyPerPoint: 2,
};

export const MEDAL = { gold: 1.0, silver: 1.3 }; // finish within par × gold, else silver, else bronze

export const STORAGE_KEY = 'meridian-sky-courier-v1';
