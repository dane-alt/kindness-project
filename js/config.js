// Kindness Project configuration.
// DEMO MODE: leave SUPABASE_URL empty. Everything is stored only in this browser (localStorage).
// LIVE MODE: paste your Supabase project URL and anon (public) key below, commit, push.
export const CONFIG = {
  SUPABASE_URL: '',          // e.g. 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: '',     // the "anon public" key from Supabase > Project Settings > API
  AUDIO_BUCKET: 'audio',
  // true  = clean entries go public at once, flagged ones wait for review (default)
  // false = every entry waits for admin review
  AUTO_APPROVE_CLEAN: true,
  SITE_URL: 'https://dane-alt.github.io/kindness-project/',
  BOOK_PDF_URL: '',          // link to the free PDF of the book, once it is uploaded
};
export const isDemo = () => !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
