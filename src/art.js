const TAU = Math.PI * 2;
const INK = '#5a4a52';

const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); };
const paint = (g, fill, stroke) => { g.fillStyle = fill; g.fill(); if (stroke !== 0) g.stroke(); };

const drawWings = (g, r, angle, span = 1) => {
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * r * 0.42, -r * 0.1);
    g.rotate(sd * angle);
    g.scale(span, 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(sd * r * 0.4, -r * 0.95, sd * r * 1.15, -r * 0.72);
    g.quadraticCurveTo(sd * r * 0.95, -r * 0.05, 0, r * 0.2);
    g.closePath();
    paint(g, sd < 0 ? '#dfe6ff' : '#fffdfe');
    g.restore();
  }
};

export const unicornFace = ({ vx, vy, rot }, t, gap = 2000, active = true, shocked = false) => {
  const sp = Math.hypot(vx, vy), ca = Math.cos(rot), sa = Math.sin(rot);
  const scared = active ? Math.max(shocked ? 1 : 0, Math.max(0, Math.min(1, (1000 - gap) / 650))) : 0;
  return { happy: active ? Math.max(0, Math.min(1, (sp - 650) / 550)) * (1 - scared) : 0, scared,
    blink: Math.max(0, 1 - Math.abs(t % 3.7 - 3.5) / 0.09),
    lookX: sp > 1 ? (vx * ca - vy * sa) / sp * 10 : 0,
    lookY: sp > 1 ? (-vx * sa - vy * ca) / sp * 10 : 0 };
};

export const drawUnicorn = (g, r, rot, lp, la, wing = 0, { happy = 0, scared = 0, blink = 0, lookX = 0, lookY = 0 } = {}) => {
  g.save();
  g.scale(r / 100, r / 100);
  g.rotate(rot);
  g.lineWidth = 5;
  g.strokeStyle = INK;
  g.lineJoin = g.lineCap = 'round';

  if (wing > 0) drawWings(g, 140, 0.5 + (wing - 1) * 1.2, 0.5 + wing * 0.5);

  if (la) {
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const ph = lp + i * 1.7;
      const x = -50 + i * 33;
      const sw = Math.sin(ph) * 46 * la;
      const lift = Math.max(0, Math.cos(ph)) * 34 * la;
      g.beginPath();
      g.moveTo(x, 46);
      g.quadraticCurveTo(x + sw * 0.45, 104, x + sw, 140 - lift);
      g.lineWidth = 22; g.strokeStyle = INK; g.stroke();
      g.lineWidth = 13; g.strokeStyle = '#fffdfe'; g.stroke();
      circ(g, x + sw, 140 - lift, 9);
      g.fillStyle = '#c9a0e0'; g.fill();
    }
    g.lineWidth = 5;
    g.strokeStyle = INK;
  }

  for (const s of [-1, 1]) {
    g.save();
    g.translate(s * 66, -70);
    g.rotate(s * 0.45);
    ell(g, 0, 0, 21, 42); paint(g, '#fffdfe');
    ell(g, 0, 4, 11, 27); paint(g, '#f2bce4');
    g.restore();
  }

  circ(g, 0, 0, 100); paint(g, '#fffdfe');

  g.beginPath();
  g.moveTo(-19, -92);
  g.quadraticCurveTo(-8, -150, 2, -196);
  g.quadraticCurveTo(12, -148, 19, -92);
  g.closePath();
  paint(g, '#ece01e');
  g.lineWidth = 4;
  for (let i = 1; i < 4; i++) {
    const t = i / 4, y = -92 - t * 96, hw = 18 * (1 - t * 0.85);
    g.beginPath(); g.moveTo(-hw + t * 8, y); g.quadraticCurveTo(t * 8, y - 9, hw + t * 8, y - 3); g.stroke();
  }
  g.lineWidth = 5;

  ell(g, -47, -74, 29, 47, -0.38); paint(g, '#e33ec5');
  ell(g, 46, -72, 29, 47, 0.38); paint(g, '#3aa8ee');
  ell(g, 0, -82, 29, 49); paint(g, '#a63ce6');

  for (const s of [-1, 1]) {
    g.save();
    g.translate(s * 39, -8);
    if (blink > 0.85) {
      g.beginPath(); g.moveTo(-21, 0); g.quadraticCurveTo(0, 8, 21, 0); g.stroke();
    } else {
      g.scale(1, 1 - blink);
      ell(g, 0, 0, 23, 23 + scared * 5 - happy * 3); paint(g, '#fff');
      g.clip();
      circ(g, lookX, lookY, 16 - scared * 4); paint(g, '#221a20', 0);
      circ(g, lookX - 5, lookY - 6, 5); paint(g, '#fff', 0);
      circ(g, lookX + 5, lookY + 5, 2.5); paint(g, '#fff', 0);
    }
    g.restore();
    g.beginPath(); g.moveTo(s * 22, -39 - scared * 12 - happy * 3);
    g.quadraticCurveTo(s * 39, -48 - happy * 5, s * 57, -38 + scared * 3); g.stroke();
  }
  g.lineWidth = 3;
  for (const s of [-1, 1]) { ell(g, s * 57, 43, 16, 12); paint(g, happy > 0.5 ? '#f4b6db' : '#f6d2e8'); }
  g.lineWidth = 5;
  if (scared > 0.5) {
    ell(g, lookX * 0.3, 62, 8 + scared * 4, 8 + scared * 8); paint(g, '#221a20');
  } else {
    const w = 24 + happy * 10;
    g.beginPath(); g.moveTo(-w, 59); g.quadraticCurveTo(0, 80 + happy * 24 - scared * 26, w, 59);
    if (happy > 0.2) { g.quadraticCurveTo(0, 66, -w, 59); paint(g, '#221a20'); }
    else g.stroke();
  }

  g.restore();
};

