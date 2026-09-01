import * as motion from './motion.js';

motion.initMotion();

/* ---------- vehicle fitment logos ----------
   Each brand card ships with its initials in the tile. If a logo file has been
   added at assets/logos/<slug>.svg (or .png) it is swapped in here. Probing
   with an Image() rather than rendering an <img> directly means a missing file
   costs nothing visible — no broken-image icon, no layout shift. */
const logoCards = document.querySelectorAll('.fitment-chip[data-logo]');
if (logoCards.length) {
  fetch('assets/logos/manifest.json')
    .then(r => (r.ok ? r.json() : {}))
    .then(manifest => {
      logoCards.forEach(card => {
        const file = manifest[card.dataset.logo];
        const mark = card.querySelector('.fitment-mark');
        const name = card.querySelector('.fitment-name');
        if (!file || !mark) return;   // no logo yet: initials badge stays
        const img = new Image();
        img.alt = '';                 // the brand name sits directly below
        img.decoding = 'async';
        // handlers before src: a cached image can fire load synchronously.
        // Only swap once it has decoded, so a bad file leaves the initials
        // badge in place rather than an empty box. No loading="lazy" here —
        // the element is detached, and a lazy detached image never loads.
        img.onload = () => mark.replaceChildren(img);
        img.src = `assets/logos/${file}`;
        if (name) card.setAttribute('aria-label', name.textContent.trim());
      });
    })
    .catch(() => {});   // manifest missing: every card keeps its initials
}

/* ---------- parts catalogue ---------- */
const seriesHost = document.querySelector('[data-series]');
const catalogueHosts = document.querySelectorAll('[data-catalogue]');
if (seriesHost || catalogueHosts.length) {
  import('./catalogue.js').then(m => {
    if (seriesHost) {
      m.renderSeries(seriesHost, m.deepGrooveGroups(seriesHost.dataset.closures || ''));
    }
    catalogueHosts.forEach(h => m.mountCatalogue(h));
  }).catch(() => {});
}

/* The scroll-scrub exploded view is an enhancement, never a gate. The section
   renders as a static diagram until we have confirmed all of: a pointer-driven
   viewport, no reduced-motion preference, WebGL, and Three.js actually
   downloaded. Only then do we pin the section (.is-3d) and hand it the canvas.
   Anything short of that leaves the static markup in place, so the heading,
   copy and part labels are always readable. */
const scrubEligible = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  window.matchMedia('(min-width: 821px)').matches &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

async function init3d() {
  const hero = document.querySelector('[data-hero3d]');
  const scrubSection = document.querySelector('[data-scrub3d]');
  if (!hero && !scrubSection) return;

  let mod;
  try {
    mod = await import('./bearing3d.js');
  } catch (e) {
    return; // static markup stands
  }

  if (hero && !hero.dataset.init) {
    hero.dataset.init = '1';
    mod.createBearing(hero, { scrub: false }).catch(() => {});
  }

  if (!scrubSection || !scrubEligible()) return;
  const host = scrubSection.querySelector('[data-scrub-canvas]');
  if (!host || host.dataset.init) return;

  // don't pin the section until Three.js is actually in hand
  if (!(await mod.ensureThree())) return;
  host.dataset.init = '1';
  scrubSection.classList.add('is-3d');

  const caption = scrubSection.querySelector('[data-scrub-caption]');
  const defaultCaption = caption ? caption.textContent : '';
  let api = null;
  const update = () => {
    const span = scrubSection.offsetHeight - window.innerHeight;
    const p = span > 0 ? Math.max(0, Math.min(1, -scrubSection.getBoundingClientRect().top / span)) : 0;
    if (api) api.setProgress(p);
    if (caption) caption.textContent = p < .25 ? 'Scroll to disassemble'
      : p < .6 ? 'Parts separating — outer race, balls, cage, inner race'
      : 'Reassembling';
  };

  const api0 = await mod.createBearing(host, { scrub: true }).catch(() => null);
  if (!api0 || api0.fallback) {
    // WebGL went away between the probe and setup - unpin and stay static
    scrubSection.classList.remove('is-3d');
    host.replaceChildren();
    delete host.dataset.init;
    if (caption) caption.textContent = defaultCaption;
    return;
  }
  api = api0;
  update();
  addEventListener('scroll', update, { passive: true });
}

init3d();

/* ---------- contact form ----------
   TODO (LAUNCH BLOCKER): FORM_ENDPOINT is empty, so this form does not submit
   anywhere. While it is empty, submitting shows the "not connected" panel and
   points the visitor at the sales inbox — it must never show a success message
   it cannot honour, or real enquiries are lost silently.
   Set this to a real form handler URL (accepting a POST) to go live. */
const FORM_ENDPOINT = '';

const form = document.querySelector('[data-contact-form]');
if (form) {
  const formState = document.querySelector('[data-form-state="form"]');
  const unconfigured = document.querySelector('[data-form-state="unconfigured"]');

  if (!FORM_ENDPOINT) {
    console.warn(
      '[BSL] Contact form has no FORM_ENDPOINT configured in js/site.js — ' +
      'submissions are NOT being delivered anywhere.');
  }

  // There is deliberately no success panel in the markup. Until a real handler
  // exists, the only outcome is the honest "not connected" panel; a success
  // message can therefore never be shown for a message that was not sent.
  const showNotConnected = () => {
    if (formState) formState.style.display = 'none';
    if (unconfigured) unconfigured.style.display = '';
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!FORM_ENDPOINT) return showNotConnected();
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        body: new FormData(form),
      });
      if (!res.ok) throw new Error(res.status);
      // Built here rather than sitting in the markup, so a confirmation can
      // only ever exist after a real 200 from a real handler.
      const ok = document.createElement('div');
      ok.style.padding = '40px 0';
      ok.innerHTML =
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:12px;' +
        'letter-spacing:.2em;text-transform:uppercase;color:#C30001">Inquiry received</div>' +
        '<div style="margin-top:18px;font-family:\'Big Shoulders Display\',sans-serif;' +
        'font-weight:700;font-size:38px;line-height:1.05;text-transform:uppercase;' +
        'color:#12304F">Thank you — we\'ll be in touch</div>' +
        '<p style="margin:16px 0 0;color:#2B2B2B;font-size:15px;line-height:1.8">' +
        'Your inquiry has reached our sales team. We typically reply within one business day.</p>';
      form.replaceWith(ok);
    } catch (err) {
      showNotConnected();
    }
  });

  form.querySelectorAll('input,select,textarea').forEach(field => {
    const label = field.closest('label');
    const span = label && label.querySelector('span');
    if (!span) return;
    field.addEventListener('focus', () => {
      span.style.transform = 'translateY(-3px) scale(1.04)';
      span.style.color = '#C30001';
    });
    field.addEventListener('blur', () => {
      if (!field.value) { span.style.transform = 'none'; span.style.color = '#5d7387'; }
    });
  });

  const submitBtn = form.querySelector('[data-fill-btn]');
  if (submitBtn) {
    const fill = submitBtn.querySelector('[data-fill]');
    submitBtn.addEventListener('mouseenter', () => { if (fill) fill.style.transform = 'scaleX(1)'; });
    submitBtn.addEventListener('mouseleave', () => { if (fill) fill.style.transform = 'scaleX(0)'; });
  }
}
