import { unicornFace, drawUnicorn, drawCannon, drawCloud, drawStrip, drawStar, drawSky, drawHills, drawStormWall, drawStormWarning, drawBubble, drawPegasus, drawDoubleJump, drawComet, drawPortal } from './art.js';
import { near, reset, seed, GY, SLOPE } from './world.js';
import { sfx, unlock, toggle, muted, music, resetMusic } from './sfx.js';
import { best, record, wipe } from './save.js';

const c = document.getElementById('c');
const g = c.getContext('2d');

const PPM = 30;
const GRAV = 2600;
const DIVEACC = 3900;
const RAD = 30;
const BEAT = 2.4;
const WINDOW = 0.22;
const CX = 250;
const CY = GY(CX) + 34;
const CS = 0.9;
const BARREL = 168 * CS;
// fixed unicorn stats (what the old shop sold at level 0)
const POWER = 1, SWEET = 0.86, PUSH = 78, DRAG = 0.06, TOP = 1450, LUNGS = 100, MAG = 30;

let W, H, DPR, FIT = 1, SEAT = 0.42;
const resize = () => {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  c.width = W * DPR; c.height = H * DPR;
  c.style.width = W + 'px'; c.style.height = H + 'px';
  FIT = Math.min(1, W / 780, H / 480);   // a phone sees far less world than a desktop
  // the taller the screen, the lower the unicorn sits, or grass fills the bottom half
  SEAT = Math.max(0.26, Math.min(0.42, 0.42 - (H / W - 0.9) * 0.16));
};
addEventListener('resize', resize);
resize();

let ph, angle, sweep, power, perfect, fuse, lit;
let u, cam, camY, zoom, t;
let combo, boostFlash, shake, parts, run, newBest, sta, fx;
let mx = 0, my = 0;
let pitch = 0, beat = 0, ptr = 0, ptrY = 0, ringFx = 0;
let grounded = 0, storm = 0, stormSpeed = 170, landFx = 0, caught = 0, flash = 0, bar = 0, pops = [];
let redFx = 0, gasp = 3, gaspN = 0, tip = 0;
let beatN = 0, beatUsed = -1;
let airJump = 0, flapFx = 0, wingPtr = null;
const keys = new Set();

const newRun = () => {
  reset(); resetMusic();
  ph = 0; sweep = 0; angle = 0.7; power = 0; perfect = 0; fuse = 1; lit = 0;
  u = { x: CX, y: CY, vx: 0, vy: 0, rot: 0, alive: 1 };
  cam = 0; camY = 0; zoom = FIT; t = 0;
  combo = 0; boostFlash = 0; shake = 0; newBest = 0; sta = LUNGS;
  parts = [];
  pitch = 0; beat = 0; ringFx = 0; grounded = 0; landFx = 0; caught = 0; flash = 0; bar = 0;
  redFx = 0; gasp = 3; gaspN = 0; tip = 0;
  beatN = 0; beatUsed = -1;
  pops = [];
  storm = CX - 3000 * PPM; stormSpeed = 170;
  fx = { anti: 0, comet: 0, storm: 0, double: 0, wings: 0 };
  airJump = 0; flapFx = 0; wingPtr = null; ptr = 0;
  keys.clear();
  run = { dist: 0, top: 0 };
};
newRun();

const pop = (x, y, s, c) => pops.push({ x, y, s, c, l: 0.9 });

const spark = (x, y, n, col, spd = 260) => {
  for (; n--;) {
    const a = Math.random() * 7, s = spd * (0.3 + Math.random());
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 0.3 + Math.random() * 0.5, c: col, r: 2 + Math.random() * 4 });
  }
};

const aimAngle = () => 0.28 + Math.abs(Math.sin(sweep));

const gliding = () => ph === 2 && u.alive && fx.wings > 0 && grounded <= 0 && pitch >= 0
                  && (keys.has('w') || keys.has('arrowup') || wingPtr !== null);

const low = () => sta < LUNGS / 3;   // red bar, and the only time a miss flashes the screen