export const drawCannon = (g, angle, fuse, lit, ball) => {
  g.lineWidth = 4;
  g.strokeStyle = INK;
  g.lineJoin = g.lineCap = 'round';

  g.save();
  g.lineWidth = 7;
  g.strokeStyle = '#e8d8a0';
  const fx = -34 - 74 * (1 - fuse), fy = 26 + 42 * (1 - fuse);
  g.beginPath();
  g.moveTo(fx, fy);
  g.quadraticCurveTo(-46, 4, -22, 12);
  g.stroke();
  if (lit) {
    const f = 1 + Math.sin(lit * 22) * 0.25;
    g.save(); g.translate(fx, fy); g.scale(f, f);
    circ(g, 0, 0, 13); paint(g, '#ff8a1e', 0);
    circ(g, 0, -3, 7); paint(g, '#ffe45c', 0);
    g.restore();
  }
  g.restore();

  g.save();
  g.rotate(-angle);
  const R = 52, L = 190;
  const grd = g.createLinearGradient(0, -R, 0, R);
  grd.addColorStop(0, '#8b4be0');
  grd.addColorStop(0.45, '#6a1fc4');
  grd.addColorStop(1, '#3d0c78');
  g.beginPath();
  g.roundRect(-56, -R, L + 56, R * 2, [R * 0.9, 22, 22, R * 0.9]);
  paint(g, grd, 0);

  const mx = L - 6, rx = 44, ry = R - 4;
  ell(g, mx, 0, rx, ry); paint(g, '#25064a', 0);
  if (ball) {
    g.save();
    ell(g, mx, 0, rx, ry);
    g.clip();
    g.translate(mx + 4, 0);
    g.rotate(angle);
    ball(50);
    g.restore();
  }
  g.beginPath();
  g.ellipse(mx, 0, rx, ry, 0, 0, TAU);
  g.strokeStyle = '#4a1290'; g.lineWidth = 7; g.stroke();
  g.strokeStyle = '#8b4be0'; g.lineWidth = 2.5; g.stroke();
  g.restore();

  g.save();
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(-84, 118); g.lineTo(84, 118); g.closePath();
  paint(g, '#f4c72e');
  g.fillStyle = '#c99a10';
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    for (const s of [-1, 1]) { circ(g, s * 84 * t, 118 * t, 4); g.fill(); }
    circ(g, -84 + 168 * t, 118, 4); g.fill();
  }
  circ(g, 0, 0, 15); paint(g, '#f4c72e');
  g.restore();
};

const PUFFS = [[-0.6, 0.15, 0.55], [0.6, 0.15, 0.55], [-0.25, -0.3, 0.62], [0.3, -0.35, 0.6], [0, 0.3, 0.6]];

