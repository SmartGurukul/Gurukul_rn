// Textbooks ops page (smartgurukul.org/ops/textbooks.html). Plain ES module, no build step, same
// shape as ../suite/js: a small API layer that unwraps the backend's {success, data, message}
// envelope, h() to build DOM, a toast. Every call carries X-Ops-Key (kept in sessionStorage only)
// and no X-School-Id. `?server=http://host:8080` points the page at another backend and sticks in
// localStorage until `?server=` (empty) clears it, like the suite.

const PROD = 'https://api.smartgurukul.org';
const SERVER_KEY = 'sg.ops.server';
const OPS_KEY = 'sg.ops.key';
const MAX_PDF_BYTES = 40 * 1024 * 1024;

// ---- storage ------------------------------------------------------------------------------------
function baseUrl() {
  try {
    const o = localStorage.getItem(SERVER_KEY);
    if (o) return o.replace(/\/+$/, '');
  } catch { /* storage blocked */ }
  return PROD;
}
function setBaseUrl(url) {
  try { if (url) localStorage.setItem(SERVER_KEY, url); else localStorage.removeItem(SERVER_KEY); } catch { /* ignore */ }
}
function getKey() { try { return sessionStorage.getItem(OPS_KEY) || ''; } catch { return ''; } }
function setKey(k) { try { if (k) sessionStorage.setItem(OPS_KEY, k); else sessionStorage.removeItem(OPS_KEY); } catch { /* ignore */ } }

const serverParam = new URLSearchParams(location.search).get('server');
if (serverParam !== null) { setBaseUrl(serverParam); history.replaceState(null, '', location.pathname + location.hash); }

// ---- api ----------------------------------------------------------------------------------------
class ApiError extends Error {
  constructor(status, message, errorCode, data) {
    super(message || `HTTP ${status}`);
    this.status = status; this.errorCode = errorCode || null; this.data = data;
  }
}

/** `body` is JSON unless it is a FormData (multipart upload). Returns the envelope's `data`. */
async function request(method, path, { body } = {}) {
  const headers = { Accept: 'application/json' };
  const key = getKey();
  if (key) headers['X-Ops-Key'] = key;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const started = performance.now();
  const label = `${method} ${path}`;
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, { method, headers, body: payload });
  } catch {
    log(`${label} → network error`, 'err');
    throw new ApiError(0, 'Could not reach the server. Check the server address and your connection.', 'NETWORK');
  }
  const ms = Math.round(performance.now() - started);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (res.status === 401) {
    log(`${label} → 401 wrong or missing ops key (${ms} ms)`, 'err');
    document.getElementById('key-form').classList.remove('ok');
    throw new ApiError(401, 'Wrong or missing ops key. Paste the key at the top of the page.', 'UNAUTHORIZED');
  }
  if (!res.ok || (json && json.success === false)) {
    const msg = json?.message || json?.error?.message || json?.error || `Request failed (HTTP ${res.status})`;
    log(`${label} → ${res.status} ${msg} (${ms} ms)`, 'err');
    throw new ApiError(res.status, String(msg), json?.errorCode, json?.data);
  }
  log(`${label} → ${res.status} (${ms} ms)`, 'ok');
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

const ops = {
  status: (board, grade) => request('GET', `/api/v1/ops/textbooks/status?board=${encodeURIComponent(board)}&grade=${encodeURIComponent(grade)}`),
  importCatalogue: (catalogue) => request('POST', '/api/v1/ops/curriculum/import', { body: catalogue }),
  upload: (chapterId, file, force) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return request('POST', `/api/v1/ops/textbooks/upload?chapter=${encodeURIComponent(chapterId)}&force=${force ? 'true' : 'false'}`, { body: fd });
  },
  ingest: (chapterId) => request('POST', `/api/v1/ops/textbooks/ingest?chapter=${encodeURIComponent(chapterId)}`),
  map: (chapterIds, force) => request('POST', '/api/v1/ops/textbooks/map', { body: { chapterIds, force: !!force } }),
  getMap: (chapterId) => request('GET', `/api/v1/ops/textbooks/map/${encodeURIComponent(chapterId)}`),
  setItemActive: (itemId, active) => request('PUT', `/api/v1/ops/textbooks/items/${encodeURIComponent(itemId)}`, { body: { active } }),
};

