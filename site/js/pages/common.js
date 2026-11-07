import * as A from '../analytics.js';
import { h, esc, f1 } from '../ui.js';

export const label = (ctx, rid) => h('span', { class: rid === ctx.meRid ? 'me' : '' }, ctx.name(rid));
export const labelHtml = (ctx, rid) => (rid === ctx.meRid ? `<b style="color:#ffd54a">${esc(ctx.name(rid))}</b>` : `<b>${esc(ctx.name(rid))}</b>`);

// Weeks selected by the Data-page range control (defaults to every completed week).
export function weeksFor(ctx, st) {
  const first = ctx.completed[0], last = ctx.completed[ctx.completed.length - 1];
  return A.weekRange(ctx, st.from ?? first, st.to ?? last);
}
export const weeksLabel = weeks => (weeks.length === 0 ? 'no completed weeks' : weeks.length === 1 ? `Week ${weeks[0]}` : `Weeks ${weeks[0]}–${weeks[weeks.length - 1]}`);

// One week's matchups as a list of cards; winner in bold.
export function matchupList(ctx, entry) {
  const teams = new Map(ctx.teams.map(t => [t.rosterId, t]));
  return h('div', { class: 'matchups' }, entry.matchups.filter(m => m.teams.length === 2).map(m => {
    const [a, b] = m.teams.slice().sort((x, y) => y.pts - x.pts);
    const done = entry.complete;
    const row = (t, win) => [
      h('span', { class: (win && done ? 'win ' : done ? 'lose ' : '') + (t.rid === ctx.meRid ? 'me' : '') }, teams.get(t.rid).name),
      h('span', { class: 'pts ' + (win && done ? 'win' : done ? 'lose' : '') }, f1(t.pts)),
    ];
    return h('div', { class: 'mu' }, row(a, true), row(b, false));
  }));
}

export function gamesTable(ctx, games, aRid) {
  if (!games.length) return h('p', { class: 'note' }, 'No games in the selected range.');
  return h('table', {}, h('thead', {}, h('tr', {}, ['Wk', 'Faced', 'Score', ''].map(x => h('th', {}, x)))),
    h('tbody', {}, games.map(g => h('tr', {},
      h('td', {}, g.week), h('td', {}, ctx.name(g.opp)),
      h('td', {}, `${f1(g.myPts)} – ${f1(g.oppPts)}`),
      h('td', { class: g.result }, g.result === 'w' ? 'W' : g.result === 'l' ? 'L' : 'T')))));
}
