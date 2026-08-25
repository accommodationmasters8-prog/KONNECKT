/**
 * Supabase configuration.
 *
 * The public site has to render with no Supabase project attached — during a
 * design review, in a preview deploy, on a fresh clone. `isConfigured` is the
 * switch every data path checks: when it is false the app serves the register
 * from the committed JSON and shows honest empty states, rather than crashing
 * or inventing content.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/**
 * The browser key.
 *
 * Supabase now issues `sb_publishable_...` keys and calls the old JWT ones
 * legacy anon keys. Both are accepted here under their own names rather than
 * one being renamed to the other: a project created this year has no anon key
 * to put in NEXT_PUBLIC_SUPABASE_ANON_KEY, and a project created before the
 * change has no publishable one. Whichever is set wins; the publishable key
 * is preferred when both are, because it can be rotated on its own.
 */
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ?? '';

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** The schema everything lives in. Never `public`. */
export const SCHEMA = 'konekt' as const;