// ---- dom helpers --------------------------------------------------------------------------------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
function $(id) { return document.getElementById(id); }

function toast(message, kind = 'info', ms = 3500) {
  const t = $('toast');
  t.textContent = message;
  t.className = `toast ${kind}`;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { t.hidden = true; }, ms);
}
function spinner(label = 'Loading…') { return h('div', { class: 'loading' }, h('span', { class: 'spin' }), ' ', label); }
function errorBox(err, retry) {
  return h('div', { class: 'error-box' }, h('p', {}, err?.message || 'Something went wrong.'),
    retry ? h('button', { class: 'btn small', type: 'button', onClick: retry }, 'Try again') : null);
}
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
async function busy(btn, fn) {
  const was = btn.disabled;
  btn.disabled = true; btn.classList.add('busy');
  try { return await fn(); } finally { btn.disabled = was; btn.classList.remove('busy'); }
}

// ---- log pane -----------------------------------------------------------------------------------
function log(text, kind = '') {
  const list = $('log');
  if (!list) return;
  const emptyNote = list.querySelector('.log-empty');
  if (emptyNote) emptyNote.remove();
  const t = new Date().toLocaleTimeString('en-IN', { hour12: false });
  const li = h('li', { class: kind }, h('span', { class: 't' }, t), h('span', {}, text));
  list.append(li);
  while (list.children.length > 300) list.removeChild(list.firstChild);
  list.scrollTop = list.scrollHeight;
}
function resetLog() {
  const list = clear($('log'));
  list.append(h('li', { class: 'log-empty' }, h('span', { class: 't' }), h('span', {}, 'Every call and its result shows here.')));
}

// ---- status table -------------------------------------------------------------------------------
let current = { board: 'CBSE', grade: '6' };

async function loadStatus() {
  const board = $('board').value;
  const grade = $('grade').value;
  current = { board, grade };
  const host = $('status');
  host.setAttribute('aria-busy', 'true');
  clear(host).append(spinner(`Loading ${board} class ${grade}…`));
  try {
    const data = await ops.status(board, grade);
    renderStatus(data);
  } catch (err) {
    clear(host).append(errorBox(err, loadStatus));
  } finally {
    host.setAttribute('aria-busy', 'false');
  }
}

function renderStatus(data) {
  const host = clear($('status'));
  const books = Array.isArray(data?.books) ? data.books : [];
  if (!books.length) {
    host.append(h('div', { class: 'card' }, h('div', { class: 'empty' },
      h('p', { class: 'empty-title' }, `No books for ${data?.board || current.board} class ${data?.grade || current.grade}`),
      h('p', { class: 'muted' }, 'Add one with the form below, or pick another board or class.'))));
    return;
  }
  const bySubject = new Map();
  for (const b of books) {
    const k = b.subjectKey || b.subjectName || 'other';
    if (!bySubject.has(k)) bySubject.set(k, { name: b.subjectName || b.subjectKey || 'Other', books: [] });
    bySubject.get(k).books.push(b);
  }
  for (const [key, s] of bySubject) {
    const chapters = s.books.reduce((n, b) => n + (b.chapters?.length || 0), 0);
    const parsed = s.books.reduce((n, b) => n + (b.chapters || []).filter((c) => c.ingest?.status === 'PARSED').length, 0);
    host.append(h('section', { class: 'subject', 'aria-label': s.name },
      h('div', { class: 'subject-head' }, h('h2', {}, s.name), h('span', { class: 'chip' }, key),
        h('span', { class: 'muted small' }, `${s.books.length} book${s.books.length === 1 ? '' : 's'} · ${parsed}/${chapters} chapters parsed`)),
      ...s.books.map(renderBook)));
  }
}

function renderBook(book) {
  return h('article', { class: 'card book', 'aria-label': book.title },
    h('div', { class: 'book-head' },
      h('h3', {}, book.title || book.code),
      h('span', { class: 'chip grey' }, book.code),
      book.edition ? h('span', { class: 'muted' }, `edition ${book.edition}`) : null),
    h('ol', { class: 'chapters' }, ...(book.chapters || []).map((c) => renderChapter(book, c))));
}

