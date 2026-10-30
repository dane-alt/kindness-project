import { CONFIG, isDemo } from './config.js?v=3';
import { backend, blobToDataURL } from './backend.js?v=3';
import { Recorder, canRecord, canTranscribe } from './recorder.js?v=3';
import { normalizeCode, isValidCode, generateCodes } from './codes.js?v=3';
import { toCSV, toJSON } from './export.js?v=3';
import { STORIES, RESEARCH } from './content.js?v=3';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SHARED = 'kp-shared'; // remembers on this device which flows you've shared in (so feeds unlock). Nothing is sent.
const shared = () => JSON.parse(localStorage.getItem(SHARED) || '{}');
const markShared = f => localStorage.setItem(SHARED, JSON.stringify({ ...shared(), [f]: true }));
const siteUrl = () => CONFIG.SITE_URL || location.href.split('#')[0];
const CONSENT = 'I understand my answers will be public (without my name) and may appear in the book <em>Kindness</em> by Dane E. Rose.';

async function refreshTally() {}

function view(html, title) { main.innerHTML = html; document.title = 'Kindness'; main.focus(); window.scrollTo(0, 0); }

// ---------- answer widget (type, speak, or speak-to-text) ----------
const PERMIT = 'I give permission for my anonymous story to be shared to inspire others as part of the Kindness Project.';
function answerBox(id, label) {
  return `<p class="byvoice">Share your story by voice or by text.</p>
  ${canRecord() ? `<div class="voice"><button type="button" class="btn alt rec" data-rec="${id}" aria-pressed="false">🎙️ Record</button>
  <span class="hint" data-status="${id}" aria-live="polite"></span>
  <audio controls data-audio="${id}" hidden></audio></div>` : ''}
  <textarea id="${id}" name="${id}" maxlength="4000" aria-label="${label}" placeholder="Or type your story here"></textarea>
  <label class="consent"><input type="checkbox" id="consent"> <span>${PERMIT}</span></label>`;
}
const answers = {};
main.addEventListener('change', e => { if (e.target.id === 'consent') { const m = $('#msg'); if (m) m.textContent = ''; } });
function wireAnswer(id) {
  answers[id] = { blob: null };
  const btn = $(`[data-rec="${id}"]`); if (!btn) return;
  const st = $(`[data-status="${id}"]`), au = $(`[data-audio="${id}"]`);
  let r = null;
  btn.onclick = async () => {
    if (!r) {
      r = new Recorder({});
      try { await r.start(); } catch { r = null; st.textContent = 'Please allow the microphone, or type instead.'; return; }
      btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); btn.textContent = '⏹ Stop'; st.textContent = '';
    } else {
      const blob = await r.stop(); r = null; answers[id].blob = blob;
      btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false'); btn.textContent = '🎙️ Record again';
      au.hidden = false; au.src = URL.createObjectURL(blob);
    }
  };
}
async function collect(id, flow, consent) {
  const text = $('#' + id).value.trim(), blob = (answers[id] || {}).blob;
  if (!text && !blob) return null;
  const mode = blob ? (text ? 'audio+transcript' : 'audio') : 'text';
  return { flow, text, input_mode: mode, consent, audio_blob: blob || null, audio_data: blob && isDemo() ? await blobToDataURL(blob) : null };
}

function feedList(items, empty = 'No entries yet. Yours could be the first.') {
  if (!items.length) return `<p class="hint">${empty}</p>`;
  const lbl = { received: 'Received', given: 'Given', inspired: 'Inspired' };
  return `<ul class="feed">${items.map(e => `<li><span class="tag">${lbl[e.flow] || ''}</span>${esc(e.text) || '<em>(voice)</em>'}
    ${e.audio_url ? `<audio controls preload="none" src="${esc(e.audio_url)}"></audio>` : ''}
    <div class="meta">${new Date(e.created_at).toLocaleDateString()}</div></li>`).join('')}</ul>`;
}

