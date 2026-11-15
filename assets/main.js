(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width:760px)');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inView = (el, cb, opts) => new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), opts).observe(el);

const intro = $('#intro'), os = $('#os'), desk = $('#desk');

/* ═════════ window manager ═════════ */
const wins = new Map($$('.win').map(w => [w.id, w]));
const tbApps = $('#tb-apps');
const tbBtn = new Map();
let z = 20, cascade = 0;

function place(w) {
  const dw = desk.clientWidth, dh = desk.clientHeight;
  const W = Math.min(+w.dataset.w, dw - 24), H = Math.min(+w.dataset.h, dh - 24);
  const icons = $('.icons');
  const left = MOBILE.matches ? 12 : icons.offsetLeft + icons.offsetWidth + 12;   // clear the icon column
  const room = dw - (dw > 1100 ? 320 : 0) - left;          // and the widgets
  const x = Math.max(8, Math.min(left + Math.max(0, (room - W) / 2) + cascade * 28, dw - W - 8));
  const y = clamp((dh - H) / 2 + (cascade - 2) * 24, 8, dh - H - 8);
  cascade = (cascade + 1) % 5;
  Object.assign(w.style, { left: x + 'px', top: y + 'px', width: W + 'px', height: H + 'px' });
  w.dataset.placed = '1';
}
function syncTask() {
  wins.forEach((w, id) => {
    const b = tbBtn.get(id);
    const icon = $(`.ico[data-open="${id}"]`);
    if (icon) icon.classList.toggle('run', !!b);
    if (!b) return;
    b.classList.toggle('act', w.classList.contains('act') && !w.hidden);
    b.classList.toggle('min', w.hidden);
  });
}
function focusWin(w, moveFocus) {
  w.style.zIndex = ++z;
  wins.forEach(x => x.classList.toggle('act', x === w));
  if (moveFocus) {
    const t = $('.win-t', w); t.tabIndex = -1;
    (w.id === 'terminal' ? $('#term-cmd') : t).focus({ preventScroll: true });
  }
  syncTask();
}
function openWin(id, opener, target) {
  const w = wins.get(id);
  if (!w) return;
  if (!w.dataset.placed) place(w);
  w.hidden = false;
  if (!tbBtn.has(id)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tb-app';
    b.textContent = $('.win-t', w).textContent;
    b.addEventListener('click', () => {
      if (w.hidden) openWin(id);
      else if (w.classList.contains('act')) minWin(w);
      else focusWin(w, true);
    });
    tbApps.append(b); tbBtn.set(id, b);
  }
  if (opener) w._opener = opener;
  focusWin(w, true);
  if (target && target !== w) target.scrollIntoView({ block: 'start' });
  history.replaceState(null, '', '#' + id);
}
function topWin() {
  let best = null;
  wins.forEach(w => { if (!w.hidden && (!best || +w.style.zIndex > +best.style.zIndex)) best = w; });
  return best;
}
function afterHide(w) {
  w.classList.remove('act');
  const next = topWin();
  if (next) focusWin(next, false);
  if (location.hash === '#' + w.id) history.replaceState(null, '', location.pathname + location.search);
  syncTask();
}
function minWin(w) { w.hidden = true; afterHide(w); }
function closeWin(w) {
  w.hidden = true; w.classList.remove('max');
  tbBtn.get(w.id)?.remove(); tbBtn.delete(w.id);
  afterHide(w);
  (w._opener && document.contains(w._opener) ? w._opener : $(`.ico[data-open="${w.id}"]`))?.focus({ preventScroll: true });
}

