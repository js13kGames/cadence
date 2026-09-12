import { zzfx, zzfxX, zzfxStart } from './zzfx.js';

let on = 1, ready = 0, focused = 1, master, next = 0, noteN = 0, phase = -1;
const voices = new Set();
export const muted = () => !on;
export const resetMusic = () => {
  next = 0; noteN = 0; phase = -1;
  if (!zzfxX) return;   // nothing to stop before the first gesture
  for (const { o, v } of voices) {
    v.gain.cancelScheduledValues(zzfxX.currentTime);
    v.gain.setTargetAtTime(0, zzfxX.currentTime, .01);
    o.stop(zzfxX.currentTime + .04);
  }
  voices.clear();
};
export const toggle = () => {
  on = !on;
  if (master) {
    master.gain.cancelScheduledValues(zzfxX.currentTime);
    master.gain.setTargetAtTime(on ? .65 : 0, zzfxX.currentTime, .015);
  }
  if (!on) resetMusic();
  return on;
};
export const unlock = () => { try { zzfxStart().resume().catch(() => {}); ready = 1; } catch (e) {} };
addEventListener('blur', () => { focused = 0; resetMusic(); });
addEventListener('focus', () => { focused = 1; });
addEventListener('visibilitychange', () => { if (document.hidden) resetMusic(); });

const note = (pitch, when, length, volume, type = 'sine') => {
  const o = zzfxX.createOscillator(), v = zzfxX.createGain(), voice = { o, v };
  o.type = type; o.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
  v.gain.setValueAtTime(0, when);
  v.gain.linearRampToValueAtTime(volume, when + .025);
  v.gain.exponentialRampToValueAtTime(.0001, when + length);
  o.connect(v); v.connect(master);
  voices.add(voice);
  o.onended = () => { o.disconnect(); v.disconnect(); voices.delete(voice); };
  o.start(when); o.stop(when + length + .02);
};

export const music = (face, ph) => {
  if (!ready || !on || !focused || document.hidden || zzfxX.state !== 'running') {
    if (voices.size) resetMusic();
    return;
  }
  if (!master) { master = zzfxX.createGain(); master.gain.value = .65; master.connect(zzfxX.destination); }
  const mode = ph < 2 ? 0 : ph;
  if (phase !== mode) { resetMusic(); phase = mode; }
  const now = zzfxX.currentTime;
  if (!next || next < now - .25) next = now + .015;
  const fear = ph === 2 ? face.scared : ph === 3 ? .35 : 0;
  const happy = ph === 2 ? face.happy * (1 - fear) : 0;
  const minor = fear > .1, end = ph === 3;
  while (next < now + .08) {
    const i = noteN % 8, root = 48 + (minor ? [0, -3, -5, -1] : [0, 5, 9, 7])[(noteN / 8 | 0) % 4];
    if (!(i % 2) || happy > .25 || fear > .5) {
      const melody = minor ? [0, 7, 12, 7, 3, 6, 12, 13] : [0, 7, 12, 7, 4, 7, 12, 16];
      note(root + 12 + melody[i], next, end ? .6 : .25 + (1 - happy) * .2,
        (end ? .015 : .022 + happy * .018), happy > .25 ? 'triangle' : 'sine');
    }
    if (!(i % 4)) {
      note(root - 12, next, .7, end ? .018 : .035);
      if (!end) for (const interval of [0, minor ? 3 : 4, 7]) note(root + interval, next, .75, .008);
    }
    if (fear > .1 && !end) note(root - 12 + (i % 2 ? 1 : 0), next, .12, fear * .03, 'triangle');
    noteN++; next += 1 / 4.8;
  }
};

const p = (...a) => { if (on) try { zzfx(...a); } catch (e) {} };

export const sfx = {

  step: (n) => p(.4, .05, 260 + Math.min(n, 40) * 14, 0, .02, .05, 1, 1.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, .5, .02),

  tick: (accent) => p(accent ? .34 : .2, .02, accent ? 1500 : 1050, 0, .008, .03, 1, 1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, .4, .01),
  miss: () => p(.4, .05, 140, .01, .03, .08, 3, 1.5, -3, 0, 0, 0, 0, .4, 0, 0, 0, .4, .03),
  aim: () => p(.3, .05, 480, 0, .01, .04, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .5, .01),
  launch: (perfect) => {
    p(2, .05, perfect ? 110 : 80, .02, .1, .5, 4, 1.6, -9, 0, 0, 0, 0, 1.3, 0, .3, .1, .4, .1);
    if (perfect) [0, 90, 180].forEach((d, i) => setTimeout(() => p(.5, .05, 520 + i * 260, 0, .06, .14, 1, 1.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, .6, .04), d));
  },
  star: () => p(.5, .05, 880, 0, .04, .12, 1, 1.8, 0, 0, 320, .02, 0, 0, 0, 0, 0, .6, .03),
  boost: () => p(.7, .05, 200, .01, .09, .22, 2, 2, 12, 0, 0, 0, 0, 0, 0, 0, .05, .5, .05),
  pad: () => p(.7, .05, 300, .01, .08, .2, 1, 2, 18, 0, 0, 0, 0, 0, 0, 0, 0, .6, .04),
  bounce: () => p(.45, .05, 170, 0, .03, .1, 1, 2, 5, 0, 0, 0, 0, 0, 0, 0, 0, .5, .02),
  fluff: () => p(.35, .1, 110, .05, .1, .2, 4, 0, 0, 0, 0, 0, 0, 1.6, 0, .2, .1, .3, .1),
  over: () => p(.6, .05, 220, .05, .18, .4, 3, 1.2, -5, 0, 0, 0, 0, .4, 0, 0, .1, .4, .12),
  pop: () => p(.5, .05, 620, 0, .05, .13, 1, 1.4, 0, 0, -180, .04, 0, 0, 0, 0, 0, .6, .04),
  wing: () => p(.6, .08, 380, .02, .12, .26, 2, 1.6, 6, 0, 0, 0, 0, .3, 0, 0, .04, .6, .06),
  comet: () => p(.9, .05, 160, .02, .2, .4, 2, 2.4, 22, 0, 0, 0, 0, .2, 0, .1, .06, .6, .1),
  warp: () => p(.7, .05, 240, .01, .14, .3, 3, 1.8, 26, 0, 400, .05, 0, 0, 0, 0, .05, .6, .06),
  zap: () => p(.8, .1, 90, .01, .12, .3, 4, 1.2, -6, 0, 0, 0, 0, 2, 0, .4, .1, .4, .1),
};
