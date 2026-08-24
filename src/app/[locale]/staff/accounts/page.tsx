import type { Metadata } from 'next';
import { StaffShell } from '@/components/staff/StaffShell';
import { Panel, PanelEmpty } from '@/components/staff/Panel';
import { staffNav } from '@/lib/staff-nav';
import { getServerClient } from '@/lib/supabase/server';
import { localeParams, resolveLocale } from '@/lib/page';
import styles from '../staff.module.css';
import local from './accounts.module.css';

export function generateStaticParams() {
  return localeParams();
}

export const metadata: Metadata = {
  title: 'Accounts opened — CRDB Konekt',
  robots: { index: false, follow: false },
};

const LABELS = {
  overview: 'Overview', events: 'Events', checkin: 'Check-in',
  accounts: 'Accounts opened', verification: 'Pin verification',
  sponsorship: 'Sponsorship', members: 'Members', audit: 'Audit log',
};

const SOURCES = [
  { value: 'event', label: 'Event', needs: 'the event' },
  { value: 'field_agent', label: 'Field agent', needs: null },
  { value: 'referral', label: 'Referral', needs: 'the referring member' },
  { value: 'branch_walk_in', label: 'Branch walk-in', needs: null },
  { value: 'campus_activation', label: 'Campus activation', needs: null },
  { value: 'digital', label: 'Digital', needs: null },
];

/**
 * Account opening capture.
 *
 * The form is shaped by the database rather than the other way round:
 * `source` and `source_reference` are NOT NULL on konekt.accounts_opened, and
 * an event- or referral-sourced account must name the event or the referrer.
 * So there is no "skip" on those fields here — an account with no traceable
 * origin cannot be written, and a form that offered one would only produce a
 * failed insert.
 *
 * Account numbers are unique at the database level, so a double entry is
 * rejected rather than quietly double-counted in every report downstream.
 */
export default async function AccountsPanel({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await resolveLocale(params);
  const supabase = await getServerClient();

  return (
    <StaffShell
      locale={locale}
      role="branch"
      active="accounts"
      nav={staffNav(locale, LABELS)}
      title={LABELS.accounts}
      scopeLabel={supabase ? 'Your branch' : 'Not connected'}
    >
      <Panel
        title="Record an account"
        description="Source attribution is mandatory. It is what lets an HQ analyst trace any account back to the event, coordinator, agent and referring member that produced it."
      >
        <form className={local.form} aria-describedby="source-help">
          <div className={local.field}>
            <label htmlFor="account-number">Account number</label>
            <input id="account-number" name="account_number" required
              autoComplete="off" inputMode="numeric" />
            <span className={local.hint}>
              Unique across the platform. A duplicate is refused by the database.
            </span>
          </div>

          <div className={local.field}>
            <label htmlFor="product">Product</label>
            <select id="product" name="product" required defaultValue="">
              <option value="" disabled>Choose a product</option>
              <option value="junior_jumbo">Junior Jumbo</option>
              <option value="teen_account">Teen Account</option>
              <option value="scholar_account">Scholar Account</option>
              <option value="malkia_account">Malkia Account</option>
              <option value="personal_current">Personal Current</option>
              <option value="sme_account">SME Account</option>
            </select>
            <span className={local.hint}>
              Junior Jumbo, Teen and Scholar serve under-18s. Guardian consent
              is required before any photo upload or marketing flag.
            </span>
          </div>

          <div className={local.field}>
            <label htmlFor="source">Source</label>
            <select id="source" name="source" required defaultValue="">
              <option value="" disabled>Choose a source</option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <span className={local.hint} id="source-help">
              Never optional. Choosing Event or Referral also requires naming
              the event or the referring member.
            </span>
          </div>

          <div className={local.field}>
            <label htmlFor="source-reference">Source reference</label>
            <input id="source-reference" name="source_reference" required
              placeholder="Registration ID, agent code, referral code" />
          </div>

          <button type="submit" className="btn btn--primary" disabled={!supabase}>
            Record account
          </button>
          {!supabase ? (
            <p className={local.disabled}>
              Submission needs the live database. The form is shown so the
              required fields are reviewable now.
            </p>
          ) : null}
        </form>
      </Panel>

      <Panel
        title="Recorded this month"
        description="Scoped to your branch by row level security, not by this page."
      >
        <PanelEmpty>
          No accounts recorded yet.
        </PanelEmpty>
      </Panel>
    </StaffShell>
  );
}