function renderChapter(book, ch) {
  const badges = [];
  const ing = ch.ingest;
  if (ing?.status === 'PARSED') {
    badges.push(h('span', { class: 'chip green', title: ing.at ? `Parsed ${fmtWhen(ing.at)}` : 'Parsed' }, `Parsed · ${ing.pages ?? '?'} pages · ${ing.chunks ?? '?'} chunks`));
  } else if (ing?.status === 'FAILED') {
    badges.push(h('span', { class: 'chip red', title: ing.error || 'Parse failed', tabindex: '0' }, 'Failed', ing.error ? ' ⓘ' : ''));
  } else if (ing) {
    badges.push(h('span', { class: 'chip grey' }, String(ing.status).toLowerCase()));
  } else {
    badges.push(h('span', { class: 'chip grey' }, 'Not parsed'));
  }
  badges.push(h('span', { class: 'chip' }, `topics ${ch.topics ?? 0}`));
  const hasMap = (ch.points ?? 0) > 0;
  badges.push(hasMap
    ? h('span', { class: 'chip gold' }, `map ${ch.points} points · ${ch.items ?? 0} items`)
    : h('span', { class: 'chip grey' }, 'no map'));
  if (ch.hasPdfUrl) badges.push(h('span', { class: 'chip grey', title: 'This chapter has an NCERT PDF URL on file' }, 'NCERT URL'));

  const row = h('li', { class: 'chapter', dataset: { chapter: ch.id } });
  const result = h('div', { class: 'ch-result', hidden: true, 'aria-live': 'polite', dataset: { chapter: ch.id } });
  const kept = lastResult.get(ch.id);
  if (kept) { result.innerHTML = kept.html; result.classList.toggle('bad', kept.bad); result.hidden = false; }
  const fileInput = h('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'sr-only', id: `file-${ch.id}`, 'aria-label': `PDF for chapter ${ch.number} ${ch.title}` });
  const forceId = `force-${ch.id}`;
  const forceBox = h('input', { type: 'checkbox', id: forceId });
  const uploadBtn = h('button', { class: 'btn small', type: 'button', onClick: () => fileInput.click() }, 'Upload PDF');
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (f) uploadPdf(row, ch, f, forceBox.checked, uploadBtn, result);
  });

  const mapBtn = h('button', { class: 'btn small', type: 'button' }, hasMap ? 'Regenerate' : 'Generate map');
  mapBtn.addEventListener('click', () => {
    if (hasMap && !window.confirm(`Regenerate the concept map for chapter ${ch.number} "${ch.title}"? Existing points and items will be replaced.`)) return;
    busy(mapBtn, async () => {
      showResult(result, false, `Generating map for ${ch.id}…`);
      try {
        const out = await ops.map([ch.id], hasMap);
        const r = Array.isArray(out) ? out[0] : out;
        const good = r && r.status === 'GENERATED';
        showResult(result, !good && r?.status !== 'SKIPPED', mapSummary(r));
        if (good) { toast('Map generated', 'success'); loadStatus(); }
      } catch (err) {
        showResult(result, true, err.message);
      }
    });
  });

  const viewBtn = h('button', { class: 'btn small', type: 'button', onClick: () => openMap(ch) }, 'View map');
  if (!hasMap) viewBtn.disabled = true;

  const actions = [uploadBtn, h('label', { class: 'check', for: forceId }, forceBox, 'force re-parse'), mapBtn, viewBtn];
  if (ch.hasPdfUrl) {
    const parseBtn = h('button', { class: 'btn small', type: 'button' }, 'Parse from NCERT');
    parseBtn.addEventListener('click', () => busy(parseBtn, async () => {
      showResult(result, false, `Parsing ${ch.id} from its NCERT URL…`);
      try {
        const out = await ops.ingest(ch.id);
        const r = Array.isArray(out) ? out[0] : out;
        const good = r?.status === 'PARSED';
        showResult(result, !good, r ? `Parse ${r.status || '?'}${r.pageCount != null ? ` · ${r.pageCount} pages` : ''}${r.chunkCount != null ? ` · ${r.chunkCount} chunks` : ''}${r.error ? ` · ${r.error}` : ''}` : 'No result returned');
        if (good) { toast('Chapter parsed', 'success'); loadStatus(); }
      } catch (err) {
        showResult(result, true, err.message);
      }
    }));
    actions.push(parseBtn);
  }

  // Drag a PDF onto the row.
  row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drop'); });
  row.addEventListener('dragleave', () => row.classList.remove('drop'));
  row.addEventListener('drop', (e) => {
    e.preventDefault(); row.classList.remove('drop');
    const f = e.dataTransfer?.files?.[0];
    if (f) uploadPdf(row, ch, f, forceBox.checked, uploadBtn, result);
  });

  row.append(
    h('div', { class: 'ch-num' }, String(ch.number ?? '')),
    h('div', { class: 'ch-main' },
      h('div', { class: 'ch-title' }, ch.title || ch.id, ' ', h('span', { class: 'ch-id' }, ch.id)),
      h('div', { class: 'ch-badges' }, ...badges),
      h('div', { class: 'ch-actions' }, fileInput, ...actions),
      result));
  return row;
}

