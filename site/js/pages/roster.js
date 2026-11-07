import * as A from '../analytics.js';
import { h, svg, f1, pct, attachTip, esc, diverge, POS_COLORS, POS_INK, SERIES, section, sortableTable } from '../ui.js';
import { label, labelHtml, weeksFor, weeksLabel } from './common.js';

export function renderRoster(ctx, st) {
  const weeks = weeksFor(ctx, st);
  if (!weeks.length) return h('p', { class: 'note' }, 'No completed weeks in the selected range.');
  return h('div', {},
    h('p', { class: 'note', style: { margin: '10px 0 0' } }, `${weeksLabel(weeks)}. Based on starters’ points only; every starter counts as a player.`),
    positionMix(ctx, weeks), positionVsAvg(ctx, weeks), topHeavy(ctx, weeks), curves(ctx, weeks), dependency(ctx, weeks));
}

// ---- 1. Top-heavy share --------------------------------------------------------------------------------
const GROUPS = [
  { name: 'Top scorer', bg: '#9ec5f4', fg: '#0b2a4d' }, { name: '#2–3 scorers', bg: '#5598e7', fg: '#071a33' },
  { name: '#4–5 scorers', bg: '#256abf', fg: '#ffffff' }, { name: 'Everyone else', bg: '#2b3a4f', fg: '#9fb0c3' },
];
function topHeavy(ctx, weeks) {
  const conc = A.concentration(ctx, weeks);
  const order = ctx.rids.slice().sort((a, b) => conc[b].top3 - conc[a].top3);
  const slices = [[0, 1], [1, 3], [3, 5]];
  const rows = order.map(rid => {
    const c = conc[rid];
    const vals = [c.top1, c.top23, c.top45, c.rest];
    const bar = h('div', { class: 'bar' }, vals.map((v, i) => {
      const el = h('div', { style: { width: (v * 100).toFixed(2) + '%', background: GROUPS[i].bg, color: GROUPS[i].fg } }, i < 3 && v >= 0.08 ? Math.round(v * 100) + '%' : '');
      return attachTip(el, () => {
        const ps = i < 3 ? c.players.slice(...slices[i]) : c.players.slice(5);
        const list = i < 3 ? ps.map(p => `${esc(p.name)} <span class="mut">${p.pos}</span> ${f1(p.pts)}`).join('<br>')
          : `${ps.length} other players<br>${f1(ps.reduce((a, p) => a + p.pts, 0))} pts`;
        return `${labelHtml(ctx, rid)}<br><span class="mut">${GROUPS[i].name} · ${pct(v)} of PF</span><br>${list}`;
      });
    }));
    return h('div', { class: 'row' }, h('div', { class: 'nm ' + (rid === ctx.meRid ? 'me' : '') }, ctx.name(rid)), bar, h('div', { class: 'end' }, pct(c.top3)));
  });
  return section('How top-heavy is each roster?', 'Share of PF from each team’s best scorers. The number on the right is the top-3 share. Tap a segment to see the players.',
    h('div', { class: 'legend' }, GROUPS.map(g => h('span', {}, h('i', { style: { background: g.bg } }), g.name))), rows);
}

