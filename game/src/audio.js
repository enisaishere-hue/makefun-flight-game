// Meridian Sky Courier — sound, made from nothing but oscillators.
// No audio files are shipped: the engine is two detuned saws through a
// low-pass filter, the wind is filtered noise, and every chime, thud and
// jingle is a short envelope on a sine or triangle wave. The whole board
// starts on the player's first key press, as browsers require.

export function makeAudio() {
  let ctx = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    } catch {
      return false;
    }
    // Engine: two saws a few hertz apart, softened by a low-pass.
    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = 'sawtooth';
    engineOsc1.frequency.value = 52;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55.5;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineFilter.Q.value = 1.2;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc1.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc1.start();
    engineOsc2.start();
    // Wind: a loop of white noise through a band-pass that opens with speed.
    const noiseLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
    windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuf;
    windSource.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSource.start();
    started = true;
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // A slow pentatonic music-box loop, one note per step, quiet under the engine.
  const MELODY = [392, 440, 523.25, 587.33, 659.25, 523.25, 440, 392, 329.63, 392, 440, 523.25];
  function startMusic() {
    if (musicTimer || !ctx) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const note = MELODY[musicStep % MELODY.length];
      tone(note, 0.9, 'sine', 0.045);
      if (musicStep % 4 === 2) tone(note / 2, 1.2, 'sine', 0.03);
      musicStep++;
    }, 460);
  }

  return {
    get muted() { return muted; },
    get started() { return started; },
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
      startMusic();
    },
    setMuted(m) {
      muted = m;
      if (ctx) {
        if (engineGain) engineGain.gain.value = m ? 0 : engineGain.gain.value;
        if (windGain) windGain.gain.value = m ? 0 : windGain.gain.value;
      }
    },
    // Called every frame with the plane's state: engine note follows the
    // throttle, wind loudness follows the airspeed.
    update(plane) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const rpm = 46 + plane.throttle * 46 + (plane.boost ? 18 : 0);
      engineOsc1.frequency.setTargetAtTime(rpm, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm * 1.07, t, 0.08);
      const target = plane.engineOut || plane.fuel <= 0 ? 0 : 0.05 + plane.throttle * 0.075;
      engineGain.gain.setTargetAtTime(target, t, 0.12);
      engineFilter.frequency.setTargetAtTime(320 + plane.throttle * 900, t, 0.1);
      const windTarget = Math.min(0.11, Math.max(0, (plane.speed - 18) / 420));
      windGain.gain.setTargetAtTime(windTarget, t, 0.15);
      windFilter.frequency.setTargetAtTime(380 + plane.speed * 9, t, 0.15);
    },
    ring() {
      tone(880, 0.35, 'sine', 0.16);
      tone(1318.5, 0.5, 'sine', 0.12, 0.07);
    },
    coin() {
      tone(1567.98, 0.12, 'triangle', 0.12);
      tone(2093, 0.18, 'triangle', 0.1, 0.05);
    },
    bump() {
      tone(140, 0.25, 'triangle', 0.22, 0, 70);
    },
    crash() {
      if (!ctx || muted) return;
      const t0 = ctx.currentTime;
      const dur = 0.7;
      const src = ctx.createBufferSource();
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start(t0);
      tone(55, 0.8, 'sine', 0.3, 0, 30);
    },
    land() {
      tone(523.25, 0.22, 'sine', 0.14);
      tone(659.25, 0.22, 'sine', 0.14, 0.14);
      tone(783.99, 0.4, 'sine', 0.16, 0.28);
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.5, 'triangle', 0.14, i * 0.13));
    },
    click() {
      tone(660, 0.06, 'square', 0.05);
    },
  };
}