// Last result per chapter, kept across table reloads so a reload after a successful upload or map
// run does not wipe what the founder just read.
const lastResult = new Map();
function showResult(box, bad, ...lines) {
  clear(box);
  box.classList.toggle('bad', !!bad);
  box.hidden = false;
  for (const l of lines) {
    if (l === null || l === undefined) continue;
    box.append(l instanceof Node ? l : h('p', {}, l));
  }
  if (box.dataset.chapter && !box.querySelector('.spin')) lastResult.set(box.dataset.chapter, { bad: !!bad, html: box.innerHTML });
}

function mapSummary(r) {
  if (!r) return 'No map result returned';
  const bits = [`Map ${r.status || '?'}`];
  if (r.points != null) bits.push(`${r.points} points`);
  if (r.items != null) bits.push(`${r.items} items`);
  if (r.error) bits.push(r.error);
  return bits.join(' · ');
}

async function uploadPdf(row, ch, file, force, btn, result) {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  if (!isPdf) { showResult(result, true, `"${file.name}" is not a PDF.`); log(`Refused ${file.name}: not a PDF`, 'err'); return; }
  if (file.size > MAX_PDF_BYTES) {
    showResult(result, true, `"${file.name}" is ${fmtBytes(file.size)}; the limit is 40 MB. Split or compress the PDF first.`);
    log(`Refused ${file.name}: ${fmtBytes(file.size)} over the 40 MB limit`, 'err');
    return;
  }
  row.classList.add('working');
  showResult(result, false, h('p', {}, h('span', { class: 'spin' }), ` Uploading ${file.name} (${fmtBytes(file.size)})${force ? ', forcing a re-parse' : ''}…`));
  log(`Uploading ${file.name} (${fmtBytes(file.size)}) to ${ch.id}${force ? ' force=true' : ''}`);
  try {
    const out = await busy(btn, () => ops.upload(ch.id, file, force));
    const ing = out?.ingest || {};
    const bad = ing.status && ing.status !== 'PARSED';
    const lines = [
      `Parse ${ing.status || '?'}${ing.pageCount != null ? ` · ${ing.pageCount} pages` : ''}${ing.chunkCount != null ? ` · ${ing.chunkCount} chunks` : ''}${ing.droppedLines ? ` · ${ing.droppedLines} lines dropped` : ''}${ing.error ? ` · ${ing.error}` : ''}`,
    ];
    const topics = out?.topicsDerived;
    if (Array.isArray(topics)) {
      lines.push(`${topics.length} topic${topics.length === 1 ? '' : 's'} derived`);
      if (topics.length) lines.push(h('ul', { class: 'ch-topics' }, ...topics.map((t) => h('li', {}, typeof t === 'string' ? t : `${t.number ?? ''} ${t.title ?? ''}`.trim()))));
    } else if (topics != null) {
      lines.push(`${topics} topics derived`);
    }
    if (out?.map) lines.push(mapSummary(out.map));
    showResult(result, bad, ...lines);
    if (!bad) { toast(`${file.name} uploaded`, 'success'); loadStatus(); }
  } catch (err) {
    showResult(result, true, err.message);
  } finally {
    row.classList.remove('working');
  }
}

// ---- map dialog ---------------------------------------------------------------------------------
async function openMap(ch) {
  const dlg = $('map-dialog');
  $('map-title').textContent = `Chapter ${ch.number}: ${ch.title}`;
  const body = clear($('map-body'));
  body.append(spinner('Loading map…'));
  if (!dlg.open) dlg.showModal();
  try {
    const map = await ops.getMap(ch.id);
    renderMap(ch, map);
  } catch (err) {
    clear(body).append(errorBox(err, () => openMap(ch)));
  }
}