export const drawCloud = (g, r, t, storm) => {
  g.save();
  g.globalAlpha = 0.92;
  for (const [px, py, pr] of PUFFS) {
    circ(g, px * r + Math.sin(t + px * 4) * r * 0.04, py * r, pr * r);
    g.fillStyle = storm ? '#4b3f6b' : '#f9a8d4'; g.fill();
  }
  g.globalAlpha = 0.5;
  for (const [px, py, pr] of PUFFS) { circ(g, px * r * 0.8, py * r - r * 0.15, pr * r * 0.7); g.fillStyle = storm ? '#6b5c94' : '#ffd3ea'; g.fill(); }
  g.restore();
  if (storm) {
    g.save();
    g.globalAlpha = 0.65 + Math.abs(Math.sin(t * 7)) * 0.35;
    g.beginPath();
    g.moveTo(-r * 0.2, -r * 0.02);
    g.lineTo(r * 0.14, -r * 0.06);
    g.lineTo(-r * 0.02, r * 0.34);
    g.lineTo(r * 0.2, r * 0.3);
    g.lineTo(-r * 0.16, r * 0.86);
    g.lineTo(-r * 0.03, r * 0.4);
    g.lineTo(-r * 0.28, r * 0.44);
    g.closePath();
    g.fillStyle = '#ffe45c'; g.fill();
    g.restore();
  }
};

export const drawBubble = (g, r, t) => {
  g.save();
  circ(g, 0, 0, r);
  const h = (t * 70) % 360;
  g.fillStyle = '#cfeaff2e'; g.fill();
  const grd = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.05, 0, 0, r);
  grd.addColorStop(0, '#ffffff55');
  grd.addColorStop(0.55, `hsla(${h},95%,80%,.24)`);
  grd.addColorStop(0.86, `hsla(${(h + 120) % 360},95%,75%,.4)`);
  grd.addColorStop(1, '#ffffff77');
  g.fillStyle = grd; g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = `hsla(${(h + 60) % 360},95%,82%,.9)`;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, r * 0.72, -2.5, -1.4);
  g.lineWidth = r * 0.11; g.strokeStyle = '#ffffffcc'; g.lineCap = 'round'; g.stroke();
  circ(g, -r * 0.38, -r * 0.38, r * 0.13); g.fillStyle = '#fff'; g.fill();
  g.restore();
};

export const drawDoubleJump = (g, r, t) => {
  g.save();
  const pulse = 1 + Math.sin(t * 3) * 0.035;
  g.scale(pulse, pulse);
  g.lineJoin = g.lineCap = 'round';
  g.lineWidth = r * 0.08; g.strokeStyle = INK;
  circ(g, 0, 0, r); paint(g, '#80e8bd');
  circ(g, 0, 0, r * 0.79);
  g.lineWidth = r * 0.045; g.strokeStyle = '#d8fff0'; paint(g, '#a5f4d4');
  g.beginPath(); g.arc(0, 0, r * 0.9, -2.5, -1.5);
  g.strokeStyle = '#f2fff9'; g.lineWidth = r * 0.065; g.stroke();
  const lift = Math.sin(t * 3) * r * 0.045;
  for (const y of [-r * 0.17, r * 0.25]) {
    g.beginPath();
    g.moveTo(-r * 0.34, y + r * 0.12 - lift);
    g.lineTo(0, y - r * 0.17 - lift);
    g.lineTo(r * 0.34, y + r * 0.12 - lift);
    g.strokeStyle = '#287d65'; g.lineWidth = r * 0.19; g.stroke();
    g.strokeStyle = '#f2fff9'; g.lineWidth = r * 0.095; g.stroke();
  }
  g.restore();
};

export const drawPegasus = (g, r, t) => {
  g.save();
  g.lineWidth = 4.5; g.strokeStyle = INK; g.lineJoin = g.lineCap = 'round';
  const f = Math.sin(t * 8);
  drawWings(g, r, 0.5 + f * 0.35);
  drawUnicorn(g, r * 0.72, Math.sin(t * 2) * 0.12);
  g.restore();
};

export const drawPortal = (g, r, t) => {
  g.save();
  g.rotate(Math.sin(t) * 0.3);
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.ellipse(0, 0, r - i * r * 0.13, r * 1.4 - i * r * 0.18, 0, 0, TAU);
    g.strokeStyle = `hsl(${(i * 52 + t * 150) % 360} 92% 62%)`;
    g.lineWidth = r * 0.13;
    g.stroke();
  }
  g.restore();
};

