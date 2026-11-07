import * as A from '../analytics.js';
import { h, svg, f1, attachTip, esc, heat, SERIES, section, sortableTable } from '../ui.js';
import { label, labelHtml, matchupList } from './common.js';

export function renderHistory(ctx) {
  const weeks = ctx.completed;
  if (!weeks.length) return h('p', { class: 'note' }, 'No completed weeks yet.');
  return h('div', {}, rankChart(ctx), pointsGrid(ctx), resultsByWeek(ctx));
}

// ---- Rank by week (line chart) ---------------------------------------------------------------
function rankChart(ctx) {
  const hist = A.rankHistory(ctx);
  const weeks = ctx.completed, N = ctx.rids.length;
  const W = 420, H = 330, L = 26, R = 100, T = 14, B = 24;
  const X = i => L + (weeks.length === 1 ? 0 : (i / (weeks.length - 1)) * (W - L - R));
  const Y = r => T + ((r - 1) / (N - 1)) * (H - T - B);
  const pinned = new Set(ctx.meRid != null ? [ctx.meRid] : []);
  const holder = h('div', {});
  const chips = h('div', { style: { marginBottom: '8px' } });

  const colorOf = rid => {
    if (rid === ctx.meRid) return SERIES[0];
    const others = [...pinned].filter(r => r !== ctx.meRid);
    const i = others.indexOf(rid);
    return i >= 0 ? SERIES[1 + (i % (SERIES.length - 1))] : null;
  };
  function draw() {
    const s = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Standings rank by week' });
    for (let r = 1; r <= N; r++) s.append(svg('line', { class: 'grid-line', x1: L, x2: W - R, y1: Y(r), y2: Y(r), opacity: r % 2 ? 0.5 : 0.25 }),
      svg('text', { x: L - 6, y: Y(r) + 3, 'text-anchor': 'end' }, r));
    weeks.forEach((w, i) => s.append(svg('text', { x: X(i), y: H - 6, 'text-anchor': 'middle' }, `W${w}`)));
    const order = ctx.rids.slice().sort((a, b) => (pinned.has(a) ? 1 : 0) - (pinned.has(b) ? 1 : 0) || (a === ctx.meRid ? 1 : 0) - (b === ctx.meRid ? 1 : 0));
    for (const rid of order) {
      const col = colorOf(rid), on = col != null;
      const pts = hist[rid].map((p, i) => `${X(i)},${Y(p.rank)}`).join(' ');
      s.append(svg('polyline', { points: pts, fill: 'none', stroke: on ? col : '#5c6f86', 'stroke-width': on ? (rid === ctx.meRid ? 3.2 : 2.4) : 1.4,
        opacity: on ? 1 : 0.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      hist[rid].forEach((p, i) => {
        const c = svg('circle', { cx: X(i), cy: Y(p.rank), r: on ? 3.2 : 2, fill: on ? col : '#5c6f86', opacity: on ? 1 : 0.6 });
        const hit = svg('circle', { cx: X(i), cy: Y(p.rank), r: 9, fill: 'transparent', style: 'cursor:pointer' });
        attachTip(hit, () => `${labelHtml(ctx, rid)}<br><span class="mut">After week ${p.week}</span><br>Rank <b>#${p.rank}</b> · ${p.w}-${p.l}${p.t ? '-' + p.t : ''} · ${f1(p.pf)} PF`);
        s.append(c, hit);
      });
      const last = hist[rid][hist[rid].length - 1];
      s.append(svg('text', { x: W - R + 8, y: Y(last.rank) + 3.5, style: `fill:${on ? col : '#9fb0c3'};font-weight:${on ? 700 : 500}` }, ctx.name(rid)));
    }
    holder.replaceChildren(s);
    chips.replaceChildren(...ctx.rids.map(rid => {
      const col = colorOf(rid);
      return h('span', { class: 'chip' + (col ? ' on' : ''), onclick: () => { pinned.has(rid) ? pinned.delete(rid) : (pinned.size < 6 && pinned.add(rid)); draw(); } },
        h('i', { style: { background: col || '#5c6f86' } }), ctx.name(rid));
    }));
  }
  draw();
  return section('Standings rank by week', 'Rank after each completed week (record first, then points). Tap a team below to highlight it, or tap a dot for details.', chips, holder);
}

// ---- Points by week (heat table) --------------------------------------------------------------
function pointsGrid(ctx) {
  const weeks = ctx.completed, N = ctx.rids.length;
  const rows = ctx.rids.map(rid => ({ rid, total: weeks.reduce((a, w) => a + ctx.score[w][rid], 0) }));
  const rankIn = (w, rid) => Object.values(ctx.score[w]).filter(x => x < ctx.score[w][rid]).length / (N - 1);
  const cols = [
    { key: 'team', label: 'Team', firstDesc: false, sort: r => ctx.name(r.rid).toLowerCase(), cell: r => label(ctx, r.rid) },
    ...weeks.map(w => ({
      key: 'w' + w, label: 'W' + w, align: 'cellc c', sort: r => ctx.score[w][r.rid],
      cell: r => {
        const c = heat(rankIn(w, r.rid)); const o = ctx.opp[w][r.rid];
        const el = h('span', { style: { display: 'block', background: c.bg, color: c.fg, borderRadius: '4px', padding: '5px 3px', minWidth: '38px', fontSize: '11px', fontWeight: 700 } }, f1(ctx.score[w][r.rid]));
        const res = o == null ? '' : ctx.score[w][r.rid] > ctx.score[w][o] ? 'W' : ctx.score[w][r.rid] < ctx.score[w][o] ? 'L' : 'T';
        return attachTip(el, () => `${labelHtml(ctx, r.rid)}<br><span class="mut">Week ${w}</span><br>${f1(ctx.score[w][r.rid])} vs ${o == null ? '—' : esc(ctx.name(o)) + ' ' + f1(ctx.score[w][o])} <b>${res}</b><br><span class="mut">Higher than ${Math.round(rankIn(w, r.rid) * (N - 1))} of ${N - 1} other teams</span>`);
      },
    })),
    { key: 'total', label: 'Total', align: 'r', sort: r => r.total, cell: r => f1(r.total) },
  ];
  return section('Points by week', 'Shading compares each score with the rest of the league that week (green = high, red = low). Tap a header to sort.',
    sortableTable({ columns: cols, rows, sortKey: 'total', stickyIndex: 0, rowClass: r => (r.rid === ctx.meRid ? 'mine' : '') }));
}

// ---- Results by week ------------------------------------------------------------------------------
function resultsByWeek(ctx) {
  const entries = ctx.data.weeks.filter(w => w.complete);
  const holder = h('div', {});
  const show = w => holder.replaceChildren(matchupList(ctx, entries.find(e => e.week === w)));
  const sel = h('select', { onchange: e => show(+e.target.value) },
    entries.slice().reverse().map(e => h('option', { value: e.week }, `Week ${e.week}`)));
  show(entries[entries.length - 1].week);
  return section('Results by week', null, h('div', { class: 'controls', style: { margin: '0 0 10px' } }, sel), holder);
}