// ---- 2. Concentration curves --------------------------------------------------------------------------
function curves(ctx, weeks) {
  const conc = A.concentration(ctx, weeks);
  const byEff = ctx.rids.slice().sort((a, b) => conc[a].eff - conc[b].eff);
  const sel = new Set([ctx.meRid, byEff[0], byEff[byEff.length - 1]].filter(x => x != null));
  const W = 428, H = 230, L = 34, R = 10, T = 10, B = 24, XM = 15;
  const X = r => L + ((r - 1) / (XM - 1)) * (W - L - R), Y = p => T + (1 - p) * (H - T - B);
  const colorOf = rid => {
    if (rid === ctx.meRid && sel.has(rid)) return SERIES[0];
    const others = [...sel].filter(r => r !== ctx.meRid); const i = others.indexOf(rid);
    return i >= 0 ? SERIES[1 + (i % 5)] : null;
  };
  const chart = h('div', {}), chips = h('div', { style: { marginBottom: '8px' } });
  function draw() {
    const s = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Cumulative share of points by player rank' });
    for (const g of [0, 0.25, 0.5, 0.75, 1]) s.append(svg('line', { class: 'grid-line', x1: L, x2: W - R, y1: Y(g), y2: Y(g) }), svg('text', { x: L - 6, y: Y(g) + 3, 'text-anchor': 'end' }, Math.round(g * 100) + '%'));
    for (const r of [1, 5, 10, 15]) s.append(svg('text', { x: X(r), y: H - 8, 'text-anchor': 'middle' }, r));
    s.append(svg('text', { x: (L + W - R) / 2, y: H + 4, 'text-anchor': 'middle', style: 'display:none' }, ''));
    const order = ctx.rids.slice().sort((a, b) => (colorOf(a) ? 1 : 0) - (colorOf(b) ? 1 : 0));
    for (const rid of order) {
      const col = colorOf(rid), on = !!col; const cv = conc[rid].curve.slice(0, XM);
      s.append(svg('polyline', { points: cv.map((p, i) => `${X(i + 1)},${Y(p)}`).join(' '), fill: 'none', stroke: on ? col : '#5c6f86',
        'stroke-width': on ? (rid === ctx.meRid ? 3 : 2.4) : 1.4, opacity: on ? 1 : 0.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      if (on) cv.forEach((p, i) => {
        const hit = svg('circle', { cx: X(i + 1), cy: Y(p), r: 9, fill: 'transparent', style: 'cursor:pointer' });
        attachTip(hit, () => `${labelHtml(ctx, rid)}<br>Top ${i + 1} player${i ? 's' : ''} = <b>${pct(p)}</b> of PF<br><span class="mut">${esc(conc[rid].players[i].name)} ${f1(conc[rid].players[i].pts)}</span>`);
        s.append(svg('circle', { cx: X(i + 1), cy: Y(p), r: 2.4, fill: col }), hit);
      });
    }
    chart.replaceChildren(s);
    chips.replaceChildren(...ctx.rids.map(rid => {
      const col = colorOf(rid);
      return h('span', { class: 'chip' + (col ? ' on' : ''), onclick: () => { sel.has(rid) ? sel.delete(rid) : (sel.size < 6 && sel.add(rid)); draw(); } },
        h('i', { style: { background: col || '#5c6f86' } }), ctx.name(rid));
    }));
  }
  draw();
  const table = sortableTable({
    sortKey: 'eff', desc: false, rows: ctx.rids.map(rid => ({ rid })), rowClass: r => (r.rid === ctx.meRid ? 'mine' : ''),
    columns: [
      { key: 'team', label: 'Team', firstDesc: false, sort: r => ctx.name(r.rid).toLowerCase(), cell: r => label(ctx, r.rid) },
      { key: 'n', label: 'Players used', align: 'r', sort: r => conc[r.rid].n, cell: r => conc[r.rid].n },
      { key: 'eff', label: 'Effective players', align: 'r', firstDesc: false, title: '1 ÷ Σ(share²): the equivalent number of equal-sized contributors. Lower = more concentrated.', sort: r => conc[r.rid].eff, cell: r => conc[r.rid].eff.toFixed(1) },
      { key: 'gini', label: 'Gini', align: 'r', title: '0 = points spread evenly, 1 = one player scored everything', sort: r => conc[r.rid].gini, cell: r => conc[r.rid].gini.toFixed(2) },
    ],
  });
  return section('Concentration curves',
    'Cumulative share of PF by player rank (best scorer first). A steeper climb means more reliance on a few players. Tap team chips to compare up to six; tap a dot for details.',
    chips, chart,
    h('div', { style: { height: '10px' } }), table,
    h('p', { class: 'note' }, 'Teams that churn through many starters look more concentrated on Gini, so Effective players is the cleaner read.'));
}

// ---- 3. Dependency on top scorer -----------------------------------------------------------------------
function dependency(ctx, weeks) {
  const rows = A.dependency(ctx, weeks).sort((a, b) => (b.newRank - b.oldRank) - (a.newRank - a.oldRank) || b.lostPct - a.lostPct);
  const mx = Math.max(...rows.map(r => r.lostPct));
  return section('What if the top scorer vanished?', 'Remove each team’s #1 scorer (no replacement) and see how its PF rank would change. Bar = share of PF lost.',
    rows.map(r => {
      const d = r.newRank - r.oldRank;
      const row = h('div', { class: 'row', style: { background: r.rid === ctx.meRid ? '#26405e' : 'var(--surface2)', borderRadius: '8px', padding: '6px 8px', marginBottom: '4px' } },
        h('div', { style: { width: '138px', flex: 'none', overflow: 'hidden' } },
          h('div', { class: 'nm ' + (r.rid === ctx.meRid ? 'me' : ''), style: { width: 'auto' } }, ctx.name(r.rid)),
          h('div', { style: { fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, r.top ? `${r.top.name} · ${f1(r.top.pts)}` : '—')),
        h('div', { style: { flex: 1 } }, h('div', { class: 'track' }, h('div', { style: { width: (r.lostPct / mx * 100).toFixed(1) + '%' } })),
          h('div', { style: { fontSize: '10px', color: 'var(--muted)', marginTop: '2px' } }, pct(r.lostPct) + ' of PF')),
        h('div', { style: { width: '84px', textAlign: 'right', fontWeight: 700, fontSize: '12px', flex: 'none' } },
          `#${r.oldRank} → #${r.newRank} `, d > 0 ? h('span', { style: { color: 'var(--bad)' } }, '▼' + d) : h('span', { class: 'muted' }, '–')));
      return attachTip(row, () => `${labelHtml(ctx, r.rid)}<br>${f1(r.pf)} PF → <b>${f1(r.without)}</b> without ${esc(r.top ? r.top.name : '—')}<br><span class="mut">Rank #${r.oldRank} → #${r.newRank}</span>`);
    }));
}

// ---- 4. Position mix ----------------------------------------------------------------------------------------
function positionMix(ctx, weeks) {
  const pm = A.positionMix(ctx, weeks);
  const mkBar = (vals, total, who) => h('div', { class: 'bar' }, ctx.pos.map(p => {
    const v = vals[p] / total;
    const el = h('div', { style: { width: (v * 100).toFixed(2) + '%', background: POS_COLORS[p], color: POS_INK[p] } }, v >= 0.09 ? Math.round(v * 100) + '%' : '');
    return attachTip(el, () => `${who}<br><b>${p}</b> · ${f1(vals[p])} pts · ${pct(v, 1)} of PF`);
  }));
  const order = ctx.rids.slice().sort((a, b) => pm.total(b) - pm.total(a));
  return section('Where the points come from', 'Share of PF by position (flex spots count as the player’s real position). Right = total PF, sorted by PF. Tap a segment for points.',
    h('div', { class: 'legend' }, ctx.pos.map(p => h('span', {}, h('i', { style: { background: POS_COLORS[p] } }), p))),
    h('div', { class: 'row' }, h('div', { class: 'nm muted' }, 'League average'), mkBar(pm.avg, pm.avgTotal, '<b>League average</b>'), h('div', { class: 'end muted' }, Math.round(pm.avgTotal))),
    h('div', { style: { height: '1px', background: 'var(--line)', margin: '6px 0 8px' } }),
    order.map(rid => h('div', { class: 'row' }, h('div', { class: 'nm ' + (rid === ctx.meRid ? 'me' : '') }, ctx.name(rid)),
      mkBar(pm.by[rid], pm.total(rid), labelHtml(ctx, rid)), h('div', { class: 'end' }, Math.round(pm.total(rid))))));
}

// ---- 5. Position vs league average ---------------------------------------------------------------------
function positionVsAvg(ctx, weeks) {
  const pd = A.positionDelta(ctx, weeks);
  const cols = [
    { key: 'team', label: 'Team', firstDesc: false, sort: r => ctx.name(r.rid).toLowerCase(), cell: r => label(ctx, r.rid) },
    ...ctx.pos.map(p => ({
      key: p, label: p, align: 'cellc c', sort: r => pd[r.rid][p].delta,
      cell: r => {
        const c = diverge(pd[r.rid][p].z); const v = pd[r.rid][p].delta;
        const el = h('span', { style: { display: 'block', background: c.bg, color: c.fg, borderRadius: '4px', padding: '6px 2px', minWidth: '40px', fontSize: '11.5px', fontWeight: 700 } },
          Math.round(v) === 0 ? '0' : (v > 0 ? '+' : '−') + Math.abs(Math.round(v)));
        return attachTip(el, () => `${labelHtml(ctx, r.rid)}<br><b>${p}</b>: ${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} pts vs. league average<br><span class="mut">${pd[r.rid][p].z >= 0 ? '+' : '−'}${Math.abs(pd[r.rid][p].z).toFixed(1)} standard deviations</span>`);
      },
    })),
    { key: 'total', label: 'Total', align: 'cellc c', sort: r => pd[r.rid].total,
      cell: r => h('span', { style: { display: 'block', background: '#243448', borderRadius: '4px', padding: '6px 2px', minWidth: '44px', fontSize: '11.5px', fontWeight: 700 } },
        (pd[r.rid].total >= 0 ? '+' : '−') + Math.abs(Math.round(pd[r.rid].total))) },
  ];
  return section('Points vs league average, by position',
    'Each cell is a team’s points at that position minus the league average. Blue = above, red = below; shade is scaled within each position (±2 standard deviations). Tap a header to sort.',
    sortableTable({ columns: cols, rows: ctx.rids.map(rid => ({ rid })), sortKey: 'total', stickyIndex: 0, rowClass: r => (r.rid === ctx.meRid ? 'mine' : '') }));
}
