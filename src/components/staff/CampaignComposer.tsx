'use client';

import { useActionState, useState } from 'react';
import {
  createCampaign, approveCampaign, resolveAudience, type ActionResult,
} from '@/app/[locale]/staff/communication/actions';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

/** GSM-7, the alphabet an SMS is billed in. 160 in one part, 153 per part after. */
function segments(text: string) {
  const length = text.length;
  if (length === 0) return 0;
  return length <= 160 ? 1 : Math.ceil(length / 153);
}

/**
 * Write a bulk message.
 *
 * The segment counter is the honest part of a bulk SMS screen: 161 characters
 * is two messages and twice the invoice, and the only moment anyone can act on
 * that is while writing it.
 */
export function CampaignComposer({ zones }: { zones: string[] }) {
  const [state, formAction, pending] = useActionState(createCampaign, INITIAL);
  const [bodyEn, setBodyEn] = useState('');
  const [bodySw, setBodySw] = useState('');

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Campaign name</span>
          <input className={styles.input} name="name" required placeholder="Mwanza campus tour reminder" />
          <span className={styles.help}>Internal. This is what you will look for in the audit log.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Channel</span>
          <select className={styles.select} name="channel" defaultValue="sms">
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="push">Push notification</option>
            <option value="email">Email</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Purpose</span>
          <select className={styles.select} name="purpose" defaultValue="event_reminders">
            <option value="event_reminders">Event reminder</option>
            <option value="marketing">Marketing</option>
          </select>
          <span className={styles.help}>
            Consent is recorded per purpose and channel. A member who agreed to
            event reminders has not agreed to marketing, and the audience will
            skip them.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Members in tier</span>
          <select className={styles.select} name="audience_tier" defaultValue="">
            <option value="">Every tier</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Zone</span>
          <select className={styles.select} name="scope_zone_code" defaultValue="">
            <option value="">National (HQ only)</option>
            {zones.map((zone) => (
              <option key={zone} value={zone}>{zone.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>
            Message (English) — {bodyEn.length} characters, {segments(bodyEn)} SMS
          </span>
          <textarea
            className={styles.textarea}
            name="body_en"
            rows={3}
            required
            value={bodyEn}
            onChange={(e) => setBodyEn(e.target.value)}
          />
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>
            Message (Kiswahili) — {bodySw.length} characters, {segments(bodySw)} SMS
          </span>
          <textarea
            className={styles.textarea}
            name="body_sw"
            rows={3}
            required
            value={bodySw}
            onChange={(e) => setBodySw(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save draft'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

export function ApproveCampaign({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(approveCampaign, INITIAL);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn--ghost btn--sm" disabled={pending}>
        {pending ? 'Approving…' : 'Approve'}
      </button>
      {state.message ? (
        <span className={state.ok ? styles.ok : styles.error}>{state.message}</span>
      ) : null}
    </form>
  );
}

export function ResolveAudience({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(resolveAudience, INITIAL);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn--ghost btn--sm" disabled={pending}>
        {pending ? 'Resolving…' : 'Resolve audience'}
      </button>
      {state.message ? (
        <span className={state.ok ? styles.ok : styles.error}>{state.message}</span>
      ) : null}
    </form>
  );
}