const jump = (wing = false) => {
  if (ph !== 2 || !u.alive) return;
  let label = 'JUMP', col = '#7cff9b';
  if (grounded > 0) {
    u.y = Math.max(u.y, GY(u.x) + RAD + 2);
    u.vy = Math.max(0, u.vy, SLOPE(u.x) * u.vx) + 850;
  } else if (wing && fx.wings > 0) {
    // flying is free, but only a flap on the beat lifts — and it always carries you forward
    const off = Math.min(beat, 1 - beat);
    const n = beat > 0.5 ? beatN + 1 : beatN;
    if (off >= WINDOW || beatUsed === n) { combo = Math.max(0, combo - 2); if (low()) redFx = 1; sfx.miss(); pop(u.x, u.y + 46, 'off beat', '#ff8fa8'); return; }
    beatUsed = n; combo++;
    u.vy = Math.min(900, Math.max(0, u.vy) + 380);
    u.vx = Math.min(u.vx + 110 * (1 + Math.min(combo, 40) * 0.025), TOP);
    flapFx = 0.3; ringFx = 0.25;
    label = combo > 2 ? `FLAP x${combo}` : 'FLAP'; col = '#eef2ff';
  } else if (fx.double > 0 && !airJump) {
    airJump = 1;
    u.vy = Math.max(u.vy, 850);
    label = 'DOUBLE JUMP';
  } else return;
  grounded = 0; boostFlash = 0.15;
  if (col === '#eef2ff') sfx.wing(); else sfx.pad();
  pop(u.x, u.y + 46, label, col);
  spark(u.x, u.y - RAD, 12, col, 260);
};

const gallop = () => {
  if (ph !== 2 || !u.alive) return;

  if (grounded <= 0) { sfx.miss(); return; }

  if (fx.storm > 0) {
    // dizzy: no rhythm, no breath — every mash is a tiny stagger forward,
    // a 6 px lurch that works even uphill where gravity eats any momentum
    const a = Math.atan(SLOPE(u.x)), kick = PUSH * 0.2;
    u.x += 6;
    u.vx += Math.cos(a) * kick; u.vy += Math.sin(a) * kick;
    boostFlash = 0.06;
    sfx.step(0);
    spark(u.x - 20, u.y, 1, '#ffe45c88', 100);
    return;
  }

  const off = Math.min(beat, 1 - beat);
  const n = beat > 0.5 ? beatN + 1 : beatN;
  const good = off < WINDOW && beatUsed !== n;
  if (good) beatUsed = n;
  if (sta < (good ? 2 : 8)) { sfx.miss(); pop(u.x, u.y + 46, 'out of breath!', '#ff5a7a'); return; }
  if (good) combo++; else combo = Math.max(0, combo - 2);
  sta -= good ? 2 : 8;

  const sp = Math.hypot(u.vx, u.vy);
  const mult = (1 + Math.min(combo, 40) * 0.025) * (good ? 2.6 : 0.3)
             * (1 + Math.max(0, (420 - sp) / 420) * 1.6);
  const a = Math.atan(SLOPE(u.x));
  const kick = PUSH * mult;
  u.vx += Math.cos(a) * kick;
  u.vy += Math.sin(a) * kick + 7 * mult;
  const nsp = Math.hypot(u.vx, u.vy), cap = TOP;
  if (nsp > cap) { u.vx *= cap / nsp; u.vy *= cap / nsp; }
  boostFlash = good ? 0.18 : 0.08;
  ringFx = good ? 0.25 : 0;
  if (!good && low()) redFx = 1;
  sfx.step(good ? combo : 0);
  pop(u.x, u.y + 46, good ? (combo > 2 ? `PERFECT x${combo}` : 'PERFECT') : 'off beat', good ? '#7cff9b' : '#ff8fa8');
  spark(u.x - 20, u.y, good ? 6 : 2, good ? `hsl(${(combo * 24) % 360} 90% 65%)` : '#ffffff66', good ? 240 : 120);
};

const endRun = () => {
  u.alive = 0; ph = 3;
  newBest = record(run.dist | 0);
  sfx.over();
};

const act = () => {
  if (ph === 0) { angle = aimAngle(); ph = 1; sweep = 0; sfx.aim(); }
  else if (ph === 1) {
    power = Math.abs(Math.sin(sweep));
    perfect = power > SWEET ? 1 : 0;
    lit = 0.001; ph = 2; u.rot = 0;
    tip = 9;   // the intro captions run from the launch, not from the first aim

    storm = u.x - 3000 * PPM;
    const sp = (600 + power * 700) * POWER * (perfect ? 1.22 : 1);
    u.vx = Math.cos(angle) * sp; u.vy = Math.sin(angle) * sp;
    shake = perfect ? 26 : 16;
    sfx.launch(perfect);
    spark(u.x, u.y, perfect ? 46 : 26, '#ffd24d', 620);
  } else if (ph === 3) newRun();
};