// ---------- screens ----------
const md = t => esc(t).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const NOTES = ['You matter.', 'Someone is glad you exist.', 'Thank you for being here.', 'You are doing better than you think.', 'Kindness looks good on you.', 'Pass it on.', 'The world is softer because of you.', 'Breathe. You belong here.'];
const BIRD = c => `<svg viewBox="0 0 34 20" aria-hidden="true"><ellipse cx="17" cy="12" rx="8" ry="4.5" fill="${c}"/><circle cx="25" cy="9.5" r="3.3" fill="${c}"/><path d="M28 9.5l4 1-4 1z" fill="#ffc94a"/><path class="wing" d="M12 11 Q17 0 22 11z" fill="${c}" opacity=".85"/><path d="M9 12 L2 9 L4 13z" fill="${c}"/></svg>`;
function sparkleScene(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cols = ['#ff6f61', '#ffc94a', '#5bc0eb', '#9be564', '#b39ddb'];
  for (let i = 0; i < 4; i++) {
    const b = document.createElement('button'); b.className = 'bird'; b.type = 'button'; b.setAttribute('aria-label', 'A bird with a message');
    b.style.cssText = `top:${8 + i * 13}%;animation-duration:${14 + i * 5}s;animation-delay:-${i * 4}s;background:none;border:0;padding:0`;
    b.innerHTML = BIRD(cols[i % cols.length]);
    b.onclick = e => { e.stopPropagation(); showNote(root, e.clientX, e.clientY); };
    root.appendChild(b);
  }
  for (let i = 0; i < 10; i++) { const f = document.createElement('i'); f.className = 'firefly'; f.style.cssText = `left:${Math.random() * 90 + 5}%;top:${Math.random() * 60 + 25}%;animation-delay:-${Math.random() * 7}s;animation-duration:${5 + Math.random() * 5}s`; root.appendChild(f); }
}
function showNote(host, x, y) {
  const r = host.getBoundingClientRect(), n = document.createElement('div'); n.className = 'note';
  n.textContent = NOTES[Math.random() * NOTES.length | 0];
  n.style.left = Math.min(Math.max(x - r.left, 90), r.width - 90) + 'px'; n.style.top = (y - r.top) + 'px';
  host.appendChild(n); setTimeout(() => n.remove(), 3300);
}
function home() {
  view(`<section class="home"><a class="journey-btn" href="#journey">Take the kindness journey</a></section>`);
}

const LEAF = `<svg class="leafy" viewBox="0 0 64 64" aria-hidden="true"><path d="M10 54C10 26 30 10 56 8c-2 26-18 46-46 46z" fill="#2f9e5f"/><path d="M12 52C24 40 36 28 50 14" stroke="#e8f3e2" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="50" cy="48" r="5" fill="#ff6f61"/><circle cx="40" cy="56" r="3.5" fill="#ffc94a"/></svg>`;
const IDEAS = [
  { title: 'Plant a tree', sub: 'One tree for about a dollar', href: 'https://onetreeplanted.org/products/plant-trees',
    art: '<img src="img/tile-tree.jpg" alt="A child planting a tree in the jungle" loading="lazy">' },
  { title: 'Give some flowers', sub: 'Find a florist near you', href: 'https://www.google.com/maps/search/florist+near+me',
    art: '<img src="img/tile-flowers.jpg" alt="Hands giving tropical flowers" loading="lazy">' },
  { title: 'Send an appreciation', sub: 'A text or email to someone you really appreciate', href: '#appreciate',
    art: '<img src="img/tile-thanks.jpg" alt="Birds carrying thank-you notes from a phone" loading="lazy">' },
];
function journey(step = 1) {
  if (step < 3) {
    const id = 'j' + step, flow = step === 1 ? 'received' : 'given';
    const q = step === 1 ? 'What is the kindest thing anyone has done for you?' : 'What is one thing you have done for yourself or others just to be kind?';
    view(`<div class="journey"><h1 class="q">${q}</h1>
    <form id="f" novalidate>${answerBox(id, q)}<p class="err" id="msg" role="alert"></p>
    <div class="row"><button class="btn" type="submit" id="submit">Submit</button></div></form></div>`);
    wireAnswer(id);
    $('#f').onsubmit = async e => {
      e.preventDefault();
      if (!$('#' + id).value.trim() && !answers[id]?.blob) { $('#msg').textContent = 'Please record or type your story first.'; return; }
      if (!$('#consent').checked) { $('#msg').textContent = 'Please tick the box to share.'; return; }
      $('#submit').disabled = true;
      try { const it = await collect(id, flow, true); await backend.submit([it]); markShared('flow1'); location.hash = step === 1 ? '#journey2' : '#journey3'; }
      catch { $('#submit').disabled = false; $('#msg').textContent = 'Sorry, that didn\'t send. Please try again.'; }
    };
    return;
  }
  view(`<div class="journey"><h1>Thank you so much for participating in the Kindness Project.</h1>
  <h2 class="q">Is there anything big or small that has the energy of kindness around it that you could do right now?</h2>
  <p class="lead">Do you need ideas?</p>
  <div class="ideas">${IDEAS.map(i => `<a class="idea" href="${i.href}" ${i.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${i.art}<span>${i.title}</span></a>`).join('')}</div>
  <form id="f" novalidate>${answerBox('j3', 'What you could do right now')}<p class="err" id="msg" role="alert"></p>
  <div class="row"><button class="btn" type="submit" id="submit">Submit</button></div></form></div>`);
  wireAnswer('j3');
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const has = $('#j3').value.trim() || answers.j3?.blob;
    if (has && !$('#consent').checked) { $('#msg').textContent = 'Please tick the box to share.'; return; }
    $('#submit').disabled = true;
    try { if (has) { const it = await collect('j3', 'inspired', true); await backend.submit([it]); } location.hash = '#gift'; }
    catch { $('#submit').disabled = false; $('#msg').textContent = 'Sorry, that didn\'t send. Please try again.'; }
  };
}

