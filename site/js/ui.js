// Small DOM helpers, tooltip, heat colors, and a sortable table. No dependencies.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const f1 = n => n.toFixed(1);
export const f2 = n => n.toFixed(2);
export const signed = (n, d = 1) => (Math.abs(n) < 0.5 * 10 ** -d ? (0).toFixed(d) : (n > 0 ? '+' : '−') + Math.abs(n).toFixed(d));
export const pct = (n, d = 0) => (n * 100).toFixed(d) + '%';

// ---- Tooltip (hover on desktop, tap on touch) -------------------------------------------
let tipEl, tipOwner = null;
function ensureTip() {
  if (!tipEl) { tipEl = h('div', { id: 'tip', role: 'tooltip' }); document.body.append(tipEl); }
  return tipEl;
}
function place(x, y) {
  const t = ensureTip();
  t.style.display = 'block';
  const w = t.offsetWidth, hgt = t.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > window.innerWidth - 8) left = Math.max(8, x - w - 14);
  if (top + hgt > window.innerHeight - 8) top = Math.max(8, y - hgt - 14);
  t.style.left = left + 'px'; t.style.top = top + 'px';
}
export function hideTip() { if (tipEl) tipEl.style.display = 'none'; tipOwner = null; }
export function attachTip(el, html) {
  const get = typeof html === 'function' ? html : () => html;
  el.addEventListener('mouseenter', e => { if (e.pointerType === 'touch') return; ensureTip().innerHTML = get(); place(e.clientX, e.clientY); });
  el.addEventListener('mousemove', e => { if (tipEl && tipEl.style.display === 'block' && tipOwner === null) place(e.clientX, e.clientY); });
  el.addEventListener('mouseleave', () => { if (tipOwner === null) hideTip(); });
  el.addEventListener('click', e => {
    if (tipOwner === el) { hideTip(); return; }
    ensureTip().innerHTML = get(); place(e.clientX, e.clientY); tipOwner = el;
    e.stopPropagation();
  });
  return el;
}
document.addEventListener('click', () => hideTip());
window.addEventListener('scroll', () => { if (tipOwner) hideTip(); }, { passive: true });

// ---- Colors ------------------------------------------------------------------------------
// frac in [0,1]; low = red/orange, high = green. Returns { bg, fg }.
export function heat(frac) {
  if (frac >= 0.83) return { bg: '#1b9e5a', fg: '#ffffff' };
  if (frac >= 0.66) return { bg: '#7fd1a0', fg: '#0b3d22' };
  if (frac >= 0.5) return { bg: '#cfeedd', fg: '#0b3d22' };
  if (frac >= 0.33) return { bg: '#fbe3c8', fg: '#5a2d00' };
  if (frac >= 0.16) return { bg: '#f4b183', fg: '#5a2d00' };
  return { bg: '#e4604f', fg: '#ffffff' };
}
const mix = (c1, c2, a) => c1.map((v, i) => Math.round(v + (c2[i] - v) * a));
export function diverge(z) { // z in standard deviations; blue above, red below
  const a = Math.min(Math.abs(z) / 2, 1);
  const c = mix([56, 56, 53], z >= 0 ? [42, 120, 214] : [208, 59, 59], a);
  return { bg: `rgb(${c.join(',')})`, fg: a > 0.45 ? '#fff' : '#e8eef6' };
}
export const POS_COLORS = { QB: '#3987e5', RB: '#d95926', WR: '#199e70', TE: '#c98500', K: '#d55181', DEF: '#008300' };
export const POS_INK = { QB: '#fff', RB: '#fff', WR: '#fff', TE: '#0b0b0b', K: '#fff', DEF: '#fff' };
export const SERIES = ['#ffd54a', '#3987e5', '#d95926', '#199e70', '#d55181', '#c98500'];

// ---- Sortable table ----------------------------------------------------------------------
// columns: [{ key, label, sort(row)->number|string, cell(row)->Node|string, align, title }]
export function sortableTable({ columns, rows, sortKey, desc = true, rowClass, className = '', stickyIndex = -1 }) {
  let key = sortKey ?? columns[0].key, dir = desc;
  const wrap = h('div', { class: 'tablewrap' });
  function render() {
    const col = columns.find(c => c.key === key);
    const sorted = rows.slice().sort((a, b) => {
      const x = col.sort(a), y = col.sort(b);
      const r = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return dir ? -r : r;
    });
    const head = h('tr', {}, columns.map((c, i) => h('th', {
      class: (c.align || '') + (c.key === key ? ' sorted' : '') + (i === stickyIndex ? ' stick' : ''),
      title: c.title || null,
      onclick: () => { if (key === c.key) dir = !dir; else { key = c.key; dir = c.firstDesc !== false; } render(); },
    }, c.label, c.key === key ? h('span', { class: 'arrow' }, dir ? ' ▾' : ' ▴') : '')));
    const body = sorted.map(r => h('tr', { class: rowClass ? rowClass(r) : '' },
      columns.map((c, i) => { const v = c.cell(r); return h('td', { class: (c.align || '') + (i === stickyIndex ? ' stick' : '') }, v); })));
    wrap.replaceChildren(h('table', { class: 'data ' + className }, h('thead', {}, head), h('tbody', {}, body)));
  }
  render();
  return wrap;
}

export function section(title, sub, ...content) {
  return h('section', { class: 'card' }, h('h2', {}, title), sub ? h('p', { class: 'sub' }, sub) : null, ...content);
}
