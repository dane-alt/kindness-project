// Backend adapter. Demo mode = localStorage mock. Live mode = Supabase REST (no SDK, keeps the page light).
import { CONFIG, isDemo } from './config.js';
import { moderate, decideStatus } from './moderation.js';
import { isValidCode } from './codes.js';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

// ---------- DEMO (mock) ----------
const LS = 'kp-demo-v1';
export const DEMO_CODES = ['KB-7Q3M', 'KB-H4XP', 'KB-2RWT'];
function seed() {
  const now = Date.now();
  const e = (flow, text, mins) => ({ id: uid(), flow, text, input_mode: 'text', audio_url: null, consent: true, status: 'approved', flags: [], created_at: new Date(now - mins * 60000).toISOString() });
  return {
    entries: [
      e('received', 'A stranger paid for my groceries when my card was declined. I still feel warm thinking about it.', 300),
      e('given', 'I sat with a neighbor at the hospital so she would not be alone.', 280),
      e('inspired', 'After reading a card, I wrote a thank-you note to my old teacher.', 120),
    ],
    codes: DEMO_CODES.slice(), logs: [], requests: [], settings: { auto_approve_clean: CONFIG.AUTO_APPROVE_CLEAN },
  };
}
const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || seed(); } catch { return seed(); } };
const save = d => localStorage.setItem(LS, JSON.stringify(d));

const demo = {
  async submit(items) {
    const d = load();
    for (const it of items) {
      const m = moderate(it.text || '');
      if (it.audio_data) m.flags.push('audio'); // voice can't be auto-checked, so it waits for review (same rule as the database)
      d.entries.push({ id: uid(), flow: it.flow, text: m.text, input_mode: it.input_mode, audio_url: it.audio_data || null,
        consent: !!it.consent, status: decideStatus(m.flags, d.settings.auto_approve_clean), flags: m.flags, created_at: new Date().toISOString() });
    }
    save(d);
  },
  async requestBook(email) { const d = load(); (d.requests ||= []).push({ email, created_at: new Date().toISOString() }); save(d); },
  async feed(flows) { return load().entries.filter(e => e.status === 'approved' && flows.includes(e.flow)).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
  async tally() { const d = load(); return d.entries.filter(e => e.status === 'approved').length + d.logs.filter(l => l.status === 'approved').length; },
  async checkCode(code) { return load().codes.includes(code); },
  async logBook(code, place, story, consent) {
    if (!isValidCode(code) || !(await this.checkCode(code))) throw new Error('unknown code');
    const d = load(); const m = moderate(story || ''); const p = moderate(place || '');
    const flags = [...new Set([...m.flags, ...p.flags])];
    d.logs.push({ id: uid(), code, place: p.text, story: m.text, consent: !!consent, status: decideStatus(flags, d.settings.auto_approve_clean), flags, created_at: new Date().toISOString() });
    save(d);
  },
  async bookTrail(code) { return load().logs.filter(l => l.code === code && l.status === 'approved'); },
  // admin
  async login(email, password) { if (password !== 'demo') throw new Error('Demo admin password is "demo"'); return true; },
  async adminAll() { const d = load(); return { entries: d.entries, logs: d.logs, settings: d.settings, requests: d.requests || [] }; },
  async setStatus(kind, id, status) { const d = load(); const row = d[kind].find(x => x.id === id); if (row) row.status = status; save(d); },
  async setAutoApprove(v) { const d = load(); d.settings.auto_approve_clean = v; save(d); },
  async addCodes(codes) { const d = load(); d.codes = [...new Set([...d.codes, ...codes])]; save(d); },
};

// ---------- LIVE (Supabase) ----------
let token = null;
const H = (extra = {}) => ({ apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (token || CONFIG.SUPABASE_ANON_KEY), 'Content-Type': 'application/json', ...extra });
async function api(path, opts = {}) {
  const r = await fetch(CONFIG.SUPABASE_URL + path, { ...opts, headers: H(opts.headers) });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const rpc = (fn, body = {}) => api('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(body) });
async function uploadAudio(blob) {
  if (!blob) return null;
  const ext = blob.type.includes('mp4') || blob.type.includes('aac') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const path = `${uid()}.${ext}`;
  const r = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/${CONFIG.AUDIO_BUCKET}/${path}`, { method: 'POST', headers: { apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY, 'Content-Type': blob.type || 'audio/webm' }, body: blob });
  if (!r.ok) throw new Error('audio upload failed');
  return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/${CONFIG.AUDIO_BUCKET}/${path}`;
}
const live = {
  async submit(items) {
    const rows = [];
    for (const it of items) {
      const m = moderate(it.text || ''); // client pre-filter; the database trigger re-checks and sets status
      rows.push({ flow: it.flow, text: m.text, input_mode: it.input_mode, audio_url: await uploadAudio(it.audio_blob), consent: !!it.consent });
    }
    await api('/rest/v1/entries', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
  },
  async requestBook(email) { await api('/rest/v1/book_requests', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ email }) }); },
  async feed(flows) { return api(`/rest/v1/entries?select=id,flow,text,input_mode,audio_url,created_at&status=eq.approved&flow=in.(${flows.join(',')})&order=created_at.desc&limit=200`); },
  async tally() { return rpc('kindness_tally'); },
  async checkCode(code) { return rpc('check_book_code', { p_code: code }); },
  async logBook(code, place, story, consent) {
    await api('/rest/v1/book_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ code, place: moderate(place).text, story: moderate(story).text, consent: !!consent }) });
  },
  async bookTrail(code) { return api(`/rest/v1/book_logs?select=place,story,created_at&code=eq.${encodeURIComponent(code)}&status=eq.approved&order=created_at.asc`); },
  async login(email, password) {
    const r = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!r.ok) throw new Error('Login failed'); token = (await r.json()).access_token;
    if (!(await rpc('is_admin'))) { token = null; throw new Error('This account is not an admin'); }
    return true;
  },
  async adminAll() {
    const [entries, logs, s, requests] = await Promise.all([api('/rest/v1/entries?select=*&order=created_at.desc'), api('/rest/v1/book_logs?select=*&order=created_at.desc'), api('/rest/v1/settings?select=*&id=eq.1'), api('/rest/v1/book_requests?select=email,created_at&order=created_at.desc').catch(() => [])]);
    return { entries, logs, settings: s[0] || { auto_approve_clean: true }, requests };
  },
  async setStatus(kind, id, status) { await api(`/rest/v1/${kind === 'logs' ? 'book_logs' : 'entries'}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); },
  async setAutoApprove(v) { await api('/rest/v1/settings?id=eq.1', { method: 'PATCH', body: JSON.stringify({ auto_approve_clean: v }) }); },
  async addCodes(codes) { await api('/rest/v1/book_codes', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(codes.map(code => ({ code }))) }); },
};

export const backend = isDemo() ? demo : live;
export const blobToDataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
