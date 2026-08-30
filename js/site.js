import * as motion from './motion.js';

motion.initMotion();

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

function init3d() {
  const hero = document.querySelector('[data-hero3d]');
  const scrubSection = document.querySelector('[data-scrub3d]');
  if (!hero && !scrubSection) return;

  import('./bearing3d.js').then(mod => {
    if (hero && !hero.dataset.init) {
      hero.dataset.init = '1';
      mod.createBearing(hero, { scrub: false });
    }

    if (!scrubSection) return;
    const host = scrubSection.querySelector('[data-scrub-canvas]');
    if (!host || host.dataset.init) return;
    host.dataset.init = '1';
    const caption = scrubSection.querySelector('[data-scrub-caption]');
    let api = null;
    const update = () => {
      const span = scrubSection.offsetHeight - window.innerHeight;
      const p = span > 0 ? Math.max(0, Math.min(1, -scrubSection.getBoundingClientRect().top / span)) : 0;
      if (api) api.setProgress(p);
      if (caption) caption.textContent = p < .25 ? 'Rotating to three-quarter view'
        : p < .6 ? 'Parts separating — outer race, balls, cage, inner race'
        : 'Reassembling';
    };
    mod.createBearing(host, { scrub: true }).then(a => { api = a; update(); });
    addEventListener('scroll', update, { passive: true });
  }).catch(() => {});
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
  const sentState = document.querySelector('[data-form-state="sent"]');
  const unconfigured = document.querySelector('[data-form-state="unconfigured"]');

  if (!FORM_ENDPOINT) {
    console.error(
      '[BSL] Contact form has no FORM_ENDPOINT configured in js/site.js — ' +
      'submissions are NOT being delivered anywhere.');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!FORM_ENDPOINT) {
      if (formState) formState.style.display = 'none';
      if (unconfigured) unconfigured.style.display = '';
      return;
    }
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        body: new FormData(form),
      });
      if (!res.ok) throw new Error(res.status);
      if (formState) formState.style.display = 'none';
      if (sentState) sentState.style.display = '';
    } catch (err) {
      if (formState) formState.style.display = 'none';
      if (unconfigured) unconfigured.style.display = '';
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
