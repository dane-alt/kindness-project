import test from 'node:test'; import assert from 'node:assert/strict';
import { toCSV, toJSON, EXPORT_FIELDS } from '../../js/export.js';
const rows = [
  { id: '1', flow: 'received', text: 'Plain', input_mode: 'text', consent: true, status: 'approved', created_at: '2026-01-01' },
  { id: '2', flow: 'given', text: 'Has "quotes", commas\nand lines', input_mode: 'audio+transcript', audio_url: 'https://x/a.m4a', consent: true, status: 'approved', created_at: '2026-01-02' },
  { id: '3', flow: 'given', text: 'secret', consent: true, status: 'pending', created_at: '2026-01-03' },
];
test('CSV has header, approved only, escaped', () => {
  const csv = toCSV(rows); const lines = csv.split('\r\n');
  assert.equal(lines[0], EXPORT_FIELDS.join(',')); assert.ok(lines[0].includes('consent'));
  assert.ok(!csv.includes('secret')); assert.ok(csv.includes('"Has ""quotes"", commas\nand lines"')); assert.ok(csv.includes(',true,approved,'));
});
test('JSON approved only with consent flag', () => { const j = JSON.parse(toJSON(rows)); assert.equal(j.length, 2); assert.equal(j[0].consent, true); assert.equal(j[0].audio_url, null); });
