// Pure analytics over site/data/league.json. Runs unchanged in the browser and in Node (tests).
// "weeks" arguments are arrays of completed week numbers; default is every completed week.

export const POS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

export function prepare(data) {
  const teams = data.teams.map(t => ({ ...t }));
  const byRid = Object.fromEntries(teams.map(t => [t.rosterId, t]));
  const completed = data.weeks.filter(w => w.complete).map(w => w.week).sort((a, b) => a - b);
  const score = {}, opp = {}, starters = {}, matchupOf = {};
  for (const wk of data.weeks) {
    if (!wk.complete) continue;
    const w = wk.week;
    score[w] = {}; opp[w] = {}; starters[w] = {}; matchupOf[w] = {};
    for (const m of wk.matchups) {
      for (const t of m.teams) {
        score[w][t.rid] = t.pts;
        starters[w][t.rid] = t.starters;
        matchupOf[w][t.rid] = m.id;
      }
      if (m.teams.length === 2) {
        opp[w][m.teams[0].rid] = m.teams[1].rid;
        opp[w][m.teams[1].rid] = m.teams[0].rid;
      }
    }
  }
  const present = new Set(Object.values(data.players || {}).map(p => p.p));
  const pos = POS.filter(p => present.has(p));
  return {
    pos, data, teams, byRid, rids: teams.map(t => t.rosterId), completed, score, opp, starters, matchupOf,
    players: data.players, meRid: null,
    name: rid => byRid[rid].name,
  };
}

export const allWeeks = ctx => ctx.completed.slice();
export const weekRange = (ctx, from, to) => ctx.completed.filter(w => w >= from && w <= to);

const cmp = (x, y) => (x > y ? 'w' : x < y ? 'l' : 't');
const rec = () => ({ w: 0, l: 0, t: 0 });
const add = (r, k) => { r[k]++; return r; };
const addRec = (r, o) => { r.w += o.w; r.l += o.l; r.t += o.t; return r; };
export const winsOf = r => r.w + 0.5 * r.t;
export const fmtRec = r => `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`;

export function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// ---- Standings -------------------------------------------------------------------------
export function standings(ctx, weeks = ctx.completed) {
  const rows = {};
  for (const rid of ctx.rids) rows[rid] = { rid, ...rec(), pf: 0, pa: 0, games: 0 };
  for (const w of weeks) {
    for (const rid of ctx.rids) {
      const o = ctx.opp[w]?.[rid];
      if (o == null) continue;
      const r = rows[rid];
      add(r, cmp(ctx.score[w][rid], ctx.score[w][o]));
      r.pf += ctx.score[w][rid]; r.pa += ctx.score[w][o]; r.games++;
    }
  }
  const list = Object.values(rows).sort((a, b) => winsOf(b) - winsOf(a) || b.pf - a.pf);
  list.forEach((r, i) => { r.rank = i + 1; });
  return list;
}

// Rank after each completed week (by record, then PF), for the History chart.
export function rankHistory(ctx) {
  const out = {};
  for (const rid of ctx.rids) out[rid] = [];
  ctx.completed.forEach((w, i) => {
    const upto = ctx.completed.slice(0, i + 1);
    for (const r of standings(ctx, upto)) out[r.rid].push({ week: w, rank: r.rank, w: r.w, l: r.l, t: r.t, pf: r.pf });
  });
  return out;
}

// ---- Schedule analysis -----------------------------------------------------------------
// Team a's scores against team b's schedule. In the week b actually played a, a would face
// itself, so that week uses a's real head-to-head result vs b. When a === b this is the actual record.
export function vsSchedule(ctx, a, b, weeks = ctx.completed) {
  const r = rec(); const games = [];
  for (const w of weeks) {
    let o = ctx.opp[w]?.[b];
    if (o == null) continue;
    if (o === a) o = b;
    if (a === b) o = ctx.opp[w][a];
    const res = cmp(ctx.score[w][a], ctx.score[w][o]);
    add(r, res);
    games.push({ week: w, opp: o, myPts: ctx.score[w][a], oppPts: ctx.score[w][o], result: res });
  }
  return { ...r, games };
}

