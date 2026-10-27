// Generate N book-copy codes for a print run.
// Usage: npm run codes -- 500            -> CSV to stdout
//        npm run codes -- 500 --sql      -> SQL insert for Supabase
import { generateCodes } from '../js/codes.js';
import { randomInt } from 'node:crypto';
const n = parseInt(process.argv[2] || '100', 10);
const codes = generateCodes(n, () => randomInt(0, 1e9) / 1e9);
if (process.argv.includes('--sql')) console.log('insert into public.book_codes (code) values\n' + codes.map(c => `('${c}')`).join(',\n') + '\non conflict do nothing;');
else console.log('code\n' + codes.join('\n'));
