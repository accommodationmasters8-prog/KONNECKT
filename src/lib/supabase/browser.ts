'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';
import { SCHEMA, isConfigured, supabaseAnonKey, supabaseUrl } from './config';

let client: ReturnType<typeof createBrowserClient<Database, typeof SCHEMA>> | null = null;

/**
 * Browser client, for the few places that genuinely need one: phone OTP sign-in
 * and the offline check-in queue. Everything else reads on the server, so the
 * data never has to make a second trip over a 3G connection.
 */
export function getBrowserClient() {
  if (!isConfigured) return null;
  if (!client) {
    client = createBrowserClient<Database, typeof SCHEMA>(supabaseUrl, supabaseAnonKey, {
      db: { schema: SCHEMA },
    });
  }
  return client;
}
