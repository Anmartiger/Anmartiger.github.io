(function(){
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* sticky header state */
  var hdr = document.getElementById('hdr');
  var onScroll = function(){ hdr.classList.toggle('stuck', window.scrollY > 8); };
  onScroll(); addEventListener('scroll', onScroll, {passive:true});

  /* mobile nav */
  var burger = document.getElementById('burger'), nav = document.getElementById('nav');
  burger.addEventListener('click', function(){
    var open = nav.classList.toggle('open');
    burger.classList.toggle('x', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.addEventListener('click', function(e){
    if (e.target.tagName === 'A'){ nav.classList.remove('open'); burger.classList.remove('x'); burger.setAttribute('aria-expanded','false'); }
  });

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

  /* seamless marquee: duplicate the list once */
  var ul = document.getElementById('marqul');
  if (ul && !rm) { document.getElementById('marq').appendChild(ul.cloneNode(true)); }

  /* section numeral parallax */
  var pars = [].slice.call(document.querySelectorAll('[data-par]'));
  if (pars.length && !rm){
    var tick = false;
    var move = function(){
      pars.forEach(function(el){
        var r = el.getBoundingClientRect();
        if (r.bottom > -200 && r.top < innerHeight + 200){
          el.style.transform = 'translateY(' + ((innerHeight/2 - r.top) * -0.06).toFixed(1) + 'px)';
        }
      });
      tick = false;
    };
    addEventListener('scroll', function(){ if(!tick){ tick = true; requestAnimationFrame(move); } }, {passive:true});
    move();
  }

  /* nav active section */
  var secs = [].slice.call(document.querySelectorAll('main section[id]'));
  var links = {};
  [].slice.call(nav.querySelectorAll('a')).forEach(function(a){ links[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window){
    var io2 = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){
          for (var k in links) links[k].classList.remove('on');
          if (links[en.target.id]) links[en.target.id].classList.add('on');
        }
      });
    }, {rootMargin:'-45% 0px -50% 0px'});
    secs.forEach(function(s){ io2.observe(s); });
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
