import * as A from '../analytics.js';
import { h, f1, signed, attachTip, esc, heat, section, sortableTable } from '../ui.js';
import { label, labelHtml, weeksFor, weeksLabel } from './common.js';

export function renderSchedule(ctx, st) {
  const weeks = weeksFor(ctx, st);
  if (!weeks.length) return h('p', { class: 'note' }, 'No completed weeks in the selected range.');
  return h('div', {}, pivotSection(ctx, weeks), weeklySection(ctx, weeks), summarySection(ctx, weeks));
}

const span = (bg, fg, text, extra = {}) => h('span', { style: { display: 'block', background: bg, color: fg, borderRadius: '4px', padding: '5px 3px', minWidth: '40px', fontSize: '11px', fontWeight: 700, ...extra } }, text);

// ---- 14 x 14 pivot ----------------------------------------------------------------------------------
function pivotSection(ctx, weeks) {
  const order = A.standings(ctx, weeks).map(r => r.rid);
  const piv = A.pivot(ctx, weeks);
  const table = h('table', { class: 'grid' },
    h('thead', {}, h('tr', {}, h('th', {}), order.map(b => h('th', { class: 'colh' }, h('div', { class: b === ctx.meRid ? 'me' : '' }, ctx.name(b)))))),
    h('tbody', {}, order.map(a => h('tr', {},
      h('th', { class: 'rowh ' + (a === ctx.meRid ? 'me' : '') }, ctx.name(a)),
      order.map(b => {
        const r = piv[a][b]; const games = r.w + r.l + r.t;
        const c = heat(A.winsOf(r) / games);
        const td = h('td', { class: a === b ? 'diag' : '', style: { background: c.bg, color: c.fg } }, A.fmtRec(r));
        return attachTip(td, () => {
          const head = a === b
            ? `${labelHtml(ctx, a)} · <b>actual record</b> <b>${A.fmtRec(r)}</b>`
            : `${labelHtml(ctx, a)} scored against ${labelHtml(ctx, b)}’s schedule: <b>${A.fmtRec(r)}</b>`;
          const rows = r.games.map(g => `<tr><td class="mut">W${g.week}</td><td>${esc(ctx.name(g.opp))}</td><td>${f1(g.myPts)}–${f1(g.oppPts)}</td><td class="${g.result}"><b>${g.result.toUpperCase()}</b></td></tr>`).join('');
          return `${head}<table>${rows}</table>`;
        });
      })))));
  return section('Record against every schedule',
    `${weeksLabel(weeks)}. Each row is a team’s scores replayed against the column team’s opponents. The outlined diagonal is the real record. Tap a cell to see the week-by-week games, and swipe sideways to see every team.`,
    h('div', { class: 'tablewrap' }, table),
    h('p', { class: 'note' }, 'In the week team B actually played team A, A would face itself, so that week uses A’s real head-to-head result against B.'));
}

// ---- Record against all teams, by week --------------------------------------------------------------
function weeklySection(ctx, weeks) {
  const wva = A.weeklyVsAll(ctx, weeks);
  const N = ctx.rids.length;
  const rows = ctx.rids.map(rid => ({ rid }));
  const cols = [
    { key: 'team', label: 'Team', firstDesc: false, sort: r => ctx.name(r.rid).toLowerCase(), cell: r => label(ctx, r.rid) },
    ...weeks.map(w => ({
      key: 'w' + w, label: 'W' + w, align: 'cellc c', sort: r => A.winsOf(wva[r.rid].weeks[w]),
      cell: r => {
        const rec = wva[r.rid].weeks[w]; const c = heat(A.winsOf(rec) / (N - 1));
        return attachTip(span(c.bg, c.fg, A.fmtRec(rec)), () => `${labelHtml(ctx, r.rid)}<br><span class="mut">Week ${w}</span><br>Would have beaten <b>${rec.w}</b> of ${N - 1} teams (${f1(ctx.score[w][r.rid])} pts)`);
      },
    })),
    { key: 'total', label: 'Total', align: 'r', sort: r => A.winsOf(wva[r.rid].total), cell: r => A.fmtRec(wva[r.rid].total) },
    { key: 'pct', label: 'Win %', align: 'r', sort: r => A.winsOf(wva[r.rid].total) / (wva[r.rid].total.w + wva[r.rid].total.l + wva[r.rid].total.t), cell: r => (100 * A.winsOf(wva[r.rid].total) / (wva[r.rid].total.w + wva[r.rid].total.l + wva[r.rid].total.t)).toFixed(0) + '%' },
  ];
  return section('Record against all teams, by week',
    'How each week’s score would have fared against every other team’s score that week. Tap a header to sort.',
    sortableTable({ columns: cols, rows, sortKey: 'total', stickyIndex: 0, rowClass: r => (r.rid === ctx.meRid ? 'mine' : '') }));
}