function gift() {
  view(`<div class="journey gift"><h1>A book on kindness</h1>
  <img class="book3d" src="img/book-3d.png" alt="The book Kindness by Dane E. Rose">
  <p>This book and audiobook are not available for sale anywhere. They are a gift.</p>
  <p>If you would like to receive the book, please enter your email address below. Your email address will be used only for the Kindness Project and never shared with anyone else. Your book and audiobook will arrive within 30 days.</p>
  <form id="bf" novalidate><input type="email" id="bem" autocomplete="email" inputmode="email" aria-label="Your email address" placeholder="Your email address">
  <p class="err" id="bmsg" role="alert"></p>
  <div class="row"><button class="btn" type="submit" id="bsub">Submit</button></div></form></div>`);
  $('#bf').onsubmit = async e => {
    e.preventDefault();
    const em = $('#bem').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { $('#bmsg').textContent = 'Please enter a valid email address.'; return; }
    $('#bsub').disabled = true;
    try { await backend.requestBook(em); $('#bf').outerHTML = '<p class="done">Thank you. Your book and audiobook will arrive within 30 days.</p>'; }
    catch { $('#bsub').disabled = false; $('#bmsg').textContent = 'Sorry, that didn\'t send. Please try again.'; }
  };
}

function appreciate() {
  const msg = 'I just wanted to tell you how much I appreciate you. Thank you for being in my life.';
  const enc = encodeURIComponent;
  view(`<div class="journey">${LEAF}<h1 class="q">Send a specific appreciation</h1>
  <p class="lead">Think of one person you really appreciate. Tell them one specific thing they did and what it meant to you.</p>
  <label for="ap">Your message</label><textarea id="ap">${esc(msg)}</textarea>
  <div class="stack"><a class="btn" id="sms" href="sms:?&body=${enc(msg)}">Send as a text</a>
  <a class="btn alt" id="mail" href="mailto:?subject=${enc('Thank you')}&body=${enc(msg)}">Send as an email</a>
  <button class="btn alt" id="cp" type="button">Copy the message</button></div><p class="okmsg" id="m" role="status"></p>
  <p><a href="#journey3">Back to ideas</a></p></div>`, 'Send an appreciation');
  const upd = () => { const v = enc($('#ap').value); $('#sms').href = 'sms:?&body=' + v; $('#mail').href = 'mailto:?subject=' + enc('Thank you') + '&body=' + v; };
  $('#ap').oninput = upd;
  $('#cp').onclick = async () => { try { await navigator.clipboard.writeText($('#ap').value); $('#m').textContent = 'Copied. Paste it anywhere.'; } catch { $('#ap').select(); } };
}

