-- Kindness Project hub: schema, moderation, RLS, storage. Run once in Supabase > SQL Editor (or `supabase db push`).
-- Privacy: no IP addresses, user agents or analytics are stored. Only what people type/record.


-- ---------- tables ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  auto_approve_clean boolean not null default true
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.admins (email text primary key);
-- >>> EDIT: put Dane's admin login email here <<<
insert into public.admins (email) values ('dane@mysticallandscapes.com') on conflict do nothing;

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  flow text not null check (flow in ('received','given','inspired')),
  text text not null default '' check (length(text) <= 4000),
  input_mode text not null default 'text' check (input_mode in ('text','audio','audio+transcript')),
  audio_url text,
  consent boolean not null check (consent = true),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  flags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists entries_status_flow on public.entries (status, flow, created_at desc);

create table if not exists public.book_codes (
  code text primary key check (code ~ '^KB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.book_logs (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.book_codes(code),
  place text not null check (length(place) between 1 and 120),
  story text not null default '' check (length(story) <= 2000),
  consent boolean not null check (consent = true),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  flags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- moderation (server side; mirrors js/moderation.js) ----------
create or replace function public.kp_moderate(t text, out cleaned text, out flags text[])
language plpgsql immutable as $$
begin
  cleaned := coalesce(t, ''); flags := '{}';
  if cleaned ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' then
    flags := array_append(flags, 'email'); cleaned := regexp_replace(cleaned, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email removed]', 'g');
  end if;
  if cleaned ~ '(\+?\d[\s().-]*){7,}' then
    flags := array_append(flags, 'phone'); cleaned := regexp_replace(cleaned, '(\+?\d[\s().-]*){7,}', '[number removed] ', 'g');
  end if;
  if cleaned ~ '([Mm]y name is|[Ii] am called|[Nn]amed|[Cc]alled)\s+[A-Z][a-z]+' or cleaned ~ '(Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+' or cleaned ~ '@[A-Za-z0-9_]{2,}' then
    flags := array_append(flags, 'name');
  end if;
  if cleaned ~* '\m(fuck|shit|bitch|bastard|cunt|asshole|dick|slut|whore|fag|faggot|nigger|nigga|retard|kill\s+yourself|kys)' then
    flags := array_append(flags, 'abusive');
  end if;
  cleaned := btrim(cleaned);
end $$;

create or replace function public.kp_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; m2 record; auto boolean;
begin
  select auto_approve_clean into auto from settings where id = 1;
  if tg_table_name = 'entries' then
    m := kp_moderate(new.text); new.text := m.cleaned; new.flags := m.flags;
    if new.audio_url is not null then new.flags := array_append(new.flags, 'audio'); end if; -- audio can't be auto-checked
  else
    m := kp_moderate(new.story); m2 := kp_moderate(new.place);
    new.story := m.cleaned; new.place := m2.cleaned; new.flags := m.flags || m2.flags;
  end if;
  -- anon can never choose its own status
  new.status := case when coalesce(auto, true) and cardinality(new.flags) = 0 then 'approved' else 'pending' end;
  new.created_at := now();
  return new;
end $$;
-- NOTE: voice recordings are held for review by default (they can contain names). Remove the 'audio' line above to auto-publish them.

drop trigger if exists entries_mod on public.entries;
create trigger entries_mod before insert on public.entries for each row execute function public.kp_before_insert();
drop trigger if exists book_logs_mod on public.book_logs;
create trigger book_logs_mod before insert on public.book_logs for each row execute function public.kp_before_insert();

-- ---------- helper RPCs ----------
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = coalesce(auth.jwt() ->> 'email', ''));
$$;
create or replace function public.kindness_tally() returns bigint language sql stable security definer set search_path = public as $$
  select (select count(*) from entries where status = 'approved') + (select count(*) from book_logs where status = 'approved');
$$;
create or replace function public.check_book_code(p_code text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from book_codes where code = upper(p_code));
$$;
grant execute on function public.is_admin(), public.kindness_tally(), public.check_book_code(text) to anon, authenticated;

-- ---------- row level security ----------
alter table public.entries enable row level security;
alter table public.book_logs enable row level security;
alter table public.book_codes enable row level security;
alter table public.settings enable row level security;
alter table public.admins enable row level security;

-- anon: insert, and read approved only
create policy entries_insert on public.entries for insert to anon, authenticated with check (consent = true);
create policy entries_read_public on public.entries for select to anon, authenticated using (status = 'approved' or public.is_admin());
create policy entries_admin_update on public.entries for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy entries_admin_delete on public.entries for delete to authenticated using (public.is_admin());

create policy logs_insert on public.book_logs for insert to anon, authenticated with check (consent = true);
create policy logs_read_public on public.book_logs for select to anon, authenticated using (status = 'approved' or public.is_admin());
create policy logs_admin_update on public.book_logs for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- codes: not listable by the public (checked via check_book_code); admin manages
create policy codes_admin on public.book_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admins_self on public.admins for select to authenticated using (public.is_admin());

-- column-level hardening: anon may only send these columns
revoke insert on public.entries from anon;
grant insert (flow, text, input_mode, audio_url, consent) on public.entries to anon;
revoke insert on public.book_logs from anon;
grant insert (code, place, story, consent) on public.book_logs to anon;
revoke select on public.entries from anon;
revoke select on public.book_logs from anon;
grant select (id, flow, text, input_mode, audio_url, created_at, status) on public.entries to anon;
grant select (code, place, story, created_at, status) on public.book_logs to anon;

-- ---------- storage for voice answers ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, 10485760, array['audio/webm','audio/mp4','audio/aac','audio/ogg','audio/mpeg','audio/x-m4a'])
on conflict (id) do update set public = true, file_size_limit = 10485760;
create policy audio_anon_upload on storage.objects for insert to anon, authenticated with check (bucket_id = 'audio');
create policy audio_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'audio' and public.is_admin());
