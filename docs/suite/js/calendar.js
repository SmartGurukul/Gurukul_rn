// Calendar view: month grid + agenda of holidays, events (with RSVP), online classes and exams,
// and the timetable of the selected day. Route: #/calendar (today) or #/calendar/YYYY-MM-DD.
import * as api from './api.js';
import { h, clear, fmtDate, fmtTime, ymd, DAYS, spinner, empty, errorBox } from './ui.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RSVP = [['GOING', 'Going'], ['MAYBE', 'Maybe'], ['NOT_GOING', "Can't go"]];

// ---- date helpers (local time, 'YYYY-MM-DD' strings) -------------------------------------------
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
const isoDay = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : ymd(d); };
const fmtHm = (t) => { // 'HH:mm' → '9:05 am'
  if (!t) return '';
  const [hh, mm] = t.split(':').map(Number);
  if (Number.isNaN(hh)) return t;
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
};

export async function mount(root, ctx, host) {
  const s = ctx.schoolId;
  const role = ctx.role;
  const today = ymd(new Date());
  const st = {
    dead: false,
    mode: 'month', // 'month' | 'agenda'
    year: 0, month: 0, // visible month
    selected: today,
    holidays: new Map(), // date → [holiday]
    loadedMonths: new Set(), // 'YYYY-MM' keys of holidays already fetched
    holidayErr: null, holidayBusy: false,
    events: [], eventsErr: null, eventsBusy: true,
    calls: [], // normalised {id, title, at, date, link, status, hosted}
    exams: [], examsSection: null,
    tt: new Map(), // `${childId}|${date}` → {data} | {err} | {busy}
    ttHidden: role === 'DRIVER',
    children: [], childId: null,
    rsvpBusy: new Set(),
  };
  { const d = parse(today); st.year = d.getFullYear(); st.month = d.getMonth(); }

  // ---- shell ---------------------------------------------------------------------------------------
  const title = h('h2', {});
  const childSel = h('select', { class: 'cal-child', hidden: true, onChange: (e) => { st.childId = e.target.value || null; st.exams = []; st.examsSection = null; paintAll(); loadTimetable(st.selected); } });
  const tabs = h('div', { class: 'tabs cal-tabs', role: 'tablist' },
    ...[['month', 'Month'], ['agenda', 'Agenda']].map(([m, label]) =>
      h('button', { type: 'button', role: 'tab', dataset: { mode: m }, onClick: () => setMode(m) }, label)));
  const head = h('div', { class: 'cal-head' },
    h('div', { class: 'cal-nav' },
      h('button', { class: 'btn small', type: 'button', 'aria-label': 'Previous month', onClick: () => shiftMonth(-1) }, '‹'),
      h('button', { class: 'btn small', type: 'button', onClick: () => select(today, true) }, 'Today'),
      h('button', { class: 'btn small', type: 'button', 'aria-label': 'Next month', onClick: () => shiftMonth(1) }, '›')),
    title, childSel, tabs);
  const gridHost = h('div', { class: 'cal-month' });
  const dayHost = h('section', { class: 'card cal-daycard', 'aria-live': 'polite' });
  const agendaHost = h('div', { class: 'cal-agenda', hidden: true });
  const body = h('div', { class: 'grid-2' }, gridHost, dayHost);
  root.append(h('div', { class: 'section-pad' }, head, body, agendaHost));

  const onSearch = () => { if (st.mode === 'agenda') paintAgenda(); };
  document.getElementById('search')?.addEventListener('input', onSearch);

  // ---- data ------------------------------------------------------------------------------------------
  function itemsOn(date) {
    return {
      holidays: st.holidays.get(date) || [],
      events: st.events.filter((e) => e.eventDate === date),
      calls: st.calls.filter((c) => c.date === date),
      exams: st.exams.filter((x) => x.assessmentDate === date),
    };
  }

  async function loadHolidays(year, month) {
    const months = [-1, 0, 1].map((k) => new Date(year, month + k, 1)).filter((d) => !st.loadedMonths.has(monthKey(d.getFullYear(), d.getMonth())));
    if (!months.length) return;
    const first = months[0], last = months[months.length - 1];
    const from = ymd(first), to = ymd(new Date(last.getFullYear(), last.getMonth() + 1, 0));
    st.holidayBusy = true; st.holidayErr = null;
    try {
      const list = await api.listHolidays(s, from, to);
      if (st.dead) return;
      months.forEach((d) => st.loadedMonths.add(monthKey(d.getFullYear(), d.getMonth())));
      for (const hd of list || []) {
        if (!hd?.date) continue;
        const arr = st.holidays.get(hd.date) || [];
        if (!arr.some((x) => x.id === hd.id)) arr.push(hd);
        st.holidays.set(hd.date, arr);
      }
    } catch (e) {
      if (st.dead) return;
      st.holidayErr = e;
    }
    st.holidayBusy = false;
    paintAll();
  }

  async function loadEvents() {
    st.eventsBusy = true; st.eventsErr = null;
    try {
      st.events = (await api.listEvents(s)) || [];
    } catch (e) {
      st.eventsErr = e;
    }
    if (st.dead) return;
    st.eventsBusy = false;
    paintAll();
  }

  async function loadCalls() {
    const [hosted, invited] = await Promise.all([
      api.listHostedCalls(s).catch(() => []),
      api.listInvitedCalls(s).catch(() => []),
    ]);
    if (st.dead) return;
    const out = [];
    for (const c of hosted || []) {
      const link = c.provider === 'GOOGLE_MEET' ? c.roomName : (c.roomName ? `https://meet.jit.si/${c.roomName}` : null);
      out.push({ id: c.id, title: c.title, at: c.scheduledAt, date: isoDay(c.scheduledAt), link, status: c.status, hosted: true });
    }
    for (const c of invited || []) {
      if (out.some((x) => x.id === c.scheduledCallId)) continue;
      out.push({ id: c.scheduledCallId, title: c.title, at: c.scheduledAt, date: isoDay(c.scheduledAt), link: null, status: c.status, hosted: false, rsvp: c.myRsvpStatus });
    }
    st.calls = out.filter((c) => c.date).sort((a, b) => a.at.localeCompare(b.at));
    paintAll();
  }

  async function loadChildren() {
    if (role !== 'PARENT') return;
    try {
      const kids = (await api.myChildren(s)) || [];
      if (st.dead || kids.length < 2) return;
      st.children = kids.map((c) => ({ id: c.studentId || c.id, name: c.name || c.studentName || 'Child' }));
      st.childId = st.children[0].id;
      clear(childSel).append(...st.children.map((c) => h('option', { value: c.id }, c.name)));
      childSel.hidden = false;
    } catch { /* single child or no access: timetable without childId */ }
  }

  function ttKey(date) { return `${st.childId || ''}|${date}`; }

  async function loadTimetable(date) {
    if (st.ttHidden) return;
    const key = ttKey(date);
    if (st.tt.has(key)) return;
    st.tt.set(key, { busy: true });
    try {
      const data = await api.myTimetable(s, date, st.childId);
      if (st.dead) return;
      st.tt.set(key, { data });
      loadExams(data);
    } catch (e) {
      if (st.dead) return;
      if (e.status === 403) { st.ttHidden = true; st.tt.delete(key); } else st.tt.set(key, { err: e });
    }
    if (st.selected === date) paintDay();
  }

  async function loadExams(tt) {
    const sectionId = tt?.sectionId;
    if (!sectionId || st.examsSection === sectionId || !['STUDENT', 'PARENT'].includes(role)) return;
    st.examsSection = sectionId;
    try {
      st.exams = (await api.listSectionAssessments(s, sectionId)) || [];
    } catch { st.exams = []; }
    if (!st.dead) paintAll();
  }

  // ---- actions ------------------------------------------------------------------------------------
  function select(date, jump = false) {
    if (!DATE_RE.test(date)) return;
    const d = parse(date);
    if (Number.isNaN(d.getTime())) return;
    const changed = date !== st.selected;
    st.selected = date;
    if (jump || st.mode === 'month') {
      const moved = d.getFullYear() !== st.year || d.getMonth() !== st.month;
      st.year = d.getFullYear(); st.month = d.getMonth();
      if (moved || jump) loadHolidays(st.year, st.month);
    }
    const want = `#/calendar/${date}`;
    if (location.hash !== want) history.replaceState(null, '', want);
    if (jump && st.mode !== 'month') setMode('month'); else if (changed || jump) paintAll();
    loadTimetable(date);
  }

  function shiftMonth(n) {
    const d = new Date(st.year, st.month + n, 1);
    st.year = d.getFullYear(); st.month = d.getMonth();
    loadHolidays(st.year, st.month);
    paintAll();
  }

  function setMode(mode) {
    st.mode = mode;
    if (mode === 'agenda') { const end = parse(addDays(today, 30)); loadHolidays(end.getFullYear(), end.getMonth()); }
    paintAll();
  }

  async function rsvp(ev, status) {
    if (st.rsvpBusy.has(ev.id)) return;
    st.rsvpBusy.add(ev.id); paintDay();
    try {
      await api.rsvpEvent(s, ev.id, status);
      ev.myRsvpStatus = status;
      host.toast('Response saved.', 'success');
    } catch (e) {
      host.toast(e?.message || 'Could not save your response.', 'error');
    }
    st.rsvpBusy.delete(ev.id);
    if (!st.dead) paintDay();
  }

  // ---- painting -----------------------------------------------------------------------------------
  function paintAll() {
    title.textContent = st.mode === 'month' ? `${MONTHS[st.month]} ${st.year}` : 'Next 30 days';
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === st.mode)));
    body.hidden = st.mode !== 'month';
    agendaHost.hidden = st.mode !== 'agenda';
    head.querySelector('.cal-nav').hidden = st.mode !== 'month';
    if (st.mode === 'month') { paintGrid(); paintDay(); } else paintAgenda();
  }

  function chipsFor(date) {
    const it = itemsOn(date);
    const all = [
      ...it.holidays.map((x) => ['holiday', x.name]),
      ...it.exams.map((x) => ['exam', x.title || x.type]),
      ...it.events.map((x) => ['event', x.name]),
      ...it.calls.map((x) => ['call', x.title]),
    ];
    const chips = all.slice(0, 3).map(([kind, label]) => h('span', { class: `cal-ev ${kind}`, title: label }, label));
    if (all.length > 3) chips.push(h('span', { class: 'cal-ev more' }, `+${all.length - 3} more`));
    const dots = h('span', { class: 'dots' }, ...all.slice(0, 4).map(([kind]) => h('i', { class: `dot ${kind}` })));
    return { chips, dots, count: all.length };
  }

  function paintGrid() {
    clear(gridHost);
    if (st.eventsErr && !st.events.length) gridHost.append(errorBox(st.eventsErr, loadEvents));
    if (st.holidayErr) gridHost.append(errorBox(st.holidayErr, () => loadHolidays(st.year, st.month)));
    const grid = h('div', { class: 'cal-grid', role: 'grid' },
      ...DOW.map((d) => h('div', { class: 'cal-dow', role: 'columnheader' }, DAYS[(DOW.indexOf(d) + 1) % 7])));
    const first = new Date(st.year, st.month, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const start = new Date(st.year, st.month, 1 - lead);
    const cells = lead + new Date(st.year, st.month + 1, 0).getDate();
    const rows = Math.ceil(cells / 7) * 7;
    for (let i = 0; i < rows; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const date = ymd(d);
      const { chips, dots, count } = chipsFor(date);
      const cls = ['cal-cell', d.getMonth() !== st.month && 'other', date === today && 'today'].filter(Boolean).join(' ');
      grid.append(h('div', {
        class: cls, role: 'gridcell', tabindex: 0, dataset: { date },
        'aria-selected': String(date === st.selected),
        'aria-label': `${fmtDate(date)}${count ? `, ${count} item${count > 1 ? 's' : ''}` : ''}`,
        onClick: () => select(date),
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(date); } },
      }, h('span', { class: 'cal-day' }, d.getDate()), ...chips, dots));
    }
    gridHost.append(grid);
    if (st.eventsBusy || st.holidayBusy) gridHost.append(spinner('Loading calendar…'));
  }

  function rsvpButtons(ev) {
    const busy = st.rsvpBusy.has(ev.id);
    return h('div', { class: 'cal-rsvp' }, ...RSVP.map(([status, label]) =>
      h('button', { type: 'button', class: `btn small${ev.myRsvpStatus === status ? ' primary' : ''}${busy ? ' busy' : ''}`, disabled: busy, onClick: () => rsvp(ev, status) }, label)));
  }

  function eventCard(ev, compact = false) {
    const when = ev.startAt ? `${fmtTime(ev.startAt)}${ev.endAt ? ` – ${fmtTime(ev.endAt)}` : ''}` : 'All day';
    return h('div', { class: 'cal-item event' },
      h('div', { class: 'cal-item-head' }, h('strong', {}, ev.name), ev.category ? h('span', { class: 'chip' }, ev.category) : null),
      h('p', { class: 'muted small' }, [when, ev.venue, ev.className].filter(Boolean).join(' · ')),
      !compact && ev.description ? h('p', { class: 'small' }, ev.description) : null,
      ev.participationType && ev.participationType !== 'NONE' ? rsvpButtons(ev) : null);
  }

  function callCard(c) {
    return h('div', { class: 'cal-item call' },
      h('div', { class: 'cal-item-head' }, h('strong', {}, c.title || 'Online class'),
        h('span', { class: 'chip green' }, c.hosted ? 'Hosting' : 'Invited')),
      h('p', { class: 'muted small' }, [fmtTime(c.at), c.status, c.rsvp && `You: ${c.rsvp}`].filter(Boolean).join(' · ')),
      c.link ? h('a', { class: 'btn small primary', href: c.link, target: '_blank', rel: 'noopener' }, 'Join') : null);
  }

  function examCard(x) {
    return h('div', { class: 'cal-item exam' },
      h('div', { class: 'cal-item-head' }, h('strong', {}, x.title || x.type), h('span', { class: 'chip red' }, x.type)),
      h('p', { class: 'muted small' }, [x.subjectName, x.maxMarks != null && `${x.maxMarks} marks`].filter(Boolean).join(' · ')));
  }

  function timetableBlock(date) {
    if (st.ttHidden) return null;
    const entry = st.tt.get(ttKey(date));
    const wrap = h('div', { class: 'cal-tt' }, h('h3', {}, 'Timetable'));
    if (!entry || entry.busy) return wrap.append(spinner('Loading timetable…')), wrap;
    if (entry.err) return wrap.append(errorBox(entry.err, () => { st.tt.delete(ttKey(date)); loadTimetable(date); })), wrap;
    const tt = entry.data || {};
    if (tt.schoolDay === false) return wrap.append(h('p', { class: 'muted' }, tt.holidayName ? `No school: ${tt.holidayName}` : 'No school on this day.')), wrap;
    const dow = DOW[(parse(date).getDay() + 6) % 7];
    const slots = (tt.slots || []).filter((x) => x.date ? x.date === date : x.dayOfWeek === dow);
    const periods = (tt.periods || []).slice().sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0));
    if (!periods.length && !slots.length) return wrap.append(h('p', { class: 'muted' }, 'No periods set for this day.')), wrap;
    if (tt.sectionLabel || tt.teacherName) wrap.append(h('p', { class: 'muted small' }, [tt.sectionLabel, tt.teacherName].filter(Boolean).join(' · ')));
    const rows = periods.length ? periods : slots.map((x) => ({ periodNumber: x.periodNumber }));
    for (const p of rows) {
      const ss = slots.filter((x) => x.periodNumber === p.periodNumber);
      const time = h('span', { class: 'agenda-time' }, p.startTime ? `${fmtHm(p.startTime)}${p.endTime ? ` – ${fmtHm(p.endTime)}` : ''}` : `Period ${p.periodNumber}`);
      if (p.breakPeriod) { wrap.append(h('div', { class: 'period break' }, time, h('span', { class: 'muted' }, p.label || 'Break'))); continue; }
      const what = ss.length ? ss.map((x) => h('div', {},
        h('strong', {}, x.subjectName || p.label || 'Free'),
        x.overrideKind ? h('span', { class: 'chip gold' }, x.overrideKind.toLowerCase().replace(/_/g, ' ')) : null,
        h('div', { class: 'muted small' }, [x.teacherName, x.className && `${x.className}${x.section ? ` ${x.section}` : ''}`, x.roomName].filter(Boolean).join(' · ')))) :
        h('span', { class: 'muted' }, p.label || 'Free');
      wrap.append(h('div', { class: 'period' }, time, h('div', {}, what)));
    }
    return wrap;
  }

  function paintDay() {
    if (st.mode !== 'month') return;
    const date = st.selected;
    const it = itemsOn(date);
    clear(dayHost);
    dayHost.append(h('div', { class: 'cal-daycard-head' },
      h('h2', {}, date === today ? 'Today' : DAYS[parse(date).getDay()]),
      h('span', { class: 'muted' }, fmtDate(date))));
    for (const hd of it.holidays) dayHost.append(h('p', { class: 'cal-holiday' }, h('span', { class: 'chip gold' }, hd.kind || 'Holiday'), ' ', hd.name));
    const tt = timetableBlock(date);
    if (tt) dayHost.append(tt);
    const section = (label, nodes) => nodes.length ? dayHost.append(h('h3', {}, label), ...nodes) : null;
    section('Exams', it.exams.map(examCard));
    section('Events', it.events.map((e) => eventCard(e)));
    section('Online classes', it.calls.map(callCard));
    if (!it.holidays.length && !it.exams.length && !it.events.length && !it.calls.length && (st.ttHidden || st.tt.get(ttKey(date))?.data?.schoolDay === false)) {
      dayHost.append(empty('Nothing on this day', 'Holidays, events, online classes and exams show here.'));
    }
  }

  function paintAgenda() {
    clear(agendaHost);
    if (st.eventsBusy || st.holidayBusy) agendaHost.append(spinner('Loading…'));
    if (st.eventsErr && !st.events.length) agendaHost.append(errorBox(st.eventsErr, loadEvents));
    const q = (document.getElementById('search')?.value || '').trim().toLowerCase();
    const match = (t) => !q || (t || '').toLowerCase().includes(q);
    const list = h('div', { class: 'agenda' });
    let any = false;
    for (let i = 0; i < 30; i++) {
      const date = addDays(today, i);
      const it = itemsOn(date);
      const nodes = [
        ...it.holidays.filter((x) => match(x.name)).map((x) => h('div', { class: 'cal-item holiday' }, h('span', { class: 'chip gold' }, x.kind || 'Holiday'), ' ', h('strong', {}, x.name))),
        ...it.exams.filter((x) => match(x.title) || match(x.subjectName)).map(examCard),
        ...it.events.filter((x) => match(x.name)).map((e) => eventCard(e, true)),
        ...it.calls.filter((x) => match(x.title)).map(callCard),
      ];
      if (!nodes.length) continue;
      any = true;
      list.append(h('div', { class: 'agenda-item' },
        h('button', { type: 'button', class: 'agenda-time cal-agenda-date', onClick: () => select(date, true) },
          i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${DAYS[parse(date).getDay()]} ${fmtDate(date, { withYear: false })}`),
        h('div', { class: 'cal-agenda-items' }, ...nodes)));
    }
    agendaHost.append(any ? list : (!st.eventsBusy ? empty(q ? 'No matches' : 'Nothing in the next 30 days', q ? 'Try another search.' : 'Holidays, events, online classes and exams show here.') : ''));
  }

  // ---- route + boot ---------------------------------------------------------------------------------
  function route(hash) {
    const part = (hash || '').replace(/^#\/?calendar\/?/, '').split('/')[0];
    const date = DATE_RE.test(part) ? part : today;
    if (date !== st.selected || !st.tt.has(ttKey(date))) select(date, date !== st.selected);
  }

  paintAll();
  loadHolidays(st.year, st.month);
  loadEvents();
  loadCalls();
  await loadChildren();
  loadTimetable(st.selected);

  return {
    route,
    unmount() {
      st.dead = true;
      document.getElementById('search')?.removeEventListener('input', onSearch);
    },
  };
}
