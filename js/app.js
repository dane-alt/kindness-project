import { CONFIG, isDemo } from './config.js';
import { backend, blobToDataURL } from './backend.js';
import { Recorder, canRecord, canTranscribe } from './recorder.js';
import { normalizeCode, isValidCode, generateCodes } from './codes.js';
import { toCSV, toJSON } from './export.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SHARED = 'kp-shared'; // remembers on this device which flows you've shared in (so feeds unlock). Nothing is sent.
const shared = () => JSON.parse(localStorage.getItem(SHARED) || '{}');
const markShared = f => localStorage.setItem(SHARED, JSON.stringify({ ...shared(), [f]: true }));
const siteUrl = () => CONFIG.SITE_URL || location.href.split('#')[0];
const CONSENT = 'I understand my answers will be public (without my name) and may appear in the book <em>Kindness</em> by Dane E. Rose.';

if (isDemo()) $('#demo-banner').hidden = false;
async function refreshTally() { try { $('#tally').textContent = await backend.tally(); } catch {} }

function view(html, title) { main.innerHTML = html; document.title = (title ? title + ' · ' : '') + 'The Kindness Project'; main.focus(); window.scrollTo(0, 0); }

// ---------- answer widget (type, speak, or speak-to-text) ----------
function answerBox(id, label) {
  const rec = canRecord();
  return `<label for="${id}">${label}</label>
  <textarea id="${id}" name="${id}" maxlength="4000" placeholder="Type here, or tap the microphone and speak."></textarea>
  ${rec ? `<div class="voice"><button type="button" class="btn alt rec" data-rec="${id}" aria-pressed="false">🎙️ Speak your answer</button>
  <span class="hint" data-status="${id}" aria-live="polite">${canTranscribe() ? 'Your words will appear as text as you speak.' : 'Your voice will be recorded. You can also type.'}</span></div>
  <div data-audio="${id}" hidden><audio controls></audio>
  <label class="consent" style="margin-top:6px"><input type="checkbox" data-keep="${id}" checked> Keep my voice recording with my answer</label></div>`
  : `<p class="hint">Voice recording isn't available in this browser, so please type.</p>`}`;
}
const answers = {};
function wireAnswer(id) {
  answers[id] = { blob: null, transcribed: false };
  const btn = $(`[data-rec="${id}"]`); if (!btn) return;
  const ta = $('#' + id), st = $(`[data-status="${id}"]`);
  let r = null, base = '';
  btn.onclick = async () => {
    if (!r) {
      base = ta.value ? ta.value.trim() + ' ' : '';
      r = new Recorder({ onTranscript: t => { ta.value = base + t; answers[id].transcribed = true; } });
      try { await r.start(); } catch (e) { r = null; st.textContent = 'Microphone not allowed. You can type instead, or allow the microphone in your browser settings.'; st.classList.add('err'); return; }
      btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); btn.textContent = '⏹ Stop recording'; st.classList.remove('err'); st.textContent = 'Listening…';
    } else {
      const blob = await r.stop(); r = null;
      answers[id].blob = blob;
      btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false'); btn.textContent = '🎙️ Record again';
      st.textContent = answers[id].transcribed ? 'Done. Check the text above and fix anything.' : 'Recording saved. You can add text too.';
      const box = $(`[data-audio="${id}"]`); box.hidden = false; $('audio', box).src = URL.createObjectURL(blob);
    }
  };
}
async function collect(id, flow, consent) {
  const text = $('#' + id).value.trim(), a = answers[id] || {};
  const keep = a.blob && $(`[data-keep="${id}"]`)?.checked;
  if (!text && !keep) return null;
  const mode = keep ? (text ? 'audio+transcript' : 'audio') : 'text';
  return { flow, text, input_mode: mode, consent, audio_blob: keep ? a.blob : null, audio_data: keep && isDemo() ? await blobToDataURL(a.blob) : null };
}

function feedList(items, empty = 'No entries yet. Yours could be the first.') {
  if (!items.length) return `<p class="hint">${empty}</p>`;
  const lbl = { received: 'Received', given: 'Given', inspired: 'Inspired' };
  return `<ul class="feed">${items.map(e => `<li><span class="tag">${lbl[e.flow] || ''}</span>${esc(e.text) || '<em>(voice)</em>'}
    ${e.audio_url ? `<audio controls preload="none" src="${esc(e.audio_url)}"></audio>` : ''}
    <div class="meta">${new Date(e.created_at).toLocaleDateString()}</div></li>`).join('')}</ul>`;
}

