// Mail view: Inbox (chat conversations), Notices (announcements) and Alerts (notifications) in a
// two-pane, Gmail-like layout. Routes: #/mail, #/mail/c/<conversationId>, #/mail/n/<announcementId>,
// #/mail/a/<notificationId>. See CONTRACT.md for the mount/unmount/route contract.
import * as api from './api.js';
import { h, clear, toast, initials, fmtWhen, fmtDate, fmtTime, debounce, spinner, empty, errorBox } from './ui.js';

const MAX_ATTACH = 10 * 1024 * 1024;
const ATTACH_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const POLL_MS = 15_000;
const TABS = [['inbox', 'Inbox'], ['notices', 'Notices'], ['alerts', 'Alerts']];
const OWNER_LABEL = { EMPLOYEE: 'Staff', STUDENT: 'Student', PARENT: 'Parent' };

export async function mount(root, ctx, host) {
  const me = { ownerType: ctx.session.ownerType, ownerId: ctx.session.ownerId };
  const isMine = (m) => m.senderOwnerType === me.ownerType && m.senderOwnerId === me.ownerId;
  const sid = ctx.schoolId;

  // ---- state ----------------------------------------------------------------------------------
  const st = {
    tab: 'inbox',
    convs: null, notices: null, alerts: null, alertsHasMore: false, alertsPage: 0,
    loads: {}, // tab -> in-flight load promise
    canCompose: ctx.role !== 'STUDENT', // students get 403 on contacts
    contacts: null, sections: null,
    open: null, // { kind: 'c'|'n'|'a', id }
    thread: null, // open conversation runtime: { id, msgs, page, hasMore, unsub, poll, el }
  };

  // ---- shell ----------------------------------------------------------------------------------
  const listEl = h('ul', { class: 'list', role: 'listbox' });
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' },
    TABS.map(([id, label]) => h('button', { type: 'button', role: 'tab', dataset: { tab: id }, onClick: () => switchTab(id) }, label)));
  const headActions = h('div', { class: 'row', style: 'gap:6px' });
  const paneList = h('aside', { class: 'pane-list' },
    h('div', { class: 'pane-head' }, h('h2', {}, 'Mail'), headActions), tabsEl, listEl);
  const paneMain = h('section', { class: 'pane-main' });
  const pane = h('div', { class: 'pane' }, paneList, paneMain);
  clear(root).append(pane);

  const searchInput = document.getElementById('search');
  const onSearch = debounce(renderList, 150);
  searchInput?.addEventListener('input', onSearch);

  paintHeadActions();
  switchTab('inbox');
  showPlaceholder();

  // ---- head buttons -----------------------------------------------------------------------------
  function paintHeadActions() {
    clear(headActions);
    if (st.tab === 'inbox' && st.canCompose) {
      headActions.append(h('button', { class: 'btn primary small', type: 'button', onClick: openCompose }, 'Compose'));
    }
    if (st.tab === 'notices' && (ctx.role === 'ADMIN' || ctx.role === 'TEACHER')) {
      headActions.append(h('button', { class: 'btn primary small', type: 'button', onClick: openNoticeCompose }, 'New notice'));
    }
    if (st.tab === 'alerts' && st.alerts?.some((a) => !a.readAt)) {
      headActions.append(h('button', { class: 'btn ghost small', type: 'button', onClick: markAllAlertsRead }, 'Mark all read'));
    }
  }

  // ---- tabs & lists -----------------------------------------------------------------------------
  function switchTab(tab) {
    st.tab = tab;
    tabsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    paintHeadActions();
    renderList();
    ensure(tab).then(() => { if (st.tab === tab) { renderList(); paintHeadActions(); } });
  }

  /** Load a tab's data once (or again on `force`); resolves when the list is in state. */
  function ensure(tab, force = false) {
    const key = { inbox: 'convs', notices: 'notices', alerts: 'alerts' }[tab];
    if (!force && st[key]) return Promise.resolve();
    if (st.loads[tab]) return st.loads[tab];
    const p = (async () => {
      try {
        if (tab === 'inbox') st.convs = await api.listConversations(sid);
        else if (tab === 'notices') st.notices = await api.listAnnouncements(sid);
        else {
          const r = await api.listNotifications(sid, 0);
          st.alerts = r?.notifications || []; st.alertsHasMore = !!r?.hasMore; st.alertsPage = 0;
        }
        st.loads[tab] = null;
      } catch (e) {
        st.loads[tab] = null;
        if (e?.status === 403) { st[key] = []; st.loads[`${tab}Hidden`] = true; } // feature not for this role
        else st.loads[`${tab}Err`] = e;
      }
    })();
    st.loads[tab] = p;
    return p;
  }

  function query() { return (searchInput?.value || '').trim().toLowerCase(); }
  const matches = (q, ...parts) => !q || parts.some((p) => (p || '').toLowerCase().includes(q));

  function renderList() {
    clear(listEl);
    const tab = st.tab;
    const err = st.loads[`${tab}Err`];
    if (err) { listEl.append(errorBox(err, () => { st.loads[`${tab}Err`] = null; switchTab(tab); })); return; }
    const data = { inbox: st.convs, notices: st.notices, alerts: st.alerts }[tab];
    if (!data) { listEl.append(spinner()); return; }
    if (st.loads[`${tab}Hidden`]) { listEl.append(empty('Not available', 'Your account does not have access to this.')); return; }
    const q = query();
    let items = [];
    if (tab === 'inbox') {
      items = data.filter((c) => matches(q, otherParty(c).name, preview(c.lastMessage))).map(convItem);
    } else if (tab === 'notices') {
      items = data.filter((n) => matches(q, n.title, n.body)).map(noticeItem);
    } else {
      items = data.filter((a) => matches(q, a.title, a.body)).map(alertItem);
      if (st.alertsHasMore && !q) {
        items.push(h('li', { class: 'section-pad', style: 'text-align:center' },
          h('button', { class: 'btn small', type: 'button', onClick: loadMoreAlerts }, 'Load more')));
      }
    }
    if (!items.length) {
      const labels = { inbox: ['No conversations', 'Messages with staff, parents and students show up here.'],
        notices: ['No notices', 'School and class announcements show up here.'], alerts: ['No alerts', 'You are all caught up.'] };
      listEl.append(empty(q ? 'No matches' : labels[tab][0], q ? '' : labels[tab][1]));
      return;
    }
    listEl.append(...items);
  }

  function listItem({ id, kind, title, sub, when, unread, gold }) {
    const selected = st.open?.kind === kind && st.open?.id === id;
    return h('li', {},
      h('button', { class: `list-item${unread ? ' unread' : ''}`, type: 'button', role: 'option', 'aria-selected': String(selected),
        dataset: { id, kind }, onClick: () => host.navigate(`#/mail/${kind}/${id}`) },
        h('span', { class: `avatar${gold ? ' gold' : ''}` }, initials(title)),
        h('span', { style: 'min-width:0' }, h('div', { class: 'li-title' }, title), h('div', { class: 'li-sub' }, sub)),
        h('span', { class: 'li-when' }, fmtWhen(when))));
  }

  function convItem(c) {
    const other = otherParty(c);
    return listItem({ id: c.id, kind: 'c', title: other.name, sub: preview(c.lastMessage), when: c.lastMessage?.sentAt,
      unread: (c.unreadCount || 0) > 0, gold: c.type === 'BOT' });
  }
  function noticeItem(n) {
    return listItem({ id: n.id, kind: 'n', title: n.title, sub: firstLine(n.body), when: n.createdAt, gold: n.scope === 'SCHOOL' });
  }
  function alertItem(a) {
    return listItem({ id: a.id, kind: 'a', title: a.title || 'Notification', sub: firstLine(a.body), when: a.createdAt, unread: !a.readAt });
  }

  function otherParty(c) {
    const p = (c.participants || []).find((x) => !(x.ownerType === me.ownerType && x.ownerId === me.ownerId));
    if (p) return p;
    return { name: c.type === 'BOT' ? 'Gurukul Assistant' : 'Conversation', ownerType: c.type === 'BOT' ? 'BOT' : null };
  }
  function preview(m) {
    if (!m) return 'No messages yet';
    const who = isMine(m) ? 'You: ' : '';
    if (m.content) return who + firstLine(m.content);
    if (m.attachmentFileName) return `${who}Attachment: ${m.attachmentFileName}`;
    return who;
  }
  function firstLine(s) { return (s || '').split('\n').find((l) => l.trim()) || ''; }

  function findConv(id) { return (st.convs || []).find((c) => c.id === id); }
  function updateListItem(kind, id) {
    // Re-render just the affected row (cheap and keeps scroll position).
    const btn = listEl.querySelector(`.list-item[data-kind="${kind}"][data-id="${id}"]`);
    if (!btn) { renderList(); return; }
    const data = kind === 'c' ? findConv(id) : kind === 'n' ? st.notices?.find((n) => n.id === id) : st.alerts?.find((a) => a.id === id);
    if (!data) return;
    const fresh = kind === 'c' ? convItem(data) : kind === 'n' ? noticeItem(data) : alertItem(data);
    btn.parentElement.replaceWith(fresh);
  }
  function markSelected() {
    listEl.querySelectorAll('.list-item').forEach((b) => b.setAttribute('aria-selected', String(st.open?.kind === b.dataset.kind && st.open?.id === b.dataset.id)));
  }

  // ---- main pane: placeholder / back ----------------------------------------------------------
  function showMain(on) { pane.classList.toggle('show-main', on); }
  function backBtn() {
    return h('button', { class: 'btn ghost back-btn', type: 'button', 'aria-label': 'Back', onClick: () => { closeThread(); st.open = null; showPlaceholder(); markSelected(); host.navigate('#/mail'); } }, '‹ Back');
  }
  function showPlaceholder() {
    closeThread();
    clear(paneMain).append(empty('Nothing open', 'Pick a conversation, notice or alert from the list.'));
    showMain(false);
  }
  function detailHead(title, chipText, chipClass) {
    return h('div', { class: 'pane-head' }, backBtn(), h('h2', {}, title), chipText ? h('span', { class: `chip ${chipClass || ''}` }, chipText) : null);
  }

  // ---- conversation thread ----------------------------------------------------------------------
  function closeThread() {
    const t = st.thread;
    if (!t) return;
    st.thread = null;
    // `unsub` is the unsubscribe fn once connected; while still connecting it is the promise, whose
    // `.then` in openConversation unsubscribes itself when it sees the thread is gone.
    if (typeof t.unsub === 'function') { try { t.unsub(); } catch { /* gone */ } }
    clearInterval(t.poll);
  }

  async function openConversation(id) {
    await ensure('inbox');
    let conv = findConv(id);
    if (!conv) { await ensure('inbox', true); conv = findConv(id); }
    if (!conv) { clear(paneMain).append(detailHead('Conversation'), errorBox({ message: 'This conversation was not found.' })); showMain(true); return; }
    closeThread();
    const other = otherParty(conv);
    const chip = conv.type === 'BOT' ? 'Assistant' : OWNER_LABEL[other.ownerType] || '';
    const threadEl = h('div', { class: 'thread' }, spinner());
    const t = { id, msgs: [], page: 0, hasMore: false, unsub: null, poll: null, el: threadEl, loadingOlder: false };
    st.thread = t;
    clear(paneMain).append(detailHead(other.name, chip, conv.type === 'BOT' ? 'gold' : ''), threadEl, composer(t, conv));
    showMain(true);

    try {
      const r = await api.getMessages(sid, id, 0);
      if (st.thread !== t) return;
      t.msgs = [...(r?.messages || [])].reverse(); t.hasMore = !!r?.hasMore;
      renderThread(t, true);
    } catch (e) {
      if (st.thread === t) clear(threadEl).append(errorBox(e, () => openConversation(id)));
      return;
    }
    threadEl.addEventListener('scroll', () => { if (threadEl.scrollTop < 40 && t.hasMore && !t.loadingOlder) loadOlder(t); });

    if (conv.unreadCount) { conv.unreadCount = 0; updateListItem('c', id); }
    api.markConversationRead(sid, id).catch(() => {});

    // Live updates, with a polling fallback when the socket is unavailable.
    const onMsg = (m) => { if (st.thread === t && m?.id) receive(t, conv, m); };
    t.unsub = api.liveSubscribe(sid, `/topic/conversations/${id}`, onMsg)
      .then((fn) => { if (st.thread === t) { t.unsub = fn; return null; } fn(); return null; })
      .catch(() => {
        if (st.thread !== t) return null;
        t.unsub = null;
        toast('Live updates unavailable; checking for new messages every 15 s.', 'error');
        t.poll = setInterval(async () => {
          try {
            const r = await api.getMessages(sid, id, 0);
            if (st.thread === t) [...(r?.messages || [])].reverse().forEach((m) => receive(t, conv, m));
          } catch { /* next tick */ }
        }, POLL_MS);
        return null;
      });
  }

  function receive(t, conv, m) {
    if (t.msgs.some((x) => x.id === m.id)) return;
    const atBottom = t.el.scrollHeight - t.el.scrollTop - t.el.clientHeight < 80;
    t.msgs.push(m);
    renderThread(t, atBottom || isMine(m));
    conv.lastMessage = m;
    if (!isMine(m)) api.markConversationRead(sid, conv.id).catch(() => {});
    // Newest conversation goes to the top, like the server orders it.
    st.convs = [conv, ...st.convs.filter((c) => c.id !== conv.id)];
    renderList();
  }

  async function loadOlder(t) {
    t.loadingOlder = true;
    const top = h('div', { class: 'day-sep' }, spinner('Loading older…'));
    t.el.prepend(top);
    try {
      const r = await api.getMessages(sid, t.id, t.page + 1);
      if (st.thread !== t) return;
      t.page += 1; t.hasMore = !!r?.hasMore;
      const older = [...(r?.messages || [])].reverse().filter((m) => !t.msgs.some((x) => x.id === m.id));
      t.msgs = [...older, ...t.msgs];
      const before = t.el.scrollHeight;
      renderThread(t, false);
      t.el.scrollTop += t.el.scrollHeight - before;
    } catch (e) {
      toast(e?.message || 'Could not load older messages.', 'error');
    } finally { top.remove(); t.loadingOlder = false; }
  }

  function renderThread(t, scrollToEnd) {
    clear(t.el);
    if (!t.msgs.length) { t.el.append(empty('Say hello', 'No messages in this conversation yet.')); return; }
    let lastDay = null;
    for (const m of t.msgs) {
      const day = new Date(m.sentAt).toDateString();
      if (day !== lastDay) { t.el.append(h('div', { class: 'day-sep' }, dayLabel(m.sentAt))); lastDay = day; }
      t.el.append(bubble(m));
    }
    if (scrollToEnd) t.el.scrollTop = t.el.scrollHeight;
  }

  function dayLabel(iso) {
    const d = new Date(iso); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return fmtDate(iso, { withYear: d.getFullYear() !== today.getFullYear() });
  }

  function bubble(m) {
    const mine = isMine(m);
    const kids = [];
    if (m.attachmentUrl) {
      const isImg = (m.attachmentContentType || '').startsWith('image/');
      kids.push(h('a', { href: m.attachmentUrl, target: '_blank', rel: 'noopener', class: 'attach' },
        isImg ? h('img', { src: m.attachmentUrl, alt: m.attachmentFileName || 'image', loading: 'lazy' }) : `Attachment: ${m.attachmentFileName || 'file'}`));
    } else if (m.attachmentFileName) {
      kids.push(h('span', { class: 'muted' }, `Attachment: ${m.attachmentFileName}`));
    }
    if (m.content) kids.push(m.content);
    kids.push(h('span', { class: 'when' }, (m.senderKind === 'BOT' ? 'Assistant · ' : '') + fmtTime(m.sentAt)));
    return h('div', { class: `bubble${mine ? ' mine' : ''}` }, kids);
  }

  function composer(t, conv) {
    const ta = h('textarea', { placeholder: 'Write a message… (Enter to send, Shift+Enter for a new line)', rows: 1, 'aria-label': 'Message' });
    const file = h('input', { type: 'file', hidden: true, accept: ATTACH_TYPES.join(',') });
    const sendBtn = h('button', { class: 'btn primary', type: 'button' }, 'Send');
    const attachBtn = h('button', { class: 'btn', type: 'button', 'aria-label': 'Attach a file', title: 'Attach (image or PDF, up to 10 MB)', onClick: () => file.click() }, '+');
    let busy = false;
    const setBusy = (on) => { busy = on; sendBtn.disabled = on; attachBtn.disabled = on; sendBtn.classList.toggle('busy', on); };

    async function send(payload) {
      if (busy || st.thread !== t) return;
      setBusy(true);
      try {
        await api.liveSend(sid, `/app/conversations/${conv.id}/messages`, payload);
        ta.value = '';
      } catch (e) {
        toast(e?.message?.includes('live') ? 'Sending needs a live connection. Please try again.' : (e?.message || 'Could not send.'), 'error');
      } finally { setBusy(false); ta.focus(); }
    }
    const sendText = () => { const content = ta.value.trim(); if (content) send({ content }); };
    sendBtn.addEventListener('click', sendText);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } });
    file.addEventListener('change', async () => {
      const f = file.files?.[0]; file.value = '';
      if (!f) return;
      if (!ATTACH_TYPES.includes(f.type)) { toast('Only JPEG, PNG, GIF, WebP images or PDFs can be attached.', 'error'); return; }
      if (f.size > MAX_ATTACH) { toast('Attachments must be 10 MB or smaller.', 'error'); return; }
      setBusy(true);
      try {
        const { uploadUrl, objectKey } = await api.presignChatAttachment(sid, conv.id, { fileName: f.name, contentType: f.type, fileSizeBytes: f.size });
        await api.putToPresignedUrl(uploadUrl, f, f.type);
        setBusy(false);
        await send({ content: ta.value.trim(), attachmentObjectKey: objectKey, attachmentContentType: f.type, attachmentFileName: f.name });
      } catch (e) { toast(e?.message || 'Upload failed.', 'error'); setBusy(false); }
    });
    return h('div', { class: 'composer' }, attachBtn, file, ta, sendBtn);
  }

  // ---- compose: new conversation ---------------------------------------------------------------
  async function openCompose() {
    closeThread(); st.open = null; markSelected();
    const search = h('input', { type: 'search', placeholder: 'Search people', 'aria-label': 'Search people' });
    const results = h('ul', { class: 'list' }, spinner());
    clear(paneMain).append(detailHead('New message'), h('div', { class: 'section-pad', style: 'padding-bottom:0' }, search), results);
    showMain(true);
    if (!st.contacts) {
      try { st.contacts = await api.listChatContacts(sid); } catch (e) {
        if (e?.status === 403) { st.canCompose = false; paintHeadActions(); showPlaceholder(); return; }
        clear(results).append(errorBox(e, openCompose)); return;
      }
    }
    const paint = () => {
      const q = search.value.trim().toLowerCase();
      clear(results);
      const rows = st.contacts.filter((c) => matches(q, c.name, contactSub(c))).map((c) => h('li', {},
        h('button', { class: 'list-item', type: 'button', onClick: () => startConversation(c) },
          h('span', { class: `avatar${c.admin ? ' gold' : ''}` }, initials(c.name)),
          h('span', { style: 'min-width:0' }, h('div', { class: 'li-title' }, c.name), h('div', { class: 'li-sub' }, contactSub(c))),
          h('span', { class: 'li-when' }, OWNER_LABEL[c.ownerType] || ''))));
      results.append(...(rows.length ? rows : [empty('No one found')]));
    };
    search.addEventListener('input', debounce(paint, 100));
    paint(); search.focus();
  }
  function contactSub(c) {
    const bits = [];
    if (c.admin) bits.push('Admin');
    if (c.classTeacherOf?.length) bits.push(`Class teacher: ${c.classTeacherOf.join(', ')}`);
    if (c.subjects?.length) bits.push(c.subjects.join(', '));
    if (c.children?.length) bits.push(`Parent of ${c.children.map((k) => k.name || k).join(', ')}`);
    return bits.join(' · ');
  }
  async function startConversation(c) {
    try {
      const conv = await api.createConversation(sid, c.ownerType, c.ownerId);
      await ensure('inbox');
      if (!findConv(conv.id)) { st.convs = [conv, ...(st.convs || [])]; renderList(); }
      host.navigate(`#/mail/c/${conv.id}`);
    } catch (e) { toast(e?.message || 'Could not start the conversation.', 'error'); }
  }

  // ---- compose: new notice ----------------------------------------------------------------------
  async function openNoticeCompose() {
    closeThread(); st.open = null; markSelected();
    clear(paneMain).append(detailHead('New notice'), h('div', { class: 'section-pad' }, spinner()));
    showMain(true);
    if (!st.sections) { try { st.sections = await api.listClassSections(sid); } catch { st.sections = []; } }
    // ADMIN: school-wide or any section. TEACHER: only sections where they are the class teacher.
    const own = ctx.role === 'ADMIN' ? st.sections : st.sections.filter((s) => s.classTeacherId === me.ownerId);
    const options = [];
    if (ctx.role === 'ADMIN') options.push(h('option', { value: 'SCHOOL' }, 'Whole school'));
    own.forEach((s) => options.push(h('option', { value: `CLASS:${s.id}` }, s.displayLabel || `${s.className} ${s.section || ''}`)));
    if (!options.length) { clear(paneMain).append(detailHead('New notice'), h('div', { class: 'section-pad' }, empty('Nothing to post to', 'Only class teachers can post a class notice.'))); return; }
    const scope = h('select', { 'aria-label': 'Audience' }, options);
    const title = h('input', { placeholder: 'Title', maxlength: 200 });
    const body = h('textarea', { placeholder: 'Write the notice…', rows: 6 });
    const post = h('button', { class: 'btn primary', type: 'button' }, 'Post notice');
    post.addEventListener('click', async () => {
      if (!title.value.trim() || !body.value.trim()) { toast('A title and a body are needed.', 'error'); return; }
      const [kind, sectionId] = scope.value.split(':');
      post.disabled = true;
      try {
        const n = await api.createAnnouncement(sid, { scope: kind, sectionId: sectionId || undefined, title: title.value.trim(), body: body.value.trim() });
        await ensure('notices');
        if (n?.id && !st.notices.some((x) => x.id === n.id)) st.notices = [n, ...st.notices];
        toast('Notice posted.', 'success');
        renderList();
        if (n?.id) host.navigate(`#/mail/n/${n.id}`); else showPlaceholder();
      } catch (e) { toast(e?.message || 'Could not post the notice.', 'error'); post.disabled = false; }
    });
    clear(paneMain).append(detailHead('New notice'),
      h('div', { class: 'section-pad mail-form' },
        h('label', {}, 'Audience'), scope, h('label', {}, 'Title'), title, h('label', {}, 'Notice'), body, h('div', { style: 'margin-top:12px' }, post)));
    title.focus();
  }

  // ---- notice / alert detail -------------------------------------------------------------------
  function scopeChip(n) {
    if (n.scope === 'SCHOOL') return ['Whole school', 'gold'];
    if (n.scope === 'GRADE') return [n.className ? `Class ${n.className}` : 'Grade', ''];
    const s = st.sections?.find((x) => x.id === n.sectionId);
    return [s ? s.displayLabel || `${s.className} ${s.section || ''}` : 'Class', ''];
  }
  async function openNotice(id) {
    closeThread();
    await ensure('notices');
    let n = st.notices.find((x) => x.id === id);
    if (!n) { await ensure('notices', true); n = st.notices.find((x) => x.id === id); }
    if (!n) { clear(paneMain).append(detailHead('Notice'), errorBox({ message: 'This notice was not found.' })); showMain(true); return; }
    const [chipText, chipClass] = scopeChip(n);
    clear(paneMain).append(detailHead('Notice', chipText, chipClass),
      h('div', { class: 'section-pad mail-detail' }, h('article', { class: 'card' },
        h('h2', {}, n.title), h('p', { class: 'muted small' }, `${fmtDate(n.createdAt)} · ${fmtTime(n.createdAt)}`),
        h('div', { class: 'mail-body' }, n.body))));
    showMain(true);
  }
  async function openAlert(id) {
    closeThread();
    await ensure('alerts');
    let a = st.alerts.find((x) => x.id === id);
    if (!a) { await ensure('alerts', true); a = st.alerts.find((x) => x.id === id); }
    if (!a) { clear(paneMain).append(detailHead('Alert'), errorBox({ message: 'This alert was not found.' })); showMain(true); return; }
    clear(paneMain).append(detailHead('Alert', prettyType(a.type)),
      h('div', { class: 'section-pad mail-detail' }, h('article', { class: 'card' },
        h('h2', {}, a.title || 'Notification'), h('p', { class: 'muted small' }, `${fmtDate(a.createdAt)} · ${fmtTime(a.createdAt)}`),
        h('div', { class: 'mail-body' }, a.body || ''))));
    showMain(true);
    if (!a.readAt) {
      a.readAt = new Date().toISOString(); updateListItem('a', id); paintHeadActions();
      api.markNotificationRead(sid, id).catch(() => {});
    }
  }
  function prettyType(t) { return (t || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()); }
  async function loadMoreAlerts() {
    try {
      const r = await api.listNotifications(sid, st.alertsPage + 1);
      st.alertsPage += 1; st.alertsHasMore = !!r?.hasMore;
      const fresh = (r?.notifications || []).filter((n) => !st.alerts.some((x) => x.id === n.id));
      st.alerts = [...st.alerts, ...fresh]; renderList();
    } catch (e) { toast(e?.message || 'Could not load more.', 'error'); }
  }
  async function markAllAlertsRead() {
    try {
      await api.markAllNotificationsRead(sid);
      const now = new Date().toISOString();
      st.alerts.forEach((a) => { if (!a.readAt) a.readAt = now; });
      renderList(); paintHeadActions();
    } catch (e) { toast(e?.message || 'Could not mark alerts read.', 'error'); }
  }

  // ---- routing ----------------------------------------------------------------------------------
  let routeSeq = 0;
  async function route(hash) {
    const parts = (hash || '').replace(/^#\/?/, '').split('/'); // ['mail', 'c', id]
    const kind = parts[1]; const id = parts[2];
    const seq = ++routeSeq;
    if (!['c', 'n', 'a'].includes(kind) || !id) { st.open = null; showPlaceholder(); markSelected(); return; }
    const tab = { c: 'inbox', n: 'notices', a: 'alerts' }[kind];
    if (st.tab !== tab) switchTab(tab);
    st.open = { kind, id };
    markSelected();
    if (kind === 'c') await openConversation(id); else if (kind === 'n') await openNotice(id); else await openAlert(id);
    if (seq === routeSeq) markSelected();
  }

  function unmount() {
    closeThread();
    searchInput?.removeEventListener('input', onSearch);
  }

  return { unmount, route };
}