function renderMap(ch, map) {
  const body = clear($('map-body'));
  const points = Array.isArray(map?.points) ? map.points : [];
  if (!points.length) { body.append(h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'No points in this map'))); return; }
  const total = points.reduce((n, p) => n + (p.items?.length || 0), 0);
  body.append(h('p', { class: 'muted small' }, `${points.length} points · ${total} items · ${ch.id}`));
  const ids = new Map(points.map((p) => [p.id, p]));
  for (const p of points) {
    const prereqs = (p.prerequisiteIds || []).map((id) => ids.get(id)?.title || id);
    body.append(h('section', { class: `point${p.active === false ? ' inactive' : ''}` },
      h('div', { class: 'point-head' },
        h('h3', {}, `${p.seq != null ? `${p.seq}. ` : ''}${p.title || p.id}`),
        p.topicId ? h('span', { class: 'chip grey' }, p.topicId) : null,
        p.active === false ? h('span', { class: 'chip red' }, 'inactive') : null),
      p.description ? h('p', { class: 'point-desc' }, p.description) : null,
      prereqs.length ? h('p', { class: 'point-desc' }, 'Needs: ', prereqs.join(', ')) : null,
      h('ul', { class: 'items' }, ...(p.items || []).map(renderItem))));
  }
}

function renderItem(item) {
  const li = h('li', { class: `item${item.active === false ? ' retired' : ''}` });
  const btn = h('button', { class: 'btn small', type: 'button', 'aria-pressed': item.active === false ? 'true' : 'false' }, item.active === false ? 'Restore' : 'Retire');
  btn.addEventListener('click', () => busy(btn, async () => {
    const nextActive = item.active === false;
    try {
      await ops.setItemActive(item.id, nextActive);
      item.active = nextActive;
      li.classList.toggle('retired', !nextActive);
      btn.textContent = nextActive ? 'Retire' : 'Restore';
      btn.setAttribute('aria-pressed', nextActive ? 'false' : 'true');
      toast(nextActive ? 'Item restored' : 'Item retired', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
  li.append(
    h('div', { class: 'stem' }, item.stem || item.id),
    btn,
    h('ul', { class: 'options' }, ...(item.options || []).map((o) => h('li', { class: o.correct ? 'correct' : '' },
      h('span', { class: 'key' }, o.key ? `${o.key}.` : '•'), o.text,
      !o.correct && (o.misconception || o.remediation) ? h('span', { class: 'why' }, ` — ${[o.misconception, o.remediation].filter(Boolean).join(' · ')}`) : null))));
  return li;
}

// ---- add a book ---------------------------------------------------------------------------------
function slug(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function suggestCode(board, cls, subject) {
  const sub = slug(subject).replace(/-/g, '').slice(0, 3);
  return `${String(board).toLowerCase()}${cls}${sub}`;
}

/** "Force\n  1.1 Turning effect\n1.2 Centre of gravity\nWork" → chapters with topics. */
function parseChapters(text) {
  const chapters = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const indented = /^\s/.test(raw);
    const line = raw.trim();
    const topicNum = line.match(/^(\d+(?:\.\d+)+)[.)]?\s+(.+)$/);
    if ((indented || topicNum) && chapters.length) {
      const ch = chapters[chapters.length - 1];
      ch.topics = ch.topics || [];
      const n = topicNum ? topicNum[1] : `${ch.number}.${ch.topics.length + 1}`;
      ch.topics.push({ number: n, title: topicNum ? topicNum[2].trim() : line });
      continue;
    }
    const title = line.replace(/^(?:chapter\s+)?\d+\s*[.):-]?\s+/i, '').trim();
    chapters.push({ number: chapters.length + 1, title: title || line });
  }
  return chapters;
}

function buildCatalogue() {
  const board = $('bk-board').value;
  const cls = Number($('bk-class').value);
  const subject = $('bk-subject').value.trim();
  const subjectKey = slug(subject);
  const bookCode = $('bk-code').value.trim().toLowerCase();
  const bookTitle = $('bk-title').value.trim();
  const chapters = parseChapters($('bk-chapters').value);
  const problems = [];
  if (!subject) problems.push('Subject is required.');
  if (!bookCode) problems.push('Book code is required.');
  else if (!/^[a-z0-9]+$/.test(bookCode)) problems.push('Book code must be lowercase letters and digits only.');
  if (!bookTitle) problems.push('Book title is required.');
  if (!chapters.length) problems.push('Add at least one chapter title.');
  const book = { bookCode, subjectKey, subject, class: cls, bookTitle, medium: 'en', edition: 'current', status: 'ok', chapters };
  const catalogue = { board, classes: [{ class: cls, subjects: [{ subject, books: [book] }] }] };
  return { catalogue, problems, chapters };
}

let codeTouched = false;
function syncBookForm() {
  const subject = $('bk-subject').value;
  $('bk-subject-key').textContent = slug(subject) || '—';
  if (!codeTouched) $('bk-code').value = suggestCode($('bk-board').value, $('bk-class').value, subject);
  const chapters = parseChapters($('bk-chapters').value);
  const topics = chapters.reduce((n, c) => n + (c.topics?.length || 0), 0);
  $('bk-summary').textContent = chapters.length ? `${chapters.length} chapter${chapters.length === 1 ? '' : 's'}${topics ? `, ${topics} topics` : ''}` : '';
}

function previewBook() {
  const { catalogue, problems } = buildCatalogue();
  const err = $('bk-error');
  const pre = $('bk-json');
  pre.textContent = JSON.stringify(catalogue, null, 2);
  pre.hidden = false;
  if (problems.length) { err.textContent = problems.join(' '); err.hidden = false; } else { err.hidden = true; }
  return problems.length === 0;
}

async function importBook(e) {
  e.preventDefault();
  if (!previewBook()) return;
  const { catalogue } = buildCatalogue();
  const btn = $('bk-import');
  const err = $('bk-error');
  await busy(btn, async () => {
    try {
      const out = await ops.importCatalogue(catalogue);
      const msg = `Imported: ${out?.subjects ?? '?'} subjects, ${out?.books ?? '?'} books, ${out?.chapters ?? '?'} chapters, ${out?.topics ?? '?'} topics`;
      log(msg, 'ok');
      toast(msg, 'success', 5000);
      err.hidden = true;
      $('board').value = catalogue.board;
      $('grade').value = String(catalogue.classes[0].class);
      await loadStatus();
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
    }
  });
}

// ---- boot ---------------------------------------------------------------------------------------
function boot() {
  resetLog();
  const base = baseUrl();
  const badge = $('server-badge');
  if (base !== PROD) { badge.textContent = base.replace(/^https?:\/\//, ''); badge.title = `Talking to ${base}`; badge.hidden = false; }
  log(`Server ${base}`);

  const keyInput = $('ops-key');
  const keyForm = $('key-form');
  keyInput.value = getKey();
  if (keyInput.value) keyForm.classList.add('ok');
  keyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    setKey(keyInput.value.trim());
    keyForm.classList.toggle('ok', !!keyInput.value.trim());
    log(keyInput.value.trim() ? 'Ops key set for this tab' : 'Ops key cleared');
    loadStatus();
  });

  $('reload').addEventListener('click', loadStatus);
  $('board').addEventListener('change', loadStatus);
  $('grade').addEventListener('change', loadStatus);
  $('log-clear').addEventListener('click', resetLog);

  $('map-close').addEventListener('click', () => $('map-dialog').close());
  $('map-dialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  for (const id of ['bk-board', 'bk-class', 'bk-subject', 'bk-chapters']) $(id).addEventListener('input', syncBookForm);
  $('bk-code').addEventListener('input', () => {
    const el = $('bk-code');
    el.value = el.value.toLowerCase().replace(/[^a-z0-9]/g, '');
    codeTouched = el.value.length > 0;
    if (!codeTouched) syncBookForm();
  });
  $('bk-preview').addEventListener('click', previewBook);
  $('book-form').addEventListener('submit', importBook);
  syncBookForm();

  // Stop the browser opening a PDF dropped outside a chapter row.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  if (getKey()) loadStatus();
  else {
    clear($('status')).append(h('div', { class: 'card' }, h('div', { class: 'empty' },
      h('p', { class: 'empty-title' }, 'Paste the ops key to begin'),
      h('p', { class: 'muted' }, 'It stays in this tab only and is never put in the URL.'))));
  }
}

boot();
