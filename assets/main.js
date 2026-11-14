(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const inView = (el, cb, opts) => {
  const io = new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting, e.target)), opts);
  io.observe(el); return io;
};

/* ── menu ─────────────────────────────────────────── */
const nav = $('#nav'), menu = $('#menu');
menu.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', open);
});
nav.addEventListener('click', e => {
  if (e.target.closest('a')) { nav.classList.remove('open'); menu.setAttribute('aria-expanded', false); }
});

/* ── tuner: scroll position is the frequency dial ─── */
const secs = $$('main > section[data-f]');
const needle = $('#needle'), tf = $('#tune-f'), tn = $('#tune-n');
const links = $$('a', nav);
let curSec = null;
function tune() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? scrollY / max : 0;
  needle.style.transform = `translateX(${(p * (innerWidth - 2)).toFixed(1)}px)`;
  let act = secs[0];
  for (const s of secs) if (s.getBoundingClientRect().top <= innerHeight * 0.4) act = s;
  if (act !== curSec) {
    curSec = act;
    tf.textContent = act.dataset.f;
    tn.textContent = act.dataset.n;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + act.id));
  }
}

/* ── platform: scroll scrubs the four builds ──────── */
const plat = $('#plat');
const pin = $('.plat-pin', plat);
const pImgs = $$('.plat-imgs img', plat), pItems = $$('.plat-list > li', plat);
const pBar = $('#plat-bar'), cfg = $('#cfg'), cfgName = $('#cfg-name');
const NAMES = ['STAGE 1', 'GHRS', 'CROWD CONTROL', 'SCORP'];
const narrow = matchMedia('(max-width:1100px)');
let stage = 0;
function scrub() {
  if (narrow.matches) return;
  const r = plat.getBoundingClientRect();
  const p = clamp(-r.top / (r.height - pin.offsetHeight), 0, 1);
  pBar.style.width = (p * 100).toFixed(2) + '%';
  const s = Math.min(3, Math.floor(p * 4));
  if (s === stage) return;
  stage = s;
  pImgs.forEach((im, i) => im.classList.toggle('on', i === s));
  pItems.forEach((li, i) => li.classList.toggle('on', i === s));
  cfg.textContent = '0' + (s + 1);
  cfgName.textContent = NAMES[s];
}

let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => { tune(); scrub(); ticking = false; });
}, { passive: true });
addEventListener('resize', () => { tune(); scrub(); });
tune(); scrub();

