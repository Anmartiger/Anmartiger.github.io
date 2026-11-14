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
  const left = dw > 1100 ? 116 : 12;                       // clear the icon column
  const room = dw - (dw > 1100 ? 320 : 0) - left;          // and the widgets
  const x = clamp(left + (room - W) / 2 + (cascade - 2) * 28, 8, dw - W - 8);
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
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return false;
  const el = document.getElementById(id);
  const w = el && el.closest('.win');
  if (!w) return false;
  openWin(w.id, null, el);
  return true;
}
addEventListener('hashchange', openFromHash);
$$('.ico').forEach((b, i) => b.style.setProperty('--i', i));

/* ═════════ desktop services ═════════ */
let desktopStarted = false;
function startDesktop() {
  if (desktopStarted) return;
  desktopStarted = true;
  waterfall();
}

/* ═════════ intro: cyberdeck power-on ═════════ */
(function deck() {
  const kbd = $('#kbd');
  for (let i = 0; i < 61; i++) {
    const k = document.createElement('i');
    if ([0, 13, 27, 41, 55, 60].includes(i)) k.className = 'k-a';
    if (i === 57) k.className = 'k-s';
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

/* wallpaper: SDR waterfall that paints the name into the spectrum */
function waterfall() {
  const wf = $('#wf'), sp = $('#spec');
  const ctx = wf.getContext('2d', { alpha: false }), sctx = sp.getContext('2d');
  let cols, rows, row, level, peak, queue, items, itemIx, t = 0, chirp = null, mouseCol = -1;
  const carriers = [{ c: .17, a: .40, w: 1 }, { c: .52, a: .55, w: 2, drift: 1 }, { c: .84, a: .30, w: 1 }];

  // Text rows as intensity masks, bottom row first so it scrolls in upright.
  function mask(text, family, weight) {
    const c = document.createElement('canvas');
    const h = Math.round(Math.min(rows * 0.5, cols * 0.18));
    c.width = cols; c.height = h;
    const x = c.getContext('2d');
    let fs = Math.round(h * 0.8);
    const font = () => `${weight} ${fs}px ${family}`;
    x.font = font();
    while (x.measureText(text).width > cols * 0.8 && fs > 8) { fs--; x.font = font(); }
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, cols / 2, h / 2);
    const d = x.getImageData(0, 0, cols, h).data, out = [];
    for (let y = 0; y < h; y++) {
      const m = new Float32Array(cols); let any = false;
      for (let i = 0; i < cols; i++) { const a = d[(y * cols + i) * 4 + 3] / 255; m[i] = a; if (a > .05) any = true; }
      if (any) out.push(m);
    }
    return out.reverse();
  }
  const gap = n => Array(Math.max(0, Math.round(n))).fill(null);

  function emit() {
    const m = queue.length ? queue.shift() : null;
    if (!queue.length) { itemIx = (itemIx + 1) % items.length; queue.push(...gap(rows * 0.45), ...items[itemIx]); }
    t++;
    if (!chirp && Math.random() < 0.006) chirp = { c0: cols * (.25 + Math.random() * .5), i: 0, len: 18 + Math.random() * 26, s: (Math.random() < .5 ? -1 : 1) * (.8 + Math.random() * 1.2) };
    const d = row.data;
    for (let c = 0; c < cols; c++) {
      const r = Math.random();
      const b = (0.07 + r * r * r * 0.45 + (r > 0.993 ? 0.5 : 0)) * (0.5 + 0.5 * Math.sin(Math.PI * c / cols));
      let h = m ? m[c] * (0.72 + 0.28 * Math.random()) : 0;
      for (const k of carriers) {
        const cc = k.c * cols + (k.drift ? Math.sin(t * 0.018) * cols * 0.025 : 0);
        if (Math.abs(c - cc) < k.w) h = Math.max(h, k.a * (0.7 + 0.3 * Math.random()));
      }
      if (chirp && Math.abs(c - (chirp.c0 + chirp.i * chirp.s)) < 1) h = Math.max(h, 0.7);
      if (mouseCol >= 0) { const dm = Math.abs(c - mouseCol); if (dm <= 1) h = Math.max(h, 0.98 - dm * 0.3); }
      const w = Math.max(0, h - 0.82) * 4, i = c * 4;
      d[i] = 255 * Math.min(1, b * 0.17 + h);
      d[i + 1] = 255 * Math.min(1, b * 0.42 + h * 0.69 + w * 0.3);
      d[i + 2] = 255 * Math.min(1, b + w * 0.75);
      d[i + 3] = 255;
      level[c] = b * 0.55 + h;
    }
    if (chirp && ++chirp.i > chirp.len) chirp = null;
    ctx.drawImage(wf, 0, 0, cols, rows - 1, 0, 1, cols, rows - 1);
    ctx.putImageData(row, 0, 0);
  }

  function drawSpec() {
    const W = sp.width, H = sp.height;
    if (!W || !H) return;
    sctx.clearRect(0, 0, W, H);
    const v = c => (level[Math.max(0, c - 1)] + level[c] * 2 + level[Math.min(cols - 1, c + 1)]) / 4;
    const y = c => H - 2 - Math.min(1, v(c)) * (H - 6);
    for (let c = 0; c < cols; c++) peak[c] = Math.max(v(c), peak[c] * 0.985);
    const sx = W / (cols - 1);
    sctx.beginPath(); sctx.moveTo(0, H);
    for (let c = 0; c < cols; c++) sctx.lineTo(c * sx, y(c));
    sctx.lineTo(W, H); sctx.closePath();
    const gr = sctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,176,0,.3)'); gr.addColorStop(1, 'rgba(47,107,255,.05)');
    sctx.fillStyle = gr; sctx.fill();
    sctx.beginPath();
    for (let c = 0; c < cols; c++) { const yy = H - 2 - Math.min(1, peak[c]) * (H - 6); c ? sctx.lineTo(c * sx, yy) : sctx.moveTo(0, yy); }
    sctx.strokeStyle = 'rgba(143,180,255,.35)'; sctx.lineWidth = 1; sctx.stroke();
    sctx.beginPath();
    for (let c = 0; c < cols; c++) c ? sctx.lineTo(c * sx, y(c)) : sctx.moveTo(0, y(c));
    sctx.strokeStyle = '#FFB000'; sctx.lineWidth = 1.5; sctx.stroke();
  }

  function build() {
    const r = wf.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    cols = clamp(Math.round(r.width / 4.2), 90, 360);
    rows = Math.max(40, Math.round(cols * r.height / r.width));
    wf.width = cols; wf.height = rows;
    row = ctx.createImageData(cols, 1);
    level = new Float32Array(cols); peak = new Float32Array(cols);
    const dpr = Math.min(2, devicePixelRatio || 1), sr = sp.getBoundingClientRect();
    sp.width = Math.round(sr.width * dpr); sp.height = Math.round(sr.height * dpr);
    items = [
      mask('ANMAR MOMANI', '"Big Shoulders Stencil Display", Impact, sans-serif', 900),
      mask('أنمار المومني', '"IBM Plex Sans Arabic", sans-serif', 700),
      mask('ROBOTICS / AI', '"Big Shoulders Stencil Display", Impact, sans-serif', 900)
    ];
    itemIx = 0;
    const top = Math.round(rows * 0.18);
    queue = [...gap(rows - items[0].length - top), ...items[0], ...gap(top)];
    for (let i = 0; i < rows; i++) emit();
    drawSpec();
    return true;
  }

  let on = false, last = 0, acc = 0;
  function loop(ts) {
    if (!on) return;
    const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts;
    acc += dt * 30;
    let n = 0;
    while (acc >= 1 && n < 3) { emit(); acc--; n++; }
    if (n) drawSpec();
    requestAnimationFrame(loop);
  }
  const start = () => { if (on || RM) return; on = true; last = 0; requestAnimationFrame(loop); };

  Promise.race([
    Promise.all([document.fonts.load('900 60px "Big Shoulders Stencil Display"'), document.fonts.load('700 60px "IBM Plex Sans Arabic"', 'أنمار')]),
    sleep(1800)
  ]).then(() => {
    if (!build()) return;
    start();
    document.addEventListener('visibilitychange', () => { if (document.hidden) on = false; else start(); });
    desk.addEventListener('pointermove', e => {
      if (e.target.closest('.win, .widgets, .ico')) { mouseCol = -1; return; }
      const r = wf.getBoundingClientRect();
      mouseCol = Math.floor((e.clientX - r.left) / r.width * cols);
    });
    desk.addEventListener('pointerleave', () => { mouseCol = -1; });
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
  });
}

/* ═════════ apps ═════════ */

/* operator: thermal (IR) and visible (EO) portrait */
(function thermal() {
  const fig = $('#ir'), cv = $('#ir-c'), src = $('#ir-src');
  const W = cv.width, H = cv.height, ctx = cv.getContext('2d');
  const STOPS = [[0, 4, 6, 12], [.22, 13, 42, 122], [.40, 47, 107, 255], [.55, 74, 35, 80], [.70, 255, 90, 31], [.85, 255, 176, 0], [1, 255, 241, 207]];
  const cmap = v => {
    for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) {
      const a = STOPS[i - 1], b = STOPS[i], f = (v - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
    }
    return STOPS[STOPS.length - 1].slice(1);
  };
  const layer = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const eo = layer(), ir = layer();
  let mode = 'ir';
  function cover(x, img, w, h) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    x.drawImage(img, (w - dw) / 2, (h - dh) * 0.15, dw, dh);
  }
  function prepare() {
    cover(eo.getContext('2d'), src, W, H);
    // Heat estimate: skin reads hot, everything else by brightness; computed small, upscaled soft.
    const sw = 128, sh = 160, sm = document.createElement('canvas');
    sm.width = sw; sm.height = sh;
    const sx = sm.getContext('2d');
    cover(sx, src, sw, sh);
    const im = sx.getImageData(0, 0, sw, sh), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const skin = r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15 && r - g > 12;
      const [R, G, B] = cmap(clamp((skin ? 0.66 + 0.34 * lum : lum * 0.3) + (Math.random() - 0.5) * 0.03, 0, 1));
      d[i] = R; d[i + 1] = G; d[i + 2] = B;
    }
    sx.putImageData(im, 0, 0);
    const ix = ir.getContext('2d');
    ix.imageSmoothingQuality = 'high';
    ix.drawImage(sm, 0, 0, W, H);
    ctx.drawImage(mode === 'ir' ? ir : eo, 0, 0);
  }
  function swap(to) {
    if (to === mode) return;
    const from = mode === 'ir' ? ir : eo, next = to === 'ir' ? ir : eo;
    mode = to;
    fig.classList.toggle('eo', to === 'eo');
    $('#ir-mode').textContent = to === 'ir' ? 'LWIR · IRONBOW' : 'EO · VISIBLE';
    $$('.ir-tog button', fig).forEach(b => b.setAttribute('aria-pressed', b.dataset.m === to));
    if (RM) { ctx.drawImage(next, 0, 0); return; }
    const t0 = performance.now();
    (function step(ts) {
      const p = clamp((ts - t0) / 650, 0, 1), y = Math.round(H * (1 - Math.pow(1 - p, 3)));
      ctx.drawImage(from, 0, 0);
      if (y > 0) ctx.drawImage(next, 0, 0, W, y, 0, 0, W, y);
      if (p < 1) { ctx.fillStyle = '#FFB000'; ctx.fillRect(0, y - 1, W, 2); requestAnimationFrame(step); }
    })(t0);
  }
  $$('.ir-tog button', fig).forEach(b => b.addEventListener('click', () => swap(b.dataset.m)));
  if (src.complete && src.naturalWidth) prepare(); else src.addEventListener('load', prepare, { once: true });
})();

