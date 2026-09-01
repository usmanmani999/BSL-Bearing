const EXPO = 'cubic-bezier(.16,1,.3,1)';
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.matchMedia('(max-width: 820px)').matches;

/* ---------- reveals ---------- */
function rest(el) {
  const kind = el.getAttribute('data-reveal');
  if (kind === 'bar' || kind === 'line') return 'scaleX(1)';
  if (kind === 'wipe') { el.style.clipPath = 'inset(0 0 0 0)'; return 'none'; }
  return 'none';
}
function show(el, delay) {
  el.style.transitionDelay = delay + 'ms';
  el.style.opacity = '1';
  el.style.transform = rest(el);
  el.dataset.revealed = '1';
}

function splitWords(el) {
  if (el.dataset.split === 'done') return;
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.textContent = w;
    s.style.cssText = 'display:inline-block;opacity:0;transform:translateY(.5em);transition:opacity .7s ' + EXPO + ' ' + (i * 60) + 'ms,transform .7s ' + EXPO + ' ' + (i * 60) + 'ms;white-space:pre';
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
  el.dataset.split = 'done';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.querySelectorAll('span').forEach(s => { s.style.opacity = '1'; s.style.transform = 'none'; });
  }));
}

/* Counters render their real value in the markup, so if this script never runs
   the page still shows the right number instead of a frozen 0. We only reset
   them to 0 once we know we are about to animate. */
function armCounters(counters) {
  counters.forEach(el => {
    if (isNaN(parseFloat(el.getAttribute('data-count')))) return;
    el.dataset.armed = '1';
    el.textContent = '0';
  });
}

function countUp(el) {
  const raw = el.getAttribute('data-count');
  const target = parseFloat(raw);
  const suffix = el.getAttribute('data-suffix') || '';
  if (isNaN(target) || el.dataset.counted === '1') return;
  el.dataset.counted = '1';
  if (reduced() || el.dataset.armed !== '1') { el.textContent = raw + suffix; return; }
  const dur = 1400, t0 = performance.now();
  const step = t => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + (p === 1 ? suffix : '');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function drawSvg(svg) {
  svg.querySelectorAll('path,line,circle,polyline').forEach((p, i) => {
    let len = 0;
    try { len = p.getTotalLength ? p.getTotalLength() : 0; } catch (e) { len = 0; }
    if (!len) { p.style.opacity = '1'; return; }
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
    p.style.opacity = '1';
    p.style.transition = 'stroke-dashoffset 1.1s ' + EXPO + ' ' + (i * 90) + 'ms';
    requestAnimationFrame(() => requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; }));
  });
}

/* ---------- chrome ---------- */
let __chrome = false;
function progressBar() {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;width:100%;transform:scaleX(0);transform-origin:left center;background:#C30001;z-index:120;will-change:transform';
  document.body.appendChild(bar);
  const upd = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
  };
  addEventListener('scroll', upd, { passive: true });
  addEventListener('resize', upd);
  upd();
}

function stickyNav() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const inner = nav.querySelector('[data-nav-inner]');
  const upd = () => {
    const on = window.scrollY > 80;
    nav.style.boxShadow = on ? '0 10px 30px rgba(18,48,79,.12)' : 'none';
    if (inner) inner.style.paddingTop = inner.style.paddingBottom = on ? '10px' : '20px';
  };
  addEventListener('scroll', upd, { passive: true });
  upd();
}

/* Page entry.

   This used to intercept every internal link, slide a full-screen navy panel
   across, and hold navigation back by 520ms before actually following the
   href. That is what read as "weird": the click felt unresponsive, the wipe
   ran again on arrival, and any click during the delay was swallowed.

   Navigation is no longer blocked at all. Links behave natively; the incoming
   page just settles in with a short fade, which reads as fast rather than
   staged. */
function pageTransition() {
  if (reduced()) return;
  const main = document.querySelector('main');
  if (!main) return;
  main.style.opacity = '0';
  main.style.transition = 'opacity .28s ease-out';
  requestAnimationFrame(() => requestAnimationFrame(() => { main.style.opacity = '1'; }));
  // never leave content stuck invisible if the transition event is missed
  setTimeout(() => { main.style.opacity = '1'; }, 600);
}

/* ---------- pointer-driven card tilt ---------- */
function tiltCards() {
  if (reduced() || isMobile()) return;
  document.querySelectorAll('[data-tilt]').forEach(card => {
    const spec = card.querySelector('[data-specular]');
    card.style.transformStyle = 'preserve-3d';
    card.addEventListener('pointermove', e => {
      if (card.dataset.revealed !== '1') return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.transition = 'transform .12s linear,border-color .35s ease';
      card.style.transform = 'perspective(900px) rotateY(' + ((px - .5) * 16).toFixed(2) + 'deg) rotateX(' + ((.5 - py) * 16).toFixed(2) + 'deg) translateZ(6px)';
      if (spec) {
        spec.style.opacity = '1';
        spec.style.background = 'radial-gradient(320px circle at ' + (px * 100) + '% ' + (py * 100) + '%, rgba(255,255,255,.55), rgba(255,255,255,0) 60%)';
      }
    });
    card.addEventListener('pointerleave', () => {
      card.style.transition = 'transform .6s ' + EXPO + ',border-color .35s ease';
      card.style.transform = 'none';
      if (spec) spec.style.opacity = '0';
    });
  });
}

