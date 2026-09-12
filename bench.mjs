// Balance bench: each measurement boots a completely fresh game instance, so the
// reported distance is that single flight, not a running record.
import assert from 'node:assert/strict';

const gradient = { addColorStop() {} };
const ctx = new Proxy({}, { get: (t, p) => p in t ? t[p] : p === 'createLinearGradient' || p === 'createRadialGradient' ? () => gradient : p === 'measureText' ? () => ({ width: 10 }) : () => {}, set: (t, p, v) => { t[p] = v; return true; } });
globalThis.DEV = true;   // exposes __game() and the X reset key
const audioLog = () => ({ oscillators: [], gains: [], calls: [] });
let audioCapture = process.argv.includes('--test') ? audioLog() : null;
const audioContexts = [];
const audioCall = (node, op, ...args) => { if (audioCapture) audioCapture.calls.push({ node, op, args, at: node.context.currentTime }); };
const audioParam = (context, value = 0) => {
  const p = { context, value };
  for (const op of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) p[op] = (...args) => { audioCall(p, op, ...args); return p; };
  return p;
};
const audioNode = (context) => ({ context, outputs: new Set(), connect(node) { this.outputs.add(node); audioCall(this, 'connect', node); return node; }, disconnect() { this.outputs.clear(); audioCall(this, 'disconnect'); } });
globalThis.AudioContext = class {
  constructor() { audioContexts.push(this); }
  currentTime = 0; state = 'running'; sampleRate = 44100; destination = {}; voices = new Set();
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {} }; }
  createGain() { const g = Object.assign(audioNode(this), { gain: audioParam(this, 1) }); if (audioCapture) audioCapture.gains.push(g); return g; }
  createOscillator() {
    const o = Object.assign(audioNode(this), { frequency: audioParam(this, 440), type: 'sine', onended: null, started: null, stopped: Infinity, ended: false,
      start(time = this.context.currentTime) { assert.equal(this.started, null); this.started = time; this.context.voices.add(this); audioCall(this, 'start', time); },
      stop(time = this.context.currentTime) { assert.notEqual(this.started, null); if (!this.ended) this.stopped = time; audioCall(this, 'stop', time); }
    });
    if (audioCapture) audioCapture.oscillators.push(o);
    return o;
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
};
const audioAdvance = (seconds) => {
  for (const a of audioContexts) {
    if (a.state === 'running') a.currentTime += seconds;
    for (const o of a.voices) if (o.stopped <= a.currentTime) { a.voices.delete(o); o.ended = true; o.onended?.(); }
  }
};
let DL = {};
globalThis.document = { hidden: false, hasFocus: () => true, addEventListener: (k, f) => (DL[k] ||= []).push(f), getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 2;
let L = {};
globalThis.addEventListener = (k, f) => (L[k] ||= []).push(f);
let q = null;
globalThis.requestAnimationFrame = (f) => { q = f; };

const L0 = () => { L = {}; q = null; };
globalThis.localStorage = {};
await import('./src/main.js');
const world = await import('./src/world.js');
const art = await import('./src/art.js');
const sound = await import('./src/sfx.js');
const zz = await import('./src/zzfx.js');
const contextsAtLoad = audioContexts.length;   // loading the game must not touch audio
const audio = zz.zzfxStart();
const fire = (k, e) => (L[k] || []).forEach((f) => f(e));
const key = (k) => { fire('keydown', { key: k, preventDefault() {} }); fire('keyup', { key: k }); };
let now = 0;
const tick = (n = 1) => { for (let i = 0; i < n; i++) { now += 16.7; audioAdvance(.0167); const f = q; q = null; f(now); } };

const WINDOW = 0.18;
const GOOD = { p: 3, k: 3, o: 2.5, u: 2, r: 2, b: 1.5, s: 1 };   // what a player wants to hit
const BAD = { z: 1, c: 1 };

// Two bots. The blind one just mashes at a fixed rate like the old game rewarded.
// The skilled one plays the new mechanics: presses on the beat, steers toward
// pickups, dives into the ground to slam. The gap between them IS the agency.
const flight = (mode, pps = 10, sd = 1337) => {
  world.seed(sd);
  key('x');
  tick(30); key(' '); tick(23); key(' ');

  const every = Math.round(60 / pps);
  let f = 0, hold = 0, onBeat = 0, offBeat = 0, last = -9, high = 0, apex = 0;
  const press = (k) => key(k);
  const setPitch = (want) => {
    if (want === hold) return;
    if (hold) fire('keyup', { key: 's' });
    if (want) fire('keydown', { key: 's', preventDefault() {} });
    hold = want;
  };

  while (globalThis.__game().ph !== 3 && f < 20000) {
    tick(1);
    const g = globalThis.__game();
    if (g.y > 400) high++;
    if (g.y > apex) apex = g.y;
    if (mode === 'afk') {
      // launch and walk away
    } else if (mode === 'blind') {
      if (f % every === 0) press('ArrowRight');
    } else {
      // step exactly on the beat
      const off = Math.min(g.beat, 1 - g.beat);
      if (off < WINDOW * 0.45 && f - last > 3) {
        last = f;
        press('ArrowRight');
        if (off < WINDOW) onBeat++; else offBeat++;
      }
      // surf: dive when the hill ahead is falling away, so you land going downhill
      const ahead = g.x + Math.max(120, g.vx * 0.3);
      const slope = world.SLOPE(ahead);
      const alt = g.y - world.GY(g.x);
      setPitch(slope < -0.12 && alt > 40 ? -1 : 0);
    }
    f++;
  }
  setPitch(0);
  const g = globalThis.__game();
  const used = {};
  for (const e of world.near(0, 200000)) if (e.dead) used[e.t] = (used[e.t] || 0) + 1;
  return { dist: g.dist, stars: used.s || 0, secs: f / 60, ended: f < 20000, used, onBeat, high: high / Math.max(1, f), apex: apex / 30 };
};

const names = { s: 'star', r: 'rainbow', c: 'cloud', b: 'pad', p: 'pegasus', u: 'bubble', k: 'comet', o: 'portal', z: 'storm' };
const SEEDS = [1337, 4242, 909, 20260913, 77];
const line = (label, mode, pps) => {
  const rs = SEEDS.map((sd) => flight(mode, pps, sd));
  const avg = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  const dists = rs.map((r) => r.dist).sort((a, b) => a - b);
  console.log(`  ${label.padEnd(12)} ${String(Math.round(avg((r) => r.dist))).padStart(5)} m avg` +
              `  (${dists[0]}-${dists[4]})  ·  ${avg((r) => r.stars).toFixed(0).padStart(3)}★  ·  ${avg((r) => r.secs).toFixed(0).padStart(3)}s` +
              `  ·  apex ${avg((r) => r.apex).toFixed(0).padStart(3)} m  ·  ${(avg((r) => r.high) * 100).toFixed(0).padStart(2)}% spent high up`);
};
if (process.argv.includes('--test')) {
  const game = () => globalThis.__game();
  const breath = (v) => globalThis.__breath(v);
  const store = globalThis.localStorage;
  store.uniBest = '777';
  const migrated = (await import('./src/save.js?fresh')).best;
  delete store.uniBest;
  const save = await import('./src/save.js');
  const down = (key, repeat = false) => fire('keydown', { key, repeat, preventDefault() {} });
  const release = (key) => fire('keyup', { key });
  const clear = () => {
    const { x } = game();
    for (const e of world.near(x - 2000, x + 2000)) e.dead = 1;
  };
  const advance = (n = 1) => {
    for (let i = 0; i < n; i++) {
      clear();
      tick();
    }
  };
  const until = (predicate, label, limit = 600) => {
    for (let i = 0; i < limit && !predicate(game()); i++) {
      assert.notEqual(game().ph, 3, `run ended before ${label}`);
      advance();
    }
    assert.ok(predicate(game()), `timed out waiting for ${label}`);
  };
  const launch = () => {
    key('x');
    world.seed(1337);
    advance(30);
    key(' ');
    assert.equal(game().ph, 1);
    advance(23);
    key(' ');
    assert.equal(game().ph, 2);
    assert.ok(game().vy > 0);
  };
  const land = () => until((g) => g.grounded > 0, 'landing');
  const pickup = (type) => {
    clear();
    const { x, y } = game();
    const e = world.near(x - 500, x + 500)[0];
    assert.ok(e, `no nearby entity for ${type} pickup`);
    Object.assign(e, { t: type, x, y, r: 100, dead: 0 });
    tick();
    assert.equal(e.dead, 1, `${type} pickup was not collected`);
  };
  const falling = () => {
    launch();
    until((g) => g.vy < -250 && g.y - world.GY(g.x) > 150, 'clear airborne descent');
  };
  const pointer = (type, pointerId = 7, clientX = innerWidth - 56, clientY = innerHeight - 138) => fire(type, { pointerId, clientX, clientY, preventDefault() {} });
  let passed = 0;
  let failed = 0;
  const test = (name, fn) => {
    try {
      fn();
      passed++;
      console.log(`ok - ${name}`);
    } catch (error) {
      failed++;
      console.error(`not ok - ${name}`);
      console.error(error.stack);
    }
  };

  const calm = { happy: 0, scared: 0 }, happy = { happy: 1, scared: 0 }, fear = { happy: 0, scared: 1 };
  const visibility = (hidden) => { document.hidden = hidden; for (const f of DL.visibilitychange || []) f({}); fire('visibilitychange', {}); };
  const musicTest = (name, fn) => test(name, () => {
    try {
      audio.state = 'running'; visibility(false); fire('focus', {});
      if (sound.muted()) sound.toggle();
      sound.resetMusic(); audioAdvance(1); audioCapture = audioLog();
      fn();
    } finally {
      audio.state = 'running'; visibility(false); fire('focus', {});
      if (sound.muted()) sound.toggle();
      sound.resetMusic(); audioAdvance(1); audioCapture = null;
    }
  });
  const play = (face = calm, ph = 2, duration = 32 / 4.8, step = .01) => {
    const end = audio.currentTime + duration;
    sound.music(face, ph);
    while (audio.currentTime < end - 1e-9) { audioAdvance(Math.min(step, end - audio.currentTime)); sound.music(face, ph); }
  };
  const starts = (log = audioCapture) => log.calls.filter((c) => c.op === 'start');
  const signature = (log) => {
    const notes = starts(log), origin = notes[0]?.args[0] || 0;
    return notes.map((c) => [+(c.args[0] - origin).toFixed(6), c.node.frequency.value, c.node.type]);
  };
  const phrase = (face = calm, ph = 2, step = .01) => {
    sound.resetMusic(); audioAdvance(1); audioCapture = audioLog();
    play(face, ph, 32 / 4.8, step);
    return audioCapture;
  };
  const stopped = (voices) => {
    assert.ok(voices.length > 0, 'test needs live music voices');
    audioAdvance(.2);
    for (const o of voices) {
      assert.ok(o.ended, 'voice must end promptly');
      assert.equal(o.outputs.size, 0, 'ended oscillator must disconnect');
    }
  };

  test('loading the game builds no AudioContext before a user gesture', () => {
    assert.equal(contextsAtLoad, 0, 'importing the game must not construct an AudioContext');
    assert.equal(audioContexts.length, 1, 'and the first gesture builds exactly one');
    assert.equal(zz.zzfxStart(), audio, 'later gestures reuse it');
  });

  test('music stays silent before unlock even with a running audio context', () => {
    try {
      assert.equal(audio.state, 'running');
      assert.equal(audioCapture.oscillators.length, 0);
      for (const ph of [0, 1, 2, 3]) play(happy, ph, .5);
      tick(60);
      assert.equal(audioCapture.oscillators.length, 0, 'render and direct music calls must require unlock');
    } finally { audioCapture = null; }
  });

  musicTest('music unlock starts audio-clock scheduling with bounded lookahead and no duplicates', () => {
    sound.unlock();
    play(happy);
    const log = audioCapture, notes = starts();
    assert.ok(notes.length > 0, 'unlock must enable notes');
    for (const c of notes) {
      assert.ok(c.args[0] >= c.at - 1e-7, 'notes must not start in the past');
      assert.ok(c.args[0] <= c.at + .08 + 1e-7, 'notes exceed lookahead');
      assert.ok(c.node.frequency.value > 0 && Number.isFinite(c.node.frequency.value));
      assert.ok(c.node.stopped > c.node.started && Number.isFinite(c.node.stopped), 'notes need a finite release');
    }
    const origin = notes[0].args[0];
    for (const c of notes) {
      const beat = (c.args[0] - origin) * 4.8;
      assert.ok(Math.abs(beat - Math.round(beat)) < 1e-6, 'notes drift off the eighth-note grid');
    }
    for (let i = 0; i < 100; i++) sound.music(happy, 2);
    assert.equal(starts().length, notes.length, 'same audio clock must not duplicate notes');
    assert.deepEqual(signature(phrase(happy, 2, .035)), signature(log), 'render cadence must not change the phrase');
  });

  musicTest('music phases and facial moods select distinct phrases with fear taking priority', () => {
    const idle = phrase(calm, 0), aim = phrase(calm, 1), neutral = phrase(), bright = phrase(happy), afraid = phrase(fear), both = phrase({ happy: 1, scared: 1 }), ending = phrase(happy, 3);
    for (const log of [idle, aim, neutral, bright, afraid, both, ending]) assert.ok(starts(log).length > 0);
    assert.deepEqual(signature(idle), signature(aim), 'aiming should retain calm music');
    assert.deepEqual(signature(afraid), signature(both), 'fear must override happiness');
    assert.notDeepEqual(signature(afraid), signature(neutral));
    assert.notDeepEqual(signature(ending), signature(idle), 'ending should have its own minor phrase');
    assert.ok(starts(bright).length > starts(neutral).length, 'happy music should be more active');
    assert.ok(starts(bright).length > starts(idle).length, 'idle music should be sparse');
    const pitch = (log) => starts(log).reduce((sum, c) => sum + c.node.frequency.value, 0) / starts(log).length;
    assert.ok(pitch(bright) > pitch(neutral), 'happy music should be higher');
    assert.ok(starts(bright).some((c) => c.node.type === 'triangle'), 'happy melody should have a brighter triangle timbre');
    assert.ok(starts(neutral).every((c) => c.node.type === 'sine'), 'calm music should retain its soft sine timbre');
    const tones = (log) => {
      const notes = starts(log), first = notes[0];
      return notes.filter((c) => c.args[0] < first.args[0] + 8 / 4.8 - 1e-7).map((c) => (Math.round(12 * Math.log2(c.node.frequency.value / first.node.frequency.value)) % 12 + 12) % 12);
    };
    assert.ok(tones(idle).includes(4) && tones(ending).includes(3) && !tones(ending).includes(4), 'ending should replace the major third with a minor third');
    assert.deepEqual(signature(phrase(happy, 0)), signature(idle), 'idle phase should ignore happy expression');
    assert.deepEqual(signature(phrase(fear, 1)), signature(aim), 'aim phase should ignore scared expression');
    assert.deepEqual(signature(phrase(fear, 3)), signature(ending), 'ending should remain calm regardless of expression');
    const peak = (log) => Math.max(...log.calls.filter((c) => ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime'].includes(c.op)).map((c) => c.args[0]));
    assert.ok(peak(ending) < peak(bright), 'ending should be quieter');
  });

  musicTest('resetMusic stops old voices and restarts the phrase without accumulating nodes', () => {
    const first = phrase(happy), voices = [...audio.voices];
    sound.resetMusic(); stopped(voices);
    assert.equal(audio.voices.size, 0);
    assert.deepEqual(signature(phrase(happy)), signature(first), 'reset should restart the phrase');
    for (let i = 0; i < 12; i++) { sound.resetMusic(); play(happy, 2, .1); }
    sound.resetMusic(); audioAdvance(1);
    assert.equal(audio.voices.size, 0, 'restarts must not leak active oscillators');
    for (const o of audioCapture.oscillators) assert.equal(o.outputs.size, 0);
  });

  musicTest('music mute clears voices, blocks scheduling and resumes without a backlog', () => {
    play(happy, 2, .5);
    const voices = [...audio.voices];
    sound.toggle(); assert.equal(sound.muted(), true); stopped(voices);
    const count = starts().length;
    play(happy, 2, 10);
    assert.equal(starts().length, count);
    sound.toggle(); assert.equal(sound.muted(), false);
    const resumed = audio.currentTime;
    play(happy, 2, .5);
    const notes = starts().slice(count);
    assert.ok(notes.length > 0);
    assert.ok(notes.every((c) => c.args[0] >= resumed && c.args[0] <= c.at + .08 + 1e-7));
  });

  musicTest('music pauses on context suspension and drops stale notes after a long clock gap', () => {
    play(happy, 2, .5);
    const count = starts().length, clock = audio.currentTime, voices = [...audio.voices];
    audio.state = 'suspended';
    for (let i = 0; i < 100; i++) { audioAdvance(.1); sound.music(happy, 2); }
    assert.equal(audio.currentTime, clock);
    assert.equal(starts().length, count, 'suspended context must not schedule');
    audio.state = 'running'; stopped(voices);
    play(happy, 2, .5);
    assert.ok(starts().length > count, 'running context should resume');
    const bundles = new Map();
    for (const c of starts()) bundles.set(c.args[0], (bundles.get(c.args[0]) || 0) + 1);
    audioAdvance(120);
    const before = starts().length, resumed = audio.currentTime;
    sound.music(happy, 2);
    const notes = starts().slice(before);
    assert.ok(notes.length <= Math.max(...bundles.values()), 'stall must not enqueue more than one eighth note');
    assert.ok(notes.every((c) => c.args[0] >= resumed && c.args[0] <= resumed + .08 + 1e-7));
    play(happy, 2, .5);
    assert.ok(starts().length > before, 'scheduler must recover after a stall');
  });

  musicTest('blur and visibility clear voices and prevent scheduling until focused and visible', () => {
    for (const hide of [false, true]) {
      play(happy, 2, .5);
      const voices = [...audio.voices];
      if (hide) visibility(true); else fire('blur', {});
      stopped(voices);
      const count = starts().length;
      play(happy, 2, 2);
      assert.equal(starts().length, count);
      if (hide) {
        fire('focus', {}); play(happy, 2, .5);
        assert.equal(starts().length, count, 'focus must not override hidden document');
        visibility(false);
      } else {
        visibility(true); visibility(false); play(happy, 2, .5);
        assert.equal(starts().length, count, 'visibility must not override window blur');
        fire('focus', {});
      }
      play(happy, 2, .5);
      assert.ok(starts().length > count, 'visible focused music should resume');
    }
  });

  musicTest('music nodes connect through gain envelopes and disconnect on natural completion', () => {
    play(happy, 2, 1);
    const notes = starts(), gains = [];
    assert.ok(notes.length > 0);
    for (const { node: o } of notes) {
      const gain = audioCapture.calls.find((c) => c.node === o && c.op === 'connect')?.args[0];
      assert.ok(gain?.gain, 'oscillator needs a voice gain');
      gains.push(gain);
      const master = audioCapture.calls.find((c) => c.node === gain && c.op === 'connect')?.args[0];
      assert.ok(master?.gain && master.outputs.has(audio.destination), 'voice gain must feed master gain and destination');
      assert.ok(audioCapture.calls.some((c) => c.node === gain.gain && c.op.includes('RampToValueAtTime')), 'voice needs an envelope');
    }
    audioAdvance(10);
    assert.equal(audio.voices.size, 0);
    for (const { node: o } of notes) { assert.ok(o.ended); assert.equal(o.outputs.size, 0); }
    for (const g of gains) assert.equal(g.outputs.size, 0, 'ended voice gain must disconnect');
  });

  musicTest('main render schedules music and a new run stops its previous voices', () => {
    key('x'); tick(60);
    assert.ok(starts().length > 0, 'render must invoke music');
    const voices = [...audio.voices];
    key('x'); stopped(voices);
    const count = starts().length;
    tick(60);
    assert.ok(starts().length > count, 'new run should restart music');
  });

  test('storm starts 3000 m behind and waits at its initial speed while aiming', () => {
    key('x');
    assert.equal((game().x - game().storm) / 30, 3000);
    const storm = game().storm;
    advance(600);
    assert.equal(game().storm, storm);
    assert.equal(game().stormSpeed, 170);
    assert.equal(game().flash, 0);
    key(' ');
    advance(600);
    assert.equal(game().storm, storm);
    assert.equal(game().stormSpeed, 170);
    key(' ');
    assert.equal((game().x - game().storm) / 30, 3000);
    assert.equal(game().stormSpeed, 170);
  });

  test('storm accelerates steadily without rubber-banding after a portal escape', () => {
    launch();
    const before = game();
    advance(120);
    const after = game(), elapsed = after.t - before.t;
    assert.ok(Math.abs(after.stormSpeed - before.stormSpeed - 20 * elapsed) < 1e-6);
    assert.ok(Math.abs(after.storm - before.storm - (before.stormSpeed + after.stormSpeed) / 2 * elapsed) < 1e-6);
    for (let i = 0; i < 4; i++) pickup('o');
    const escaped = game();
    assert.ok(escaped.x - escaped.storm > 3000 * 30);
    advance();
    const next = game();
    assert.ok(next.x - next.storm > 3000 * 30);
    assert.ok(Math.abs(next.storm - escaped.storm - (escaped.stormSpeed + next.stormSpeed) / 2 * (next.t - escaped.t)) < 1e-6);
  });

  test('storm flashes only within 100 m, catches a slow player, and resets', () => {
    const random = Math.random;
    Math.random = () => 0;
    try {
      launch();
      for (let i = 0; i < 10000 && game().x - game().storm > 100 * 30 + 100; i++) {
        assert.equal(game().ph, 2);
        advance();
        assert.equal(game().flash, 0);
      }
      until((g) => g.flash > 0, 'nearby storm flash');
      assert.ok(game().x - game().storm <= 100 * 30);
      pickup('o');
      assert.ok(game().x - game().storm > 100 * 30);
      assert.equal(game().flash, 0);
      until((g) => g.flash > 0, 'storm closing in again');
      until((g) => g.ph === 3, 'storm catching the player');
      assert.ok(game().x - game().storm < 30);
      key(' ');
      assert.equal(game().stormSpeed, 170);
      assert.equal(game().flash, 0);
      assert.equal((game().x - game().storm) / 30, 3000);
    } finally { Math.random = random; }
  });

  test('one-key gallop: → steps on the beat, dizzy mashing staggers without rhythm or breath', () => {
    launch();
    land();
    until((g) => g.grounded > 0 && Math.min(g.beat, 1 - g.beat) < 0.08, 'grounded beat');
    const before = game();
    key('ArrowRight');
    assert.equal(game().combo, before.combo + 1);
    assert.equal(game().sta, before.sta - 2);
    key('ArrowRight');
    assert.equal(game().combo, Math.max(0, before.combo - 1), 'second tap on the same beat is a miss');
    assert.equal(game().sta, before.sta - 10);
    key('ArrowLeft');
    assert.equal(game().sta, before.sta - 10, 'left arrow does nothing');
    pickup('z');
    assert.ok(game().fx.storm > 0);
    assert.equal(game().combo, 0);
    until((g) => g.grounded > 0, 'grounded while dizzy');
    const dizzy = game();
    for (let i = 0; i < 5; i++) key('ArrowRight');
    assert.equal(game().sta, dizzy.sta, 'mashing costs no breath');
    assert.equal(game().combo, 0, 'mashing builds no combo');
    assert.ok(game().vx > dizzy.vx && game().vx - dizzy.vx < 5 * 78 * 0.2 + 1e-6, 'each mash is a tiny stagger');
    assert.ok(Math.abs(game().x - dizzy.x - 30) < 1e-6, 'each mash lurches 6 px forward even with no momentum');
  });

  test('breath crisis: red bar below a third, red flash on a miss, then a 3-2-1 countdown', () => {
    launch();
    const lungs = game().sta;
    land();
    until((g) => g.grounded > 0 && Math.min(g.beat, 1 - g.beat) > 0.3, 'off-beat moment on the ground');
    assert.equal(game().redFx, 0);
    key('ArrowRight');
    assert.equal(game().redFx, 0, 'a miss on a full tank does not flash');
    breath(lungs / 4);
    until((g) => g.grounded > 0 && Math.min(g.beat, 1 - g.beat) > 0.3, 'another off-beat moment');
    key('ArrowRight');
    assert.ok(game().redFx > 0, 'a miss flashes the screen once breath is low');
    advance(20);
    assert.equal(game().redFx, 0, 'the red flash fades');

    const breathColour = () => {
      const seen = [];
      const roundRect = ctx.roundRect;
      ctx.roundRect = (...args) => { if (args[1] === 122) seen.push(ctx.fillStyle); };
      try { advance(); } finally { ctx.roundRect = roundRect; }
      return seen[seen.length - 1];
    };
    breath(lungs / 3 + 3);
    assert.equal(breathColour(), '#7cff9b');
    breath(lungs / 3 - 3);
    assert.equal(breathColour(), '#ff5a7a');

    breath(0);
    advance();
    assert.equal(game().gaspN, 3, 'the countdown starts at three');
    until((g) => g.gaspN === 2, 'countdown 2');
    until((g) => g.gaspN === 1, 'countdown 1');
    until((g) => g.ph === 3, 'the run ends when breath runs out');

    launch();
    land();
    breath(0);
    until((g) => g.gaspN === 2, 'countdown running again');
    pickup('s');
    assert.ok(game().sta >= 20, 'the star refills breath');
    assert.equal(game().gaspN, 0, 'a star cancels the countdown');

    breath(0);
    game().fx.wings = 12;
    advance(220);
    assert.equal(game().gaspN, 0, 'wings pause the countdown');
    assert.notEqual(game().ph, 3, 'flying keeps an empty-lunged unicorn alive');
  });

  test('storm distance stays visible but warning lightning starts at exactly 100 m', () => {
    for (const gap of [3000, 100.01, 100, 99, 0]) {
      const fills = [], labels = [];
      const canvas = new Proxy({
        createLinearGradient: () => gradient,
        fill() { fills.push(this.fillStyle); },
        fillText(s) { labels.push(s); }
      }, { get: (t, p) => p in t ? t[p] : () => {} });
      art.drawStormWarning(canvas, 1280, 720, gap, Math.max(0, 1 - gap / 100));
      assert.ok(labels.includes(`${gap | 0} m`));
      assert.equal(fills.includes('#ffe45c'), gap <= 100);
    }
  });

  test('combo progress and multiplier appear below breath without overlapping power-ups', () => {
    launch();
    land();
    const roundRect = ctx.roundRect, fillText = ctx.fillText;
    const bars = [], labels = [];
    ctx.roundRect = (...args) => bars.push(args);
    ctx.fillText = (...args) => labels.push(args);
    try {
      game().fx.double = 12;
      advance();
      assert.ok(bars.some(([x, y, w, h]) => x === 20 && y === 146 && w === 190 && h === 12));
      assert.ok(labels.some(([s, x, y]) => s === 'COMBO' && x === 220 && y === 157));
      assert.ok(labels.some(([s, x, y]) => s === 'x1.00  0' && x === 30 && y === 156));
      const breath = bars.find(([x, y]) => x === 20 && y === 122);
      assert.ok(breath && breath[1] + breath[3] < 146);
      assert.ok(labels.some(([s, x, y]) => s.startsWith('DOUBLE JUMP') && y > 176));
      until((g) => g.grounded > 0 && Math.min(g.beat, 1 - g.beat) < 0.08, 'grounded beat');
      key('ArrowRight');
      assert.ok(game().combo > 0);
      bars.length = labels.length = 0;
      advance();
      assert.ok(bars.some(([x, y, w]) => x === 20 && y === 146 && Math.abs(w - 190 * Math.min(game().combo, 40) / 40) < 1e-9));
      assert.ok(labels.some(([s, x, y]) => s === `x${(1 + Math.min(game().combo, 40) * 0.025).toFixed(2)}  ${game().combo}` && x === 30 && y === 156));
    } finally { ctx.roundRect = roundRect; ctx.fillText = fillText; }
  });

  test('speed brings a grin, while nearby storms and thunderclouds take priority', () => {
    const u = { vx: 0, vy: 0, rot: 0 };
    const face = (gap = 2000, active = true, shocked = false) => art.unicornFace(u, 0, gap, active, shocked);
    assert.equal(face().happy, 0);
    assert.equal(face().scared, 0);
    u.vx = 900;
    assert.ok(face().happy > 0 && face().happy < 1);
    u.vx = 1500;
    assert.equal(face().happy, 1);
    assert.ok(face(700).scared > 0 && face(700).scared < 1);
    assert.ok(face(700).happy < face().happy);
    assert.equal(face(300).scared, 1);
    assert.equal(face(300).happy, 0);
    assert.equal(face(2000, true, true).scared, 1);
    assert.equal(face(2000, true, true).happy, 0);
    assert.equal(face(300, false).scared, 0);
    assert.equal(face(300, false).happy, 0);
    assert.equal(face().scared, 0);
    assert.equal(face().happy, 1);
  });

  test('gaze follows screen-space velocity even when the head is tilted', () => {
    for (const rot of [-1.2, 0, 0.8]) {
      for (const [vx, vy] of [[900, 0], [-900, 0], [0, 800], [0, -800], [600, 800], [600, -800], [0, 0]]) {
        const f = art.unicornFace({ vx, vy, rot }, 0);
        const x = f.lookX * Math.cos(rot) - f.lookY * Math.sin(rot);
        const y = f.lookX * Math.sin(rot) + f.lookY * Math.cos(rot);
        const sp = Math.hypot(vx, vy);
        assert.ok(Math.abs(x - (sp ? vx / sp * 10 : 0)) < 1e-9);
        assert.ok(Math.abs(y - (sp ? -vy / sp * 10 : 0)) < 1e-9);
      }
    }
  });

  test('blinks are brief, close fully, reopen, and leave expression and gaze intact', () => {
    const u = { vx: 1500, vy: 300, rot: -0.3 };
    let closed = 0, transitions = 0, wasClosed = false, peak = 0;
    for (let i = 0; i < 1200; i++) {
      const f = art.unicornFace(u, i / 120, 300);
      const shut = f.blink > 0;
      assert.ok(f.blink >= 0 && f.blink <= 1);
      assert.equal(f.scared, 1);
      assert.ok(f.lookX > 0);
      if (shut) closed++;
      if (shut && !wasClosed) transitions++;
      wasClosed = shut;
      peak = Math.max(peak, f.blink);
    }
    assert.equal(transitions, 2);
    assert.ok(closed > 20 && closed < 60);
    assert.ok(peak > 0.99);
    assert.equal(art.unicornFace(u, 0).blink, 0);
    assert.equal(art.unicornFace(u, 3.7).blink, 0);
  });

  test('face rendering clips moving pupils, closes both eyelids, and preserves canvas state', () => {
    const draw = (face) => {
      const calls = [], methods = ['save', 'restore', 'scale', 'rotate', 'translate', 'beginPath', 'arc', 'ellipse', 'fill', 'stroke', 'moveTo', 'lineTo', 'quadraticCurveTo', 'closePath', 'clip'];
      const canvas = Object.fromEntries(methods.map((m) => [m, (...args) => {
        assert.ok(args.every(Number.isFinite), `${m} received invalid coordinates`);
        calls.push([m, ...args]);
      }]));
      art.drawUnicorn(canvas, 30, -0.3, 1, 0.4, 1, face);
      let depth = 0;
      for (const [m] of calls) {
        if (m === 'save') depth++;
        if (m === 'restore') depth--;
        assert.ok(depth >= 0);
      }
      assert.equal(depth, 0);
      return calls;
    };
    for (const mood of [{}, { happy: 1 }, { scared: 1 }]) {
      const face = { ...mood, lookX: 8, lookY: -6 };
      const open = draw(face), closed = draw({ ...face, blink: 1 });
      assert.equal(open.filter(([m]) => m === 'clip').length, 2);
      assert.equal(open.filter(([m, x, y, r]) => m === 'arc' && x === 8 && y === -6 && r === (mood.scared ? 12 : 16)).length, 2);
      assert.equal(closed.filter(([m]) => m === 'clip').length, 0);
      assert.equal(closed.filter(([m, x, y, ex, ey]) => m === 'quadraticCurveTo' && x === 0 && y === 8 && ex === 21 && ey === 0).length, 2);
      draw({ ...face, blink: 0.8 });
    }
  });

  test('live face reacts to movement and thunderclouds, and resets between runs', () => {
    launch();
    advance();
    assert.deepEqual(game().face, art.unicornFace(game(), game().t, game().x - game().storm, true, false));
    assert.ok(game().face.lookX > 0);
    pickup('z');
    assert.equal(game().face.scared, 1);
    assert.equal(game().face.happy, 0);
    key('x');
    assert.deepEqual(game().face, { happy: 0, scared: 0, blink: 0, lookX: 0, lookY: 0 });
    advance(210);
    assert.ok(game().face.blink > 0);
  });

  test('seeded worlds reproducibly generate double-jump and pegasus pickups', () => {
    for (const sd of SEEDS) {
      world.seed(sd);
      const entities = world.near(0, 100000).map((e) => ({ ...e }));
      assert.ok(entities.some((e) => e.t === 'j'), `seed ${sd} lacks double-jump pickups`);
      assert.ok(entities.some((e) => e.t === 'p'), `seed ${sd} lacks pegasus pickups`);
      world.seed(sd);
      assert.deepEqual(world.near(0, 100000), entities);
    }
  });

  test('Space launch is edge-triggered and repeated launches still work', () => {
    key('x');
    advance(30);
    down(' ', true);
    assert.equal(game().ph, 0);
    down(' ');
    assert.equal(game().ph, 1);
    down(' ');
    down(' ', true);
    assert.equal(game().ph, 1);
    advance(23);
    release(' ');
    down(' ');
    assert.equal(game().ph, 2);
    const vy = game().vy;
    down(' ');
    down(' ', true);
    assert.equal(game().vy, vy);
    release(' ');
    launch();
    until((g) => g.ph === 3, 'end of run', 8000);
    key(' ');
    assert.equal(game().ph, 0);
    key(' ');
    assert.equal(game().ph, 1);
    advance(23);
    key(' ');
    assert.equal(game().ph, 2);
  });

  for (const control of [' ', 'w', 'ArrowUp']) {
    test(`${JSON.stringify(control)} ground jump gives real lift without breath or unlimited air jumps`, () => {
      launch();
      land();
      const before = game();
      key(control);
      assert.equal(game().grounded, 0);
      assert.ok(game().vy >= 850);
      assert.equal(game().sta, before.sta);
      assert.equal(game().airJump, 0);
      advance(6);
      assert.ok(game().y > before.y + 50);
      assert.ok(game().y - world.GY(game().x) > 60);
      assert.equal(game().grounded, 0);
      const vy = game().vy;
      for (let i = 0; i < 20; i++) {
        key(' ');
        key('w');
        key('ArrowUp');
      }
      assert.equal(game().vy, vy);
      assert.equal(game().sta, before.sta);
    });
  }

  test('double jump is available once per landing, not once per pickup', () => {
    falling();
    pickup('j');
    assert.ok(game().fx.double > 11.9 && game().fx.double <= 12);
    assert.equal(game().airJump, 0);
    const sta = game().sta;
    down(' ', true);
    assert.equal(game().airJump, 0);
    down(' ');
    assert.equal(game().airJump, 1);
    assert.ok(game().vy >= 850);
    assert.equal(game().sta, sta);
    advance(3);
    const vy = game().vy;
    down(' ');
    down(' ', true);
    release(' ');
    key(' ');
    assert.equal(game().vy, vy);
    pickup('j');
    assert.equal(game().airJump, 1);
    const refreshedVy = game().vy;
    key(' ');
    assert.equal(game().vy, refreshedVy);
    land();
    assert.equal(game().airJump, 0);
    assert.ok(game().fx.double > 0);
    key(' ');
    assert.equal(game().airJump, 0);
    advance(3);
    key(' ');
    assert.equal(game().airJump, 1);
    assert.ok(game().vy >= 850);
  });

  test('double-jump expiry removes unused jumps and never replenishes a used jump', () => {
    falling();
    pickup('j');
    game().fx.double = 0.001;
    advance();
    assert.equal(game().fx.double, 0);
    const vy = game().vy;
    key(' ');
    assert.equal(game().vy, vy);
    assert.equal(game().airJump, 0);
    pickup('j');
    key(' ');
    assert.equal(game().airJump, 1);
    game().fx.double = 0.001;
    advance();
    assert.equal(game().fx.double, 0);
    assert.equal(game().airJump, 1);
    pickup('j');
    const usedVy = game().vy;
    key(' ');
    assert.equal(game().vy, usedVy);
  });

  test('pegasus preserves lift and grants twelve seconds of wings', () => {
    falling();
    pickup('p');
    assert.ok(game().fx.wings > 11.9 && game().fx.wings <= 12);
    assert.ok(game().vy > 900);
    assert.equal(game().grounded, 0);
  });

  test('flaps are free, lift only on the beat, push forward, and share W/Up hold', () => {
    falling();
    pickup('p');
    const air = (g) => g.grounded <= 0 && g.ph === 2;
    until((g) => air(g) && Math.min(g.beat, 1 - g.beat) < 0.06, 'on-beat moment in the air');
    let before = game();
    down('w', true);
    assert.equal(game().vy, before.vy, 'key repeat never flaps');
    down('w');
    assert.equal(game().sta, before.sta, 'flap costs no breath');
    assert.equal(game().vy, Math.min(900, Math.max(before.vy, 0) + 380));
    assert.ok(game().vx > before.vx, 'flap pushes forward');
    assert.equal(game().combo, before.combo + 1);
    assert.equal(game().flapFx, 0.3);
    assert.equal(game().gliding, true);
    const flapped = game();
    down('w');
    down('w', true);
    down('ArrowUp');
    assert.equal(game().vy, flapped.vy, 'held keys do not flap again');
    release('w');
    assert.equal(game().gliding, true);
    release('ArrowUp');
    assert.equal(game().gliding, false);
    down('ArrowUp');
    assert.equal(game().vy, flapped.vy, 'second flap on the same beat is a miss');
    assert.equal(game().vx, flapped.vx);
    assert.equal(game().combo, Math.max(0, flapped.combo - 2));
    assert.equal(game().gliding, true, 'an off-beat press still starts a glide');
    release('ArrowUp');
    until((g) => air(g) && Math.min(g.beat, 1 - g.beat) > 0.3, 'off-beat moment in the air');
    before = game();
    key('w');
    assert.equal(game().sta, before.sta);
    assert.equal(game().vy, before.vy, 'off-beat press gives no lift');
    assert.equal(game().vx, before.vx);
    assert.ok(game().flapFx <= before.flapFx, 'no fresh flap animation');
    breath(0);
    until((g) => air(g) && Math.min(g.beat, 1 - g.beat) < 0.06, 'next beat');
    before = game();
    key('ArrowUp');
    assert.equal(game().vy, Math.min(900, Math.max(before.vy, 0) + 380), 'flying works with empty lungs');
    advance(20);
    assert.equal(game().flapFx, 0);
  });

  test('Space uses double jump independently of wings and held W', () => {
    falling();
    game().fx.wings = 12;
    const vy = game().vy;
    key(' ');
    assert.equal(game().vy, vy);
    game().fx.double = 12;
    down('w');
    const sta = game().sta;
    key(' ');
    assert.equal(game().airJump, 1);
    assert.ok(game().vy >= 850);
    assert.equal(game().sta, sta);
    release('w');
    key('w');
    assert.equal(game().sta, sta);
    assert.equal(game().airJump, 1);
  });

  for (const control of ['w', 'ArrowUp']) {
    test(`${control} glide reduces gravity, caps descent, and stops on release/dive/expiry`, () => {
      falling();
      down(control);
      game().fx.wings = 12;
      assert.equal(game().gliding, true);
      advance();
      assert.equal(game().vy, -180);
      advance(3);
      assert.equal(game().vy, -180);
      release(control);
      assert.equal(game().gliding, false);
      advance();
      assert.ok(game().vy < -215);
      down(control);
      const air = (g) => g.grounded <= 0 && g.ph === 2;
      until((g) => air(g) && Math.min(g.beat, 1 - g.beat) > 0.3, 'off beat while gliding');
      until((g) => air(g) && Math.min(g.beat, 1 - g.beat) < 0.06, 'next beat while gliding');
      release(control);
      down(control);
      assert.ok(game().vy >= 380, 'fresh press on the beat flaps');
      const before = game().vy;
      advance();
      const gravity = before - game().vy;
      assert.ok(gravity >= 4 && gravity <= 9, `unexpected glide gravity ${gravity}`);
      down('s');
      assert.equal(game().gliding, false);
      const diving = game().vy;
      advance();
      assert.ok(diving - game().vy > 90);
      release('s');
      assert.equal(game().gliding, true);
      game().fx.wings = 0.001;
      const expiring = game().vy;
      advance();
      assert.equal(game().fx.wings, 0);
      assert.equal(game().gliding, false);
      assert.ok(expiring - game().vy > 35);
      release(control);
      const expired = game();
      key(control);
      assert.equal(game().sta, expired.sta);
      assert.equal(game().vy, expired.vy);
    });
  }

  test('blur releases held wing and dive controls and permits a fresh flap', () => {
    falling();
    game().fx.wings = 12;
    down('w');
    down('ArrowDown');
    fire('blur', {});
    assert.equal(game().gliding, false);
    const before = game();
    advance();
    assert.ok(before.vy - game().vy < 70);
    down('w');
    assert.equal(game().sta, before.sta);
    assert.equal(game().gliding, true);
    release('w');
  });

  test('touch jump lifts from ground and pointer release/cancel ends held glide', () => {
    launch();
    land();
    const ground = game();
    pointer('pointerdown');
    assert.equal(game().grounded, 0);
    assert.ok(game().vy >= 850);
    assert.equal(game().sta, ground.sta);
    advance(6);
    assert.ok(game().y > ground.y + 50);
    pointer('pointerup');
    game().fx.wings = 12;
    for (const event of ['pointerup', 'pointercancel']) {
      const sta = game().sta;
      pointer('pointerdown');
      assert.equal(game().sta, sta);
      assert.equal(game().gliding, true);
      pointer('pointerdown');
      pointer('pointerdown', 8);
      assert.equal(game().sta, sta);
      pointer('pointermove', 7, innerWidth - 56, innerHeight - 60);
      assert.equal(game().gliding, true);
      pointer(event);
      assert.equal(game().gliding, false);
    }
    pointer('pointerdown');
    fire('blur', {});
    assert.equal(game().gliding, false);
  });

  test('new run clears effects, air jump, flap animation, keys and touch holds', () => {
    falling();
    game().fx.wings = 12;
    game().fx.double = 12;
    down(' ');
    assert.equal(game().airJump, 1);
    until((g) => g.grounded <= 0 && Math.min(g.beat, 1 - g.beat) < 0.06, 'beat in the air');
    down('w');
    down('s');
    pointer('pointerdown');
    assert.ok(game().flapFx > 0);
    key('x');
    assert.equal(game().ph, 0);
    assert.equal(game().airJump, 0);
    assert.equal(game().flapFx, 0);
    assert.equal(game().gliding, false);
    assert.ok(Object.values(game().fx).every((value) => value === 0));
    down(' ');
    assert.equal(game().ph, 1);
    release(' ');
    advance(23);
    key(' ');
    game().fx.wings = 12;
    assert.equal(game().gliding, false);
    const before = game();
    advance();
    assert.ok(before.vy - game().vy < 70);
    down('w');
    assert.equal(game().gliding, true);
    assert.equal(game().sta, before.sta);
    release('w');
    pointer('pointerdown');
    assert.equal(game().gliding, true);
    pointer('pointercancel');
  });

  test('stars thin out with distance but never run dry', () => {
    const CHUNK = 760;
    const count = (i) => world.near(i * CHUNK, i * CHUNK + 1).filter((o) => o.t === 's').length;
    for (const seed of [1337, 909, 77]) {
      world.seed(seed);
      for (const i of [79, 100, 150, 300, 600]) {
        assert.ok(count(i) >= 2, `seed ${seed} chunk ${i} has ${count(i)} stars`);
      }
    }
    world.seed(1337);
    const avg = (lo, hi) => { let n = 0; for (let i = lo; i <= hi; i++) n += count(i); return n / (hi - lo + 1); };
    assert.ok(avg(290, 300) < avg(2, 10), 'late chunks are leaner than early ones');
    world.seed(1337);
  });

  test('shake rocks the world on a smooth path and leaves the sky alone', () => {
    launch();
    assert.ok(game().shake > 0, 'the launch shakes the screen');
    const ops = [];
    const watched = ['fillRect', 'translate'];
    const saved = {};
    for (const op of watched) { saved[op] = ctx[op]; ctx[op] = (...args) => ops.push([op, ...args]); }
    try {
      ops.length = 0;
      advance();
      const fill = ops.findIndex(([op]) => op === 'fillRect');
      const move = ops.findIndex(([op]) => op === 'translate');
      assert.ok(fill >= 0 && move > fill, 'the sky is painted before the world is offset');

      const offsets = [];
      for (let i = 0; i < 6; i++) {
        ops.length = 0;
        advance();
        assert.ok(game().shake > 0, 'still shaking');
        const [, x, y] = ops.find(([op]) => op === 'translate');
        offsets.push([x, y]);
      }
      for (let i = 1; i < offsets.length; i++) {
        const dx = Math.abs(offsets[i][0] - offsets[i - 1][0]);
        const dy = Math.abs(offsets[i][1] - offsets[i - 1][1]);
        assert.ok(dx < 10 && dy < 10, `shake jumped ${dx.toFixed(1)},${dy.toFixed(1)} px between frames`);
      }
    } finally { for (const op of watched) ctx[op] = saved[op]; }
  });

  test('intro captions last nine seconds from the launch, however long the aim took', () => {
    const said = [];
    const fillText = ctx.fillText;
    ctx.fillText = (...args) => said.push(args[0]);
    const storm = () => said.some((s) => typeof s === 'string' && s.startsWith('a storm is chasing you'));
    try {
      key('x');
      world.seed(1337);
      advance(30);
      key(' ');
      assert.equal(game().ph, 1);
      advance(600);                       // dawdle ten seconds on the ignition meter
      key(' ');
      assert.equal(game().ph, 2);
      said.length = 0;
      advance();
      assert.ok(storm(), 'the caption is up at launch even after a slow aim');
      advance(60 * 6);
      said.length = 0;
      advance();
      assert.ok(storm(), 'still readable six seconds into the flight');
      advance(60 * 4);
      said.length = 0;
      advance();
      assert.ok(!storm(), 'gone once the nine seconds are up');
    } finally { ctx.fillText = fillText; }
  });

  test('the storm badge moves to the top right only on a narrow screen', () => {
    const place = (w, h) => {
      const ops = [];
      const canvas = new Proxy({
        createLinearGradient: () => gradient,
        fillText(s, x, y) { ops.push(['text', x, y, s]); },
        translate(x, y) { ops.push(['move', x, y]); }
      }, { get: (t, p) => p in t ? t[p] : () => {} });
      art.drawStormWarning(canvas, w, h, 2856, 0.2);
      assert.ok(ops.some(([op, x, y, s]) => op === 'text' && s === '2856 m'), 'the distance is drawn');
      const move = ops.find(([op]) => op === 'move');
      assert.ok(move, 'the badge is placed with a translate');
      return { x: move[1], y: move[2] };
    };
    const desk = place(1280, 720);
    assert.ok(desk.x < 1280 * 0.1 && desk.y > 720 * 0.5, `desktop badge should keep its old spot, got ${desk.x},${desk.y}`);
    const phone = place(620, 1340);
    assert.ok(phone.x > 620 * 0.75 && phone.y < 1340 * 0.2, `phone badge should sit top right, got ${phone.x},${phone.y}`);
  });

  test('long prompts shrink to fit a narrow screen', () => {
    const measure = ctx.measureText, fillText = ctx.fillText;
    const seen = [];
    const w0 = innerWidth, h0 = innerHeight;
    try {
      ctx.measureText = (s) => ({ width: s.length * 30 });
      ctx.fillText = (s) => seen.push([s, ctx.font]);
      globalThis.innerWidth = 620; globalThis.innerHeight = 1340;
      fire('resize', {});
      key('x');
      advance(2);
      const prompt = seen.find(([s]) => typeof s === 'string' && s.includes('lock the angle'));
      assert.ok(prompt, 'the aiming prompt is drawn');
      const px = +prompt[1].match(/([\d.]+)px/)[1];
      const want = 20 * (620 - 24) / (prompt[0].length * 30);
      assert.ok(px < 20, `expected the 20 px prompt to shrink, got ${px}`);
      assert.ok(Math.abs(px - want) < 1e-9, `expected ${want}, got ${px}`);
    } finally {
      ctx.measureText = measure; ctx.fillText = fillText;
      globalThis.innerWidth = w0; globalThis.innerHeight = h0;
      fire('resize', {});
    }
  });

  test('a tall screen seats the unicorn lower so grass cannot fill half the view', () => {
    launch();
    land();
    advance(120);
    const seat = () => {
      until((g) => g.grounded > 0, 'grounded sample');
      const g = game();
      return (innerHeight - (g.y - g.camY) * g.zoom) / innerHeight;
    };
    const wide = seat();
    assert.ok(wide > 0.55 && wide < 0.75, `desktop seat ${wide.toFixed(3)} should stay mid-screen`);
    const w0 = innerWidth, h0 = innerHeight;
    try {
      globalThis.innerWidth = 620; globalThis.innerHeight = 1340;
      fire('resize', {});
      advance(240);
      const tall = seat();
      assert.ok(tall > wide + 0.08, `portrait seat ${tall.toFixed(3)} should sit lower than ${wide.toFixed(3)}`);
      assert.ok(tall < 0.85, `but not off the bottom edge: ${tall.toFixed(3)}`);
    } finally {
      globalThis.innerWidth = w0; globalThis.innerHeight = h0;
      fire('resize', {});
      advance(240);
    }
  });

  test('a narrow viewport pulls the camera back so a phone sees a comparable span', () => {
    launch();
    land();
    advance(120);
    const wide = game().zoom;
    const W0 = innerWidth, H0 = innerHeight;
    try {
      globalThis.innerWidth = 620; globalThis.innerHeight = 1340;
      fire('resize', {});
      advance(240);
      const narrow = game().zoom;
      assert.ok(narrow < wide * 0.85, `narrow zoom ${narrow.toFixed(3)} vs wide ${wide.toFixed(3)}`);
      assert.ok(narrow > wide * 0.5, `zoomed out too far: ${narrow.toFixed(3)} vs ${wide.toFixed(3)}`);
    } finally {
      globalThis.innerWidth = W0; globalThis.innerHeight = H0;
      fire('resize', {});
      advance(240);
    }
  });

  test('storage keeps to one namespaced key, carries the old one over and deletes nothing', () => {
    assert.equal(migrated, 777, 'a record saved under the pre-namespace key is still read');
    const neighbours = { uniLv: '[1,2,3]', uniBank: '99', someOtherGame: 'keep me' };
    Object.assign(store, neighbours);
    const before = Object.keys(store);
    try {
      assert.equal(save.record(12345), 1);
      assert.equal(+store['unicorn-launcher-26.best'], 12345, 'the record lands in this entry own key');
      const outside = Object.keys(store).filter((k) => k !== 'unicorn-launcher-26.best' && !before.includes(k));
      assert.deepEqual(outside, [], `keys written outside the namespace: ${outside}`);
      for (const k of Object.keys(neighbours)) assert.ok(k in store, `a neighbour key was deleted: ${k}`);
    } finally {
      save.wipe();
      for (const k of Object.keys(neighbours)) delete store[k];
    }
  });

  for (const type of ['b', 'p', 'r', 'k']) {
    test(`${type} booster clears grounded state`, () => {
      launch();
      land();
      pickup(type);
      assert.equal(game().grounded, 0);
    });
  }

  console.log(`${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
} else {
  line('AFK (no input)', 'afk', 0);
  line('blind 7/s', 'blind', 7);
  line('blind 15/s', 'blind', 15);
  line('skilled', 'skill');
}
