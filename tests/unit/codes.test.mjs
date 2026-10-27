import test from 'node:test'; import assert from 'node:assert/strict';
import { generateCodes, isValidCode, normalizeCode, ALPHABET } from '../../js/codes.js';
test('alphabet has no ambiguous chars', () => { for (const c of '01OIL') assert.ok(!ALPHABET.includes(c)); });
test('generates N unique valid codes', () => { const c = generateCodes(2000); assert.equal(new Set(c).size, 2000); c.forEach(x => assert.ok(isValidCode(x), x)); });
test('respects existing codes', () => { const ex = new Set(generateCodes(100)); generateCodes(500, Math.random, ex).forEach(c => assert.ok(!ex.has(c))); });
test('normalizes user input', () => { assert.equal(normalizeCode(' kb 7q3m '), 'KB-7Q3M'); assert.equal(normalizeCode('7q3m'), 'KB-7Q3M'); assert.equal(isValidCode(normalizeCode('KB-O1IL')), false); });