document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]');
  if (o) return openWin(o.dataset.open, o);
  const a = e.target.closest('[data-act]');
  if (a) {
    const w = a.closest('.win');
    if (a.dataset.act === 'close') closeWin(w);
    else if (a.dataset.act === 'min') minWin(w);
    else w.classList.toggle('max');
  }
});
wins.forEach(w => {
  w.addEventListener('pointerdown', () => { if (!w.classList.contains('act')) focusWin(w, false); });
  // drag by the title bar
  const bar = $('.win-bar', w);
  bar.addEventListener('dblclick', e => { if (!e.target.closest('button') && !MOBILE.matches) w.classList.toggle('max'); });
  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button') || MOBILE.matches || w.classList.contains('max')) return;
    const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop;
    bar.setPointerCapture(e.pointerId);
    const move = ev => {
      w.style.left = clamp(ev.clientX - sx, 80 - w.offsetWidth, desk.clientWidth - 80) + 'px';
      w.style.top = clamp(ev.clientY - sy, 0, desk.clientHeight - 36) + 'px';
    };
    const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || $('#lb').open || !intro.hidden) return;
  const w = topWin();
  if (w && w.classList.contains('act')) closeWin(w);
});
function openTarget(id) {
  const el = id && document.getElementById(id);
  const w = el && el.closest('.win');
  if (!w) return false;
  const panel = el.closest('[role="tabpanel"]');
  if (panel) selectTab(panel.id);
  openWin(w.id, null, el);
  return true;
}
function openFromHash() { return openTarget(decodeURIComponent(location.hash.slice(1))); }
addEventListener('hashchange', openFromHash);
$$('.ico').forEach((b, i) => b.style.setProperty('--i', i));

/* ═════════ desktop services ═════════ */
let desktopStarted = false;
function startDesktop() {
  if (desktopStarted) return;
  desktopStarted = true;
  tacmap();
}

/* ═════════ intro: cyberdeck power-on ═════════ */
(function deck() {
  const kbd = $('#kbd');
  for (let i = 0; i < 63; i++) {
    const k = document.createElement('i');
    if (i === 0 || i === 41) k.className = 'k-a';
    if (i === 59) k.className = 'k-s';
    kbd.append(k);
  }
})();

const LINES = [
  ['GCS-01 BIOS v4.2', 'OK'], ['MEM 8192 MB', 'OK'], ['CRT-9 640x480', 'SYNC'],
  ['mount /dev/ros2', 'OK'], ['lidar  rplidar-c1', 'OK'], ['imu    9-axis', 'OK'],
  ['gnss   3D fix 31.95N 35.91E', 'OK'], ['radio  433.920 MHz', 'LINK'],
  ['', ''], ['operator ANMAR MOMANI', ''], ['role     ROBOTICS ENGINEER / AI ENGINEER', ''], ['', ''], ['> starting desktop_', '']
];
let started = false, finished = false, autoT;
os.inert = true;

function finish() {
  if (finished) return;
  finished = true;
  clearTimeout(autoT);
  try { sessionStorage.setItem('gcs-boot', '1'); } catch {}
  intro.classList.add('gone');
  intro.inert = true;
  setTimeout(() => { intro.hidden = true; }, RM ? 0 : 450);
  os.inert = false;
  os.classList.add('on');
  startDesktop();
  if (!openFromHash()) openWin('operator');
}
async function power() {
  if (started) return;
  started = true;
  clearTimeout(autoT);
  $('#intro-ui').classList.add('out');
  intro.classList.add('open');
  await sleep(1000);
  const scr = $('#dscreen'), log = $('#bootlog');
  scr.classList.add('on');
  await sleep(420);
  for (const [l, s] of LINES) {
    if (finished) return;
    const row = document.createElement('div');
    row.textContent = s ? l.padEnd(30, '.') + ' ' : l;
    if (s) { const g = document.createElement('span'); g.className = 'g'; g.textContent = s; row.append(g); }
    log.append(row);
    await sleep(95);
  }
  if (finished) return;
  intro.classList.add('front');
  await sleep(700);
  if (finished) return;
  const r = scr.getBoundingClientRect();
  const s = Math.max(innerWidth / r.width, innerHeight / r.height) * 1.04;
  const tx = s * (innerWidth / 2 - (r.left + r.width / 2)), ty = s * (innerHeight / 2 - (r.top + r.height / 2));
  $('#cam').style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
  await sleep(1000);
  finish();
}

