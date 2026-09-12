const CHUNK = 760;

export const GY = (x) => 340 + Math.sin(x / 620) * 190 + Math.sin(x / 300 + 1.3) * 55 + Math.sin(x / 140 + 2.1) * 15;
export const SLOPE = (x) => (GY(x + 6) - GY(x - 6)) / 12;

const rng = (s) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const cache = new Map();
let SEED = 1337;

export const seed = (n) => { SEED = n; cache.clear(); };

const GAP = 24;
const size = (o) => o.r || Math.max(o.w, o.h) / 2;

const chunk = (i) => {
  let e = cache.get(i);
  if (e) return e;
  e = [];
  if (i > 0) {
    const prev = i > 1 ? chunk(i - 1) : [];
    const r = rng(i * 7919 + SEED);
    const hard = Math.min(i / 45, 1);
    const top = Math.min(220 + i * 20, 620);
    const at = (x) => GY(x);
    const clear = (x, y, rad) => {
      for (const o of e) if (Math.hypot(o.x - x, o.y - y) < size(o) + rad + GAP) return 0;
      for (const o of prev) if (Math.hypot(o.x - x, o.y - y) < size(o) + rad + GAP) return 0;
      return 1;
    };
    // roll a spot until it touches nothing already placed; give up after a few tries
    const spot = (rad, dy, span = CHUNK, tries = 8) => {
      for (; tries--;) {
        const x = i * CHUNK + r() * span, y = at(x) + dy();
        if (clear(x, y, rad)) return [x, y];
      }
      return 0;
    };
    const put = (t, rad, dy) => { const p = spot(rad, dy); if (p) e.push({ t, x: p[0], y: p[1], r: rad }); };

    // rare pickups first, so they never lose their spot to a cloud
    if (i > 1 && r() < 0.4) put('p', 44, () => 130 + r() * top);
    if (i > 2 && r() < 0.36) put('u', 48, () => 90 + r() * top);
    if (i > 4 && r() < 0.2) put('k', 28, () => 110 + r() * top);
    if (i > 5 && r() < 0.18) put('o', 46, () => 140 + r() * top);
    if (i > 7 && r() < 0.12 + hard * 0.45) put('z', 82, () => 80 + r() * (top + 140));
    if (i === 1 || r() < 0.4) put('j', 28, () => 70 + r() * 100);

    // stars thin out with distance but never run dry: every chunk keeps an arc,
    // and a crowded one falls back to whichever stars of it fit
    for (let n = hard > 0.5 ? 1 : 2; n--;) {
      let best = [];
      for (let tries = 10; tries--;) {
        const x0 = i * CHUNK + r() * CHUNK * 0.7;
        const y0 = GY(x0) + 70 + r() * (top + 60);
        const len = Math.max(2, (6 - hard * 3.5 + r() * 3) | 0);
        const curve = (r() - 0.5) * 0.008;
        const arc = [];
        for (let k = 0; k < len; k++) {
          const dx = k * 78, sx2 = x0 + dx;
          arc.push({ t: 's', x: sx2, y: Math.max(at(sx2) + 40, y0 + dx * 0.18 - curve * dx * dx), r: 19 });
        }
        const free = arc.filter((o) => clear(o.x, o.y, o.r));
        if (free.length === arc.length) { best = arc; break; }
        if (free.length > best.length) best = free;
      }
      if (best.length > 1) e.push(...best);
    }

    for (let n = r() < 0.75 ? 1 : 2; n--;) {
      const p = spot(95, () => 60 + r() * top);
      if (p) e.push({ t: 'r', x: p[0], y: p[1], w: 190, h: 30 });
    }
    if (r() < 0.45) { const p = spot(65, () => 24); if (p) e.push({ t: 'b', x: p[0], y: p[1], w: 130, h: 30 }); }

    for (let n = 1 + ((r() < 0.3 + hard * 0.9) ? 1 : 0) + (hard > 0.6 ? 1 : 0) + (hard > 0.9 ? 1 : 0); n--;) {
      const rad = 70 + r() * 55;
      put('c', rad, () => 60 + r() * (top + 120));
    }
  }
  cache.set(i, e);
  return e;
};

export const reset = () => cache.clear();

export const near = (x0, x1) => {
  const out = [];
  for (let i = Math.max(0, Math.floor(x0 / CHUNK)); i <= Math.floor(x1 / CHUNK); i++) out.push(...chunk(i));
  return out;
};