export function pivot(ctx, weeks = ctx.completed) {
  const m = {};
  for (const a of ctx.rids) { m[a] = {}; for (const b of ctx.rids) m[a][b] = vsSchedule(ctx, a, b, weeks); }
  return m;
}

// Each week: how many of the other teams a team's score would have beaten.
export function weeklyVsAll(ctx, weeks = ctx.completed) {
  const out = {};
  for (const a of ctx.rids) {
    out[a] = { weeks: {}, total: rec() };
    for (const w of weeks) {
      const r = rec();
      for (const b of ctx.rids) if (b !== a) add(r, cmp(ctx.score[w][a], ctx.score[w][b]));
      out[a].weeks[w] = r; addRec(out[a].total, r);
    }
  }
  return out;
}

export function medianRecords(ctx, weeks = ctx.completed) {
  const med = {}; for (const w of weeks) med[w] = median(Object.values(ctx.score[w]));
  const out = {};
  for (const a of ctx.rids) {
    const r = rec();
    for (const w of weeks) add(r, cmp(ctx.score[w][a], med[w]));
    out[a] = r;
  }
  return { byTeam: out, medians: med };
}

export function pfBy(ctx, weeks = ctx.completed, mode = 'all') {
  const skip = mode === 'noDEF' ? ['DEF'] : mode === 'noKDEF' ? ['DEF', 'K'] : [];
  const out = {};
  for (const rid of ctx.rids) {
    let t = 0;
    for (const w of weeks) for (const s of ctx.starters[w][rid] || []) {
      if (!skip.includes(ctx.players[s.id]?.p)) t += s.pts;
    }
    out[rid] = t;
  }
  return out;
}

export function summary(ctx, weeks = ctx.completed, pfMode = 'all') {
  const st = Object.fromEntries(standings(ctx, weeks).map(r => [r.rid, r]));
  const piv = pivot(ctx, weeks);
  const med = medianRecords(ctx, weeks).byTeam;
  const pf = pfBy(ctx, weeks, pfMode);
  const pfRank = Object.fromEntries(Object.entries(pf).sort((a, b) => b[1] - a[1]).map(([rid], i) => [rid, i + 1]));
  const n = ctx.rids.length;
  return ctx.rids.map(rid => {
    const own = { w: st[rid].w, l: st[rid].l, t: st[rid].t };
    const others = rec();
    for (const b of ctx.rids) if (b !== rid) addRec(others, piv[rid][b]);
    const expected = winsOf(others) / (n - 1);
    return {
      rid, own, others, median: med[rid], pf: pf[rid], pfRank: pfRank[rid],
      expectedWins: expected, luck: winsOf(own) - expected,
      winPctOthers: winsOf(others) / (others.w + others.l + others.t || 1),
    };
  });
}

// ---- Roster analysis -------------------------------------------------------------------
export function playerTotals(ctx, weeks = ctx.completed) {
  const out = {};
  for (const rid of ctx.rids) {
    const m = {};
    for (const w of weeks) for (const s of ctx.starters[w][rid] || []) {
      const p = ctx.players[s.id] || { n: s.id, p: '?' };
      const e = m[s.id] || (m[s.id] = { id: s.id, name: p.n, pos: p.p, team: p.t, pts: 0, gp: 0 });
      e.pts += s.pts; e.gp++;
    }
    out[rid] = Object.values(m).sort((a, b) => b.pts - a.pts);
  }
  return out;
}

function gini(xs) {
  const v = xs.filter(x => x > 0).sort((a, b) => a - b);
  const n = v.length, s = v.reduce((a, b) => a + b, 0);
  if (n < 2 || !s) return 0;
  return (2 * v.reduce((acc, x, i) => acc + (i + 1) * x, 0)) / (n * s) - (n + 1) / n;
}

