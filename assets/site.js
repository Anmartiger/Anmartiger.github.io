(function(){
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── boot sequence (index only) ─────────────────────── */
  var boot = document.getElementById('boot');
  if (boot){
    if (rm){ boot.classList.add('done'); }
    else {
      var log = document.getElementById('bootlog');
      var steps = [
        'init drive controller .......... <b>OK</b>',
        'mount ROS 2 nodes .............. <b>OK</b>',
        'link telemetry uplink .......... <b>OK</b>',
        'acquire operator ............... <b>LOCK</b>'
      ];
      var i = 0;
      var step = function(){
        if (log && i < steps.length){
          var d = document.createElement('div');
          d.innerHTML = steps[i]; log.appendChild(d); i++;
          setTimeout(step, 230);
        }
      };
      setTimeout(step, 180);
      setTimeout(function(){ boot.classList.add('done'); }, 1500);
    }
  }

  /* ── target-lock on the portrait ────────────────────── */
  var frame = document.getElementById('recticell');
  if (frame){
    if (rm){ frame.classList.add('locked'); }
    else { setTimeout(function(){ frame.classList.add('locked'); }, boot ? 1700 : 500); }
  }

  /* sticky header state */
  var hdr = document.getElementById('hdr');
  if (hdr){
    var onScroll = function(){ hdr.classList.toggle('stuck', window.scrollY > 8); };
    onScroll(); addEventListener('scroll', onScroll, {passive:true});
  }

  /* mobile nav */
  var burger = document.getElementById('burger'), nav = document.getElementById('nav');
  if (burger && nav){
    burger.addEventListener('click', function(){
      var open = nav.classList.toggle('open');
      burger.classList.toggle('x', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function(e){
      if (e.target.tagName === 'A'){ nav.classList.remove('open'); burger.classList.remove('x'); burger.setAttribute('aria-expanded','false'); }
    });
  }

  /* reveal on scroll */
  var els = document.querySelectorAll('.rv');
  if (rm || !('IntersectionObserver' in window)) {
    els.forEach(function(el){ el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
    }, {rootMargin:'0px 0px -8% 0px', threshold:0.08});
    els.forEach(function(el){ io.observe(el); });
  }

  /* count-up stats */
  var nums = [].slice.call(document.querySelectorAll('.num[data-count]'));
  if (nums.length){
    var runCount = function(el){
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = (el.getAttribute('data-count').indexOf('.') > -1) ? 1 : 0;
      var pad = parseInt(el.getAttribute('data-pad') || '0', 10);
      var suf = el.getAttribute('data-suffix') || '';
      if (rm){ el.textContent = target.toFixed(dec) + suf; return; }
      var t0 = null, dur = 1100;
      var fmt = function(v){ var s = v.toFixed(dec); if (pad && dec===0){ while(s.length < pad) s = '0'+s; } return s + suf; };
      var frame2 = function(ts){
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0)/dur, 1);
        var e = 1 - Math.pow(1-p, 3);
        el.textContent = fmt(target * e);
        if (p < 1) requestAnimationFrame(frame2);
      };
      requestAnimationFrame(frame2);
    };
    if ('IntersectionObserver' in window){
      var ioN = new IntersectionObserver(function(entries){
        entries.forEach(function(en){ if (en.isIntersecting){ runCount(en.target); ioN.unobserve(en.target); } });
      }, {threshold:0.6});
      nums.forEach(function(n){ ioN.observe(n); });
    } else { nums.forEach(runCount); }
  }

  /* field footage: play when visible, pause when not */
  var fvids = [].slice.call(document.querySelectorAll('video[data-field]'));
  if (fvids.length && !rm && 'IntersectionObserver' in window){
    var ioV = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        var v = en.target;
        if (en.isIntersecting){ if (!v.src && v.dataset.src) v.src = v.dataset.src; v.play().catch(function(){}); }
        else { v.pause(); }
      });
    }, {threshold:0.35});
    fvids.forEach(function(v){ ioV.observe(v); });
  }

  /* seamless marquee: duplicate the list once */
  var ul = document.getElementById('marqul');
  if (ul && !rm) { document.getElementById('marq').appendChild(ul.cloneNode(true)); }

  /* section label parallax */
  var pars = [].slice.call(document.querySelectorAll('[data-par]'));
  if (pars.length && !rm){
    var tick = false;
    var move = function(){
      pars.forEach(function(el){
        var r = el.getBoundingClientRect();
        if (r.bottom > -200 && r.top < innerHeight + 200){
          el.style.transform = 'translateY(' + ((innerHeight/2 - r.top) * -0.05).toFixed(1) + 'px)';
        }
      });
      tick = false;
    };
    addEventListener('scroll', function(){ if(!tick){ tick = true; requestAnimationFrame(move); } }, {passive:true});
    move();
  }

  /* nav active section + status bar readout */
  var secs = [].slice.call(document.querySelectorAll('main section[id]'));
  var sbSec = document.getElementById('sb-sec');
  var secName = {platform:'SEC-01 · PLATFORM', work:'SEC-02 · FIELD', repos:'SEC-03 · SOURCE', fikrbot:'SEC-04 · TEACH', experience:'SEC-05 · RECORD', contact:'SEC-06 · COMMS'};
  var links = {};
  if (nav) [].slice.call(nav.querySelectorAll('a')).forEach(function(a){ links[a.getAttribute('href').replace(/.*#/,'')] = a; });
  if (secs.length && 'IntersectionObserver' in window){
    var io2 = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){
          for (var k in links) links[k].classList.remove('on');
          if (links[en.target.id]) links[en.target.id].classList.add('on');
          if (sbSec && secName[en.target.id]) sbSec.textContent = secName[en.target.id];
        }
      });
    }, {rootMargin:'-45% 0px -50% 0px'});
    secs.forEach(function(s){ io2.observe(s); });
  }

  /* status bar clock (Amman UTC+3) */
  var clock = document.getElementById('sb-clock');
  if (clock){
    var tickClock = function(){
      var now = new Date();
      var u = now.getTime() + now.getTimezoneOffset()*60000 + 3*3600000;
      var d = new Date(u);
      var p = function(n){ return (n<10?'0':'')+n; };
      clock.textContent = p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds())+' UTC+3';
    };
    tickClock(); setInterval(tickClock, 1000);
  }
})();

