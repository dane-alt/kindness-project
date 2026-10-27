-- Paste the output of `npm run codes -- 500 --sql` here, or add codes from the Admin screen.
insert into public.book_codes (code) values ('KB-7Q3M'),('KB-H4XP'),('KB-2RWT') on conflict do nothing;
