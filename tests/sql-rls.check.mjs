// SQL/RLS check against real Postgres (PGlite, in-process). Run: npm run test:sql (from repo root)
import { PGlite } from '@electric-sql/pglite'; import fs from 'node:fs';
const db = new PGlite();
// minimal Supabase stand-ins
await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
create table storage.buckets(id text primary key,name text,public bool,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id serial, bucket_id text, name text); alter table storage.objects enable row level security;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
grant usage on schema public, auth to anon, authenticated; grant all on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated;`);
await db.exec(fs.readFileSync('./supabase/migrations/001_init.sql','utf8'));
await db.exec(fs.readFileSync('./supabase/seed-codes.example.sql','utf8'));
const q = async (s, p) => (await db.query(s, p)).rows;
await db.exec(`set role anon`);
await db.exec(`insert into entries(flow,text,input_mode,consent,audio_url) values ('received','A kind stranger helped me','text',true,null),('inspired','voice note','audio+transcript',true,'https://x/a.m4a'),('given','call me 415 555 1234','text',true,null)`);
let failed=false; try { await db.exec(`insert into entries(flow,text,consent,status) values ('given','x',true,'approved')`); } catch(e){ failed=true; } console.log('anon cannot set status:', failed);
failed=false; try { await db.exec(`insert into entries(flow,text,consent) values ('given','x',false)`); } catch(e){ failed=true; } console.log('consent required:', failed);
console.log('anon sees:', await q(`select text,status from entries`));
console.log('tally:', await q(`select kindness_tally()`), 'code ok:', await q(`select check_book_code('KB-7Q3M') a, check_book_code('KB-ZZZZ') b`));
await db.exec(`insert into book_logs(code,place,story,consent) values ('KB-7Q3M','Lisbon','left it on a train',true)`);
failed=false; try { await db.exec(`insert into book_logs(code,place,consent) values ('KB-ZZZZ','x',true)`); } catch(e){ failed=true; } console.log('bad code rejected:', failed);
failed=false; try { await q(`select * from book_codes`); console.log('codes rows visible to anon:', (await q(`select * from book_codes`)).length); } catch(e){ console.log('codes select blocked'); }
console.log('anon update affects:', (await db.query(`update entries set status='approved'`)).affectedRows);
await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claims','{"email":"dane@mysticallandscapes.com"}',false);`);
console.log('admin is_admin:', await q(`select is_admin()`), 'admin sees all:', (await q(`select status,flags from entries`)));
console.log('audio+text rows:', await q(`select text,flags,status from entries`)); console.log('admin approve:', (await db.query(`update entries set status='approved' where status='pending'`)).affectedRows);