addEventListener('keydown', (e) => {
  unlock();
  const k = e.key.toLowerCase();
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();
  if (k === 'w' || k === 'arrowup' || k === ' ') {
    if (e.repeat || keys.has(k)) return;
    const wingHeld = keys.has('w') || keys.has('arrowup');
    keys.add(k);
    if (k === ' ') {
      if (ph === 2) jump(); else act();
    } else if (!wingHeld) jump(true);
  } else if (k === 'arrowright' || k === 'd') gallop();
  else if (k === 's' || k === 'arrowdown') { keys.add(k); pitch = -1; }
  else if (k === 'm') toggle();
  else if (DEV && k === 'x') { wipe(); newRun(); }
  else if ((k === 'enter' || k === 'r') && !e.repeat) act();
});
addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  keys.delete(k);
  if (k === 's' || k === 'arrowdown') pitch = keys.has('s') || keys.has('arrowdown') ? -1 : 0;
});
addEventListener('blur', () => { keys.clear(); ptr = 0; wingPtr = null; pitch = 0; });
addEventListener('pointermove', (e) => {
  mx = e.clientX; my = e.clientY;

  if (e.pointerId !== wingPtr && ptr && ph === 2) pitch = my > ptrY + 24 ? -1 : 0;
});
const releasePointer = (e) => {
  if (e.pointerId === wingPtr) wingPtr = null;
  else { ptr = 0; pitch = keys.has('s') || keys.has('arrowdown') ? -1 : 0; }
};
addEventListener('pointerup', releasePointer);
addEventListener('pointercancel', releasePointer);
addEventListener('pointerdown', (e) => {
  unlock();
  mx = e.clientX; my = e.clientY;
  if (ph === 2 && Math.hypot(mx - (W - 56), my - (H - 138)) < 38) {
    if (wingPtr === null) { wingPtr = e.pointerId; jump(true); }
    return;
  }
  ptr = 1; ptrY = my;
  if (ph === 2) gallop();
  else act();
});

