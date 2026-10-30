-- People who ask for the gift book and audiobook. Emails are used only for the Kindness Project.
create table if not exists public.book_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' and length(email) <= 254),
  created_at timestamptz not null default now()
);
alter table public.book_requests enable row level security;
create policy book_requests_insert on public.book_requests for insert to anon, authenticated with check (true);
create policy book_requests_admin on public.book_requests for select to authenticated using (public.is_admin());
create policy book_requests_admin_delete on public.book_requests for delete to authenticated using (public.is_admin());
grant insert (email) on public.book_requests to anon, authenticated;
grant select, delete on public.book_requests to authenticated;