/* lightbox for project galleries */
(function(){
  var figs = [].slice.call(document.querySelectorAll('.gal figure'));
  if (!figs.length) return;
  var box = document.createElement('div');
  box.className = 'lb'; box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
  box.innerHTML = '<button class="x" aria-label="Close">✕</button><button class="pv" aria-label="Previous">‹</button>'+
                  '<img alt=""><button class="nx" aria-label="Next">›</button><div class="cnt"></div>';
  document.body.appendChild(box);
  var img = box.querySelector('img'), cnt = box.querySelector('.cnt'), i = 0;
  function show(n){
    i = (n + figs.length) % figs.length;
    var f = figs[i].querySelector('img');
    img.src = f.getAttribute('data-full') || f.src;
    img.alt = f.alt;
    cnt.textContent = (i+1) + ' / ' + figs.length;
  }
  function open(n){ show(n); box.classList.add('on'); document.body.style.overflow='hidden'; }
  function close(){ box.classList.remove('on'); document.body.style.overflow=''; }
  figs.forEach(function(f,n){
    f.addEventListener('click', function(){ open(n); });
    f.setAttribute('tabindex','0');
    f.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(n); } });
  });
  box.querySelector('.x').addEventListener('click', close);
  box.querySelector('.pv').addEventListener('click', function(e){ e.stopPropagation(); show(i-1); });
  box.querySelector('.nx').addEventListener('click', function(e){ e.stopPropagation(); show(i+1); });
  box.addEventListener('click', function(e){ if (e.target === box) close(); });
  addEventListener('keydown', function(e){
    if (!box.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(i-1);
    if (e.key === 'ArrowRight') show(i+1);
  });
})();
