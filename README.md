# The Kindness Project hub

A free, phone-first website reached by QR codes on cards and in the book *Kindness* by Dane E. Rose. People share kind acts anonymously, by voice, typing, or voice turned into text. The full request is in [BRIEF.md](BRIEF.md). Test results are in [TEST-REPORT.md](TEST-REPORT.md).

**Live site:** https://dane-alt.github.io/kindness-project/ (in **demo mode** until Supabase is connected; see below)

| What | Link (also what the QR codes point to) |
|---|---|
| Flow 1 – Kindness received and given (QR 1) | https://dane-alt.github.io/kindness-project/?f=1 |
| Flow 2 – Kind acts inspired (QR 2) | https://dane-alt.github.io/kindness-project/?f=2 |
| Book-copy code entry | https://dane-alt.github.io/kindness-project/#/book (or `?code=KB-XXXX` to pre-fill) |
| Share screen | https://dane-alt.github.io/kindness-project/#/share |
| Feed (unlocks after you share) | https://dane-alt.github.io/kindness-project/#/feed |
| Admin | https://dane-alt.github.io/kindness-project/#/admin |

## Technical choices (and why)

- **Plain HTML + CSS + JavaScript modules, no build step, no framework.** About 36 KB total (uncompressed), so it loads fast on mid-range phones and there is nothing to break. No web fonts, no trackers, no analytics.
- **Hosting: GitHub Pages** (free). `.github/workflows/pages.yml` runs the unit + SQL tests and then deploys on every push to `main`.
- **Backend: Supabase free tier** (Postgres + Storage + Auth). The site talks to it with plain `fetch` calls (no SDK) through `js/backend.js`. Everything is in `supabase/migrations/001_init.sql`.
- **Demo mode:** when `js/config.js` has no Supabase URL/key, a mock backend stores everything only in that browser (`localStorage`) and a yellow banner says so. Demo admin password: `demo`. Demo book codes: `KB-7Q3M`, `KB-H4XP`, `KB-2RWT`.
- **Voice:** `MediaRecorder` records audio (WebM/Opus on Android Chrome, MP4/AAC on iPhone Safari; the format is picked automatically). **Transcription:** the browser's Web Speech API fills in the text box live where it exists (Chrome on Android, Safari on iOS 14.5+). If it doesn't exist, or the mic is refused, people simply type. Each person can choose to keep or drop the voice recording.
- **Entries stay hidden until you share:** the feed unlocks after submitting (a flag stored only on that phone). Only *approved* entries are ever readable from the database.
- **Moderation, two layers:** `js/moderation.js` removes emails and phone numbers before sending and flags name patterns ("my name is…", "Mrs. Lee", @handles) and abusive words. The **database trigger repeats the same checks** (`kp_moderate`) so nobody can skip them, and it sets the status itself (the public can never mark their own entry approved). Clean typed entries go public at once; flagged entries and all voice recordings wait for review (voice can't be auto-checked). The admin "Publish clean entries right away" switch turns that off so *everything* waits.
- **Book codes:** `KB-XXXX` from 31 unambiguous characters (no 0/O, 1/I/L), so about 923,000 possible codes. The public can check one code but can't list them.
- **Privacy:** no accounts for the public, no IP addresses, no device info, no cookies, no analytics. Only the words/recordings people choose to share, the flow, the date, and the consent flag. `no-referrer` policy.
- **Accessibility:** large text, 48-px buttons, real labels, live regions for status, keyboard focus outlines, works with reduced motion, no sideways scrolling at phone width.

## Files

```
index.html, css/, js/          the site
  js/config.js                 <- paste Supabase URL + anon key here to go live
  js/backend.js                demo (mock) + live (Supabase) backends
  js/moderation.js             filter rules (mirrored in SQL)
  js/codes.js, js/export.js    book codes, CSV/JSON export
supabase/migrations/001_init.sql   tables, moderation trigger, RLS, storage bucket
supabase/seed-codes.example.sql    example code insert
scripts/gen-codes.mjs          make N book codes for a print run
scripts/gen-qr.mjs, render-cards.mjs   QR codes + 4x6 card artwork
qr/                            print-ready files (below)
tests/                         unit, SQL/RLS and Playwright tests
```

## QR codes (in `/qr`)

- `flow1-qr.svg`, `flow1-qr.png`, `flow2-qr.svg`, `flow2-qr.png`: the QR alone, 3 in × 3 in (PNG is 900 px = 300 dpi), high error correction, quiet zone included.
- `card-flow1-4x6.svg/.png`, `card-flow2-4x6.svg/.png`: complete 4×6 in card artwork (PNG 1200×1800 = 300 dpi).
- To regenerate for a different address: `npm run qr -- https://your.domain/ && node scripts/render-cards.mjs`.

## Switching on the real backend (Supabase), about 15 minutes

1. Create a free account at https://supabase.com (Continue with GitHub works) and a **New project** (free plan; pick a region near most readers, save the database password somewhere safe).
2. **SQL Editor → New query**: paste all of `supabase/migrations/001_init.sql`. First change the admin email on the line marked `>>> EDIT` if it shouldn't be `dane@mysticallandscapes.com`. Click **Run**.
3. Add the first book codes: run `npm run codes -- 500 --sql` and paste the output into the SQL Editor (or use the Admin screen's "Create & download codes" later).
4. **Authentication → Users → Add user → Create new user**: Dane's admin email + a strong password, tick **Auto confirm**. Then **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up" (only the admin needs an account). Under **URL Configuration** set Site URL to `https://dane-alt.github.io/kindness-project/`.
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key. Put them in `js/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). The anon key is meant to be public; the security comes from the row-level-security rules. **Never** put the `service_role` key in the site.
6. Commit and push. The Action redeploys in about a minute and the demo banner disappears.
7. Test once on a real iPhone and Android phone: share by typing, by voice, then approve the voice entry in Admin.

## Admin (Dane)

1. Open https://dane-alt.github.io/kindness-project/#/admin on any device.
2. Sign in with the admin email and password from step 4 (demo mode: any email, password `demo`).
3. **Waiting for review**: read or listen, then **Approve** or **Reject**. Flags say why something was held (email, phone, name, abusive, audio).
4. **Settings**: "Publish clean entries right away" (on by default).
5. **Export approved entries**: **Download CSV** or **Download JSON** (fields: id, flow, text, input_mode, audio_url, consent, status, created_at). Only approved entries are exported, and every one carries `consent = true`.
6. **Book codes**: enter a number and tap **Create & download codes** to add codes for a print run and get the list as a CSV.

Forgot the password? Supabase dashboard → Authentication → Users → the admin user → Send password recovery (or set a new one).

## Running locally

```
npm ci
npm run serve        # http://localhost:4173
npm test             # unit tests
npm run test:sql     # SQL, trigger and RLS rules against real Postgres (PGlite)
npx playwright install --with-deps chromium webkit
npm run e2e          # phone tests (iPhone 13 WebKit, Pixel 7 Chromium)
BASE_URL=https://dane-alt.github.io/kindness-project/ npm run e2e   # same tests against the live site
```

## Free-tier notes

Supabase free projects pause after about a week with no activity; visiting the site, or a free uptime pinger, keeps it awake, and a paused project can be resumed from the dashboard. Free storage is 1 GB (roughly 15,000 one-minute voice notes).
