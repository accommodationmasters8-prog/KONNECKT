'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createEvent, updateEvent, type ActionResult } from '@/app/[locale]/staff/events/actions';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

const ZONES = [
  'CENTRAL', 'COASTAL', 'DAR_ES_SALAAM', 'HIGHLAND',
  'LAKE', 'NORTHERN', 'SOUTHERN', 'WESTERN',
] as const;

export interface EventFormValues {
  id?: string;
  title_en?: string;
  title_sw?: string;
  summary_en?: string | null;
  summary_sw?: string | null;
  starts_at?: string;
  ends_at?: string;
  venue_name?: string;
  zone_code?: string | null;
  capacity?: number | null;
  waitlist_enabled?: boolean;
  target_registrations?: number | null;
  target_accounts?: number | null;
  budget_tzs?: number | null;
}

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time, not an ISO string. */
function forInput(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Create or edit an event.
 *
 * Both titles are required, because the site is bilingual and a missing
 * Swahili title renders as an empty heading rather than as English.
 *
 * Creating never publishes: a new event is a draft, and it reaches the public
 * site only by being walked through approval on its own screen.
 */
export function EventForm({
  locale,
  event,
}: {
  locale: string;
  event?: EventFormValues;
}) {
  const editing = Boolean(event?.id);
  const [state, formAction, pending] = useActionState(
    editing ? updateEvent : createEvent,
    INITIAL,
  );
  const router = useRouter();

  // A created draft has its own screen, and that is where the work continues.
  useEffect(() => {
    if (state.ok && state.id) router.push(`/${locale}/staff/events/${state.id}`);
  }, [state, locale, router]);

  return (
    <form action={formAction} className={styles.form}>
      {event?.id ? <input type="hidden" name="id" value={event.id} /> : null}

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Title (English)</span>
          <input className={styles.input} name="title_en" defaultValue={event?.title_en ?? ''} required />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Title (Kiswahili)</span>
          <input className={styles.input} name="title_sw" defaultValue={event?.title_sw ?? ''} required />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Summary (English)</span>
          <textarea className={styles.textarea} name="summary_en" rows={2} defaultValue={event?.summary_en ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Summary (Kiswahili)</span>
          <textarea className={styles.textarea} name="summary_sw" rows={2} defaultValue={event?.summary_sw ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Starts</span>
          <input className={styles.input} type="datetime-local" name="starts_at"
            defaultValue={forInput(event?.starts_at)} required />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Ends</span>
          <input className={styles.input} type="datetime-local" name="ends_at"
            defaultValue={forInput(event?.ends_at)} required />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Venue</span>
          <input className={styles.input} name="venue_name" defaultValue={event?.venue_name ?? ''} required />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Zone</span>
          <select className={styles.select} name="zone_code" defaultValue={event?.zone_code ?? ''}>
            <option value="">Not set</option>
            {ZONES.map((zone) => (
              <option key={zone} value={zone}>{zone.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <span className={styles.help}>
            A zone manager can only reach events in their own zone, so an event
            with no zone is invisible to everyone except HQ.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Capacity</span>
          <input className={styles.input} type="number" min="1" name="capacity"
            defaultValue={event?.capacity ?? ''} />
          <span className={styles.help}>Empty means no limit. The database enforces it — two people cannot take the last seat.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Target registrations</span>
          <input className={styles.input} type="number" min="0" name="target_registrations"
            defaultValue={event?.target_registrations ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Target accounts opened</span>
          <input className={styles.input} type="number" min="0" name="target_accounts"
            defaultValue={event?.target_accounts ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Budget (TZS)</span>
          <input className={styles.input} type="number" min="0" step="1000" name="budget_tzs"
            defaultValue={event?.budget_tzs ?? ''} />
          <span className={styles.help}>Needed for cost per account. Without it the event has no cost line in reporting.</span>
        </label>
      </div>

      <div className={styles.switchRow}>
        <label className={styles.switch}>
          <input type="checkbox" name="waitlist_enabled" defaultChecked={event?.waitlist_enabled ?? true} />
          <span>
            <span className={styles.label}>Waitlist when full</span>
            <span className={styles.help}>Off means registration simply closes at capacity.</span>
          </span>
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save event' : 'Create draft'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}