export function concentration(ctx, weeks = ctx.completed) {
  const pt = playerTotals(ctx, weeks);
  const out = {};
  for (const rid of ctx.rids) {
    const ps = pt[rid]; const total = ps.reduce((a, p) => a + p.pts, 0) || 1;
    const sum = (a, b) => ps.slice(a, b).reduce((x, p) => x + p.pts, 0) / total;
    let cum = 0;
    out[rid] = {
      total, players: ps, n: ps.length,
      top1: sum(0, 1), top23: sum(1, 3), top45: sum(3, 5), rest: 1 - sum(0, 5), top3: sum(0, 3),
      eff: 1 / ps.reduce((a, p) => a + (p.pts / total) ** 2, 0),
      gini: gini(ps.map(p => p.pts)),
      curve: ps.map(p => (cum += p.pts, cum / total)),
    };
  }
  return out;
}

export function dependency(ctx, weeks = ctx.completed) {
  const pt = playerTotals(ctx, weeks);
  const pf = Object.fromEntries(ctx.rids.map(r => [r, pt[r].reduce((a, p) => a + p.pts, 0)]));
  const oldRank = Object.fromEntries(Object.entries(pf).sort((a, b) => b[1] - a[1]).map(([r], i) => [r, i + 1]));
  return ctx.rids.map(rid => {
    const top = pt[rid][0]; const without = pf[rid] - (top ? top.pts : 0);
    const newRank = 1 + ctx.rids.filter(o => o !== rid && pf[o] > without).length;
    return { rid, top, pf: pf[rid], without, lostPct: top ? top.pts / pf[rid] : 0, oldRank: oldRank[rid], newRank };
  });
}

export function positionMix(ctx, weeks = ctx.completed) {
  const pt = playerTotals(ctx, weeks); const by = {};
  for (const rid of ctx.rids) {
    by[rid] = Object.fromEntries(ctx.pos.map(p => [p, 0]));
    for (const p of pt[rid]) if (p.pos in by[rid]) by[rid][p.pos] += p.pts;
  }
  const avg = Object.fromEntries(ctx.pos.map(p => [p, ctx.rids.reduce((a, r) => a + by[r][p], 0) / ctx.rids.length]));
  return { by, avg, total: rid => ctx.pos.reduce((a, p) => a + by[rid][p], 0), avgTotal: ctx.pos.reduce((a, p) => a + avg[p], 0) };
}

export function positionDelta(ctx, weeks = ctx.completed) {
  const pm = positionMix(ctx, weeks);
  const sd = {};
  for (const p of ctx.pos) {
    const xs = ctx.rids.map(r => pm.by[r][p]); const mu = pm.avg[p];
    sd[p] = Math.sqrt(xs.reduce((a, x) => a + (x - mu) ** 2, 0) / xs.length) || 1;
  }
  const out = {};
  for (const rid of ctx.rids) {
    out[rid] = Object.fromEntries(ctx.pos.map(p => [p, { delta: pm.by[rid][p] - pm.avg[p], z: (pm.by[rid][p] - pm.avg[p]) / sd[p] }]));
    out[rid].total = pm.total(rid) - pm.avgTotal;
  }
  return out;
}

// ---- All-time (past seasons from Sleeper's league chain + completed weeks of the current season) ----
// Teams are matched across seasons by Sleeper user id. Games are regular season only.
export function allTime(ctx) {
  const d = ctx.data, past = d.seasons || [], cur = d.league.season;
  const users = {};
  const U = (id, name) => users[id] || (users[id] = { userId: id, name, seasons: {}, w: 0, l: 0, t: 0, pf: 0, pa: 0, g: 0, titles: 0, finals: 0, h2h: {} });
  for (const t of ctx.teams) U(t.userId, t.name);
  const games = [];
  for (const s of past) {
    for (const t of s.teams) {
      const u = U(t.userId, t.name);
      u.seasons[s.season] = { finish: t.finish, w: t.w, l: t.l, t: t.t, pf: t.pf, pa: t.pa, g: t.w + t.l + t.t };
      if (t.finish === 1) u.titles++;
      if (t.finish <= 2) u.finals++;
    }
    for (const [wk, a, pa, b, pb] of s.games) games.push({ season: s.season, week: wk, a, pa, b, pb });
  }
  const st = standings(ctx);
  for (const r of st) {
    const t = ctx.byRid[r.rid], u = users[t.userId];
    u.seasons[cur] = { finish: null, rank: r.rank, w: r.w, l: r.l, t: r.t, pf: r.pf, pa: r.pa, g: r.games, live: true };
  }
  for (const w of ctx.completed) for (const [id, m] of Object.entries(ctx.opp[w])) {
    if (+id < m) games.push({ season: cur, week: w, a: ctx.byRid[id].userId, pa: ctx.score[w][id], b: ctx.byRid[m].userId, pb: ctx.score[w][m] });
  }
  for (const u of Object.values(users)) for (const s of Object.values(u.seasons)) {
    u.w += s.w; u.l += s.l; u.t += s.t; u.pf += s.pf; u.pa += s.pa; u.g += s.g;
  }
  for (const g of games) {
    const r = g.pa > g.pb ? 'w' : g.pa < g.pb ? 'l' : 't', r2 = r === 'w' ? 'l' : r === 'l' ? 'w' : 't';
    const A_ = users[g.a], B_ = users[g.b];
    if (!A_ || !B_) continue;
    (A_.h2h[g.b] ||= { w: 0, l: 0, t: 0 })[r]++;
    (B_.h2h[g.a] ||= { w: 0, l: 0, t: 0 })[r2]++;
  }
  const seasonList = [...past.map(s => s.season), cur];
  return { users: Object.values(users), seasonList, games, current: cur };
}

