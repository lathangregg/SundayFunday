// Sanity checks for the data and analytics. Run with: node tests/verify.mjs
// 1) Internal consistency (always runs): the pivot diagonal must equal Sleeper's official records.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from '../site/js/analytics.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'site/data/league.json'), 'utf8'));
const ctx = A.prepare(data);
let failed = 0, passed = 0;
const ok = (cond, msg) => { cond ? passed++ : (failed++, console.error('FAIL:', msg)); };
const close = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b}`);
const rid = name => ctx.teams.find(t => t.name === name)?.rosterId;
const N = ctx.rids.length;

// ---- 1. consistency -----------------------------------------------------------------------
const piv = A.pivot(ctx);
for (const t of ctx.teams) {
  const d = piv[t.rosterId][t.rosterId];
  ok(d.w === t.official.w && d.l === t.official.l && d.t === t.official.t,
    `${t.name}: pivot diagonal ${A.fmtRec(d)} != Sleeper ${t.official.w}-${t.official.l}`);
}
const wva = A.weeklyVsAll(ctx);
for (const t of ctx.teams) for (const w of ctx.completed) {
  const r = wva[t.rosterId].weeks[w];
  ok(r.w + r.l + r.t === N - 1, `${t.name} week ${w}: weekly record does not cover ${N - 1} opponents`);
}
for (const w of ctx.completed) {
  const wins = ctx.rids.reduce((a, r) => a + wva[r].weeks[w].w, 0);
  const losses = ctx.rids.reduce((a, r) => a + wva[r].weeks[w].l, 0);
  ok(wins === losses, `week ${w}: league wins (${wins}) != losses (${losses})`);
}
for (const a of ctx.rids) for (const b of ctx.rids) {
  const r = piv[a][b];
  ok(r.w + r.l + r.t === ctx.completed.length, `pivot ${a}/${b}: games != completed weeks`);
}

console.log(`${passed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