const step = (dt) => {
  t += dt;
  if (lit) lit += dt;
  if (boostFlash > 0) boostFlash -= dt;
  if (flapFx > 0) flapFx = Math.max(0, flapFx - dt);
  if (redFx > 0) redFx = Math.max(0, redFx - dt * 4);
  if (tip > 0 && ph === 2) tip = Math.max(0, tip - dt);
  if (shake > 0) shake = Math.max(0, shake - dt * 60);

  if (ph < 2) {
    sweep += dt * (ph ? 3.4 : 1.9);

    const a = ph ? angle : aimAngle();
    u.x = CX + Math.cos(a) * BARREL;
    u.y = CY + Math.sin(a) * BARREL;
    u.rot = -a;
  }

  if (u.alive && ph >= 2) {
    if (fuse > 0) fuse = Math.max(0, fuse - dt * 2.5);

    for (const k in fx) fx[k] = Math.max(0, fx[k] - dt);

    const wasBeat = beat;
    beat = (beat + dt * BEAT) % 1;
    if (beat < wasBeat) { bar = (bar + 1) % 4; beatN++; sfx.tick(!bar); }
    if (ringFx > 0) ringFx -= dt;
    if (landFx > 0) landFx -= dt;
    if (grounded > 0) grounded -= dt;

    storm += (stormSpeed + 10 * dt) * dt;
    stormSpeed += 20 * dt;
    if (u.x - storm < RAD) { caught = 1; endRun(); }

    const glide = gliding();
    u.vy -= (GRAV * (glide ? 0.12 : fx.anti > 0 ? 0.16 : fx.comet > 0 ? 0.5 : 1) + (pitch < 0 ? DIVEACC : 0)) * dt;
    if (glide) u.vy = Math.max(u.vy, -180);
    if (fx.comet > 0) {
      u.vx = Math.max(u.vx, 1500);
      if (Math.random() < dt * 60) spark(u.x - 24, u.y, 2, Math.random() < 0.5 ? '#ffb03a' : '#ffe45c', 140);
    } else u.vx *= 1 - DRAG * dt;
    u.x += u.vx * dt;
    u.y += u.vy * dt;

    const want = -Math.atan2(u.vy, Math.max(u.vx, 120)) * 0.55;
    u.rot += (want - u.rot) * Math.min(1, dt * 7);

    const gy = GY(u.x) + RAD;
    if (u.y <= gy) {
      u.y = gy;
      const a = Math.atan(SLOPE(u.x));
      const ca = Math.cos(a), sa = Math.sin(a);
      const tanv = u.vx * ca + u.vy * sa;
      let nt = Math.max(0, tanv);

      if (grounded <= 0) {
        const norv = -u.vx * sa + u.vy * ca;
        const harsh = Math.min(1, Math.abs(norv) / 1100);
        nt *= 1 - harsh * 0.55;
        if (harsh < 0.22 && a < -0.08) {
          nt *= 1.26;
          landFx = 0.3;
          combo++;
          sta = Math.min(LUNGS, sta + 8);
          pop(u.x, u.y + 40, 'clean landing  +8', '#7cff9b');
          sfx.pad();
          spark(u.x, u.y - RAD, 16, '#7cff9b', 320);
        } else if (harsh > 0.5) {
          combo = 0;
          sfx.bounce();
          spark(u.x, u.y - RAD, 12, '#ffd8ee', 220);
          shake = 8;
        } else sfx.bounce();
      }
      grounded = 0.1;
      airJump = 0;
      u.vx = ca * nt;
      u.vy = sa * nt;
      u.vx *= 1 - 0.25 * dt;
    }

    const mag = MAG;
    for (const e of near(u.x - 500, u.x + 500)) {
      if (e.dead) continue;
      let dx = u.x - e.x, dy = u.y - e.y;

      if (e.t === 's' && mag) {
        const d = Math.hypot(dx, dy);
        if (d < RAD + mag) { e.x += (dx / d) * 260 * dt; e.y += (dy / d) * 260 * dt; dx = u.x - e.x; dy = u.y - e.y; }
      }

      const hit = e.r ? dx * dx + dy * dy < (e.r + RAD) ** 2
                      : Math.abs(dx) < e.w / 2 + RAD && Math.abs(dy) < e.h / 2 + RAD;
      if (!hit) continue;

      if (e.t === 'c') {
        if (fx.comet > 0) continue;
        const k = 1 - 1.9 * dt;
        u.vx *= k; u.vy *= k;
        if (combo) { combo = 0; sfx.fluff(); }
        if (Math.random() < dt * 30) spark(u.x, u.y, 1, '#ffc2e2', 90);
        continue;
      }

      if (e.t === 's') {
        sta = Math.min(LUNGS, sta + 20);
        pop(e.x, e.y, '+20 breath', '#7cff9b');
        u.vx = Math.min(u.vx + 40, TOP);
        sfx.star();
        spark(e.x, e.y, 12, '#ffe45c', 300);
      } else if (e.t === 'r') {
        u.vx = Math.min(u.vx * 1.22 + 90, TOP);
        u.vy += 120;
        grounded = 0;
        sfx.boost();
        spark(e.x, e.y, 18, `hsl(${(t * 300) % 360} 95% 62%)`, 380);
        shake = 10;
      } else if (e.t === 'b') {
        u.vy = Math.max(u.vy * -0.9, 900);
        grounded = 0;
        sfx.pad();
        spark(e.x, e.y, 14, '#7cf', 300);
        shake = 8;
      } else if (e.t === 'p') {
        fx.wings = 12; grounded = 0; flapFx = 0.3;
        u.vy = Math.max(u.vy, 0) + 950;
        u.vx = Math.min(u.vx + 70, TOP);
        pop(e.x, e.y + 60, 'WINGS: tap ↑ on the beat to fly / hold ↑ to glide', '#eef2ff');
        sfx.wing();
        spark(e.x, e.y, 20, '#eef2ff', 420);
        shake = 12;
      } else if (e.t === 'j') {
        fx.double = 12;
        pop(e.x, e.y + 46, 'DOUBLE JUMP: SPACE in midair', '#7cff9b');
        sfx.pad();
        spark(e.x, e.y, 16, '#7cff9b', 300);
      } else if (e.t === 'u') {
        fx.anti = 2.6;
        sfx.pop();
        spark(e.x, e.y, 16, '#bfefff', 260);
      } else if (e.t === 'k') {
        grounded = 0;
        fx.comet = 1.8;
        u.vx = Math.max(u.vx * 1.4, 1500);
        u.vy = Math.max(u.vy, 60);
        sfx.comet();
        spark(e.x, e.y, 28, '#ffb03a', 520);
        shake = 22;
      } else if (e.t === 'o') {
        spark(u.x, u.y, 20, '#a45bff', 340);
        u.x += 780;
        sfx.warp();
        spark(u.x, u.y, 20, '#3ab7ff', 340);
        shake = 14;
      } else if (e.t === 'z') {
        fx.storm = 2.4;
        combo = 0;
        u.vx *= 0.8;
        sfx.zap();
        spark(e.x, e.y, 22, '#ffe45c', 300);
        shake = 16;
      }
      e.dead = 1;
    }

    run.dist = u.x / PPM;
    run.top = Math.max(run.top, u.y / PPM);

    // no breath left for even a perfect step: three seconds to find a star.
    // wings pause it, because flying costs nothing.
    if (sta < 2 && fx.wings <= 0) {
      gasp -= dt;
      const n = Math.ceil(gasp);
      if (n !== gaspN) { gaspN = n; if (n > 0) sfx.tick(1); }
      if (gasp <= 0) { caught = 2; endRun(); }
    } else if (gaspN) { gasp = 3; gaspN = 0; }

    if (u.x - storm > 100 * PPM) flash = 0;
    else if (flash > 0) flash = Math.max(0, flash - dt * 4);
    else if (Math.random() < dt * 1.4) { flash = 1; sfx.zap(); }

    if (u.vx > 300 && Math.random() < dt * 90) {
      parts.push({ x: u.x - 18, y: u.y, vx: -u.vx * 0.05, vy: 40 - Math.random() * 80, l: 0.6, c: `hsl(${(u.x * 0.5) % 360} 92% 64%)`, r: 3 + Math.random() * 5 });
    }
  }

  for (let i = pops.length; i--;) {
    const q = pops[i];
    q.y += 46 * dt; q.l -= dt;
    if (q.l <= 0) pops.splice(i, 1);
  }

  for (let i = parts.length; i--;) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 500 * dt; p.l -= dt;
    if (p.l <= 0) parts.splice(i, 1);
  }

  const sp = Math.hypot(u.vx, u.vy);
  const tx = ph < 2 ? CX + 60 : u.x;
  const ground = GY(tx);
  const ty = ph < 2 ? CY + 130 : u.y * 0.66 + (ground + 210) * 0.34;
  const alt = ph < 2 ? 0 : u.y - ground;
  const want = Math.min(1, 780 / (alt + 660)) * Math.min(1, 1150 / (sp + 780));
  zoom += (Math.max(0.42, want) * FIT - zoom) * Math.min(1, dt * 2.5);
  cam = tx - (W * (ph < 2 ? 0.32 : 0.23)) / zoom;
  camY = ty - (H * (ph < 2 ? 0.42 : SEAT)) / zoom;
};

