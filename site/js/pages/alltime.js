import * as A from '../analytics.js';
import { h, f1, attachTip, esc, heat, section, sortableTable } from '../ui.js';

export function renderAllTime(ctx) {
  const at = A.allTime(ctx);
  const me = ctx.byRid[ctx.meRid]?.userId;
  const done = at.seasonList.filter(s => s !== at.current);
  if (!done.length) return h('p', { class: 'note' }, 'No completed past seasons found.');
  const mine = u => (u.userId === me ? 'me' : '');
  const nameCell = u => h('span', { class: mine(u) }, u.name);
  const pct = (w, l, t) => (w + l + t ? ((w + 0.5 * t) / (w + l + t)) : 0);
  const rec = r => `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`;
  return h('div', {},
    h('p', { class: 'note', style: { margin: '10px 0 0' } }, `Seasons ${done[0]}–${done[done.length - 1]} plus ${at.current} so far (completed weeks). Regular-season games only; titles come from finished seasons.`),
    standingsCard(), finishGrid(), h2hCard(), ppgCard(), recordsCard());

  function standingsCard() {
    const cols = [
      { key: 'team', label: 'Team', firstDesc: false, sort: u => u.name.toLowerCase(), cell: nameCell },
      { key: 'rec', label: 'Record', align: 'r', sort: u => pct(u.w, u.l, u.t), cell: u => rec(u) },
      { key: 'pct', label: 'Win%', align: 'r', sort: u => pct(u.w, u.l, u.t), cell: u => (pct(u.w, u.l, u.t) * 100).toFixed(1) },
      { key: 'ppg', label: 'PF/G', align: 'r', sort: u => u.pf / (u.g || 1), cell: u => f1(u.pf / (u.g || 1)) },
      { key: 'pf', label: 'PF', align: 'r', sort: u => u.pf, cell: u => Math.round(u.pf).toLocaleString() },
      { key: 'titles', label: '🏆', title: 'Championships', align: 'r', sort: u => u.titles * 10 + u.finals, cell: u => String(u.titles) },
      { key: 'fin', label: 'Finals', align: 'r', sort: u => u.finals, cell: u => String(u.finals) },
      { key: 'avg', label: 'Avg fin.', title: 'Average finish, completed seasons', align: 'r', firstDesc: false,
        sort: u => { const f = done.map(s => u.seasons[s]?.finish).filter(Boolean); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 99; },
        cell: u => { const f = done.map(s => u.seasons[s]?.finish).filter(Boolean); return f.length ? (f.reduce((a, b) => a + b, 0) / f.length).toFixed(1) : '—'; } },
    ];
    return section('All-time standings', 'Every season in this league’s Sleeper history. Tap a header to sort.',
      sortableTable({ columns: cols, rows: at.users, sortKey: 'pct', stickyIndex: 0, rowClass: u => (u.userId === me ? 'mine' : '') }));
  }

  function finishGrid() {
    const N = at.users.length;
    const cols = [
      { key: 'team', label: 'Team', firstDesc: false, sort: u => u.name.toLowerCase(), cell: nameCell },
      ...at.seasonList.map(s => ({
        key: 's' + s, label: s === at.current ? s + '*' : s, align: 'cellc c', firstDesc: false,
        sort: u => { const x = u.seasons[s]; return x ? (x.finish ?? x.rank) : 99; },
        cell: u => {
          const x = u.seasons[s]; if (!x) return '—';
          const place = x.finish ?? x.rank;
          const c = heat(1 - (place - 1) / (N - 1));
          const el = h('span', { style: { display: 'block', background: c.bg, color: c.fg, borderRadius: '4px', padding: '6px 3px', minWidth: '44px', fontSize: '11.5px', fontWeight: 700, opacity: x.live ? 0.75 : 1 } },
            (x.finish === 1 ? '🏆 ' : '') + (x.live ? '#' + place : '#' + place));
          return attachTip(el, () => `<b>${esc(u.name)}</b><br><span class="mut">${s}${x.live ? ' (in progress)' : ''}</span><br>${x.live ? 'Current rank' : 'Finished'} <b>#${place}</b> · ${rec(x)}<br>${f1(x.pf)} PF`);
        },
      })),
    ];
    return section('Finish by season', `Final place from each season’s playoff bracket (non-playoff teams ranked by record, then points). *${at.current} shows the current standings rank. Tap a header to sort.`,
      sortableTable({ columns: cols, rows: at.users, sortKey: 's' + done[done.length - 1], desc: false, stickyIndex: 0, rowClass: u => (u.userId === me ? 'mine' : '') }));
  }

  function h2hCard() {
    const users = at.users.slice().sort((a, b) => pct(b.w, b.l, b.t) - pct(a.w, a.l, a.t));
    const head = h('tr', {}, h('th', { class: 'stick' }, ''), users.map(u => h('th', { class: 'c', style: { fontSize: '10px' } }, u.name.slice(0, 7))));
    const body = users.map(a => h('tr', { class: a.userId === me ? 'mine' : '' },
      h('td', { class: 'stick' }, nameCell(a)),
      users.map(b => {
        if (a === b) return h('td', { class: 'cellc c' }, h('span', { style: { color: '#5c6f86' } }, '—'));
        const r = a.h2h[b.userId] || { w: 0, l: 0, t: 0 };
        const c = heat(pct(r.w, r.l, r.t));
        const el = h('span', { style: { display: 'block', background: c.bg, color: c.fg, borderRadius: '4px', padding: '6px 2px', minWidth: '40px', fontSize: '11px', fontWeight: 700 } }, rec(r));
        return h('td', { class: 'cellc c' }, attachTip(el, () => `<b>${esc(a.name)}</b> vs <b>${esc(b.name)}</b><br>${rec(r)} all-time (${(pct(r.w, r.l, r.t) * 100).toFixed(0)}%)`));
      })));
    return section('Head-to-head', 'Row team’s all-time regular-season record against the column team. Teams ordered by all-time win %.',
      h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', {}, head), h('tbody', {}, body))));
  }

  function ppgCard() {
    const ppg = (u, s) => { const x = u.seasons[s]; return x && x.g ? x.pf / x.g : null; };
    const lg = s => { const v = at.users.map(u => ppg(u, s)).filter(x => x != null); return v.reduce((a, b) => a + b, 0) / v.length; };
    const cols = [
      { key: 'team', label: 'Team', firstDesc: false, sort: u => u.name.toLowerCase(), cell: nameCell },
      ...at.seasonList.map(s => ({
        key: 's' + s, label: s === at.current ? s + '*' : s, align: 'cellc c',
        sort: u => ppg(u, s) ?? 0,
        cell: u => {
          const v = ppg(u, s); if (v == null) return '—';
          const vals = at.users.map(x => ppg(x, s)).filter(x => x != null);
          const rank = vals.filter(x => x < v).length / Math.max(1, vals.length - 1);
          const c = heat(rank);
          const el = h('span', { style: { display: 'block', background: c.bg, color: c.fg, borderRadius: '4px', padding: '6px 3px', minWidth: '44px', fontSize: '11.5px', fontWeight: 700 } }, f1(v));
          return attachTip(el, () => `<b>${esc(u.name)}</b> · ${s}<br>${f1(v)} points per game<br><span class="mut">League average ${f1(lg(s))} (${v >= lg(s) ? '+' : '−'}${Math.abs(v - lg(s)).toFixed(1)})</span>`);
        },
      })),
    ];
    return section('Scoring by season', 'Points per game each season; shading ranks teams within a season (green = highest). Tap a header to sort.',
      sortableTable({ columns: cols, rows: at.users, sortKey: 's' + done[done.length - 1], stickyIndex: 0, rowClass: u => (u.userId === me ? 'mine' : '') }));
  }

  function recordsCard() {
    const rows = A.recordsBook(at);
    return section('Records book', 'Single-game and streak records across all seasons.',
      h('div', { class: 'matchups' }, rows.map(r => h('div', { class: 'mu', style: { display: 'block' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } }, h('span', { class: 'mut' }, r.k), h('b', {}, r.v)),
        h('div', {}, h('span', { class: r.who === ctx.byRid[ctx.meRid]?.name ? 'me' : '' }, r.who), h('span', { class: 'mut', style: { fontSize: '11px' } }, ' · ' + r.d))))));
  }
}
