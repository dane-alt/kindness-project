// Book-copy codes: KB-XXXX using characters that can't be confused (no 0/O, 1/I/L).
export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_RE = /^KB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;
export function normalizeCode(input = '') {
  let s = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1'); // map lookalikes, then reject
  if (s.startsWith('KB')) s = s.slice(2);
  return 'KB-' + s;
}
export function isValidCode(code) { return CODE_RE.test(code); }
export function generateCodes(n, rand = Math.random, existing = new Set()) {
  const out = new Set();
  if (n > ALPHABET.length ** 4 - existing.size) throw new Error('too many codes');
  while (out.size < n) {
    let c = 'KB-';
    for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(rand() * ALPHABET.length)];
    if (!existing.has(c)) out.add(c);
  }
  return [...out];
}