const w2sx = (x) => (x - cam) * zoom;
const w2sy = (y) => H - (y - camY) * zoom;
const at = (x, y, s, fn) => { g.save(); g.translate(w2sx(x), w2sy(y)); g.scale(s, s); fn(); g.restore(); };
const text = (s, x, y, size, col, align = 'left', weight = 600) => {
  g.save();
  g.fillStyle = col; g.textAlign = align;
  const font = (px) => `${weight} ${px}px system-ui,-apple-system,sans-serif`;
  g.font = font(size);
  const room = W - 24, wide = g.measureText(s).width;   // a long prompt must not run off a phone screen
  if (wide > room) g.font = font(size * room / wide);
  g.shadowColor = '#0b0620cc';
  g.shadowBlur = 6;
  g.shadowOffsetY = 1;
  g.fillText(s, x, y);
  g.restore();
};

const over = () => {
  g.fillStyle = '#100722d9'; g.fillRect(0, 0, W, H);
  text(`${run.dist | 0} m`, W / 2, H * 0.4, 64, '#fff', 'center', 700);
  if (caught) text(caught === 2 ? 'you ran out of breath' : 'the storm caught you', W / 2, H * 0.4 - 52, 18, '#ff5a7a', 'center');
  text(`${newBest ? 'NEW BEST!  ' : ''}peak ${run.top | 0} m   ·   best ${best} m`, W / 2, H * 0.4 + 32, 18, newBest ? '#7cff9b' : '#ffffffaa', 'center');
  text('SPACE / tap — launch again    ·    M — sound', W / 2, H * 0.4 + 90, 16, '#ffffff99', 'center');
};

