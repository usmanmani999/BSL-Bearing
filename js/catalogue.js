/* Reusable parts-catalogue table.

   One component serves both the wheel hub (DAC) and taper roller datasets.
   Rows come from JSON, never from markup. Above 768px it renders a sortable
   table with a sticky header; below that the same rows render as stacked
   cards, because a nine-column table cannot be read at 360px. Rows are
   rendered in pages so a 200-row dataset never puts 200 rows in the DOM at
   once. */

const PAGE_SIZE = 40;
const DASH = '—';

const SCHEMA = {
  /* Headers are uppercased by the site's type styles, so "d" and "D" would
     render identically. Each dimension is labelled by name instead. */
  hub: {
    file: 'data/hub-bearings.json',
    dims: [
      ['d', 'Bore d (mm)'], ['D', 'Outer D (mm)'], ['B', 'Width B (mm)'],
      ['C', 'Width C (mm)'], ['weight', 'Weight (kg)'],
    ],
    inter: [['skf', 'SKF'], ['fag', 'FAG'], ['koyo', 'KOYO']],
  },
  taper: {
    file: 'data/taper-roller.json',
    dims: [
      ['d', 'Bore d (mm)'], ['D', 'Outer D (mm)'], ['T', 'Width T (mm)'],
      ['B', 'Width B (mm)'], ['C', 'Width C (mm)'],
      ['cr', 'Cr dynamic (kN)'], ['cor', 'Cor static (kN)'],
      ['weight', 'Weight (kg)'],
    ],
    inter: [],
  },
};

const fmt = v => (v === null || v === undefined || v === '' ? DASH : String(v));

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function boreBands(rows) {
  const bores = [...new Set(rows.map(r => r.d))].sort((a, b) => a - b);
  if (!bores.length) return [];
  const lo = Math.floor(bores[0] / 10) * 10;
  const hi = Math.ceil(bores[bores.length - 1] / 10) * 10;
  const bands = [];
  for (let s = lo; s < hi; s += 10) {
    if (bores.some(b => b >= s && b < s + 10)) bands.push([s, s + 10]);
  }
  return bands;
}

