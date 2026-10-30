-- AI kindness moderator. Run after 001_init.sql (SQL Editor > New query > paste > Run).
-- Every new post is sent to the "moderate" Edge Function, which asks an AI: "Is this conducive to kindness?"
--   kind    -> approved within seconds
--   doubt   -> stays pending and is emailed to Dane for a decision
--   abusive -> rejected (never shown)
-- Obvious slurs are rejected by the database itself before the AI is asked.

create extension if not exists pg_net;

alter table public.entries   add column if not exists ai_decision text, add column if not exists ai_reason text;
alter table public.book_logs add column if not exists ai_decision text, add column if not exists ai_reason text;

-- private settings for the webhook (no RLS policy = unreadable by the public)
create table if not exists public.kp_private (key text primary key, value text not null);
alter table public.kp_private enable row level security;
-- >>> EDIT these two values after deploying the function (see README, "AI moderator") <<<
insert into public.kp_private (key, value) values
  ('moderator_url', 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/moderate'),
  ('moderator_secret', 'REPLACE-WITH-A-LONG-RANDOM-STRING')
on conflict (key) do nothing;

-- new rule for status on insert: slurs rejected, everything else waits a few seconds for the AI
create or replace function public.kp_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; m2 record;
begin
  if tg_table_name = 'entries' then
    m := kp_moderate(new.text); new.text := m.cleaned; new.flags := m.flags;
    if new.audio_url is not null then new.flags := array_append(new.flags, 'audio'); end if;
  else
    m := kp_moderate(new.story); m2 := kp_moderate(new.place);
    new.story := m.cleaned; new.place := m2.cleaned; new.flags := m.flags || m2.flags;
  end if;
  new.status := case when 'abusive' = any(new.flags) then 'rejected' else 'pending' end;
  new.ai_decision := null; new.ai_reason := null;
  new.created_at := now();
  return new;
end $$;

-- after insert: hand the post to the AI moderator
create or replace function public.kp_send_to_moderator() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare u text; k text;
begin
  if new.status <> 'pending' then return new; end if;
  select value into u from kp_private where key = 'moderator_url';
  select value into k from kp_private where key = 'moderator_secret';
  if u is null or u like '%YOUR-PROJECT-REF%' then return new; end if;
  perform net.http_post(
    url := u,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kp-secret', k),
    body := jsonb_build_object('table', tg_table_name, 'id', new.id)
  );
  return new;
end $$;

drop trigger if exists entries_ai on public.entries;
create trigger entries_ai after insert on public.entries for each row execute function public.kp_send_to_moderator();
drop trigger if exists book_logs_ai on public.book_logs;
create trigger book_logs_ai after insert on public.book_logs for each row execute function public.kp_send_to_moderator();