const COLS = { s: '#ffdc3d', r: '#ff6bd6', p: '#eef2ff', j: '#7cff9b', u: '#8fe3ff', k: '#ffb03a', o: '#a45bff', z: '#ff5a7a', c: '#f9a8d4', b: '#7cf' };

const telegraph = () => {
  const edge = cam + W / zoom;
  let n = 0;
  for (const e of near(edge, edge + 1700)) {
    if (e.dead || e.t === 's' || n > 7) continue;
    const y = Math.max(24, Math.min(H - 24, w2sy(e.y)));
    const d = (e.x - u.x) / 1700;
    g.globalAlpha = 0.85 - d * 0.5;
    g.fillStyle = COLS[e.t] || '#fff';
    g.beginPath();
    g.moveTo(W - 8, y); g.lineTo(W - 26, y - 9); g.lineTo(W - 26, y + 9);
    g.closePath(); g.fill();
    n++;
  }
  g.globalAlpha = 1;
};

const hud = () => {
  g.save();
  text(`${run.dist | 0} m`, 20, 40, 26, '#fff');
  text(`best ${best} m`, 20, 66, 15, '#ffffffaa');
  if (muted()) text('muted', 20, 110, 13, '#ffffff66');

  if (ph === 2) {
    const bw = 190;
    g.fillStyle = '#0005'; g.beginPath(); g.roundRect(20, 122, bw, 12, 6); g.fill();
    g.fillStyle = low() ? '#ff5a7a' : '#7cff9b';
    g.beginPath(); g.roundRect(20, 122, bw * Math.max(0, sta) / LUNGS, 12, 6); g.fill();
    text('BREATH', 20 + bw + 10, 133, 12, '#ffffff88');
    g.fillStyle = '#0005'; g.beginPath(); g.roundRect(20, 146, bw, 12, 6); g.fill();
    g.fillStyle = `hsl(${(combo * 24) % 360} 95% 65%)`;
    g.beginPath(); g.roundRect(20, 146, bw * Math.min(combo, 40) / 40, 12, 6); g.fill();
    text('COMBO', 20 + bw + 10, 157, 12, '#ffffff88');
    text(`x${(1 + Math.min(combo, 40) * 0.025).toFixed(2)}  ${combo}`, 30, 156, 11, '#fff');
    if (gaspN > 0) {
      text('OUT OF BREATH', W / 2, H * 0.3, 22, '#ff5a7a', 'center', 700);
      text(`${gaspN}`, W / 2, H * 0.3 + 96, 78 + (gasp % 1) * 26, '#ff5a7a', 'center', 700);
      text('grab a star!', W / 2, H * 0.3 + 130, 16, '#ffffffcc', 'center');
    }
  }

  if (ph === 2) {
    let py = 176;
    const pill = (label, left, col) => {
      g.fillStyle = col + '33'; g.beginPath(); g.roundRect(20, py, 150, 22, 6); g.fill();
      text(`${label} ${left.toFixed(1)}s`, 30, py + 16, 13, col);
      py += 26;
    };
    if (fx.double > 0) pill(airJump ? 'JUMP USED' : 'DOUBLE JUMP', fx.double, '#7cff9b');
    if (fx.wings > 0) {
      pill(gliding() ? 'GLIDING' : 'WINGS', fx.wings, '#eef2ff');
      text('W / UP: hold glide, tap flap -12', 20, py + 14, 12, '#eef2ff');
      py += 26;
    }
    g.beginPath(); g.arc(W - 56, H - 138, 38, 0, 7);
    g.fillStyle = wingPtr !== null ? '#eef2ff66' : '#10072299'; g.fill();
    g.strokeStyle = fx.wings > 0 ? '#eef2ff' : '#7cff9b'; g.lineWidth = 2; g.stroke();
    text(fx.wings > 0 && grounded <= 0 ? 'FLAP' : 'JUMP', W - 56, H - 134, 13, '#fff', 'center');
    if (fx.wings > 0) text('hold: glide', W - 56, H - 86, 11, '#eef2ff', 'center');
    text('SPACE / W / UP: jump', 20, H - 14, 12, '#ffffffaa');
    if (fx.comet > 0) pill('COMET', fx.comet, '#ffb03a');
    if (fx.anti > 0) pill('FLOATY', fx.anti, '#8fe3ff');
    if (fx.storm > 0) pill('DIZZY - MASH →', fx.storm, '#ff5a7a');
  }

  if (ph === 2) {
    const gap = u.x - storm;
    if (gap < 900) {
      g.save();
      const a = Math.min(0.55, (900 - gap) / 900);
      const vg = g.createLinearGradient(0, 0, W * 0.45, 0);
      vg.addColorStop(0, `rgba(120,20,160,${a})`);
      vg.addColorStop(1, '#0000');
      g.fillStyle = vg; g.fillRect(0, 0, W * 0.45, H);
      if (gap < 420) text('RUN!', W / 2, 100, 46, `rgba(255,90,122,${0.6 + Math.abs(Math.sin(t * 8)) * 0.4})`, 'center', 700);
      g.restore();
    }
  }

  if (ph === 0) {
    text('SPACE / tap — lock the angle', W / 2, H - 46, 20, '#fff', 'center');
  } else if (ph === 1) {
    const bw = Math.min(380, W - 60), v = Math.abs(Math.sin(sweep)), sweet = SWEET;
    g.save();
    g.translate(W / 2 - bw / 2, H - 84);
    g.fillStyle = '#0006'; g.beginPath(); g.roundRect(-4, -4, bw + 8, 30, 8); g.fill();
    g.fillStyle = '#7cff9b33'; g.fillRect(bw * sweet, -4, bw * (1 - sweet) + 4, 30);
    const grd = g.createLinearGradient(0, 0, bw, 0);
    grd.addColorStop(0, '#ff5a7a'); grd.addColorStop(0.6, '#ffd24d'); grd.addColorStop(1, '#7cff9b');
    g.fillStyle = grd; g.beginPath(); g.roundRect(0, 0, bw * v, 22, 6); g.fill();
    g.fillStyle = '#fff'; g.fillRect(bw * sweet, -6, 3, 34);
    g.restore();
    text('SPACE / tap — light the fuse (stop in the green!)', W / 2, H - 34, 20, '#fff', 'center');
  } else if (ph === 2 && tip > 0) {
    const a = Math.min(1, tip / 3);
    text('a storm is chasing you — keep your speed up or it eats you', W / 2, 108, 20, `rgba(255,140,170,${a})`, 'center', 700);
    text('SPACE / W / UP — jump. S / DOWN — dive onto a downslope', W / 2, H - 62, 21, `rgba(255,255,255,${a})`, 'center');
    text('tap → ONCE per beat, when the ring closes', W / 2, H - 36, 17, `rgba(255,255,255,${a * 0.8})`, 'center');
  }
  g.restore();
};

