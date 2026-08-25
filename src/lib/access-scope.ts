/**
 * What a grant is, and how it is worded.
 *
 * Split out from the queries so the issue form can import it. A client
 * component that reaches for `@/lib/access` pulls the server Supabase client
 * into the browser bundle with it, and the build says so — this file is the
 * half that is safe on both sides.
 */

export type AccessLevel = 'hq' | 'zone' | 'branch' | 'field_agent';

export interface AccessGrant {
  id: string;
  code: string;
  label: string;
  holder_name: string;
  holder_phone: string | null;
  note: string | null;
  role: AccessLevel;
  zone_code: string | null;
  branch_id: string | null;
  expires_at: string | null;
  issued_at: string;
  redeemed_at: string | null;
  staff_user_id: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
}

/** What a grant is, right now. Derived, never stored — an expiry that has to
 *  be swept by a job is an expiry that is wrong between sweeps. */
export type GrantState = 'revoked' | 'active' | 'expired' | 'open';

export function grantState(grant: AccessGrant, now = new Date()): GrantState {
  if (grant.revoked_at) return 'revoked';
  if (grant.redeemed_at) return 'active';
  if (grant.expires_at && new Date(grant.expires_at) < now) return 'expired';
  return 'open';
}

export const GRANT_STATE_WORDING: Record<GrantState, string> = {
  open: 'Not used yet',
  active: 'In use',
  expired: 'Expired unused',
  revoked: 'Revoked',
};

export const LEVEL_WORDING: Record<AccessLevel, string> = {
  hq: 'HQ — every zone',
  zone: 'Zone — the branches under it',
  branch: 'Branch — its own stations',
  field_agent: 'Field agent — one branch, read mostly',
};

export interface BranchOption {
  id: string;
  name: string;
  zone_code: string | null;
}


export const ZONE_CODES = [
  'CENTRAL', 'COASTAL', 'DAR_ES_SALAAM', 'HIGHLAND',
  'LAKE', 'NORTHERN', 'SOUTHERN', 'WESTERN',
] as const;

export function zoneWording(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