export async function mountCatalogue(host) {
  const kind = host.dataset.catalogue;
  const schema = SCHEMA[kind];
  if (!schema) return;

  let data;
  try {
    const res = await fetch(schema.file);
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch (e) {
    host.replaceChildren(el('p', 'cat-empty',
      'The parts catalogue could not be loaded. Please refresh, or contact ' +
      'sales with the part number you need.'));
    return;
  }

  const all = data.rows || [];
  const cols = [['designation', 'Designation'], ...schema.dims, ...schema.inter];
  const state = { q: '', bore: '', sort: 'designation', dir: 1, shown: PAGE_SIZE };

  /* ---- controls ---- */
  const controls = el('div', 'cat-controls');

  const search = el('input');
  search.type = 'search';
  search.placeholder = 'e.g. DAC42 or 32210';
  search.setAttribute('aria-label', 'Search by bearing designation');
  const fSearch = el('label', 'cat-field');
  fSearch.append(el('span', null, 'Search designation'), search);

  const bore = el('select');
  bore.setAttribute('aria-label', 'Filter by bore diameter');
  bore.append(new Option('All bore sizes', ''));
  boreBands(all).forEach(([a, b]) => bore.append(new Option(`${a} – ${b} mm`, `${a}:${b}`)));
  const fBore = el('label', 'cat-field');
  fBore.append(el('span', null, 'Bore diameter (d)'), bore);

  const sort = el('select');
  sort.setAttribute('aria-label', 'Sort rows');
  [['designation:1', 'Designation (A–Z)'], ['designation:-1', 'Designation (Z–A)'],
   ['d:1', 'Bore, smallest first'], ['d:-1', 'Bore, largest first']]
    .forEach(([v, t]) => sort.append(new Option(t, v)));
  const fSort = el('label', 'cat-field');
  fSort.append(el('span', null, 'Sort by'), sort);

  controls.append(fSearch, fBore, fSort);

  const count = el('div', 'cat-count');
  const scroll = el('div', 'cat-scroll');
  const table = el('table', 'cat-table');
  const thead = el('thead');
  const htr = el('tr');
  cols.forEach(([key, label]) => {
    const th = el('th', null, label);
    th.scope = 'col';
    if (key === 'designation' || key === 'd') {
      th.dataset.sort = key;
      th.tabIndex = 0;
      th.setAttribute('role', 'button');
      const activate = () => {
        state.dir = state.sort === key ? -state.dir : 1;
        state.sort = key;
        sort.value = `${key}:${state.dir}`;
        state.shown = PAGE_SIZE;
        render();
      };
      th.addEventListener('click', activate);
      th.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    }
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  const tbody = el('tbody');
  table.append(thead, tbody);
  scroll.appendChild(table);

  const cards = el('div', 'cat-cards');
  const more = el('div', 'cat-more');
  const moreBtn = el('button', 'btn-quote', 'Show more');
  moreBtn.type = 'button';
  moreBtn.addEventListener('click', () => { state.shown += PAGE_SIZE; render(); });
  more.appendChild(moreBtn);

  host.replaceChildren(controls, count, scroll, cards, more);

  /* ---- filtering + rendering ---- */
  function visible() {
    const q = state.q.trim().toLowerCase();
    const [lo, hi] = state.bore ? state.bore.split(':').map(Number) : [null, null];
    return all
      .filter(r => !q || r.designation.toLowerCase().includes(q))
      .filter(r => lo === null || (r.d >= lo && r.d < hi))
      .sort((a, b) => {
        const k = state.sort;
        const av = a[k], bv = b[k];
        const c = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return c * state.dir;
      });
  }

  function render() {
    const rows = visible();
    const page = rows.slice(0, state.shown);

    count.textContent = rows.length === all.length
      ? `${all.length} part numbers`
      : `${rows.length} of ${all.length} part numbers`;

    htr.querySelectorAll('th[data-sort]').forEach(th => {
      th.setAttribute('aria-sort', th.dataset.sort === state.sort
        ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
    });

    const body = document.createDocumentFragment();
    const cardFrag = document.createDocumentFragment();

    page.forEach(r => {
      const tr = el('tr');
      cols.forEach(([key]) => {
        const td = el('td');
        if (key === 'designation') {
          td.className = 'cat-desig';
          td.textContent = r.designation;
        } else if (schema.inter.some(([k]) => k === key)) {
          td.className = 'cat-inter';
          td.textContent = fmt(r[key]);
        } else {
          td.textContent = fmt(r[key]);
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);

      const card = el('div', 'cat-card');
      card.appendChild(el('div', 'cat-card-head', r.designation));
      const kv = el('dl', 'cat-kv');
      schema.dims.forEach(([key, label]) => {
        const wrap = el('div');
        wrap.append(el('dt', null, label), el('dd', null, fmt(r[key])));
        kv.appendChild(wrap);
      });
      card.appendChild(kv);
      if (schema.inter.length) {
        const box = el('div', 'cat-card-inter');
        schema.inter.forEach(([key, label]) => {
          const wrap = el('div');
          wrap.append(el('dt', null, label), el('dd', null, fmt(r[key])));
          box.appendChild(wrap);
        });
        card.appendChild(box);
      }
      cardFrag.appendChild(card);
    });

    tbody.replaceChildren(body);
    cards.replaceChildren(cardFrag);

    if (!rows.length) {
      const msg = 'No part number matches that search. Send us the number and ' +
                  'we will cross-reference it.';
      const tr = el('tr');
      const td = el('td', 'cat-empty', msg);
      td.colSpan = cols.length;
      tr.appendChild(td);
      tbody.replaceChildren(tr);
      cards.replaceChildren(el('p', 'cat-empty', msg));
    }
    more.hidden = page.length >= rows.length;
    moreBtn.textContent = `Show more (${rows.length - page.length} remaining)`;
  }

  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = search.value; state.shown = PAGE_SIZE; render(); }, 120);
  });
  bore.addEventListener('change', () => {
    state.bore = bore.value; state.shown = PAGE_SIZE; render();
  });
  sort.addEventListener('change', () => {
    const [k, d] = sort.value.split(':');
    state.sort = k; state.dir = Number(d); state.shown = PAGE_SIZE; render();
  });

  render();
}

/* ---- deep groove series, enumerated ---- */
export function renderSeries(host, groups) {
  const frag = document.createDocumentFragment();
  groups.forEach(g => {
    const wrap = el('div', 'series-group');
    const id = `series-${g.name}`;
    const btn = el('button', 'series-toggle');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', id);

    const left = el('div');
    left.append(el('div', 'series-name', `${g.name} series`),
                el('div', 'series-meta', `${g.from} – ${g.to} · ${g.parts.length} part numbers`));
    const sign = el('span', 'series-sign', '+');
    btn.append(left, sign);

    const body = el('div', 'series-body');
    body.id = id;
    body.hidden = true;
    const chips = el('div', 'series-chips');
    g.parts.forEach(p => chips.appendChild(el('div', 'series-chip', p)));
    body.append(chips, el('p', 'series-closures', `Closures · ${g.closures}`));

    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
      sign.textContent = open ? '+' : '−';
    });

    wrap.append(btn, body);
    frag.appendChild(wrap);
  });
  host.replaceChildren(frag);
}

export function deepGrooveGroups(closures) {
  // enumerated rather than hand-typed; 6000/6200/6300 each run 00-24
  return [
    { name: '6000', from: '6000', to: '6024' },
    { name: '6200', from: '6200', to: '6224' },
    { name: '6300', from: '6300', to: '6324' },
  ].map(g => ({
    ...g,
    closures,
    parts: Array.from({ length: 25 }, (_, i) =>
      String(Number(g.from) + i)),
  }));
}