/* ── hero: SDR waterfall that paints the name into the spectrum ── */
(function waterfall() {
  const wf = $('#wf'), sp = $('#spec'), hero = $('.hero');
  if (!wf) return;
  const ctx = wf.getContext('2d', { alpha: false });
  const sctx = sp.getContext('2d');
  let cols, rows, row, level, peak, queue, items, itemIx, t = 0, chirp = null, mouseCol = -1;
  const carriers = [{ c: .17, a: .40, w: 1 }, { c: .52, a: .55, w: 2, drift: 1 }, { c: .84, a: .30, w: 1 }];

  // Render text off-screen and return its rows as intensity masks, bottom row first,
  // so the waterfall (which pushes rows in at the top) shows it upright.
  function mask(text, family, weight) {
    const c = document.createElement('canvas');
    const h = Math.round(Math.min(rows * 0.62, cols * 0.2));
    c.width = cols; c.height = h;
    const x = c.getContext('2d');
    let fs = Math.round(h * 0.8);
    const font = () => `${weight} ${fs}px ${family}`;
    x.font = font();
    while (x.measureText(text).width > cols * 0.86 && fs > 8) { fs--; x.font = font(); }
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, cols / 2, h / 2);
    const d = x.getImageData(0, 0, cols, h).data;
    const out = [];
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
    if (!queue.length) { itemIx = (itemIx + 1) % items.length; queue.push(...gap(rows * 0.32), ...items[itemIx]); }
    t++;
    if (!chirp && Math.random() < 0.006) {
      chirp = { c0: cols * (.25 + Math.random() * .5), i: 0, len: 18 + Math.random() * 26, s: (Math.random() < .5 ? -1 : 1) * (.8 + Math.random() * 1.2) };
    }
    const d = row.data;
    for (let c = 0; c < cols; c++) {
      const r = Math.random();
      let b = (0.07 + r * r * r * 0.45 + (r > 0.993 ? 0.5 : 0)) * (0.5 + 0.5 * Math.sin(Math.PI * c / cols));
      let h = m ? m[c] * (0.72 + 0.28 * Math.random()) : 0;
      for (const k of carriers) {
        const cc = k.c * cols + (k.drift ? Math.sin(t * 0.018) * cols * 0.025 : 0);
        if (Math.abs(c - cc) < k.w) h = Math.max(h, k.a * (0.7 + 0.3 * Math.random()));
      }
      if (chirp && Math.abs(c - (chirp.c0 + chirp.i * chirp.s)) < 1) h = Math.max(h, 0.7);
      if (mouseCol >= 0) { const dm = Math.abs(c - mouseCol); if (dm <= 1) h = Math.max(h, 0.98 - dm * 0.3); }
      const w = Math.max(0, h - 0.82) * 4;
      const i = c * 4;
      d[i]     = 255 * Math.min(1, b * 0.17 + h);
      d[i + 1] = 255 * Math.min(1, b * 0.42 + h * 0.69 + w * 0.3);
      d[i + 2] = 255 * Math.min(1, b * 1.0 + w * 0.75);
      d[i + 3] = 255;
      level[c] = b * 0.55 + h;
    }
    if (chirp && ++chirp.i > chirp.len) chirp = null;
    ctx.drawImage(wf, 0, 0, cols, rows - 1, 0, 1, cols, rows - 1);
    ctx.putImageData(row, 0, 0);
  }

  function drawSpec() {
    const W = sp.width, H = sp.height;
    sctx.clearRect(0, 0, W, H);
    sctx.strokeStyle = 'rgba(143,180,255,.08)'; sctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) { const y = Math.round(H * g / 4) + .5; sctx.beginPath(); sctx.moveTo(0, y); sctx.lineTo(W, y); sctx.stroke(); }
    const y = c => H - 2 - Math.min(1, v(c)) * (H - 8);
    const v = c => (level[Math.max(0, c - 1)] + level[c] * 2 + level[Math.min(cols - 1, c + 1)]) / 4;
    for (let c = 0; c < cols; c++) peak[c] = Math.max(v(c), peak[c] * 0.985);
    const sx = W / (cols - 1);
    sctx.beginPath(); sctx.moveTo(0, H);
    for (let c = 0; c < cols; c++) sctx.lineTo(c * sx, y(c));
    sctx.lineTo(W, H); sctx.closePath();
    const gr = sctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,176,0,.28)'); gr.addColorStop(1, 'rgba(47,107,255,.06)');
    sctx.fillStyle = gr; sctx.fill();
    sctx.beginPath();
    for (let c = 0; c < cols; c++) { const yy = H - 2 - Math.min(1, peak[c]) * (H - 8); c ? sctx.lineTo(c * sx, yy) : sctx.moveTo(0, yy); }
    sctx.strokeStyle = 'rgba(143,180,255,.35)'; sctx.lineWidth = 1; sctx.stroke();
    sctx.beginPath();
    for (let c = 0; c < cols; c++) c ? sctx.lineTo(c * sx, y(c)) : sctx.moveTo(0, y(c));
    sctx.strokeStyle = '#FFB000'; sctx.lineWidth = Math.max(1, devicePixelRatio || 1) * 1.2; sctx.stroke();
  }

  function build() {
    const r = wf.getBoundingClientRect();
    cols = r.width < 700 ? 180 : 320;
    rows = Math.max(40, Math.round(cols * r.height / r.width));
    wf.width = cols; wf.height = rows;
    row = ctx.createImageData(cols, 1);
    level = new Float32Array(cols); peak = new Float32Array(cols);
    const dpr = Math.min(2, devicePixelRatio || 1), sr = sp.getBoundingClientRect();
    sp.width = Math.round(sr.width * dpr); sp.height = Math.round(sr.height * dpr);
    items = [
      mask('ANMAR MOMANI', '"Big Shoulders Stencil Display", Impact, sans-serif', 900),
      mask('أنمار المومني', '"IBM Plex Sans Arabic", sans-serif', 700)
    ];
    itemIx = 0;
    // Pre-fill the screen so the English name is already sitting near the top on load.
    const top = Math.round(rows * 0.1);
    queue = [...gap(rows - items[0].length - top), ...items[0], ...gap(top)];
    for (let i = 0; i < rows; i++) emit();
    drawSpec();
  }

  let on = true, last = 0, acc = 0;
  const RATE = 34; // rows per second
  function loop(ts) {
    if (!on) return;
    const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts;
    acc += dt * RATE;
    let n = 0;
    while (acc >= 1 && n < 3) { emit(); acc--; n++; }
    if (n) drawSpec();
    requestAnimationFrame(loop);
  }
  const start = () => { if (on || RM) return; on = true; last = 0; requestAnimationFrame(loop); };

  const fontsReady = Promise.race([
    Promise.all([
      document.fonts.load('900 60px "Big Shoulders Stencil Display"'),
      document.fonts.load('700 60px "IBM Plex Sans Arabic"', 'أنمار')
    ]),
    new Promise(r => setTimeout(r, 1800))
  ]);
  fontsReady.then(() => {
    build();
    if (RM) { on = false; return; }
    requestAnimationFrame(loop);
    inView(hero, vis => { if (vis) start(); else on = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) on = false; else if (hero.getBoundingClientRect().bottom > 0) start(); });
    hero.addEventListener('pointermove', e => {
      const r = wf.getBoundingClientRect();
      mouseCol = e.clientY >= r.top ? Math.floor((e.clientX - r.left) / r.width * cols) : -1;
    });
    hero.addEventListener('pointerleave', () => { mouseCol = -1; });
  });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (cols) build(); }, 200); });
})();