export const drawStrip = (g, w, h, t) => {
  const cols = ['#ff3b6b', '#ff8f2e', '#ffe23d', '#4ad96a', '#3ab7ff', '#a45bff'];
  g.save();
  const bh = h / cols.length;
  cols.forEach((c, i) => {
    g.beginPath();
    g.roundRect(-w / 2, -h / 2 + i * bh, w, bh + 0.5, 3);
    g.fillStyle = c; g.fill();
  });

  const sx = ((t * 260) % (w + 90)) - w / 2 - 45;
  const sh = g.createLinearGradient(sx - 45, 0, sx + 45, 0);
  sh.addColorStop(0, '#fff0'); sh.addColorStop(0.5, '#fff9'); sh.addColorStop(1, '#fff0');
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 4);
  g.fillStyle = sh; g.fill();

  g.strokeStyle = '#fffc'; g.lineWidth = 4; g.lineCap = 'round';
  for (let i = -1; i < 2; i++) {
    const cx = i * 46 + ((t * 130) % 46);
    g.beginPath(); g.moveTo(cx - 10, -h / 2 + 5); g.lineTo(cx + 8, 0); g.lineTo(cx - 10, h / 2 - 5); g.stroke();
  }
  g.restore();
};

export const drawStar = (g, r, t) => {
  g.save();
  g.rotate(t * 1.6);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2, rad = i % 2 ? r * 0.45 : r;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath();
  g.fillStyle = '#ffdc3d'; g.fill();
  g.strokeStyle = '#e0a010'; g.lineWidth = 2.5; g.stroke();
  g.restore();
};

export const drawComet = (g, r, t) => {
  g.save();
  const grd = g.createLinearGradient(-r * 3.6, 0, 0, 0);
  grd.addColorStop(0, '#ff7a1e00');
  grd.addColorStop(0.55, '#ff7a1eaa');
  grd.addColorStop(1, '#ffe45c');
  g.beginPath();
  g.moveTo(-r * 3.6 - Math.sin(t * 8) * r, 0);
  g.lineTo(0, -r * 0.9); g.lineTo(0, r * 0.9);
  g.closePath();
  g.fillStyle = grd; g.fill();
  circ(g, 0, 0, r * 0.95); g.fillStyle = '#fff3b0'; g.fill();
  drawStar(g, r * 0.8, t * 2.5);
  g.restore();
};

export const drawSky = (g, W, H, camX, groundY, z) => {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1e6fc4');
  sky.addColorStop(0.42, '#57aae8');
  sky.addColorStop(0.75, '#a5d8f3');
  sky.addColorStop(1, '#ffeccb');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  g.save();
  g.globalAlpha = 0.32;
  g.lineWidth = 26 * z;
  const rx = W * 0.7 - camX * 0.03 * z, ry = groundY, rr = Math.max(W, H) * 0.55;
  ['#ff3b6b', '#ffe23d', '#4ad96a', '#3ab7ff', '#a45bff'].forEach((c, i) => {
    g.strokeStyle = c;
    g.beginPath();
    g.arc(rx, ry, rr - i * 26 * z, Math.PI, TAU);
    g.stroke();
  });
  g.restore();

  const layers = [[0.12, '#9fc9b4', 0.30], [0.28, '#7ab598', 0.20], [0.5, '#5aa07f', 0.12]];
  for (const [par, col, amp] of layers) {
    const off = camX * par * z;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let sx = 0; sx <= W + 40; sx += 40) {
      const wx = (sx + off) / 220;
      g.lineTo(sx, groundY - (Math.sin(wx) * 0.6 + Math.sin(wx * 0.37) * 0.4 + 1) * H * amp * z);
    }
    g.lineTo(W, H);
    g.fill();
  }
};