// ---- Summary ----------------------------------------------------------------------------------------------
function summarySection(ctx, weeks) {
  const holder = h('div', {});
  let mode = 'all';
  const rankOwn = Object.fromEntries(A.standings(ctx, weeks).map(r => [r.rid, r.rank]));
  function draw() {
    const rows = A.summary(ctx, weeks, mode);
    holder.replaceChildren(sortableTable({
      sortKey: 'rank', desc: false, stickyIndex: 1, rows, rowClass: r => (r.rid === ctx.meRid ? 'mine' : ''),
      columns: [
        { key: 'rank', label: '#', align: 'c', firstDesc: false, sort: r => rankOwn[r.rid], cell: r => rankOwn[r.rid] },
        { key: 'team', label: 'Team', firstDesc: false, sort: r => ctx.name(r.rid).toLowerCase(), cell: r => label(ctx, r.rid) },
        { key: 'rec', label: 'Record', align: 'c', sort: r => A.winsOf(r.own) * 1000 + r.pf / 100, cell: r => A.fmtRec(r.own) },
        { key: 'pf', label: 'PF', align: 'r', sort: r => r.pf, cell: r => f1(r.pf) },
        { key: 'pfr', label: 'PF rk', align: 'c', firstDesc: false, sort: r => r.pfRank, cell: r => r.pfRank },
        { key: 'oth', label: 'vs others', align: 'c', sort: r => r.winPctOthers, cell: r => A.fmtRec(r.others) },
        { key: 'med', label: 'vs median', align: 'c', sort: r => A.winsOf(r.median), cell: r => A.fmtRec(r.median) },
        { key: 'exp', label: 'Exp W', align: 'r', title: 'Wins expected on an average schedule', sort: r => r.expectedWins, cell: r => r.expectedWins.toFixed(1) },
        { key: 'luck', label: 'Luck', align: 'r', title: 'Actual wins minus expected wins (green = lucky)', sort: r => r.luck,
          cell: r => h('span', { style: { color: r.luck > 0.5 ? '#7fd1a0' : r.luck < -0.5 ? '#f4b183' : '#9fb0c3' } }, signed(r.luck)) },
      ],
    }));
  }
  draw();
  const sel = h('select', { onchange: e => { mode = e.target.value; draw(); } },
    h('option', { value: 'all' }, 'All starters'),
    ...(ctx.pos.includes('DEF') ? [h('option', { value: 'noDEF' }, 'Without defenses')] : []),
    ...(ctx.pos.includes('K') ? [h('option', { value: 'noKDEF' }, 'Without kickers & defenses')] : []));
  return section('Summary and schedule luck',
    'Luck = actual wins minus the wins a team’s scoring would earn on an average schedule. “vs others” is the combined record against all other teams’ schedules; “vs median” is the record against the league median each week.',
    h('div', { class: 'controls', style: { margin: '0 0 10px' } }, 'PF counts', sel), holder);
}