function stories(filter = 'All') {
  const stages = ['All', ...new Set(STORIES.map(s => s.stage))];
  const list = STORIES.map((s, i) => ({ ...s, i })).filter(s => filter === 'All' || s.stage === filter);
  view(`<p class="eyebrow">True stories</p><h1>Kindness, in the light and in the dark</h1>
  <p class="lead">Real people, real places, real costs. The circle runs from simple generosity to the kindness found at the end of a life. Tap a story to read it.</p>
  <div class="chips" role="group" aria-label="Filter stories">${stages.map(st => `<button class="chip" data-st="${esc(st)}" aria-pressed="${st === filter}">${esc(st)}</button>`).join('')}</div>
  ${list.map(s => `<details class="story" id="s${s.i + 1}"><summary><span class="tag">${esc(s.stage)}</span><h3>${esc(s.title)}</h3><span class="who">${esc(s.people)}</span></summary>
  <blockquote>${md(s.quote)}</blockquote><p>${md(s.story)}</p>
  ${s.today ? `<div class="today"><p class="eyebrow">Still reaching us today</p><p>${md(s.today)}</p></div>` : ''}
  ${s.sources.length ? `<p class="src">Sources: ${s.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a>`).join(' · ')}</p>` : ''}</details>`).join('')}
  <div class="stack"><a class="btn warm" href="#journey">Take the kindness journey</a></div>`, 'Stories');
  main.querySelectorAll('[data-st]').forEach(b => b.onclick = () => stories(b.dataset.st));
}

function research() {
  view(`<p class="eyebrow">Happiness research</p><h1>Small kindnesses, measured</h1>
  <p class="lead">Each of these comes from a published study. Pick one and try it today. None takes more than twenty minutes.</p>
  ${RESEARCH.map(r => `<div class="finding"><p class="try">${md(r.action)}</p><p class="why">${md(r.research)}${r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener">Read more</a>` : ''}</p></div>`).join('')}
  <div class="stack"><a class="btn warm" href="#flow2">I tried one: share what happened</a></div>`, 'Research');
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
      await backend.submit(items); markShared('flow1'); refreshTally(); location.hash = '#thanks1';
    } catch (err) { $('#submit').disabled = false; $('#msg').textContent = 'Sorry, that didn\'t send. Please try again.'; }
  };
}
const stash = {};

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
  const x = c.getContext('2d'), W = c.width = innerWidth, H = c.height = innerHeight, cols = ['#0b8a63', '#ffcc4d', '#ff7a59', '#7fd8b3'];
  const ps = Array.from({ length: 90 }, () => ({ x: W / 2, y: H * .35, vx: (Math.random() - .5) * 9, vy: -Math.random() * 9 - 3, r: 3 + Math.random() * 4, c: cols[Math.random() * 5 | 0] }));
  let t = 0; (function f() { x.clearRect(0, 0, W, H); ps.forEach(p => { p.vy += .25; p.x += p.vx; p.y += p.vy; x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill(); }); if (++t < 110) requestAnimationFrame(f); else c.remove(); })();
}
async function thanks(flow) {
  setTimeout(confetti, 50);
  const flows = flow === 1 ? ['received', 'given'] : ['inspired'];
  view(`<h1>Thank you.</h1><p class="lead">Here is what others have shared${flow === 2 ? ' about kind acts the project inspired' : ''}.</p>
  <p class="hint">Yours will appear here within a minute, once our kindness check has read it.</p><div id="list">Loading…</div>
  <div class="stack">${flow === 2 ? '<a class="btn" href="#share">Share the Kindness Project</a>' : '<a class="btn" href="#flow2">Tell us a kind act it inspired</a><a class="btn alt" href="#share">Share the Kindness Project</a>'}</div>`, 'Thank you');
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
    try { await backend.submit([it]); markShared('flow2'); refreshTally(); location.hash = '#thanks2'; }
    catch { $('#submit').disabled = false; $('#msg').textContent = 'Sorry, that didn\'t send. Please try again.'; }
  };
}

function share() {
  const url = siteUrl(), msg = 'I thought you would enjoy the Kindness Project: true stories of kindness, and a place to share your own.';
  const enc = encodeURIComponent, full = msg + ' ' + url;
  view(`<h1>Pass it on</h1><p class="lead">Know someone who'd enjoy this? Send them the link, or let them scan this code.</p><img class="qr" src="qr/kindness-project-qr.svg" alt="QR code for the Kindness Project" width="220" height="220"><p class="src" style="text-align:center">${esc(url)}</p>
  <div class="stack">${navigator.share ? '<button class="btn" id="native">Share…</button>' : ''}
  <button class="btn alt" id="copy">Copy link</button>
  <a class="btn alt" href="sms:?&body=${enc(full)}">Text message</a>
  <a class="btn alt" href="mailto:?subject=${enc('The Kindness Project')}&body=${enc(full)}">Email</a>
  <a class="btn alt" href="https://wa.me/?text=${enc(full)}" target="_blank" rel="noopener">WhatsApp</a></div>
  <p class="okmsg" id="msg" role="status"></p><p><a href="#">Back to start</a></p>`, 'Share');
  if (navigator.share) $('#native').onclick = () => navigator.share({ title: 'The Kindness Project', text: msg, url }).catch(() => {});
  $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(url); $('#msg').textContent = 'Link copied.'; } catch { prompt('Copy this link:', url); } };
}