let seen = false;
try { seen = sessionStorage.getItem('gcs-boot') === '1'; } catch {}
if (RM || seen || location.hash.length > 1) finish();
else {
  $('#power').addEventListener('click', power);
  $('#skip').addEventListener('click', finish);
  intro.addEventListener('keydown', e => { if (e.key === 'Escape') finish(); });
  $('#power').focus({ preventScroll: true });
  autoT = setTimeout(power, 7000);
}

/* clock: Amman, UTC+3 */
(function clock() {
  const a = $('#clock'), b = $('#clock2');
  const p = n => String(n).padStart(2, '0');
  const tick = () => {
    const d = new Date(Date.now() + 3 * 3600e3);
    a.textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC+3`;
    b.textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  };
  tick(); setInterval(tick, 1000);
})();

/* wallpaper: tactical map with terrain, radar sweep and SCORP on patrol */
function tacmap() {
  const cv = $('#map'), ctx = cv.getContext('2d');
  const base = document.createElement('canvas'), bx = base.getContext('2d');
  const tPos = $('#t-pos'), tHdg = $('#t-hdg'), tSpd = $('#t-spd'), tWpt = $('#t-wpt');
  const LAT0 = 31.95, LON0 = 35.91, DEG = 0.000022, MPX = 2.44; // degrees and metres per pixel
  const FONT = '10px "IBM Plex Mono", monospace';
  let W = 0, H = 0, dpr = 1, home, wps = [], segs = [], total = 0, dist = 0, trail = [], blips = [], sweep = 0, mouse = null, lastT = 0, lastTele = 0;

  // Fixed seed so the terrain is the same on every visit.
  let seed = 20251114;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const R = new Float32Array(65536);
  for (let i = 0; i < R.length; i++) R[i] = rnd();
  const sm = t => t * t * (3 - 2 * t);
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
    const h = (a, b) => R[((a & 255) << 8) | (b & 255)];
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y) => vn(x, y) * .55 + vn(x * 2.03 + 17, y * 2.03 + 5) * .28 + vn(x * 4.1 + 3, y * 4.1 + 11) * .17;
  const ll = (x, y) => [LAT0 - (y - home.y) * DEG, LON0 + (x - home.x) * DEG * 1.18];

  function drawBase() {
    base.width = Math.round(W * dpr); base.height = Math.round(H * dpr);
    bx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bx.fillStyle = '#05070a'; bx.fillRect(0, 0, W, H);
    // terrain contours by marching squares; every fifth line is an amber index contour
    const g = 9, nx = Math.ceil(W / g) + 1, ny = Math.ceil(H / g) + 1, f = new Float32Array(nx * ny), S = 1 / 300;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) f[j * nx + i] = fbm(i * g * S, j * g * S);
    const T = 0, Rt = 1, B = 2, L = 3;
    const TAB = [null, [[L, B]], [[B, Rt]], [[L, Rt]], [[T, Rt]], [[L, T], [B, Rt]], [[T, B]], [[L, T]], [[L, T]], [[T, B]], [[T, Rt], [L, B]], [[T, Rt]], [[L, Rt]], [[B, Rt]], [[L, B]], null];
    let k = 0;
    for (let lv = 0.2; lv < 0.85; lv += 0.035, k++) {
      bx.beginPath();
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = f[j * nx + i], b = f[j * nx + i + 1], c = f[(j + 1) * nx + i + 1], d = f[(j + 1) * nx + i];
        const segsHere = TAB[(a > lv) << 3 | (b > lv) << 2 | (c > lv) << 1 | (d > lv)];
        if (!segsHere) continue;
        const x0 = i * g, y0 = j * g;
        const P = e => e === T ? [x0 + g * (lv - a) / (b - a), y0] : e === Rt ? [x0 + g, y0 + g * (lv - b) / (c - b)] : e === B ? [x0 + g * (lv - d) / (c - d), y0 + g] : [x0, y0 + g * (lv - a) / (d - a)];
        for (const [e1, e2] of segsHere) { const p = P(e1), q = P(e2); bx.moveTo(p[0], p[1]); bx.lineTo(q[0], q[1]); }
      }
      const index = k % 5 === 0;
      bx.strokeStyle = index ? 'rgba(255,176,0,.17)' : 'rgba(84,130,230,.14)';
      bx.lineWidth = index ? 1.2 : 1;
      bx.stroke();
    }
    // map grid with coordinates
    const step = 120;
    bx.strokeStyle = 'rgba(143,180,255,.07)'; bx.lineWidth = 1; bx.beginPath();
    for (let x = home.x % step; x < W; x += step) { bx.moveTo(Math.round(x) + .5, 0); bx.lineTo(Math.round(x) + .5, H); }
    for (let y = home.y % step; y < H; y += step) { bx.moveTo(0, Math.round(y) + .5); bx.lineTo(W, Math.round(y) + .5); }
    bx.stroke();
    bx.font = FONT; bx.fillStyle = 'rgba(143,180,255,.4)';
    for (let x = home.x % step; x < W - 70; x += step) bx.fillText(ll(x, 0)[1].toFixed(3) + 'E', x + 4, H - 8);
    for (let y = home.y % step; y < H - 24; y += step) if (y > 16) bx.fillText(ll(0, y)[0].toFixed(3) + 'N', W - 66, y - 4);
    // scale bar
    const sb = Math.round(250 / MPX), sx = home.x - 260, sy = H - 30;
    bx.strokeStyle = 'rgba(236,230,216,.5)'; bx.beginPath();
    bx.moveTo(sx, sy - 4); bx.lineTo(sx, sy); bx.lineTo(sx + sb, sy); bx.lineTo(sx + sb, sy - 4); bx.stroke();
    bx.fillStyle = 'rgba(236,230,216,.6)'; bx.fillText('250 m', sx + sb + 6, sy + 3);
  }

  function setup() {
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    if (!W || !H) return false;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    home = { x: Math.round(W * (W > 1100 ? .55 : .5)), y: Math.round(H * .55) };
    const m = Math.min(W, H);
    wps = [[-.36, -.14], [-.05, -.34], [.3, -.24], [.42, .06], [.16, .3], [-.22, .26]].map(([a, b]) => ({ x: home.x + a * m * 1.25, y: home.y + b * m }));
    segs = []; total = 0;
    wps.forEach((p, i) => { const q = wps[(i + 1) % wps.length], l = Math.hypot(q.x - p.x, q.y - p.y); segs.push({ p, q, l, s: total, i }); total += l; });
    blips = Array.from({ length: 6 }, () => {
      const a = rnd() * Math.PI * 2, d = (.2 + rnd() * .75) * m * .6;
      return { x: home.x + Math.cos(a) * d, y: home.y + Math.sin(a) * d, a, v: 0, id: 'C-' + (10 + Math.floor(rnd() * 89)) };
    });
    trail = [];
    drawBase();
    return true;
  }
  function roverAt(d) {
    d = ((d % total) + total) % total;
    const s = segs.find(s => d < s.s + s.l) || segs[0], t = (d - s.s) / s.l;
    return { x: s.p.x + (s.q.x - s.p.x) * t, y: s.p.y + (s.q.y - s.p.y) * t, h: Math.atan2(s.q.y - s.p.y, s.q.x - s.p.x), w: s.i };
  }

  function frame(ts) {
    const dt = lastT ? Math.min(.1, (ts - lastT) / 1000) : 0; lastT = ts;
    dist += 34 * dt;
    sweep = (sweep + dt * Math.PI * 2 / 6) % (Math.PI * 2);
    const rv = roverAt(dist), last = trail[trail.length - 1];
    if (!last || Math.hypot(rv.x - last.x, rv.y - last.y) > 3) { trail.push({ x: rv.x, y: rv.y }); if (trail.length > 170) trail.shift(); }

    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT; ctx.lineWidth = 1;
    const RR = Math.min(W, H) * .62;
    // range rings
    ctx.setLineDash([2, 6]); ctx.strokeStyle = 'rgba(255,176,0,.22)';
    for (const k of [1 / 3, 2 / 3, 1]) { ctx.beginPath(); ctx.arc(home.x, home.y, RR * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,176,0,.5)';
    for (const k of [1 / 3, 2 / 3, 1]) ctx.fillText((RR * k * MPX / 1000).toFixed(1) + ' km', home.x + 5, home.y - RR * k - 5);
    // radar sweep
    if (ctx.createConicGradient) {
      const wedge = .9, gr = ctx.createConicGradient(sweep - wedge, home.x, home.y), f = wedge / (Math.PI * 2);
      gr.addColorStop(0, 'rgba(255,176,0,0)'); gr.addColorStop(f, 'rgba(255,176,0,.15)');
      gr.addColorStop(Math.min(1, f + .001), 'rgba(255,176,0,0)'); gr.addColorStop(1, 'rgba(255,176,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(home.x, home.y, RR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,176,0,.6)'; ctx.beginPath();
    ctx.moveTo(home.x, home.y); ctx.lineTo(home.x + Math.cos(sweep) * RR, home.y + Math.sin(sweep) * RR); ctx.stroke();
    // contacts flare as the sweep passes, then fade
    for (const b of blips) {
      const d = (sweep - b.a + Math.PI * 4) % (Math.PI * 2);
      if (d < .09) b.v = 1; else b.v *= .985;
      if (b.v < .03) continue;
      ctx.fillStyle = `rgba(255,90,31,${b.v})`; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,90,31,${b.v * .5})`; ctx.beginPath(); ctx.arc(b.x, b.y, 7 + (1 - b.v) * 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(236,230,216,${b.v * .75})`; ctx.fillText(b.id, b.x + 9, b.y - 6);
    }
    // patrol route and waypoints
    ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(143,180,255,.42)'; ctx.beginPath();
    wps.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    const next = (rv.w + 1) % wps.length;
    wps.forEach((p, i) => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i === next ? '#FFB000' : 'rgba(143,180,255,.75)'; ctx.fillRect(-3.5, -3.5, 7, 7); ctx.restore();
      ctx.fillStyle = 'rgba(143,180,255,.8)'; ctx.fillText('WP' + (i + 1), p.x + 8, p.y + 13);
    });
    // trail
    ctx.lineWidth = 2;
    for (let i = 1; i < trail.length; i++) {
      ctx.strokeStyle = `rgba(255,176,0,${i / trail.length * .7})`;
      ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
    }
    ctx.lineWidth = 1;
    // ground station
    ctx.strokeStyle = '#ECE6D8'; ctx.strokeRect(home.x - 5, home.y - 5, 10, 10);
    ctx.fillStyle = '#ECE6D8'; ctx.fillText('GCS-01', home.x + 10, home.y + 4);
    // rover
    ctx.save(); ctx.translate(rv.x, rv.y); ctx.rotate(rv.h);
    ctx.shadowColor = '#FFB000'; ctx.shadowBlur = 12; ctx.fillStyle = '#FFB000';
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#FFB000'; ctx.fillText('R-01 SCORP', rv.x + 13, rv.y - 10);
    // cursor coordinates
    if (mouse) {
      ctx.strokeStyle = 'rgba(236,230,216,.18)'; ctx.setLineDash([3, 4]); ctx.beginPath();
      ctx.moveTo(mouse.x, 0); ctx.lineTo(mouse.x, H); ctx.moveTo(0, mouse.y); ctx.lineTo(W, mouse.y); ctx.stroke(); ctx.setLineDash([]);
      const [la, lo] = ll(mouse.x, mouse.y), txt = la.toFixed(4) + 'N ' + lo.toFixed(4) + 'E';
      ctx.fillStyle = 'rgba(5,6,7,.85)'; ctx.fillRect(mouse.x + 10, mouse.y + 10, ctx.measureText(txt).width + 12, 18);
      ctx.fillStyle = '#ECE6D8'; ctx.fillText(txt, mouse.x + 16, mouse.y + 23);
    }
    // telemetry widget, a few times a second
    if (ts - lastTele > 220) {
      lastTele = ts;
      const [la, lo] = ll(rv.x, rv.y);
      tPos.textContent = la.toFixed(4) + ' N ' + lo.toFixed(4) + ' E';
      tHdg.textContent = String(Math.round((rv.h * 180 / Math.PI + 450) % 360)).padStart(3, '0') + '°';
      tSpd.textContent = (1.6 + .35 * Math.sin(ts / 1700)).toFixed(1) + ' m/s';
      tWpt.textContent = (next + 1) + ' / ' + wps.length;
    }
  }

  let on = false;
  const loop = ts => { if (!on) return; frame(ts); requestAnimationFrame(loop); };
  const start = () => { if (on || RM) return; on = true; lastT = 0; requestAnimationFrame(loop); };
  Promise.race([document.fonts.load(FONT), sleep(1500)]).then(() => {
    if (!setup()) return;
    dist = total * .18;
    frame(performance.now());
    start();
    document.addEventListener('visibilitychange', () => { if (document.hidden) on = false; else start(); });
    desk.addEventListener('pointermove', e => {
      if (e.target.closest('.win, .widgets, .ico')) mouse = null;
      else { const r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; }
      if (RM) frame(performance.now());
    });
    desk.addEventListener('pointerleave', () => { mouse = null; if (RM) frame(performance.now()); });
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (setup()) frame(performance.now()); }, 200); });
  });
}

/* ═════════ apps ═════════ */

/* M.P.M.R build tabs */
function selectTab(panelId, focus) {
  $$('#platform [role="tab"]').forEach(t => {
    const on = t.getAttribute('aria-controls') === panelId;
    t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    if (on && focus) t.focus();
  });
}
(function tabs() {
  const tabs = $$('#platform [role="tab"]');
  const go = i => selectTab(tabs[(i + tabs.length) % tabs.length].getAttribute('aria-controls'), true);
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => go(i));
    t.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: tabs.length - 1 - i }[e.key];
      if (d !== undefined) { e.preventDefault(); go(i + d); }
    });
  });
})();

/* SCORP turret view: damped pan-tilt loop chasing the pointer */
(function tracker() {
  const cam = $('#camv'), tgt = $('#tgt'), ret = $('#ret'), lbl = $('#ret-lbl');
  const rPan = $('#r-pan'), rTilt = $('#r-tilt'), rErr = $('#r-err'), rMode = $('#r-mode'), rState = $('#r-state');
  let w = 0, h = 0, pos = null, vel = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
  let manual = false, lastInput = -1e9, still = 0, run = false, t = 0, state = '';
  const fmt = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1).padStart(4, '0') + '°';
  cam.addEventListener('pointermove', e => {
    const r = cam.getBoundingClientRect();
    aim = { x: e.clientX - r.left, y: e.clientY - r.top };
    manual = true; lastInput = performance.now();
    if (RM) frame(performance.now());
  });
  cam.addEventListener('pointerleave', () => { lastInput = performance.now() - 2000; });
  function setState(s) {
    if (s === state) return;
    state = s; rState.textContent = s;
    rState.classList.toggle('lock', s === 'LOCK'); ret.classList.toggle('lock', s === 'LOCK');
    lbl.textContent = s === 'LOCK' ? 'LOCK' : 'TRK';
  }
  function frame(now) {
    w = cam.clientWidth; h = cam.clientHeight;
    if (!w) return;
    if (!pos) { pos = { x: w / 2, y: h / 2 }; aim = { ...pos }; }
    if (now - lastInput > 2600) manual = false;
    if (!manual && !RM) {
      t++;
      aim = { x: w * (.5 + .34 * Math.sin(t * .0105) + .06 * Math.sin(t * .041)), y: h * (.5 + .28 * Math.sin(t * .0157 + 1.3) + .05 * Math.cos(t * .033)) };
    }
    if (RM) pos = { ...aim };
    else {
      vel.x = (vel.x + (aim.x - pos.x) * 0.045) * 0.82; vel.y = (vel.y + (aim.y - pos.y) * 0.045) * 0.82;
      pos.x += vel.x; pos.y += vel.y;
    }
    const err = Math.hypot(aim.x - pos.x, aim.y - pos.y);
    still = err < 6 ? still + 1 : 0;
    setState(still > 18 ? 'LOCK' : err > 140 ? 'SEARCH' : 'TRACK');
    tgt.style.transform = `translate3d(${aim.x}px,${aim.y}px,0)`;
    ret.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
    rPan.textContent = fmt((pos.x / w - .5) * 120);
    rTilt.textContent = fmt(-(pos.y / h - .5) * 60);
    rErr.textContent = String(Math.round(err)).padStart(3, '0') + ' px';
    rMode.textContent = manual ? 'MANUAL' : 'AUTO';
  }
  function loop(now) { if (!run) return; frame(now); requestAnimationFrame(loop); }
  inView(cam, vis => {
    if (vis && !run) { run = !RM; frame(performance.now()); if (run) requestAnimationFrame(loop); }
    else if (!vis) run = false;
  });
})();

/* feeds: play only what's visible, with a running timecode */
(function feeds() {
  const tc = s => [s / 3600, (s / 60) % 60, s % 60].map(n => String(Math.floor(n)).padStart(2, '0')).join(':');
  $$('.feed video').forEach(v => {
    const out = v.parentElement.querySelector('.feed-tc');
    v.addEventListener('timeupdate', () => { out.textContent = tc(v.currentTime); });
    if (!RM) inView(v, vis => { if (vis) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.2 });
  });
})();

/* register: preview image follows the pointer */
(function register() {
  const box = $('#hover-img');
  if (!matchMedia('(pointer:fine)').matches) return;
  const img = $('img', box);
  $$('.reg-r[data-img]').forEach(r => {
    r.addEventListener('pointerenter', () => { img.src = r.dataset.img; box.classList.add('on'); });
    r.addEventListener('pointerleave', () => box.classList.remove('on'));
    r.addEventListener('pointermove', e => {
      const bw = box.offsetWidth, bh = box.offsetHeight;
      box.style.transform = `translate3d(${Math.min(e.clientX + 24, innerWidth - bw - 12)}px,${clamp(e.clientY - bh / 2, 40, innerHeight - bh - 50)}px,0)`;
    });
  });
  // a closed or minimised window must not leave its preview behind
  new MutationObserver(() => { if ($('#work').hidden) box.classList.remove('on'); }).observe($('#work'), { attributes: true, attributeFilter: ['hidden'] });
})();

/* lightbox for images and feeds */
(function lightbox() {
  const lb = $('#lb'), body = $('#lb-body'), cap = $('#lb-cap');
  const open = (node, text) => { body.replaceChildren(node); cap.textContent = text || ''; lb.showModal(); };
  document.addEventListener('click', e => {
    const im = e.target.closest('[data-full]');
    if (im) {
      const pic = $('img', im), el = new Image();
      el.src = im.dataset.full; el.alt = pic ? pic.alt : '';
      return open(el, el.alt);
    }
    const f = e.target.closest('.feed');
    if (f) {
      const v = document.createElement('video');
      Object.assign(v, { src: f.dataset.v, controls: true, autoplay: true, playsInline: true, loop: true });
      open(v, f.dataset.t);
    }
  });
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', () => body.replaceChildren());
})();

/* terminal */
(function terminal() {
  const out = $('#term-out'), form = $('#term-form'), inp = $('#term-cmd'), body = $('#term');
  const APPS = { operator: 'Operator', platform: 'M.P.M.R', feeds: 'Feeds', work: 'Register', fikrbot: 'Fikr-Bot', bench: 'Bench', comet: 'Comet', experience: 'Record', contact: 'Comms' };
  const ALIAS = { mpmr: 'platform', rover: 'platform', scorp: 'tracking', turret: 'tracking', tracker: 'tracking', register: 'work', projects: 'work', fikr: 'fikrbot', record: 'experience', cv: 'experience', comms: 'contact', about: 'operator', me: 'operator' };
  const hist = []; let hi = 0;
  const print = (text, cls) => { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = text + '\n'; out.append(s); body.scrollTop = body.scrollHeight; };
  const CMDS = {
    help: () => print('help      this list\nwhoami    who runs this station\napps      list applications\nopen APP  open an application, e.g. open mpmr\ncontact   how to reach me\nskills    the short loadout\ndate      local time in Amman\nclear     clear the screen\nexit      close the terminal'),
    whoami: () => print('Anmar Momani — Robotics Engineer & AI Engineer\nAmman, Jordan · founder of Fikr-Bot · available for work'),
    apps: () => print(Object.entries(APPS).map(([k, v]) => k.padEnd(11) + v).join('\n')),
    ls: () => CMDS.apps(),
    open: a => {
      const id = ALIAS[a] || a;
      if (!a) return print('usage: open APP   (try: apps)', 'e');
      if (id === 'tracking') { print('opening M.P.M.R › SCORP turret…', 'c'); return openTarget('tracking'); }
      if (!APPS[id]) return print(`open: no such application: ${a}`, 'e');
      print(`opening ${APPS[id]}…`, 'c'); openWin(id);
    },
    contact: () => print('email   amomnar@gmail.com\nphone   +962 77 624 7155\ngithub  github.com/Anmartiger\nlinkedin  in/anmar-momani-0a6974152'),
    skills: () => print('robotics  ROS 2 · SLAM · Jetson Orin · Pi 5 · ESP32 · LoRa · GNSS/RTK\nvision/ai PyTorch · YOLOv8 · EfficientNetV2 · OpenCV · RAG · Arabic NLP\nbackend   FastAPI · PostgreSQL · SQLite FTS5 · Docker · Tauri\nlangs     Python · C++ · Rust · SQL · Bash'),
    date: () => print($('#clock').textContent),
    clear: () => { out.textContent = ''; },
    exit: () => closeWin(wins.get('terminal')),
    sudo: () => print('sudo: permission denied. This incident will be reported to Comet.', 'e')
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    const raw = inp.value.trim(); inp.value = '';
    print('anmar@gcs-01:~$ ' + raw, 'c');
    if (!raw) return;
    hist.push(raw); hi = hist.length;
    const [cmd, ...args] = raw.split(/\s+/);
    const fn = CMDS[cmd.toLowerCase()] || ((APPS[ALIAS[cmd.toLowerCase()] || cmd.toLowerCase()] || ALIAS[cmd.toLowerCase()] === 'tracking') && (() => CMDS.open(cmd.toLowerCase())));
    fn ? fn(args.join(' ').toLowerCase()) : print(`${cmd}: command not found. Type help.`, 'e');
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' && hi > 0) { inp.value = hist[--hi]; e.preventDefault(); }
    if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; e.preventDefault(); }
  });
  body.addEventListener('click', e => { if (!e.target.closest('a') && !getSelection().toString()) inp.focus(); });
})();
})();