const expression = () => unicornFace(u, t, u.x - storm, ph >= 2, fx.storm > 0);

const render = () => {
  const face = expression();
  music(face, ph);
  g.setTransform(DPR, 0, 0, DPR, 0, 0);

  const groundY = Math.min(H, w2sy(GY(cam + W / (2 * zoom))));
  drawSky(g, W, H, cam, groundY, zoom);
  // the sky stays put and the world rocks, on a smooth path rather than
  // per-frame noise, so an impact reads as a thump instead of a glitch
  if (shake > 0) { const a = t * 26; g.translate(Math.sin(a) * shake * 0.5, Math.sin(a * 1.7) * shake * 0.5); }
  drawHills(g, W, H, w2sx, w2sy, GY, cam, zoom);

  at(CX, CY, zoom * CS, () => drawCannon(g, ph ? angle : aimAngle(), fuse, lit, ph < 2 ? (r) => drawUnicorn(g, r, 0, 0, 0, 0, face) : 0));

  for (const e of near(cam - 200, cam + W / zoom + 200)) {
    if (e.dead) continue;
    const d = { c: () => drawCloud(g, e.r, t), z: () => drawCloud(g, e.r, t, 1), s: () => drawStar(g, e.r, t),
                p: () => drawPegasus(g, e.r, t), j: () => drawDoubleJump(g, e.r, t), u: () => drawBubble(g, e.r, t), k: () => drawComet(g, e.r, t),
                o: () => drawPortal(g, e.r, t) }[e.t] || (() => drawStrip(g, e.w, e.h, e.t === 'r' ? t : t * 2));
    at(e.x, e.y, zoom, d);
  }

  for (const p of parts) {
    g.globalAlpha = Math.max(0, Math.min(1, p.l * 2));
    g.fillStyle = p.c;
    g.beginPath(); g.arc(w2sx(p.x), w2sy(p.y), p.r * zoom, 0, 7); g.fill();
  }
  g.globalAlpha = 1;

  if (boostFlash > 0) {
    g.save();
    g.globalAlpha = boostFlash * 4;
    g.beginPath(); g.arc(w2sx(u.x), w2sy(u.y), RAD * 1.9 * zoom, 0, 7);
    g.fillStyle = '#fff6'; g.fill();
    g.restore();
  }
  if (ph >= 2) {
    at(u.x, u.y + 11, zoom, () => drawUnicorn(g, RAD, u.rot, u.x * 0.035, grounded > 0 ? 1 : 0.4,
      fx.wings > 0 ? (gliding() ? 1 : 0.35) + Math.sin((flapFx / 0.3) * Math.PI) * 0.65 : 0, face));
    if (fx.anti > 0) at(u.x, u.y, zoom, () => drawBubble(g, RAD * 1.5, t));
    if (landFx > 0) {
      g.save(); g.globalAlpha = landFx * 3;
      g.beginPath(); g.arc(w2sx(u.x), w2sy(u.y), RAD * 2.4 * zoom, 0, 7);
      g.strokeStyle = '#7cff9b'; g.lineWidth = 4; g.stroke();
      g.restore();
    }
  }
  if (flash > 0) {
    g.save();
    g.globalAlpha = flash * 0.28;
    g.fillStyle = '#e8dcff';
    g.fillRect(-40, -40, W + 80, H + 80);
    g.restore();
  }
  if (redFx > 0) {
    g.save();
    g.globalAlpha = redFx * 0.22;
    g.fillStyle = '#ff2d55';
    g.fillRect(-40, -40, W + 80, H + 80);
    g.restore();
  }

  const stormX = w2sx(storm), gap = u.x - storm;
  if (gap <= 100 * PPM) drawStormWall(g, stormX, H, t);
  if (stormX < 80) {
    drawStormWarning(g, W, H, Math.max(0, gap / PPM), Math.max(0, 1 - gap / (100 * PPM)));
  }

  if (ph === 2 && u.alive) {

    const off = Math.min(beat, 1 - beat), good = off < WINDOW;
    const sx = w2sx(u.x), sy = w2sy(u.y), base = RAD * zoom;
    g.beginPath(); g.arc(sx, sy, base * 1.25, 0, 7);
    g.strokeStyle = good ? '#7cff9bcc' : '#ffffff77'; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(sx, sy, base * (1.25 + off * 5), 0, 7);
    g.strokeStyle = good ? '#7cff9b' : '#ffffffaa';
    g.lineWidth = good ? 6 : 3; g.stroke();
    if (off < 0.06) {
      g.beginPath(); g.arc(sx, sy, base * (1.25 + off * 9), 0, 7);
      g.strokeStyle = `rgba(255,255,255,${1 - off * 16})`; g.lineWidth = 5; g.stroke();
    }
    if (ringFx > 0) {
      g.beginPath(); g.arc(sx, sy, base * (1.3 + (0.25 - ringFx) * 9), 0, 7);
      g.strokeStyle = `rgba(124,255,155,${ringFx * 4})`; g.lineWidth = 3; g.stroke();
    }
    telegraph();
  }

  for (const q of pops) {
    g.save();
    g.globalAlpha = Math.min(1, q.l * 2.2);
    text(q.s, w2sx(q.x), w2sy(q.y), 16, q.c, 'center', 700);
    g.restore();
  }

  g.setTransform(DPR, 0, 0, DPR, 0, 0);   // the HUD never shakes
  hud();
  if (ph === 3) over();
};

if (DEV) globalThis.__breath = (v) => { sta = v; };
if (DEV) globalThis.__game = () => ({ ph, dist: run.dist | 0, top: run.top | 0, sta, redFx, gasp, gaspN, cam, camY, zoom, shake, fx, beat, combo, grounded, airJump, gliding: !!gliding(), flapFx, t, storm, stormSpeed, flash, rot: u.rot, face: expression(), x: u.x, y: u.y, vx: u.vx, vy: u.vy });

let prev = 0, acc = 0;
const frame = (now) => {
  requestAnimationFrame(frame);
  const dt = Math.min((now - prev) / 1000, 0.1);
  prev = now;
  acc += dt;
  while (acc > 1 / 120) { step(1 / 120); acc -= 1 / 120; }
  render();
};
requestAnimationFrame(frame);
