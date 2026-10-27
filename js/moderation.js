// Moderation filter shared by browser and tests. The same rules run again in Postgres (see supabase/migrations).
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\s().-]*){7,}/g;
const NAME_PATTERNS = [
  /\b(?:[Mm]y name is|[Ii] am called|[Nn]amed|[Cc]alled)\s+[A-Z][a-z]+/,
  /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+/,
  /@[A-Za-z0-9_]{2,}/, // social handles
];
export const PROFANITY = ['fuck','shit','bitch','bastard','cunt','asshole','dick','slut','whore','fag','faggot','nigger','nigga','retard','kill yourself','kys'];
const PROF_RE = new RegExp('\\b(' + PROFANITY.map(w => w.replace(/ /g, '\\s+')).join('|') + ')\\w*', 'i');

export function moderate(text = '') {
  const flags = [];
  let clean = String(text);
  EMAIL.lastIndex = 0;
  if (EMAIL.test(clean)) { flags.push('email'); clean = clean.replace(EMAIL, '[email removed]'); }
  EMAIL.lastIndex = 0;
  const phoneHits = clean.match(PHONE) || [];
  if (phoneHits.some(p => p.replace(/\D/g, '').length >= 7)) {
    flags.push('phone');
    clean = clean.replace(PHONE, m => (m.replace(/\D/g, '').length >= 7 ? '[number removed] ' : m)).replace(/ +$/,'');
  }
  if (NAME_PATTERNS.some(r => r.test(clean))) flags.push('name');
  if (PROF_RE.test(clean)) flags.push('abusive');
  return { text: clean.trim(), flags, ok: flags.length === 0 };
}

export function decideStatus(flags, autoApproveClean = true) {
  return flags.length === 0 && autoApproveClean ? 'approved' : 'pending';
}