/* M.P.M.R build tabs */
(function tabs() {
  const tabs = $$('#platform [role="tab"]');
  const select = i => tabs.forEach((t, j) => {
    const on = i === j;
    t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    if (on) t.focus();
  });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: tabs.length - 1 - i }[e.key];
      if (d !== undefined) { e.preventDefault(); select((i + d + tabs.length) % tabs.length); }
    });
  });
})();

/* tracker: damped pan-tilt loop chasing the pointer */
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
  const APPS = { operator: 'Operator', platform: 'M.P.M.R', tracking: 'Tracker', feeds: 'Feeds', work: 'Register', fikrbot: 'Fikr-Bot', bench: 'Bench', comet: 'Comet', experience: 'Record', contact: 'Comms' };
  const ALIAS = { mpmr: 'platform', rover: 'platform', tracker: 'tracking', register: 'work', projects: 'work', fikr: 'fikrbot', record: 'experience', cv: 'experience', comms: 'contact', about: 'operator', me: 'operator' };
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
    const fn = CMDS[cmd.toLowerCase()] || (APPS[ALIAS[cmd.toLowerCase()] || cmd.toLowerCase()] && (() => CMDS.open(cmd.toLowerCase())));
    fn ? fn(args.join(' ').toLowerCase()) : print(`${cmd}: command not found. Type help.`, 'e');
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' && hi > 0) { inp.value = hist[--hi]; e.preventDefault(); }
    if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; e.preventDefault(); }
  });
  body.addEventListener('click', e => { if (!e.target.closest('a') && !getSelection().toString()) inp.focus(); });
})();
})();