// ---------- screens ----------
function home() {
  const s = shared();
  view(`<h1>Kindness is contagious.</h1>
  <p class="lead">Share a kindness, anonymously. No sign-up, no names. Just the good stuff.</p>
  <div class="stack"><a class="btn" href="#/flow1">Kindness received and given</a>
  <a class="btn alt" href="#/flow2">A kind act the project inspired</a>
  <a class="btn alt" href="#/book">I found a copy of the book</a>
  ${s.flow1 || s.flow2 ? `<a class="btn alt" href="#/feed">See everyone's kindness</a>` : ''}</div>`);
}

function flow1(step = 1) {
  if (step === 1) {
    view(`<p class="step">Step 1 of 2</p><h1>What is the kindest thing anyone has ever done for you, and how do you feel about it?</h1>
    <form id="f" novalidate>${answerBox('a1', 'Your answer')}<p class="err" id="msg" role="alert"></p>
    <div class="row"><button class="btn" type="submit">Next</button></div></form>`, 'Kindness received');
    wireAnswer('a1');
    $('#f').onsubmit = e => { e.preventDefault(); const ok = $('#a1').value.trim() || answers.a1?.blob; if (!ok) { $('#msg').textContent = 'Please type or record an answer first.'; return; } stash.a1 = { text: $('#a1').value, ...answers.a1 }; flow1(2); };
    return;
  }
  view(`<p class="step">Step 2 of 2</p><h1>What is one of the kindest things you've done for someone else?</h1>
  <form id="f" novalidate>${answerBox('a2', 'Your answer')}
  <label class="consent"><input type="checkbox" id="consent" required> <span>${CONSENT}</span></label>
  <p class="hint">Please leave out names, phone numbers and emails. We remove them automatically.</p>
  <p class="err" id="msg" role="alert"></p>
  <div class="row"><button class="btn alt" type="button" id="back">Back</button><button class="btn" type="submit" id="submit">Share my kindness</button></div></form>`, 'Kindness given');
  wireAnswer('a2');
  $('#back').onclick = () => { flow1(1); $('#a1').value = stash.a1?.text || ''; answers.a1 = { blob: stash.a1?.blob, transcribed: stash.a1?.transcribed }; };
  $('#f').onsubmit = async e => {
    e.preventDefault();
    if (!$('#consent').checked) { $('#msg').textContent = 'Please tick the box to agree before sharing.'; return; }
    if (!$('#a2').value.trim() && !answers.a2?.blob) { $('#msg').textContent = 'Please type or record an answer first.'; return; }
    $('#submit').disabled = true; $('#msg').textContent = '';
    try {
      // rebuild answer 1 from the stash
      const items = [];
      const a1 = stash.a1; const keep1 = !!a1.blob;
      if (a1.text.trim() || keep1) items.push({ flow: 'received', text: a1.text.trim(), consent: true, input_mode: keep1 ? (a1.text.trim() ? 'audio+transcript' : 'audio') : 'text', audio_blob: a1.blob || null, audio_data: keep1 && isDemo() ? await blobToDataURL(a1.blob) : null });
      const a2 = await collect('a2', 'given', true); if (a2) items.push(a2);
      await backend.submit(items); markShared('flow1'); refreshTally(); location.hash = '#/thanks1';
    } catch (err) { $('#submit').disabled = false; $('#msg').textContent = 'Sorry, that didn\'t send. Please try again.'; }
  };
}
const stash = {};

async function thanks(flow) {
  const flows = flow === 1 ? ['received', 'given'] : ['inspired'];
  view(`<h1>Thank you. 💛</h1><p class="lead">Here is what others have shared${flow === 2 ? ' about kind acts the project inspired' : ''}.</p>
  <p class="hint">New entries may take a little while to appear after a quick check.</p><div id="list">Loading…</div>
  <div class="stack">${flow === 2 ? '<a class="btn" href="#/share">Share the Kindness Project</a>' : '<a class="btn" href="#/flow2">Tell us a kind act it inspired</a><a class="btn alt" href="#/share">Share the Kindness Project</a>'}</div>`, 'Thank you');
  $('#list').innerHTML = feedList(await backend.feed(flows));
}

function flow2() {
  view(`<h1>Have you done a kind act for yourself or someone else inspired by the Kindness Project?</h1>
  <form id="f" novalidate>${answerBox('a3', 'Tell us about it')}
  <label class="consent"><input type="checkbox" id="consent" required> <span>${CONSENT}</span></label>
  <p class="hint">Please leave out names, phone numbers and emails. We remove them automatically.</p>
  <p class="err" id="msg" role="alert"></p><div class="row"><button class="btn" type="submit" id="submit">Share it</button></div></form>`, 'Kind acts inspired');
  wireAnswer('a3');
  $('#f').onsubmit = async e => {
    e.preventDefault();
    if (!$('#consent').checked) { $('#msg').textContent = 'Please tick the box to agree before sharing.'; return; }
    const it = await collect('a3', 'inspired', true); if (!it) { $('#msg').textContent = 'Please type or record an answer first.'; return; }
    $('#submit').disabled = true;
    try { await backend.submit([it]); markShared('flow2'); refreshTally(); location.hash = '#/thanks2'; }
    catch { $('#submit').disabled = false; $('#msg').textContent = 'Sorry, that didn\'t send. Please try again.'; }
  };
}

function share() {
  const url = siteUrl(), msg = 'I thought you would enjoy the Kindness Project: share a kindness, anonymously.';
  const enc = encodeURIComponent, full = msg + ' ' + url;
  view(`<h1>Pass it on</h1><p class="lead">Know someone who'd enjoy this? Send them the Kindness Project.</p>
  <div class="stack">${navigator.share ? '<button class="btn" id="native">Share…</button>' : ''}
  <button class="btn alt" id="copy">Copy link</button>
  <a class="btn alt" href="sms:?&body=${enc(full)}">Text message</a>
  <a class="btn alt" href="mailto:?subject=${enc('The Kindness Project')}&body=${enc(full)}">Email</a>
  <a class="btn alt" href="https://wa.me/?text=${enc(full)}" target="_blank" rel="noopener">WhatsApp</a></div>
  <p class="okmsg" id="msg" role="status"></p><p><a href="#/">Back to start</a></p>`, 'Share');
  if (navigator.share) $('#native').onclick = () => navigator.share({ title: 'The Kindness Project', text: msg, url }).catch(() => {});
  $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(url); $('#msg').textContent = 'Link copied.'; } catch { prompt('Copy this link:', url); } };
}

