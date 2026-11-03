// Drive: a Google-Drive-like browser over the Resource Hub (class section → subject → book →
// chapter files) plus a "Shared in chats" folder of attachments from the user's conversations.
// Routes: #/drive, #/drive/s/<sectionId>, #/drive/s/<sectionId>/<subjectId>, #/drive/shared.
import * as api from './api.js';
import { h, clear, fmtWhen, spinner, empty, errorBox, debounce } from './ui.js';

const SHARED_CONVERSATIONS = 10; // how many conversations to scan for attachments
const PREFETCH_LIMIT = 12; // prefetch subject counts for root folders when there are few sections

export async function mount(root, ctx, host) {
  const s = ctx.schoolId;
  const state = {
    path: [], // [] | ['shared'] | ['s', sectionId] | ['s', sectionId, subjectId]
    sections: null, // [{ id, label, sub }] once loaded
    sectionsErr: null,
    resources: new Map(), // sectionId → { data } | { err }
    shared: null, // [{ name, url, type, when, from }] once loaded
    sharedErr: null,
    query: '',
    seq: 0, // guards against out-of-order renders
  };

  // ---- shell ---------------------------------------------------------------------------------------
  const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' });
  const localSearch = h('input', {
    type: 'search', class: 'drive-search', placeholder: 'Search files', 'aria-label': 'Search files',
    onInput: (e) => setQuery(e.target.value),
  });
  const body = h('div', { class: 'section-pad' });
  clear(root).append(
    h('div', { class: 'pane-head drive-head' }, h('h2', {}, 'Drive'), localSearch),
    h('div', { class: 'section-pad drive-crumbs' }, crumbs),
    body,
  );

  const topSearch = document.getElementById('search');
  const onTopSearch = debounce(() => setQuery(topSearch.value), 150);
  topSearch?.addEventListener('input', onTopSearch);
  if (topSearch?.value) state.query = topSearch.value;

  function setQuery(q) {
    const next = (q || '').trim().toLowerCase();
    if (next === state.query) return;
    state.query = next;
    if (localSearch.value.trim().toLowerCase() !== next) localSearch.value = q || '';
    render();
  }
  const matches = (...fields) => !state.query || fields.some((f) => (f || '').toLowerCase().includes(state.query));

  // ---- navigation ------------------------------------------------------------------------------------
  function parse(hash) {
    const parts = (hash || '').replace(/^#\/?drive\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'shared') return ['shared'];
    if (parts[0] === 's' && parts[1]) return parts.slice(0, 3);
    return [];
  }
  const toHash = (path) => `#/drive${path.length ? `/${path.join('/')}` : ''}`;
  const go = (path) => host.navigate(toHash(path));

  function sectionById(id) { return (state.sections || []).find((x) => x.id === id) || null; }
  function labelOf(data) { return `${data.className || ''} ${data.section || ''}`.trim() || 'Class'; }

  // ---- data ------------------------------------------------------------------------------------------
  async function loadSections() {
    if (state.sections) return;
    state.sectionsErr = null;
    try {
      state.sections = await discoverSections();
    } catch (e) {
      state.sectionsErr = e;
    }
  }

  /** ADMIN: all class sections; everyone else: the sections their timetable exposes. */
  async function discoverSections() {
    if (ctx.role === 'ADMIN') {
      try {
        const list = await api.listClassSections(s);
        if (Array.isArray(list)) {
          return list.map((c) => ({ id: c.id, label: labelOf(c), sub: c.academicYear || '' }));
        }
      } catch (e) {
        if (e.status !== 403) throw e;
      }
    }
    const timetables = [];
    if (ctx.role === 'PARENT') {
      const children = await api.myChildren(s).catch(() => []);
      const ids = (children || []).map((c) => c.studentId || c.id).filter(Boolean);
      const got = await Promise.allSettled(ids.length ? ids.map((id) => api.myTimetable(s, undefined, id)) : [api.myTimetable(s)]);
      got.forEach((r) => { if (r.status === 'fulfilled' && r.value) timetables.push(r.value); });
    } else {
      try { timetables.push(await api.myTimetable(s)); } catch (e) { if (e.status !== 403 && e.status !== 404) throw e; }
    }
    const seen = new Map();
    for (const tt of timetables) {
      if (tt?.sectionId) seen.set(tt.sectionId, { id: tt.sectionId, label: tt.sectionLabel || labelOf(tt), sub: '' });
      for (const slot of tt?.slots || []) {
        if (slot.sectionId && !seen.has(slot.sectionId)) seen.set(slot.sectionId, { id: slot.sectionId, label: labelOf(slot), sub: '' });
      }
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }

  async function loadResources(sectionId, force = false) {
    const cached = state.resources.get(sectionId);
    if (cached && !force) return cached;
    let entry;
    try {
      const data = await api.getSectionResources(s, sectionId);
      entry = { data, subjects: (data?.subjects || []).map(normSubject) };
    } catch (err) {
      entry = { err };
    }
    state.resources.set(sectionId, entry);
    return entry;
  }

  function normSubject(sub) {
    const books = (sub.books || []).map((b) => ({
      code: b.bookCode, title: b.bookTitle || b.bookCode || 'Book', edition: b.edition,
      chapters: (b.chapters || []).filter((c) => !c.hidden).map((c) => ({
        id: c.chapterId, number: c.number, title: c.title, pdfUrl: c.pdfUrl || null, video: c.video || null,
        questionCount: c.questionCount || 0, book: b.bookTitle || b.bookCode || '',
      })),
    }));
    return {
      id: String(sub.subjectId), name: sub.subjectName || sub.subjectCode || 'Subject', code: sub.subjectCode,
      teacher: sub.teacherName || '', books, chapterCount: books.reduce((n, b) => n + b.chapters.length, 0),
    };
  }

  /** Attachments from the newest conversations, newest first. Fetched once per mount, on demand. */
  async function loadShared(force = false) {
    if (state.shared && !force) return;
    state.sharedErr = null;
    try {
      const convs = (await api.listConversations(s)) || [];
      const first = (Array.isArray(convs) ? convs : convs.content || []).slice(0, SHARED_CONVERSATIONS);
      const pages = await Promise.allSettled(first.map((c) => api.getMessages(s, c.id, 0)));
      const files = [];
      pages.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const msgs = Array.isArray(r.value) ? r.value : r.value?.content || r.value?.messages || [];
        const conv = first[i];
        for (const m of msgs) {
          if (!m.attachmentUrl) continue;
          files.push({
            url: m.attachmentUrl, type: m.attachmentContentType || '', when: m.sentAt,
            name: m.attachmentFileName || 'Attachment',
            from: conv.otherPartyName || conv.title || conv.name || 'Chat',
          });
        }
      });
      files.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));
      state.shared = files;
    } catch (e) {
      state.sharedErr = e;
    }
  }

  // ---- render ----------------------------------------------------------------------------------------
  async function render() {
    const seq = ++state.seq;
    const path = state.path;
    paintCrumbs();
    if (path[0] === 'shared') return renderShared(seq);
    if (!state.sections && !state.sectionsErr) {
      clear(body).append(spinner('Loading your folders…'));
      await loadSections();
      if (seq !== state.seq) return;
    }
    if (state.sectionsErr) {
      clear(body).append(errorBox(state.sectionsErr, () => { state.sections = null; render(); }));
      return;
    }
    if (path[0] === 's') return renderSection(seq, path[1], path[2]);
    renderRoot(seq);
  }

  function paintCrumbs() {
    const path = state.path;
    const parts = [{ label: 'Drive', to: [] }];
    if (path[0] === 'shared') parts.push({ label: 'Shared in chats' });
    if (path[0] === 's') {
      const sec = sectionById(path[1]);
      const res = state.resources.get(path[1]);
      parts.push({ label: sec?.label || (res?.data ? labelOf(res.data) : 'Class'), to: path.length > 2 ? ['s', path[1]] : null });
      if (path[2]) parts.push({ label: res?.subjects?.find((x) => x.id === path[2])?.name || 'Subject' });
    }
    clear(crumbs);
    parts.forEach((p, i) => {
      if (i) crumbs.append(h('span', { 'aria-hidden': 'true' }, '›'));
      crumbs.append(p.to ? h('button', { type: 'button', onClick: () => go(p.to) }, p.label) : h('span', { 'aria-current': 'page' }, p.label));
    });
  }

  function folder(label, sub, ico, onOpen) {
    return h('button', { type: 'button', class: 'folder', onClick: onOpen },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, ico),
      h('span', { class: 'folder-text' }, h('span', { class: 'li-title' }, label), sub ? h('span', { class: 'li-sub' }, sub) : null));
  }

  function renderRoot(seq) {
    const sections = state.sections || [];
    const grid = h('div', { class: 'folders' });
    for (const sec of sections) {
      const res = state.resources.get(sec.id);
      const sub = res?.subjects ? `${res.subjects.length} subject${res.subjects.length === 1 ? '' : 's'}` : (sec.sub || 'Class folder');
      if (matches(sec.label, sub)) grid.append(folder(sec.label, sub, '📁', () => go(['s', sec.id])));
    }
    if (matches('Shared in chats', 'attachments')) grid.append(folder('Shared in chats', 'Files from your conversations', '💬', () => go(['shared'])));
    clear(body);
    if (!sections.length && !state.query) {
      body.append(empty('Nothing shared with you yet', 'Class resources show up here once a class section is linked to you.'));
      body.append(h('div', { class: 'folders', style: 'margin-top:16px' }, folder('Shared in chats', 'Files from your conversations', '💬', () => go(['shared']))));
    } else if (!grid.childElementCount) {
      body.append(empty('No matches', `Nothing here matches “${state.query}”.`));
    } else {
      body.append(grid);
    }
    // Subject counts for the root folders, fetched quietly when the list is small.
    if (sections.length && sections.length <= PREFETCH_LIMIT && sections.some((x) => !state.resources.has(x.id))) {
      Promise.allSettled(sections.filter((x) => !state.resources.has(x.id)).map((x) => loadResources(x.id)))
        .then(() => { if (seq === state.seq && !state.path.length) renderRoot(++state.seq); });
    }
  }

  async function renderSection(seq, sectionId, subjectId) {
    let entry = state.resources.get(sectionId);
    if (!entry) {
      clear(body).append(spinner('Opening folder…'));
      entry = await loadResources(sectionId);
      if (seq !== state.seq) return;
      paintCrumbs();
    }
    clear(body);
    if (entry.err) {
      const e = entry.err;
      if (e.status === 403) {
        body.append(ctx.role === 'PARENT'
          ? empty('Resources open to parents soon', 'The class Resource Hub is not available to parent accounts yet.')
          : empty('Not available', e.message || 'You do not have access to this class folder.'));
      } else if (e.status === 404) {
        body.append(empty('Folder not found', 'This class section does not exist or is not shared with you.'));
      } else {
        body.append(errorBox(e, () => { state.resources.delete(sectionId); render(); }));
      }
      return;
    }
    if (subjectId) return renderSubject(entry, subjectId);
    const grid = h('div', { class: 'folders' });
    for (const sub of entry.subjects) {
      if (!matches(sub.name, sub.teacher, sub.code)) continue;
      const meta = [sub.teacher, `${sub.chapterCount} chapter${sub.chapterCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
      grid.append(folder(sub.name, meta, '📁', () => go(['s', sectionId, sub.id])));
    }
    if (!entry.subjects.length) {
      body.append(empty('No subjects yet', 'Nothing has been added to this class folder.'));
      return;
    }
    if (grid.childElementCount) body.append(grid);
    // While searching, also surface matching chapters across every subject of this class.
    if (state.query) {
      const hits = entry.subjects.flatMap((sub) => sub.books.flatMap((b) => b.chapters
        .filter((c) => matches(c.title, c.book, sub.name))
        .map((c) => fileRow(c, `${sub.name} · ${c.book}`))));
      if (hits.length) body.append(h('h3', { class: 'drive-group' }, 'Chapters'), h('ul', { class: 'files' }, hits));
      if (!grid.childElementCount && !hits.length) body.append(empty('No matches', `Nothing in this class matches “${state.query}”.`));
    }
  }

  function renderSubject(entry, subjectId) {
    const sub = entry.subjects.find((x) => x.id === subjectId);
    if (!sub) { body.append(empty('Subject not found', 'This subject is not part of the class folder.')); return; }
    if (sub.teacher) body.append(h('p', { class: 'muted' }, `Taught by ${sub.teacher}`));
    let shown = 0;
    for (const book of sub.books) {
      const rows = book.chapters.filter((c) => matches(c.title, book.title, `ch ${c.number}`)).map((c) => fileRow(c));
      if (!rows.length) continue;
      shown += rows.length;
      body.append(
        h('h3', { class: 'drive-group' }, book.title, book.edition ? h('span', { class: 'chip' }, book.edition) : null),
        h('ul', { class: 'files' }, rows),
      );
    }
    if (!shown) {
      body.append(state.query
        ? empty('No matches', `No chapter matches “${state.query}”.`)
        : empty('No chapters yet', 'Books and chapters for this subject have not been added.'));
    }
  }

  function fileRow(c, metaPrefix) {
    const meta = [metaPrefix || c.book, c.questionCount ? `${c.questionCount} question${c.questionCount === 1 ? '' : 's'}` : null]
      .filter(Boolean).join(' · ');
    const actions = h('span', { class: 'file-actions' });
    if (c.pdfUrl) actions.append(h('a', { class: 'btn small', href: c.pdfUrl, target: '_blank', rel: 'noopener' }, 'Open PDF'));
    if (c.video?.url) actions.append(h('a', { class: 'btn small', href: c.video.url, target: '_blank', rel: 'noopener' }, 'Watch'));
    if (!actions.childElementCount) actions.append(h('span', { class: 'muted small' }, 'No file'));
    const ico = c.video?.url && !c.pdfUrl ? '🎬' : '📄';
    return h('li', { class: 'file' },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, ico),
      h('span', { class: 'file-text' },
        h('span', { class: 'li-title' }, c.number != null ? `Ch ${c.number} · ${c.title || ''}` : (c.title || 'Chapter')),
        meta ? h('span', { class: 'li-sub' }, meta) : null),
      actions);
  }

  async function renderShared(seq) {
    if (!state.shared && !state.sharedErr) {
      clear(body).append(spinner('Looking through your chats…'));
      await loadShared();
      if (seq !== state.seq) return;
    }
    clear(body);
    if (state.sharedErr) { body.append(errorBox(state.sharedErr, () => { state.shared = null; render(); })); return; }
    const rows = state.shared.filter((f) => matches(f.name, f.from, f.type)).map((f) => h('li', { class: 'file' },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, iconFor(f.type)),
      h('span', { class: 'file-text' },
        h('span', { class: 'li-title' }, f.name),
        h('span', { class: 'li-sub' }, [f.from, f.when ? fmtWhen(f.when) : null].filter(Boolean).join(' · '))),
      h('a', { class: 'btn small', href: f.url, target: '_blank', rel: 'noopener' }, 'Open')));
    if (!rows.length) {
      body.append(state.query
        ? empty('No matches', `No shared file matches “${state.query}”.`)
        : empty('No files shared yet', `Attachments from your ${SHARED_CONVERSATIONS} most recent chats will appear here.`));
      return;
    }
    body.append(h('p', { class: 'muted small' }, 'Links open the file directly and expire after about an hour.'), h('ul', { class: 'files' }, rows));
  }

  function iconFor(type) {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    return '📄';
  }

  // ---- lifecycle -------------------------------------------------------------------------------------
  state.path = parse(location.hash);
  render();

  return {
    route(hash) {
      const next = parse(hash);
      if (next.join('/') === state.path.join('/')) return;
      state.path = next;
      render();
    },
    unmount() {
      topSearch?.removeEventListener('input', onTopSearch);
      state.seq++;
    },
  };
}
