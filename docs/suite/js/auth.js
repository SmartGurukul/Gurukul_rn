// Sign-in flows, mirroring the app: mobile → schools on file → OTP → (profile picker) → session;
// or staff username + password at a school found by name. Calls onSignedIn(session) when done.
import * as api from './api.js';
import { h, clear, debounce } from './ui.js';

const $ = (id) => document.getElementById(id);

export function mountAuth(onSignedIn) {
  const root = $('auth');
  root.hidden = false;
  const steps = ['phone', 'school', 'otp', 'profile', 'staff'].reduce((m, k) => ({ ...m, [k]: $(`auth-step-${k}`) }), {});
  const errorEl = $('auth-error');
  let phone = '';
  let schools = [];
  let schoolId = '';
  let selectionToken = '';

  function show(step) {
    Object.entries(steps).forEach(([k, el]) => { el.hidden = k !== step; });
    errorEl.hidden = true;
    const focus = { phone: 'phone', otp: 'otp', staff: 'staff-school' }[step];
    if (focus) setTimeout(() => $(focus).focus(), 50);
  }
  function fail(err) {
    errorEl.textContent = err?.message || 'Something went wrong. Please try again.';
    errorEl.hidden = false;
  }
  function busy(btn, on) { btn.disabled = on; btn.classList.toggle('busy', on); }

  function normalisePhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  async function sendOtp() {
    await api.requestOtp(schoolId, phone);
    $('otp-phone').textContent = phone;
    $('otp').value = '';
    show('otp');
  }

  $('phone-next').addEventListener('click', async () => {
    phone = normalisePhone($('phone').value);
    if (phone.length !== 10) return fail(new Error('Enter your 10-digit mobile number.'));
    const btn = $('phone-next');
    busy(btn, true);
    try {
      schools = await api.lookupSchoolsByPhone(phone);
      if (!schools?.length) return fail(new Error('This number is not on file at any school. Ask your school to add it, or use the staff login.'));
      if (schools.length === 1) { schoolId = schools[0].id; await sendOtp(); return; }
      const list = clear($('school-list'));
      schools.forEach((s) => list.append(h('li', {}, h('button', { type: 'button', class: 'choice', onClick: async () => {
        schoolId = s.id;
        try { await sendOtp(); } catch (e) { fail(e); }
      } }, h('strong', {}, s.name), h('span', { class: 'muted' }, [s.city, s.state].filter(Boolean).join(', '))))));
      show('school');
    } catch (e) { fail(e); } finally { busy(btn, false); }
  });
  $('phone').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('phone-next').click(); });

  $('otp-resend').addEventListener('click', async (e) => { e.preventDefault(); try { await sendOtp(); } catch (err) { fail(err); } });

  async function finish(session) {
    api.setSession(session);
    onSignedIn(session);
  }

  $('otp-verify').addEventListener('click', async () => {
    const otp = $('otp').value.trim();
    if (!/^\d{4,8}$/.test(otp)) return fail(new Error('Enter the code from the message.'));
    const btn = $('otp-verify');
    busy(btn, true);
    try {
      const res = await api.verifyOtp(schoolId, phone, otp);
      if (res.profileSelectionRequired && res.profiles?.length) {
        selectionToken = res.selectionToken;
        const list = clear($('profile-list'));
        res.profiles.forEach((p) => list.append(h('li', {}, h('button', { type: 'button', class: 'choice', onClick: async () => {
          try { await finish(await api.selectProfile(schoolId, selectionToken, p.ownerType, p.ownerId)); } catch (err) { fail(err); }
        } }, h('strong', {}, p.name), h('span', { class: 'muted' }, [p.role, p.className ? `Class ${p.className}${p.section ? ` ${p.section}` : ''}` : null].filter(Boolean).join(' · '))))));
        show('profile');
        return;
      }
      await finish(res);
    } catch (e) { fail(e); } finally { busy(btn, false); }
  });
  $('otp').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('otp-verify').click(); });

  // Staff login
  $('to-staff-login').addEventListener('click', (e) => { e.preventDefault(); show('staff'); });
  let staffSchoolId = '';
  const staffList = $('staff-school-list');
  $('staff-school').addEventListener('input', debounce(async () => {
    const q = $('staff-school').value.trim();
    staffSchoolId = '';
    clear(staffList);
    if (q.length < 2) return;
    try {
      const found = await api.searchSchools(q);
      (found || []).slice(0, 8).forEach((s) => staffList.append(h('li', {}, h('button', { type: 'button', class: 'choice', onClick: () => {
        staffSchoolId = s.id;
        $('staff-school').value = s.name;
        clear(staffList);
        $('staff-username').focus();
      } }, h('strong', {}, s.name), h('span', { class: 'muted' }, [s.city, s.state].filter(Boolean).join(', '))))));
    } catch (err) { fail(err); }
  }, 300));
  $('staff-login').addEventListener('click', async () => {
    if (!staffSchoolId) return fail(new Error('Pick your school from the list.'));
    const username = $('staff-username').value.trim();
    const password = $('staff-password').value;
    if (!username || !password) return fail(new Error('Enter your username and password.'));
    const btn = $('staff-login');
    busy(btn, true);
    try { await finish(await api.login(staffSchoolId, username, password)); } catch (e) { fail(e); } finally { busy(btn, false); }
  });
  $('staff-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('staff-login').click(); });

  root.querySelectorAll('.auth-back').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); show('phone'); }));
  show('phone');
  return () => { root.hidden = true; };
}