/* ── operator portrait: thermal (IR) and visible (EO) ── */
(function thermal() {
  const fig = $('#ir'), cv = $('#ir-c'), src = $('#ir-src');
  if (!cv) return;
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
    // Heat estimate: skin reads hot, everything else by brightness, computed small then upscaled for a soft sensor look.
    const sw = 128, sh = 160, sm = document.createElement('canvas');
    sm.width = sw; sm.height = sh;
    const sx = sm.getContext('2d');
    cover(sx, src, sw, sh);
    const im = sx.getImageData(0, 0, sw, sh), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const skin = r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15 && r - g > 12;
      let heat = skin ? 0.66 + 0.34 * lum : lum * 0.3;
      heat = clamp(heat + (Math.random() - 0.5) * 0.03, 0, 1);
      const [R, G, B] = cmap(heat);
      d[i] = R; d[i + 1] = G; d[i + 2] = B;
    }
    sx.putImageData(im, 0, 0);
    const ix = ir.getContext('2d');
    ix.imageSmoothingQuality = 'high';
    ix.drawImage(sm, 0, 0, W, H);
    ctx.drawImage(ir, 0, 0);
  }

  function swap(to) {
    if (to === mode) return;
    const from = mode === 'ir' ? ir : eo, next = to === 'ir' ? ir : eo;
    mode = to;
    fig.classList.toggle('eo', to === 'eo');
    $('#ir-mode').textContent = to === 'ir' ? 'LWIR · IRONBOW' : 'EO · VISIBLE';
    $$('.ir-tog button', fig).forEach(b => b.setAttribute('aria-pressed', b.dataset.m === to));
    if (RM) { ctx.drawImage(next, 0, 0); return; }
    const t0 = performance.now(), dur = 650;
    (function step(ts) {
      const p = clamp((ts - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3), y = Math.round(H * e);
      ctx.drawImage(from, 0, 0);
      if (y > 0) ctx.drawImage(next, 0, 0, W, y, 0, 0, W, y);
      if (p < 1) {
        ctx.fillStyle = '#FFB000'; ctx.fillRect(0, y - 1, W, 2);
        requestAnimationFrame(step);
      }
    })(t0);
  }
  $$('.ir-tog button', fig).forEach(b => b.addEventListener('click', () => swap(b.dataset.m)));
  if (src.complete && src.naturalWidth) prepare(); else src.addEventListener('load', prepare, { once: true });
})();