/* ---------- timeline connector ---------- */
function timelines() {
  document.querySelectorAll('[data-timeline]').forEach(tl => {
    const line = tl.querySelector('[data-timeline-line]');
    if (!line) return;
    if (reduced()) { line.style.transform = 'scaleY(1)'; return; }
    const upd = () => {
      const r = tl.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (window.innerHeight * .75 - r.top) / r.height));
      line.style.transform = 'scaleY(' + p + ')';
    };
    addEventListener('scroll', upd, { passive: true });
    upd();
  });
}

/* ---------- horizontal scroll track ---------- */
function hscroll() {
  document.querySelectorAll('[data-hscroll]').forEach(sec => {
    const track = sec.querySelector('[data-hscroll-track]');
    if (!track) return;
    if (reduced()) return;
    const upd = () => {
      const dist = Math.max(0, track.scrollWidth - window.innerWidth + 64);
      const span = sec.offsetHeight - window.innerHeight;
      const p = span > 0 ? Math.max(0, Math.min(1, -sec.getBoundingClientRect().top / span)) : 0;
      track.style.transform = 'translate3d(' + (-p * dist) + 'px,0,0)';
    };
    addEventListener('scroll', upd, { passive: true });
    addEventListener('resize', upd);
    upd();
  });
}

/* ---------- parallax ---------- */
function parallax() {
  const els = Array.from(document.querySelectorAll('[data-parallax]'));
  if (!els.length || reduced()) return;
  const upd = () => els.forEach(el => {
    const r = el.getBoundingClientRect();
    const k = parseFloat(el.getAttribute('data-parallax')) || .2;
    el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - window.innerHeight / 2) * -k).toFixed(1) + 'px,0)';
  });
  addEventListener('scroll', upd, { passive: true });
  upd();
}

/* ---------- init ---------- */
export function initMotion() {
  const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
  const counters = Array.from(document.querySelectorAll('[data-count]'));
  const heads = Array.from(document.querySelectorAll('[data-split]'));

  if (!__chrome) { __chrome = true; progressBar(); stickyNav(); pageTransition(); }

  if (reduced()) {
    nodes.forEach(n => show(n, 0));
    counters.forEach(countUp);
    document.querySelectorAll('[data-draw]').forEach(s => s.querySelectorAll('path,line,circle,polyline').forEach(p => { p.style.opacity = '1'; }));
    timelines();
    return;
  }

  armCounters(counters);
  heads.forEach(h => splitWords(h));

  // stagger indices
  const gi = new Map();
  nodes.forEach(n => {
    const g = n.closest('[data-stagger]');
    if (!g) return;
    const i = gi.get(g) || 0; gi.set(g, i + 1);
    n.dataset.stagIndex = String(i);
  });
  // center-out ordering
  document.querySelectorAll('[data-stagger="center"]').forEach(g => {
    const kids = Array.from(g.querySelectorAll('[data-reveal]'));
    const mid = (kids.length - 1) / 2;
    kids.forEach((k, i) => { k.dataset.stagIndex = String(Math.round(Math.abs(i - mid))); });
  });

  const trigger = el => {
      if (el.dataset.revealed === '1') return;
      const step = el.hasAttribute('data-stagger-step') ? parseInt(el.getAttribute('data-stagger-step'), 10) : 90;
      show(el, (parseInt(el.dataset.stagIndex || '0', 10)) * step);
      el.querySelectorAll('[data-count]').forEach(countUp);
      if (el.hasAttribute('data-count')) countUp(el);
      el.querySelectorAll('[data-draw]').forEach(drawSvg);
      if (el.hasAttribute('data-draw')) drawSvg(el);
      const h = el.querySelector('[data-bar-heading]');
      if (h) setTimeout(() => { h.style.opacity = '1'; h.style.transform = 'none'; }, 420);
  };

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      trigger(en.target);
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
  nodes.forEach(n => io.observe(n));

  const io2 = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { countUp(en.target); io2.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
  // every counter gets its own observer, so a counter never depends on the
  // reveal of an ancestor firing first. countUp is idempotent.
  counters.forEach(c => io2.observe(c));

  tiltCards();
  timelines();
  hscroll();
  parallax();

  // safety net: only for elements already inside the viewport that somehow
  // never received an intersection callback — never for off-screen content.
  setTimeout(() => {
    nodes.forEach(n => {
      if (n.dataset.revealed === '1') return;
      const r = n.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) { trigger(n); io.unobserve(n); }
    });
    // never leave an armed counter sitting at 0 because a callback was missed
    counters.forEach(c => {
      if (c.dataset.counted === '1') return;
      if (c.getBoundingClientRect().top < window.innerHeight) countUp(c);
    });
  }, 4000);
}
