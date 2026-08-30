/**
 * Access codes.
 *
 * A branch does not have a work email. Half of them share one mailbox, and a
 * shared mailbox is not an identity — so the credential HQ hands out is a
 * code, and the code is what somebody types to sign in.
 *
 * Underneath, Supabase Auth still wants an email address, so the code maps to
 * one deterministically. The domain is `.invalid`, which IANA reserves and
 * guarantees will never resolve: even a misconfigured mailer cannot deliver a
 * reset link for one of these accounts to a real inbox somewhere.
 *
 * This file is imported by both the browser and the server. Nothing secret may
 * go in it — the mapping is not a secret, the passphrase is.
 */

/** RFC 2606 reserved. Never routable, never deliverable. */
export const ACCESS_EMAIL_DOMAIN = 'access.konekt.invalid';

/**
 * Crockford's alphabet, minus the letters that get misheard.
 *
 * No I, L, O, 0 or 1: these codes are read down a phone line to a branch in
 * Kigoma, and "oh" and "zero" are the same sound.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const ACCESS_CODE_PATTERN = /^KNK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/** Tidy up what somebody typed: case, spaces, and the dashes they forgot. */
export function normaliseCode(input: string): string {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = bare.startsWith('KNK') ? bare.slice(3) : bare;
  if (body.length !== 8) return input.trim().toUpperCase();
  return `KNK-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function isAccessCode(input: string): boolean {
  return ACCESS_CODE_PATTERN.test(normaliseCode(input));
}

/** The auth identity behind a code. Deterministic, so no lookup is needed. */
export function accessCodeEmail(code: string): string {
  return `${normaliseCode(code).toLowerCase()}@${ACCESS_EMAIL_DOMAIN}`;
}

/** True when an email came from a code rather than from a person. */
export function isAccessEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith(`@${ACCESS_EMAIL_DOMAIN}`));
}

/**
 * A new code, from the platform's own randomness.
 *
 * 31^8 is about 850 billion, and codes are only guessable while unredeemed, so
 * the exposure is a race against a window measured in days rather than an
 * offline attack. Server-side only in practice, but `crypto` is on both.
 *
 * Rejection sampling rather than `byte % 31`. The alphabet has 31 letters and
 * a byte has 256 values: 256 = 8x31 + 8, so a modulo would hand the first
 * eight letters nine chances each and the remaining twenty-three only eight —
 * about 12% more A-H in every position than anything else. That is a biased
 * credential, and a biased credential is a smaller keyspace than the one you
 * think you have. Bytes at or above 248 are thrown away instead, which costs
 * a few extra bytes of entropy and nothing else.
 */
export function generateCode(): string {
  const limit = 256 - (256 % ALPHABET.length); // 248
  const out: string[] = [];

  while (out.length < 8) {
    const batch = new Uint8Array(16);
    crypto.getRandomValues(batch);
    for (const b of batch) {
      if (b >= limit) continue;
      out.push(ALPHABET[b % ALPHABET.length]);
      if (out.length === 8) break;
    }
  }

  const body = out.join('');
  return `KNK-${body.slice(0, 4)}-${body.slice(4)}`;
}
