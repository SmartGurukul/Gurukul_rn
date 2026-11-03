// School Suite shell: sign-in gate, hash router (#/mail, #/calendar, #/drive), top bar, side nav.
import * as api from './api.js';
import { mountAuth } from './auth.js';
import { toast, clear, initials } from './ui.js';

const views = {
  mail: () => import('./mail.js'),
  calendar: () => import('./calendar.js'),
  drive: () => import('./drive.js'),
};

const $ = (id) => document.getElementById(id);
let ctx = null; // { session, schoolId, school, profile, role }
let current = null; // { name, unmount }
let hideAuth = null;

function roleLabel(role) {
  return { ADMIN: 'Admin', TEACHER: 'Teacher', STUDENT: 'Student', PARENT: 'Parent', DRIVER: 'Driver' }[role] || role || '';
}

async function buildContext(session) {
  const schoolId = session.schoolId;
  const [school, profiles] = await Promise.all([
    api.getSchool(schoolId).catch(() => null),
    api.listProfiles(schoolId).catch(() => []),
  ]);
  const profile = (profiles || []).find((p) => p.current) || (profiles || [])[0] || null;
  return { session, schoolId, school, profile, role: session.role, name: profile?.name || session.username || '' };
}

function paintWho() {
  $('who-name').textContent = ctx.name ? `${ctx.name} · ${roleLabel(ctx.role)}` : roleLabel(ctx.role);
  $('who-school').textContent = ctx.school?.name || '';
  const nav = $('sidenav');
  // Parents and students see Drive only when the Resource Hub lets them in (the view says so itself).
  nav.querySelectorAll('a[data-app]').forEach((a) => a.setAttribute('aria-current', 'false'));
}

async function route() {
  if (!ctx) return;
  const name = (location.hash.replace(/^#\/?/, '').split('/')[0] || 'mail');
  const loader = views[name] || views.mail;
  const view = $('view');
  $('sidenav').querySelectorAll('a[data-app]').forEach((a) => a.setAttribute('aria-current', a.dataset.app === name ? 'page' : 'false'));
  $('app').classList.remove('nav-open');
  $('menu-btn').setAttribute('aria-expanded', 'false');
  if (current?.name === name) { current.route?.(location.hash); return; }
  if (current?.unmount) { try { current.unmount(); } catch { /* ignore */ } }
  clear(view);
  current = { name };
  try {
    const mod = await loader();
    const handle = await mod.mount(view, ctx, { toast, navigate: (hash) => { location.hash = hash; } });
    current = { name, ...(handle || {}) };
    current.route?.(location.hash);
  } catch (e) {
    view.textContent = '';
    view.append(Object.assign(document.createElement('p'), { className: 'error-box', textContent: e?.message || 'Could not open this app.' }));
  }
  view.focus({ preventScroll: true });
}

async function enter(session) {
  try {
    ctx = await buildContext(session);
  } catch (e) {
    toast(e?.message || 'Could not load your profile.', 'error');
    return;
  }
  if (hideAuth) { hideAuth(); hideAuth = null; }
  $('app').hidden = false;
  paintWho();
  if (!location.hash) location.hash = '#/mail';
  route();
  refreshBadges();
}

async function refreshBadges() {
  if (!ctx) return;
  try {
    const [chat, notes] = await Promise.all([api.getChatUnreadCount(ctx.schoolId), api.get('/api/v1/notifications/unread-count', ctx.schoolId)]);
    const n = (chat?.unread || 0) + (notes?.unread || 0);
    const b = $('badge-mail');
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = n === 0;
  } catch { /* badge is best effort */ }
}
setInterval(refreshBadges, 60_000);

function leave() {
  if (current?.unmount) { try { current.unmount(); } catch { /* ignore */ } }
  current = null; ctx = null;
  api.liveDisconnect();
  $('app').hidden = true;
  clear($('view'));
  hideAuth = mountAuth(enter);
}

$('sign-out').addEventListener('click', async () => { await api.signOut(); });
api.onSignedOut(() => { toast('Signed out.'); leave(); });
$('menu-btn').addEventListener('click', () => {
  const open = $('app').classList.toggle('nav-open');
  $('menu-btn').setAttribute('aria-expanded', String(open));
});
window.addEventListener('hashchange', route);
window.addEventListener('focus', refreshBadges);

// A `?server=http://host:8080` query points the suite at another backend (local testing), like the
// app's Server screen. It sticks in localStorage until `?server=` (empty) clears it.
const serverParam = new URLSearchParams(location.search).get('server');
if (serverParam !== null) { api.setBaseUrl(serverParam); history.replaceState(null, '', location.pathname + location.hash); }

const existing = api.getSession();
if (existing?.token && existing.schoolId) enter(existing); else hideAuth = mountAuth(enter);
