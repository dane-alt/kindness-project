# Test report – Kindness Project hub

Date: Oct 27, 2026. Tested in **demo mode** (mock backend) because the Supabase project doesn't exist yet. The database rules were tested separately against real Postgres.

## Summary

| Suite | Result |
|---|---|
| Unit tests (`npm test`): moderation filter, export CSV/JSON, book-code generation | **14 / 14 passed** |
| SQL / security rules (`npm run test:sql`, real Postgres 17 via PGlite with stand-ins for Supabase roles) | **all checks passed** |
| Phone end-to-end (`npm run e2e`): 10 scenarios × 2 phones | **20 / 20 passed** |
| Same end-to-end suite against the **live GitHub Pages site** | see "Live site" below |

Phones emulated with Playwright: **iPhone 13 (WebKit = Safari's engine)** and **Pixel 7 (Chromium = Chrome's engine)**, touch, phone screen size.

## What the end-to-end tests cover (each on both phones)

1. Home page loads, demo banner shows, feed is locked before sharing (direct visit to the feed says "Share first").
2. **Flow 1, typing:** screen 1 question, empty-answer warning, screen 2 question, consent line shown and **required**, submit, thank-you page shows the person's entries **and everyone else's**, tally goes up.
3. **Flow 1, voice + transcription:** tap mic → permission granted (fake microphone) → recording → transcript appears in the text box → stop → playback appears → submit. Voice entry saved as `audio+transcript` and held for review; typed answer published.
4. **Mic permission denied:** clear message, typing still works.
5. **No speech recognition in the browser:** records audio only, can still submit.
6. **Flow 2:** question, share, sees only "inspired" entries, then **share screen**: Share button (Web Share API where the phone has it), Copy link (verified it copies the site link), Text message (`sms:`), Email (`mailto:`), WhatsApp.
7. **Moderation:** "My name is Sarah, text me at 415-555-1234 or sarah@x.com" → phone and email removed, flagged (email, phone, name), held, not shown in the feed.
8. **Admin:** wrong password refused, sign in, flagged entry shown with reasons (name, abusive), Approve, queue empties, **CSV and JSON downloads** checked (header includes `consent`, approved rows only, all `consent: true`), create 25 book codes → CSV with 25 valid `KB-XXXX` codes.
9. **Book-code logging:** `?code=` link pre-fills, unknown code rejected, messy input `kb 7q3m` accepted as `KB-7Q3M`, logged, the copy's travel trail shown, tally goes up.
10. **Accessibility basics:** `lang="en"`, labelled fields, every button at least 44 px tall, no sideways scrolling.

## SQL / security checks (real Postgres)

- The public (anon) **cannot set its own status** (column not writable) and entries **require consent**.
- The public reads **only approved** entries; held ones are invisible.
- Phone numbers are removed and the entry held **by the database**, even if the website's filter were bypassed. Voice entries are held.
- Unknown book codes are rejected; the public **cannot list** book codes; the code-check function works.
- The public **cannot approve or edit** anything (update affects 0 rows).
- The admin email is recognised and can see and approve held entries.

## Unit tests

Moderation: clean text passes; emails removed; phones in 4 formats removed; short numbers ("I was 7 in 2019") left alone; "My name is…", "Mrs. Johnson", @handles flagged; profanity flagged without false hits on words like "Scunthorpe"; approve/hold decision follows the setting. Export: header, approved-only, quotes/commas/new lines escaped, consent flag. Codes: no ambiguous letters, 2,000 unique valid codes, avoids existing codes, normalises user input.

## Honest limits – still needs Dane's real phones

- **Real microphone and real transcription were not tested on a physical iPhone or Android.** The tests use a fake microphone and a fake speech engine. They prove the screens, permission handling, recording pipeline and fall-backs work, but not how well Safari or Chrome actually hears a voice. Speech-to-text quality depends on the phone, and on iPhone it needs iOS 14.5+.
- The WebKit engine in testing is close to iPhone Safari but is not the real Safari app.
- The live Supabase backend (real saving across phones, audio upload, admin email login) can only be tested after the Supabase project is created. The code paths are written and the database rules are tested, but the REST calls haven't run against a real Supabase project.

**Please try once on your iPhone and Android:** open the Flow 1 link, tap "Speak your answer", allow the microphone, say a sentence, check the words appear, stop, play it back, finish. Then the same on Flow 2.

## Live site
