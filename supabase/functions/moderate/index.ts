// Kindness Project AI moderator (Supabase Edge Function, runs in the cloud).
// Asks: "Is this conducive to kindness?"  kind -> approved, doubt -> pending + email to Dane, abusive -> rejected.
// Secrets (Supabase > Edge Functions > Secrets): ANTHROPIC_API_KEY, RESEND_API_KEY, KP_WEBHOOK_SECRET,
//   optional: DANE_EMAIL (default dane@mysticallandscapes.com), MODERATOR_MODEL (default claude-haiku-5-5), FROM_EMAIL.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

const SB = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DANE = Deno.env.get('DANE_EMAIL') ?? 'dane@mysticallandscapes.com';
const FROM = Deno.env.get('FROM_EMAIL') ?? 'Kindness Project <onboarding@resend.dev>';
const MODEL = Deno.env.get('MODERATOR_MODEL') ?? 'claude-haiku-5-5';
const SITE = 'https://dane-alt.github.io/kindness-project/';

const SYSTEM = `You moderate posts for The Kindness Project, a public, anonymous site where people share true stories of kindness they received, gave, or were inspired to do. Posts appear publicly and may be quoted in a book.

Answer one question: Is this post conducive to kindness?

Reply with JSON only: {"decision":"kind"|"doubt"|"abusive","reason":"under 15 words"}

"kind": a sincere post that is safe to show the public. Sad, painful or dark experiences told with care are kind. Imperfect grammar and mild everyday language are fine.
"doubt": unclear or borderline. Use it when the post names or could identify a private person (full name, address, workplace, school), mentions suicide, self-harm, abuse or a crisis, looks like advertising or spam, is off-topic, or could embarrass or hurt someone.
"abusive": hateful, harassing, obscene, sexual, threatening, mocking, or trolling.
When unsure between kind and doubt, choose doubt.`;

const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
const tableName = (t: string) => (t === 'book_logs' ? 'book_logs' : 'entries');

async function getRow(table: string, id: string) {
  const r = await fetch(`${SB}/rest/v1/${table}?id=eq.${id}&select=*`, { headers: H });
  const rows = await r.json();
  return rows[0];
}
async function setRow(table: string, id: string, patch: Record<string, unknown>) {
  await fetch(`${SB}/rest/v1/${table}?id=eq.${id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
}

async function askAI(post: string): Promise<{ decision: string; reason: string }> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 120, system: SYSTEM, messages: [{ role: 'user', content: `Post:\n"""\n${post.slice(0, 4000)}\n"""` }] }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = (data.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  const out = JSON.parse(m ? m[0] : text);
  if (!['kind', 'doubt', 'abusive'].includes(out.decision)) throw new Error('bad decision: ' + text);
  return { decision: out.decision, reason: String(out.reason ?? '').slice(0, 200) };
}

async function emailDane(table: string, row: Record<string, unknown>, post: string, reason: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return;
  const kind = table === 'book_logs' ? `book copy ${row.code}` : String(row.flow);
  const audio = row.audio_url ? `\nVoice recording: ${row.audio_url}` : '';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: [DANE],
      subject: 'Kindness Project: one post needs your decision',
      text: `The kindness check was unsure about this post (${kind}).\n\nWhy: ${reason}\n\nPost:\n${post || '(voice only)'}${audio}\n\nApprove or reject it here: ${SITE}#/admin\n`,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.headers.get('x-kp-secret') !== Deno.env.get('KP_WEBHOOK_SECRET')) return new Response('forbidden', { status: 403 });
  const { table: t, id } = await req.json();
  const table = tableName(t);
  const row = await getRow(table, id);
  if (!row || row.status !== 'pending') return new Response('skip');

  const post = table === 'book_logs' ? `Where the book is: ${row.place}\nWhat kindness it prompted: ${row.story}` : String(row.text ?? '');
  let decision = 'doubt', reason = '';
  if (!post.trim()) { reason = 'Voice recording with no text; please listen.'; }
  else {
    try { ({ decision, reason } = await askAI(post)); }
    catch (e) { decision = 'doubt'; reason = 'The kindness check could not run: ' + String(e).slice(0, 120); }
  }
  const status = decision === 'kind' ? 'approved' : decision === 'abusive' ? 'rejected' : 'pending';
  await setRow(table, id, { status, ai_decision: decision, ai_reason: reason });
  if (decision === 'doubt') await emailDane(table, row, post, reason);
  return new Response(JSON.stringify({ decision }), { headers: { 'Content-Type': 'application/json' } });
});
