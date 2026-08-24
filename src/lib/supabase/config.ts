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
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** The schema everything lives in. Never `public`. */
export const SCHEMA = 'konekt' as const;