async function feedPage() {
  const s = shared();
  if (!s.flow1 && !s.flow2) { view(`<h1>Share first, then see</h1><p class="lead">Everyone's stories open up after you share your own.</p><div class="stack"><a class="btn" href="#/flow1">Share a kindness</a></div>`); return; }
  view(`<h1>Everyone's kindness</h1><div id="list">Loading…</div>`, 'Feed');
  $('#list').innerHTML = feedList(await backend.feed(['received', 'given', 'inspired']));
}

async function book(codeIn) {
  view(`<h1>You found a copy of <em>Kindness</em></h1><p class="lead">Each copy has a short code inside, like KB-7Q3M. Log where this copy has been and what kindness it sparked.</p>
  <form id="f" novalidate><label for="code">Book code</label><input type="text" id="code" autocomplete="off" autocapitalize="characters" placeholder="KB-XXXX" value="${esc(codeIn || '')}">
  <label for="place">Where are you? (a town or place, not your address)</label><input type="text" id="place" maxlength="120" placeholder="e.g. a café in Lisbon">
  <label for="story">What kindness did it prompt? (optional)</label><textarea id="story" maxlength="2000"></textarea>
  <label class="consent"><input type="checkbox" id="consent"> <span>${CONSENT}</span></label>
  <p class="err" id="msg" role="alert"></p><div class="row"><button class="btn" type="submit" id="submit">Log this copy</button></div></form><div id="trail"></div>`, 'Book code');
  $('#f').onsubmit = async e => {
    e.preventDefault(); const code = normalizeCode($('#code').value); $('#msg').textContent = '';
    if (!isValidCode(code) || !(await backend.checkCode(code))) { $('#msg').textContent = 'We couldn\'t find that code. Check the inside cover and try again.'; return; }
    if (!$('#place').value.trim()) { $('#msg').textContent = 'Please say where the book is now.'; return; }
    if (!$('#consent').checked) { $('#msg').textContent = 'Please tick the box to agree before sharing.'; return; }
    $('#submit').disabled = true;
    try {
      await backend.logBook(code, $('#place').value.trim(), $('#story').value.trim(), true); refreshTally();
      const trail = await backend.bookTrail(code);
      main.innerHTML = `<h1>Logged. Thank you! 📖</h1><p class="lead">Copy <strong>${esc(code)}</strong> has been to:</p>
      <ul class="feed">${trail.map(t => `<li><strong>${esc(t.place)}</strong>${t.story ? '<br>' + esc(t.story) : ''}<div class="meta">${new Date(t.created_at).toLocaleDateString()}</div></li>`).join('') || '<li>Your log is waiting for a quick check.</li>'}</ul>
      <div class="stack"><a class="btn" href="#/flow1">Share a kindness</a><a class="btn alt" href="#/share">Pass it on</a></div>`;
    } catch { $('#submit').disabled = false; $('#msg').textContent = 'Sorry, that didn\'t save. Please try again.'; }
  };
}