async function feedPage() {
  const s = shared();
  if (!s.flow1 && !s.flow2) { view(`<h1>Share first, then see</h1><p class="lead">Everyone's stories open up after you share your own.</p><div class="stack"><a class="btn" href="#journey">Take the kindness journey</a></div>`); return; }
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
      <div class="stack"><a class="btn" href="#flow1">Share a kindness</a><a class="btn alt" href="#share">Pass it on</a></div>`;
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
  const row = (kind, e, body) => `<tr data-id="${e.id}"><td>${body}${e.ai_reason ? `<div class="flagged">Kindness check: ${esc(e.ai_reason)}</div>` : ''}${e.flags?.length ? `<div class="flagged">Flagged: ${esc(e.flags.join(', '))}</div>` : ''}</td>
    <td><button class="btn small" data-act="approved" data-kind="${kind}" data-id="${e.id}">Approve</button> <button class="btn small alt" data-act="rejected" data-kind="${kind}" data-id="${e.id}">Reject</button></td></tr>`;
  view(`<h1>Admin</h1>
  <div class="card"><h2>Waiting for review (${pend.length + pendL.length})</h2>
  <table aria-label="Pending entries"><tbody id="pending">${pend.map(e => row('entries', e, `<span class="tag">${e.flow}</span>${esc(e.text) || '(voice)'}${e.audio_url ? `<audio controls preload="none" src="${esc(e.audio_url)}"></audio>` : ''}`)).join('')}
  ${pendL.map(l => row('logs', l, `<span class="tag">book ${esc(l.code)}</span>${esc(l.place)} — ${esc(l.story)}`)).join('')}</tbody></table>
  ${pend.length + pendL.length ? '' : '<p class="hint">Nothing waiting. 🎉</p>'}</div>
  <div class="card"><h2>Settings</h2><label class="consent"><input type="checkbox" id="auto" ${d.settings.auto_approve_clean ? 'checked' : ''}> Publish clean entries right away (flagged ones always wait for you)</label></div>
  <div class="card"><h2>Export approved entries</h2><p class="hint">${d.entries.filter(e => e.status === 'approved').length} approved, with consent flag.</p>
  <div class="row"><button class="btn" id="csv">Download CSV</button><button class="btn alt" id="json">Download JSON</button></div></div>
  <div class="card"><h2>Book requests (${(d.requests || []).length})</h2><p class="hint">Emails from people who asked for the book and audiobook.</p>
  <div class="row"><button class="btn alt" id="reqcsv">Download emails (CSV)</button></div></div>
  <div class="card"><h2>Book codes</h2><label for="n">Make new codes for a print run</label><input type="text" id="n" inputmode="numeric" value="50">
  <div class="row"><button class="btn alt" id="gen">Create &amp; download codes</button></div></div>
  <div class="card"><h2>All approved (${d.entries.filter(e => e.status === 'approved').length})</h2>${feedList(d.entries.filter(e => e.status === 'approved'))}</div>`, 'Admin');
  main.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => { await backend.setStatus(b.dataset.kind, b.dataset.id, b.dataset.act); refreshTally(); admin(); });
  $('#auto').onchange = e => backend.setAutoApprove(e.target.checked);
  const stamp = new Date().toISOString().slice(0, 10);
  $('#csv').onclick = () => download(`kindness-approved-${stamp}.csv`, toCSV(d.entries), 'text/csv');
  $('#json').onclick = () => download(`kindness-approved-${stamp}.json`, toJSON(d.entries), 'application/json');
  $('#reqcsv').onclick = () => download(`kindness-book-requests-${stamp}.csv`, 'email,requested_at\r\n' + (d.requests || []).map(r => `${r.email},${r.created_at}`).join('\r\n') + '\r\n', 'text/csv');
  $('#gen').onclick = async () => { const n = Math.min(5000, Math.max(1, parseInt($('#n').value, 10) || 0)); const codes = generateCodes(n); await backend.addCodes(codes); download(`book-codes-${stamp}.csv`, 'code\r\n' + codes.join('\r\n') + '\r\n', 'text/csv'); };
}

// ---------- router ----------
async function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, arg] = h.split('/');
  // query-string aliases so printed QR codes stay short and robust: ?f=1, ?f=2, ?code=KB-XXXX
  const q = new URLSearchParams(location.search);
  if (!h && q.get('f')) { location.replace(q.get('f') === '2' ? '#flow2' : '#journey'); return; }
  if (!h && q.get('code')) { location.replace('#book/' + q.get('code')); return; }
  ({ '': home, journey: () => journey(1), journey2: () => journey(2), journey3: () => journey(3), gift, appreciate, stories: () => stories(), research, flow1: () => flow1(1), flow2, thanks1: () => thanks(1), thanks2: () => thanks(2), share, feed: feedPage, book: () => book(arg), admin }[p] || home)();
}
window.addEventListener('hashchange', route);
route();