export const drawHills = (g, W, H, sx, sy, gy, camX, z) => {
  const step = 12;
  g.beginPath();
  g.moveTo(-20, H + 20);
  for (let px = -20; px < W + 20; px += step) {
    const wx = camX + px / z;
    g.lineTo(px, sy(gy(wx)));
  }
  g.lineTo(W + 20, H + 20);
  g.closePath();
  const grd = g.createLinearGradient(0, sy(420), 0, H);
  grd.addColorStop(0, '#2e8a57');
  grd.addColorStop(1, '#11331f');
  g.fillStyle = grd;
  g.fill();

  g.beginPath();
  for (let px = -20; px < W + 20; px += step) {
    const wx = camX + px / z;
    g[px < -10 ? 'moveTo' : 'lineTo'](px, sy(gy(wx)));
  }
  g.strokeStyle = '#5ad07e';
  g.lineWidth = 7 * z;
  g.stroke();
  g.strokeStyle = '#ff8fc6';
  g.lineWidth = 4 * z;
  g.setLineDash([26 * z, 30 * z]);
  g.lineDashOffset = camX * z * 0.5;
  g.stroke();
  g.setLineDash([]);
};

export const drawStormWall = (g, edge, H, t) => {
  if (edge < -420) return;
  const w = 420;
  const grd = g.createLinearGradient(edge - w, 0, edge + 40, 0);
  grd.addColorStop(0, '#0f0722');
  grd.addColorStop(0.45, '#241543f2');
  grd.addColorStop(0.85, '#3a225899');
  grd.addColorStop(1, '#3a225800');
  g.fillStyle = grd;
  g.fillRect(edge - w, 0, w + 40, H);

  g.save();

  for (let i = 0; i < 9; i++) {
    const y = (i / 8) * H;
    const wob = Math.sin(t * 1.6 + i) * 26;
    g.globalAlpha = 0.9;
    circ(g, edge - 60 + wob, y, 78 + (i % 3) * 20);
    g.fillStyle = '#33234f'; g.fill();
    circ(g, edge - 130 - wob * 0.5, y + 40, 66 + (i % 4) * 16);
    g.fillStyle = '#241540'; g.fill();
  }

  g.globalAlpha = 0.35;
  g.strokeStyle = '#9ec6ff';
  g.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const rx = edge - ((i * 97 + t * 900) % w);
    const ry = ((i * 211 + t * 1500) % (H + 60)) - 30;
    g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 7, ry + 22); g.stroke();
  }

  g.globalAlpha = 0.5 + Math.abs(Math.sin(t * 5.3)) * 0.5;
  g.strokeStyle = '#ffe45c';
  g.lineWidth = 5;
  for (const [ph, sc] of [[0, 1], [2.1, 0.7]]) {
    const by = ((Math.sin(t * 2.7 + ph) * 0.5 + 0.5) * H) | 0;
    const bx = edge - 90 - ph * 40;
    g.beginPath();
    g.moveTo(bx, by - 70 * sc);
    g.lineTo(bx + 42 * sc, by - 12 * sc);
    g.lineTo(bx + 6 * sc, by + 4 * sc);
    g.lineTo(bx + 52 * sc, by + 74 * sc);
    g.stroke();
  }
  g.restore();
};

export const drawStormWarning = (g, W, H, gapM, close) => {
  g.save();
  const grd = g.createLinearGradient(0, 0, 150, 0);
  grd.addColorStop(0, `rgba(30,10,50,${0.4 + close * 0.5})`);
  grd.addColorStop(1, '#1e0a3200');
  g.fillStyle = grd;
  g.fillRect(0, 0, 150, H);

  // on a narrow screen there is no room beside the unicorn, so go top right
  if (W < 900) g.translate(W - 74, 96); else g.translate(58, H * 0.65);
  for (const [dx, dy, r] of [[-16, 6, 26], [16, 6, 24], [0, -8, 30]]) {
    circ(g, dx, dy, r); g.fillStyle = '#3d2a5e'; g.fill();
  }
  if (gapM <= 100) {
    g.globalAlpha = 0.6 + Math.abs(Math.sin(Date.now() / 90)) * 0.4;
    g.beginPath();
    g.moveTo(-8, 18); g.lineTo(10, 20); g.lineTo(-2, 40); g.lineTo(14, 38); g.lineTo(-10, 74); g.lineTo(0, 44); g.lineTo(-16, 46);
    g.closePath();
    g.fillStyle = '#ffe45c'; g.fill();
    g.globalAlpha = 1;
  }

  g.textAlign = 'center';
  g.fillStyle = '#fff';
  g.font = '700 22px system-ui,-apple-system,sans-serif';
  g.fillText(`${gapM | 0} m`, 0, -46);
  g.fillStyle = '#ff8fa8';
  g.font = '600 11px system-ui,-apple-system,sans-serif';
  g.fillText('STORM', 0, -28);
  g.restore();
};