// ---------- admin ----------
let adminOk = false;
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
async function admin() {
  if (!adminOk) {
    view(`<h1>Admin</h1>${isDemo() ? '<p class="hint">Demo mode: any email, password <code>demo</code>.</p>' : ''}
    <form id="f" novalidate><label for="em">Email</label><input type="email" id="em" autocomplete="username"><label for="pw">Password</label><input type="password" id="pw" autocomplete="current-password">
    <p class="err" id="msg" role="alert"></p><div class="row"><button class="btn" type="submit">Sign in</button></div></form>`, 'Admin');
    $('#f').onsubmit = async e => { e.preventDefault(); try { await backend.login($('#em').value, $('#pw').value); adminOk = true; admin(); } catch (err) { $('#msg').textContent = err.message; } };
    return;
  }
  const d = await backend.adminAll();
  const pend = d.entries.filter(e => e.status === 'pending'), pendL = d.logs.filter(l => l.status === 'pending');
  const row = (kind, e, body) => `<tr data-id="${e.id}"><td>${body}${e.flags?.length ? `<div class="flagged">Flagged: ${esc(e.flags.join(', '))}</div>` : ''}</td>
    <td><button class="btn small" data-act="approved" data-kind="${kind}" data-id="${e.id}">Approve</button> <button class="btn small alt" data-act="rejected" data-kind="${kind}" data-id="${e.id}">Reject</button></td></tr>`;
  view(`<h1>Admin</h1>
  <div class="card"><h2>Waiting for review (${pend.length + pendL.length})</h2>
  <table aria-label="Pending entries"><tbody id="pending">${pend.map(e => row('entries', e, `<span class="tag">${e.flow}</span>${esc(e.text) || '(voice)'}${e.audio_url ? `<audio controls preload="none" src="${esc(e.audio_url)}"></audio>` : ''}`)).join('')}
  ${pendL.map(l => row('logs', l, `<span class="tag">book ${esc(l.code)}</span>${esc(l.place)} — ${esc(l.story)}`)).join('')}</tbody></table>
  ${pend.length + pendL.length ? '' : '<p class="hint">Nothing waiting. 🎉</p>'}</div>
  <div class="card"><h2>Settings</h2><label class="consent"><input type="checkbox" id="auto" ${d.settings.auto_approve_clean ? 'checked' : ''}> Publish clean entries right away (flagged ones always wait for you)</label></div>
  <div class="card"><h2>Export approved entries</h2><p class="hint">${d.entries.filter(e => e.status === 'approved').length} approved, with consent flag.</p>
  <div class="row"><button class="btn" id="csv">Download CSV</button><button class="btn alt" id="json">Download JSON</button></div></div>
  <div class="card"><h2>Book codes</h2><label for="n">Make new codes for a print run</label><input type="text" id="n" inputmode="numeric" value="50">
  <div class="row"><button class="btn alt" id="gen">Create &amp; download codes</button></div></div>
  <div class="card"><h2>All approved (${d.entries.filter(e => e.status === 'approved').length})</h2>${feedList(d.entries.filter(e => e.status === 'approved'))}</div>`, 'Admin');
  main.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => { await backend.setStatus(b.dataset.kind, b.dataset.id, b.dataset.act); refreshTally(); admin(); });
  $('#auto').onchange = e => backend.setAutoApprove(e.target.checked);
  const stamp = new Date().toISOString().slice(0, 10);
  $('#csv').onclick = () => download(`kindness-approved-${stamp}.csv`, toCSV(d.entries), 'text/csv');
  $('#json').onclick = () => download(`kindness-approved-${stamp}.json`, toJSON(d.entries), 'application/json');
  $('#gen').onclick = async () => { const n = Math.min(5000, Math.max(1, parseInt($('#n').value, 10) || 0)); const codes = generateCodes(n); await backend.addCodes(codes); download(`book-codes-${stamp}.csv`, 'code\r\n' + codes.join('\r\n') + '\r\n', 'text/csv'); };
}

// ---------- router ----------
async function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, arg] = h.split('/');
  // query-string aliases so printed QR codes stay short and robust: ?f=1, ?f=2, ?code=KB-XXXX
  const q = new URLSearchParams(location.search);
  if (!h && q.get('f')) { location.replace('#/flow' + q.get('f')); return; }
  if (!h && q.get('code')) { location.replace('#/book/' + q.get('code')); return; }
  ({ '': home, flow1: () => flow1(1), flow2, thanks1: () => thanks(1), thanks2: () => thanks(2), share, feed: feedPage, book: () => book(arg), admin }[p] || home)();
}
window.addEventListener('hashchange', route);
route(); refreshTally();
