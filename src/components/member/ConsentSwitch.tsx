'use client';

import { useActionState } from 'react';
import { setConsent, type ActionResult } from '@/app/[locale]/me/consent/actions';
import styles from './ConsentSwitch.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

/**
 * One consent decision.
 *
 * A switch and a Save, rather than a switch that saves as it slides: this
 * writes an immutable record with a timestamp, and a stray tap on a phone in a
 * pocket should not be able to produce one. The wording beside it is the
 * wording that gets stored.
 */
export function ConsentSwitch({
  consentKey,
  locale,
  label,
  granted,
  capturedAt,
}: {
  consentKey: string;
  locale: string;
  label: string;
  granted: boolean;
  capturedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(setConsent, INITIAL);

  return (
    <form action={formAction} className={styles.row}>
      <input type="hidden" name="key" value={consentKey} />
      <input type="hidden" name="locale" value={locale} />

      <label className={styles.switch}>
        <input type="checkbox" name="granted" defaultChecked={granted} />
        <span className={styles.wording}>{label}</span>
      </label>

      <div className={styles.foot}>
        <button type="submit" className="btn btn--quiet" disabled={pending}>
          {pending ? 'Saving…' : 'Save this choice'}
        </button>
        <p className={styles.meta} role="status" aria-live="polite">
          {state.message
            || (capturedAt
              ? `${granted ? 'Agreed' : 'Declined'} on ${new Date(capturedAt).toLocaleDateString()}`
              : 'No decision recorded yet — which counts as no.')}
        </p>
      </div>
    </form>
  );
}