/* ── tracking: damped pan-tilt loop chasing the pointer ── */
(function tracker() {
  const cam = $('#cam');
  if (!cam) return;
  const tgt = $('#tgt'), ret = $('#ret'), lbl = $('#ret-lbl');
  const rPan = $('#r-pan'), rTilt = $('#r-tilt'), rErr = $('#r-err'), rMode = $('#r-mode'), rState = $('#r-state');
  let w = 0, h = 0, pos = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
  let manual = false, lastInput = -1e9, still = 0, run = false, t = 0, state = '';
  const measure = () => { w = cam.clientWidth; h = cam.clientHeight; };
  measure(); pos = { x: w * .5, y: h * .5 }; aim = { ...pos };
  addEventListener('resize', measure);
  const fmt = (v, n) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1).padStart(n, '0') + '°';

  cam.addEventListener('pointermove', e => {
    const r = cam.getBoundingClientRect();
    aim = { x: e.clientX - r.left, y: e.clientY - r.top };
    manual = true; lastInput = performance.now();
    if (RM) frame(performance.now());
  });
  cam.addEventListener('pointerleave', () => { lastInput = performance.now() - 2000; });

  function setState(s) { if (s === state) return; state = s; rState.textContent = s; rState.classList.toggle('lock', s === 'LOCK'); ret.classList.toggle('lock', s === 'LOCK'); lbl.textContent = s === 'LOCK' ? 'LOCK' : 'TRK'; }

  function frame(now) {
    if (now - lastInput > 2600) manual = false;
    if (!manual && !RM) {
      t += 1;
      aim = {
        x: w * (.5 + .34 * Math.sin(t * .0105) + .06 * Math.sin(t * .041)),
        y: h * (.5 + .28 * Math.sin(t * .0157 + 1.3) + .05 * Math.cos(t * .033))
      };
    }
    if (RM) { pos = { ...aim }; }
    else {
      vel.x = (vel.x + (aim.x - pos.x) * 0.045) * 0.82;
      vel.y = (vel.y + (aim.y - pos.y) * 0.045) * 0.82;
      pos.x += vel.x; pos.y += vel.y;
    }
    const err = Math.hypot(aim.x - pos.x, aim.y - pos.y);
    still = err < 6 ? still + 1 : 0;
    setState(still > 18 ? 'LOCK' : err > 140 ? 'SEARCH' : 'TRACK');
    tgt.style.transform = `translate3d(${aim.x}px,${aim.y}px,0)`;
    ret.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
    rPan.textContent = fmt((pos.x / w - .5) * 120, 4);
    rTilt.textContent = fmt(-(pos.y / h - .5) * 60, 4);
    rErr.textContent = String(Math.round(err)).padStart(3, '0') + ' px';
    rMode.textContent = manual ? 'MANUAL' : 'AUTO';
  }
  function loop(now) { if (!run) return; frame(now); requestAnimationFrame(loop); }
  frame(performance.now());
  if (!RM) inView(cam, vis => { if (vis && !run) { run = true; requestAnimationFrame(loop); } else if (!vis) run = false; });
})();

/* ── feeds: play only what's on screen, show running timecode ── */
(function feeds() {
  const vids = $$('.feed video');
  const tc = s => [s / 3600, (s / 60) % 60, s % 60].map(n => String(Math.floor(n)).padStart(2, '0')).join(':');
  vids.forEach(v => {
    const out = v.parentElement.querySelector('.feed-tc');
    v.addEventListener('timeupdate', () => { out.textContent = tc(v.currentTime); });
    if (!RM) inView(v, vis => { if (vis) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.25 });
  });
})();

/* ── register: preview image follows the pointer ──── */
(function register() {
  const box = $('#hover-img');
  if (!box || !matchMedia('(pointer:fine)').matches) return;
  const img = $('img', box);
  let bw = 280, bh = 210;
  $$('.reg-r[data-img]').forEach(r => {
    r.addEventListener('pointerenter', () => { img.src = r.dataset.img; img.alt = ''; box.classList.add('on'); bw = box.offsetWidth; bh = box.offsetHeight; });
    r.addEventListener('pointerleave', () => box.classList.remove('on'));
    r.addEventListener('pointermove', e => {
      const x = Math.min(e.clientX + 28, innerWidth - bw - 12);
      const y = clamp(e.clientY - bh / 2, 72, innerHeight - bh - 12);
      box.style.transform = `translate3d(${x}px,${y}px,0)`;
    });
  });
})();

/* ── fikr-bot poster strip ────────────────────────── */
(function posters() {
  const strip = $('#posters');
  if (!strip) return;
  $$('.posters-nav button').forEach(b => b.addEventListener('click', () => {
    strip.scrollBy({ left: Number(b.dataset.dir) * strip.clientWidth * 0.8, behavior: RM ? 'auto' : 'smooth' });
  }));
})();

/* ── lightbox for images and feeds ────────────────── */
(function lightbox() {
  const lb = $('#lb'), body = $('#lb-body'), cap = $('#lb-cap');
  function open(node, text) {
    body.replaceChildren(node);
    cap.textContent = text || '';
    lb.showModal();
  }
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
      return open(v, f.dataset.t);
    }
  });
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', () => body.replaceChildren());
})();
})();
