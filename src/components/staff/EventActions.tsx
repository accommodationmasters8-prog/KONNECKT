'use client';

import { useActionState } from 'react';
import {
  moveEvent, duplicateEvent, promoteWaitlist, setCoordinator, type ActionResult,
} from '@/app/[locale]/staff/events/actions';
import { TRANSITION_LABELS } from '@/lib/event-lifecycle';
import type { EventStatus } from '@/lib/supabase/types';
import styles from './EventActions.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

/**
 * Everything you can do to an event once it exists.
 *
 * The buttons are generated from the lifecycle graph rather than written out,
 * so a screen can never offer a transition the action would refuse — the two
 * cannot drift, because they are the same list.
 */
export function EventTransitions({
  id,
  status,
  allowed,
}: {
  id: string;
  status: EventStatus;
  allowed: EventStatus[];
}) {
  const [state, formAction, pending] = useActionState(moveEvent, INITIAL);

  if (allowed.length === 0) {
    return (
      <p className={styles.terminal}>
        {status === 'completed'
          ? 'Completed. Nothing moves from here — the record of what happened is final.'
          : 'No moves available from this state.'}
      </p>
    );
  }

  return (
    <form action={formAction} className={styles.transitions}>
      <input type="hidden" name="id" value={id} />
      <div className={styles.buttons}>
        {allowed.map((target) => (
          <button
            key={target}
            type="submit"
            name="to"
            value={target}
            disabled={pending}
            className={
              target === 'cancelled'
                ? 'btn btn--quiet'
                : target === 'published'
                  ? 'btn btn--primary'
                  : 'btn btn--ghost'
            }
          >
            {TRANSITION_LABELS[target]}
          </button>
        ))}
      </div>
      <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
        {state.message}
      </p>
    </form>
  );
}

export function DuplicateEvent({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(duplicateEvent, INITIAL);
  return (
    <form action={formAction} className={styles.inline}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn--ghost" disabled={pending}>
        {pending ? 'Copying…' : 'Duplicate as draft'}
      </button>
      <span className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
        {state.message}
      </span>
    </form>
  );
}

export function PromoteWaitlist({ id, waiting }: { id: string; waiting: number }) {
  const [state, formAction, pending] = useActionState(promoteWaitlist, INITIAL);
  return (
    <form action={formAction} className={styles.inline}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn--ghost" disabled={pending || waiting === 0}>
        {pending ? 'Promoting…' : 'Promote next from waitlist'}
      </button>
      <span className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
        {state.message}
      </span>
    </form>
  );
}

export function CoordinatorPicker({
  id,
  current,
  options,
}: {
  id: string;
  current: string | null;
  options: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(setCoordinator, INITIAL);
  return (
    <form action={formAction} className={styles.inline}>
      <input type="hidden" name="id" value={id} />
      <label className={styles.pickerLabel}>
        <span className="visually-hidden">Coordinator</span>
        <select name="coordinator_staff_id" defaultValue={current ?? ''} className={styles.select}>
          <option value="">Nobody assigned</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn btn--ghost" disabled={pending}>
        {pending ? 'Saving…' : 'Assign'}
      </button>
      <span className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
        {state.message}
      </span>
    </form>
  );
}
