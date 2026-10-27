export const EXPORT_FIELDS = ['id','flow','text','input_mode','audio_url','consent','status','created_at'];
const esc = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export function approvedOnly(entries) { return entries.filter(e => e.status === 'approved'); }
export function toCSV(entries) {
  const rows = approvedOnly(entries).map(e => EXPORT_FIELDS.map(f => esc(e[f])).join(','));
  return [EXPORT_FIELDS.join(','), ...rows].join('\r\n') + '\r\n';
}
export function toJSON(entries) {
  return JSON.stringify(approvedOnly(entries).map(e => Object.fromEntries(EXPORT_FIELDS.map(f => [f, e[f] ?? null]))), null, 2);
}