export function recordsBook(at) {
  const nm = id => at.users.find(u => u.userId === id)?.name || id;
  const rows = [];
  const hi = at.games.flatMap(g => [{ ...g, who: g.a, pts: g.pa, opp: g.b, oppPts: g.pb }, { ...g, who: g.b, pts: g.pb, opp: g.a, oppPts: g.pa }]);
  const by = (f, dir) => hi.slice().sort((x, y) => dir * (f(x) - f(y)))[0];
  const hiScore = by(x => x.pts, -1), loScore = by(x => x.pts, 1);
  const blow = by(x => x.pts - x.oppPts, -1);
  const close = hi.filter(x => x.pts > x.oppPts).sort((x, y) => (x.pts - x.oppPts) - (y.pts - y.oppPts))[0];
  const lostBig = hi.filter(x => x.pts < x.oppPts).sort((x, y) => y.pts - x.pts)[0];
  const f = x => `${x.season} Wk ${x.week}`;
  rows.push({ k: 'Highest score', v: hiScore.pts.toFixed(1), who: nm(hiScore.who), d: `vs ${nm(hiScore.opp)} (${hiScore.oppPts.toFixed(1)}) · ${f(hiScore)}` });
  rows.push({ k: 'Lowest score', v: loScore.pts.toFixed(1), who: nm(loScore.who), d: `vs ${nm(loScore.opp)} (${loScore.oppPts.toFixed(1)}) · ${f(loScore)}` });
  rows.push({ k: 'Biggest blowout', v: '+' + (blow.pts - blow.oppPts).toFixed(1), who: nm(blow.who), d: `${blow.pts.toFixed(1)}–${blow.oppPts.toFixed(1)} vs ${nm(blow.opp)} · ${f(blow)}` });
  rows.push({ k: 'Closest win', v: '+' + (close.pts - close.oppPts).toFixed(2), who: nm(close.who), d: `${close.pts.toFixed(1)}–${close.oppPts.toFixed(1)} vs ${nm(close.opp)} · ${f(close)}` });
  rows.push({ k: 'Most points in a loss', v: lostBig.pts.toFixed(1), who: nm(lostBig.who), d: `lost to ${nm(lostBig.opp)} (${lostBig.oppPts.toFixed(1)}) · ${f(lostBig)}` });
  // longest win streak across seasons
  const order = at.games.slice().sort((a, b) => a.season - b.season || a.week - b.week);
  let best = { n: 0 };
  for (const u of at.users) {
    let n = 0, start = null;
    for (const g of order) {
      if (g.a !== u.userId && g.b !== u.userId) continue;
      const won = g.a === u.userId ? g.pa > g.pb : g.pb > g.pa;
      if (won) { if (!n) start = g; n++; if (n > best.n) best = { n, who: u.userId, start, end: g }; } else n = 0;
    }
  }
  if (best.n) rows.push({ k: 'Longest win streak', v: best.n + ' games', who: nm(best.who), d: `${f(best.start)} to ${f(best.end)}` });
  return rows;
}
