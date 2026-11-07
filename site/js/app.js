import * as A from './analytics.js';
import { h, hideTip } from './ui.js';
import { renderHome } from './pages/home.js';
import { renderHistory } from './pages/history.js';
import { renderAllTime } from './pages/alltime.js';
import { renderSchedule } from './pages/schedule.js';
import { renderRoster } from './pages/roster.js';

const app = document.getElementById('app');
const state = { from: null, to: null };
let ctx = null;

function rangeControls() {
  const ws = ctx.completed;
  const from = state.from ?? ws[0], to = state.to ?? ws[ws.length - 1];
  const sel = (value, onchange) => h('select', { onchange },
    ws.map(w => h('option', { value: w, selected: w === value ? true : null }, `Week ${w}`)));
  return h('div', { class: 'controls' },
    'Weeks',
    sel(from, e => { state.from = +e.target.value; if (state.to != null && state.to < state.from) state.to = state.from; route(true); }),
    'to',
    sel(to, e => { state.to = +e.target.value; if (state.from != null && state.from > state.to) state.from = state.to; route(true); }),
    h('button', { class: 'btn', onclick: () => { state.from = state.to = null; route(true); } }, 'All'));
}

function route(keepScroll = false) {
  hideTip();
  const y = window.scrollY;
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const page = parts[0] || 'home';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === page));
  let view;
  try {
    if (page === 'history') {
      const hasPast = (ctx.data.seasons || []).length > 0;
      const sub = hasPast && parts[1] === 'alltime' ? 'alltime' : 'season';
      view = h('div', {}, h('h1', {}, 'History'),
        hasPast ? h('nav', { class: 'sub' },
          h('a', { href: '#/history', class: sub === 'season' ? 'on' : '' }, 'Season'),
          h('a', { href: '#/history/alltime', class: sub === 'alltime' ? 'on' : '' }, 'All-time')) : null,
        sub === 'alltime' ? renderAllTime(ctx) : renderHistory(ctx));
    }
    else if (page === 'data') {
      const sub = parts[1] === 'roster' ? 'roster' : 'schedule';
      view = h('div', {},
        h('h1', {}, 'Data'),
        h('nav', { class: 'sub' },
          h('a', { href: '#/data/schedule', class: sub === 'schedule' ? 'on' : '' }, 'Schedule analysis'),
          h('a', { href: '#/data/roster', class: sub === 'roster' ? 'on' : '' }, 'Roster analysis')),
        rangeControls(),
        sub === 'schedule' ? renderSchedule(ctx, state) : renderRoster(ctx, state));
    } else view = h('div', {}, renderHome(ctx));
  } catch (e) {
    console.error(e);
    view = h('div', { class: 'err' }, 'Something went wrong drawing this page: ' + e.message);
  }
  app.replaceChildren(view);
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}

async function main() {
  try {
    const res = await fetch('data/league.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('league.json ' + res.status);
    const data = await res.json();
    ctx = A.prepare(data);
    document.getElementById('league-name').textContent = data.league.name;
    document.title = data.league.name;
    const last = ctx.completed[ctx.completed.length - 1];
    const when = new Date(data.generatedAt).toLocaleString([], { month: 'short', day: 'numeric' });
    document.getElementById('updated').textContent = `Wk ${last ?? 0} · ${when}`;
    window.addEventListener('hashchange', () => route());
    route();
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('div', { class: 'err' }, 'Could not load league data. ' + e.message));
  }
}
main();
