import * as A from '../analytics.js';
import { h, f1, signed, section, sortableTable } from '../ui.js';
import { label, matchupList } from './common.js';

export function renderHome(ctx) {
  const weeks = ctx.completed;
  const last = weeks[weeks.length - 1];
  const sm = A.summary(ctx);
  const st = A.standings(ctx);
  const byRid = r => sm.find(x => x.rid === r);
  const leader = st[0];
  const topPf = sm.slice().sort((a, b) => b.pf - a.pf)[0];
  const lucky = sm.slice().sort((a, b) => b.luck - a.luck)[0];
  const unlucky = sm.slice().sort((a, b) => a.luck - b.luck)[0];
  let best = { pts: -1 };
  for (const w of weeks) for (const rid of ctx.rids) if (ctx.score[w][rid] > best.pts) best = { pts: ctx.score[w][rid], rid, week: w };

  const tile = (k, v, d) => h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), h('div', { class: 'd' }, d));
  const tiles = h('div', { class: 'tiles' },
    tile('League leader', label(ctx, leader.rid), A.fmtRec(leader)),
    tile('Most points', label(ctx, topPf.rid), `${f1(topPf.pf)} PF`),
    tile('Luckiest', label(ctx, lucky.rid), `${signed(lucky.luck)} wins vs. an average schedule`),
    tile('Unluckiest', label(ctx, unlucky.rid), `${signed(unlucky.luck)} wins vs. an average schedule`),
    tile('Top score', label(ctx, best.rid), `${f1(best.pts)} in Week ${best.week}`),
    tile('Weeks played', String(weeks.length), `Season ${ctx.data.league.season}`));

  const table = sortableTable({
    sortKey: 'rank', desc: false, stickyIndex: 1,
    rowClass: r => (r.rid === ctx.meRid ? 'mine' : ''),
    rows: st,
    columns: [
      { key: 'rank', label: '#', align: 'c', firstDesc: false, sort: r => r.rank, cell: r => r.rank },
      { key: 'team', label: 'Team', firstDesc: false, sort: r => ctx.name(r.rid).toLowerCase(), cell: r => label(ctx, r.rid) },
      { key: 'rec', label: 'Record', align: 'c', sort: r => A.winsOf(r) * 1000 + r.pf / 100, cell: r => A.fmtRec(r) },
      { key: 'pf', label: 'PF', align: 'r', sort: r => r.pf, cell: r => f1(r.pf) },
      { key: 'oth', label: 'vs all', align: 'c', title: 'Record against every other team’s schedule', sort: r => byRid(r.rid).winPctOthers, cell: r => A.fmtRec(byRid(r.rid).others) },
      { key: 'luck', label: 'Luck', align: 'r', title: 'Actual wins minus expected wins on an average schedule', sort: r => byRid(r.rid).luck, cell: r => signed(byRid(r.rid).luck) },
    ],
  });

  // Results: last completed week (and the in-progress week when it has started).
  const entries = ctx.data.weeks.filter(w => w.matchups.some(m => m.teams.some(t => t.pts > 0)));
  const wsel = h('select', { onchange: e => { holder.replaceChildren(matchupList(ctx, entries.find(x => x.week === +e.target.value))); } },
    entries.slice().reverse().map(e => h('option', { value: e.week }, `Week ${e.week}${e.complete ? '' : ' (in progress)'}`)));
  const first = entries[entries.length - 1];
  const holder = h('div', {}, first ? matchupList(ctx, first) : h('p', { class: 'note' }, 'No games yet.'));

  return h('div', {},
    tiles,
    section('Standings', `Through Week ${last}. Tap a column to sort. “vs all” is your record against every other team’s schedule.`, table),
    section('Results', 'Winner in bold. Scores for an in-progress week are live as of the last update.',
      h('div', { class: 'controls', style: { margin: '0 0 10px' } }, wsel), holder));
}
