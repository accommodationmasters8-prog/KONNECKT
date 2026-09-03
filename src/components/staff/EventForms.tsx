'use client';

import { useActionState } from 'react';
import { Finder } from './Finder';
import {
  saveEvent, addEventImage, removeEventImage, type ActionResult,
} from '@/app/[locale]/staff/events/actions';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

export interface EventFields {
  id?: string;
  name?: string;
  event_date?: string;
  end_date?: string | null;
  venue?: string;
  address?: string | null;
  station_id?: string | null;
  category_id?: string | null;
  participants?: number | null;
  budget_tzs?: number | null;
  actual_spend_tzs?: number | null;
  accounts_opened?: number | null;
  accounts_activated?: number | null;
  leads_expected?: number | null;
  leads_got?: number | null;
  simbanking_activated?: number | null;
  cards_issued?: number | null;
  lipa_hapa_registered?: number | null;
  deposits_tzs?: number | null;
  album_url?: string | null;
  notes?: string | null;
}

/**
 * Record an event, or correct one.
 *
 * There is no past/upcoming field. The date decides it, everywhere it is
 * shown — a status somebody has to flip the morning after is a status that is
 * wrong by lunchtime.
 */
export function EventForm({
  event,
  stations,
  categories,
  branches,
  needsBranch,
}: {
  event?: EventFields;
  stations: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  needsBranch: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveEvent, INITIAL);
  const editing = Boolean(event?.id);

  /* Only needed to show the name of an already-linked station while editing;
     finding a different one goes through the search. */
  const initialStation = event?.station_id
    ? { id: event.station_id, name: stations.find((s) => s.id === event.station_id)?.name ?? '' }
    : null;

  return (
    <form action={formAction} className={styles.form}>
      {event?.id ? <input type="hidden" name="id" value={event.id} /> : null}

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Event name</span>
          <input className={styles.input} name="name" required defaultValue={event?.name ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Date</span>
          <input className={styles.input} type="date" name="event_date" required
            defaultValue={event?.event_date ?? ''} />
          <span className={styles.help}>
            Past or upcoming follows from this — there is nothing else to set.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Ends</span>
          <input className={styles.input} type="date" name="end_date"
            defaultValue={event?.end_date ?? ''} />
          <span className={styles.help}>Only for something that runs more than a day.</span>
        </label>

        {needsBranch ? (
          <label className={styles.field}>
            <span className={styles.label}>Branch</span>
            <select className={styles.select} name="branch_id" required defaultValue="">
              <option value="" disabled>Choose a branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className={styles.help}>The branch it counts towards.</span>
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.label}>Venue</span>
          <input className={styles.input} name="venue" required defaultValue={event?.venue ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Where exactly</span>
          <input className={styles.input} name="address" defaultValue={event?.address ?? ''}
            placeholder="Town, district" />
        </label>

        <div className={styles.field}>
          {/* Was a dropdown of whatever stations the page had loaded, which on
              a register of twenty-one thousand is a dropdown that does not
              contain the one you want. */}
          <Finder
            name="station_id"
            label="At which station"
            placeholder="Type a name — leave empty if it is not at a tracked one"
            initial={initialStation}
          />
          <span className={styles.help}>
            Linking it means this event shows up in that station&rsquo;s story.
          </span>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Category</span>
          <select className={styles.select} name="category_id" defaultValue={event?.category_id ?? ''}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Participants</span>
          <input className={styles.input} type="number" min="0" name="participants"
            defaultValue={event?.participants ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Budget (TZS)</span>
          <input className={styles.input} type="number" min="0" step="1000" name="budget_tzs"
            defaultValue={event?.budget_tzs ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Actually spent (TZS)</span>
          <input className={styles.input} type="number" min="0" step="1000" name="actual_spend_tzs"
            defaultValue={event?.actual_spend_tzs ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Leads expected</span>
          <input className={styles.input} type="number" min="0" name="leads_expected"
            defaultValue={event?.leads_expected ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Leads got</span>
          <input className={styles.input} type="number" min="0" name="leads_got"
            defaultValue={event?.leads_got ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Accounts opened</span>
          <input className={styles.input} type="number" min="0" name="accounts_opened"
            defaultValue={event?.accounts_opened ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Accounts activated</span>
          <input className={styles.input} type="number" min="0" name="accounts_activated"
            defaultValue={event?.accounts_activated ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>SimBanking activated</span>
          <input className={styles.input} type="number" min="0" name="simbanking_activated"
            defaultValue={event?.simbanking_activated ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Cards issued</span>
          <input className={styles.input} type="number" min="0" name="cards_issued"
            defaultValue={event?.cards_issued ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Lipa Hapa registered</span>
          <input className={styles.input} type="number" min="0" name="lipa_hapa_registered"
            defaultValue={event?.lipa_hapa_registered ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Deposits raised (TZS)</span>
          <input className={styles.input} type="number" min="0" step="1000" name="deposits_tzs"
            defaultValue={event?.deposits_tzs ?? ''} />
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Album link</span>
          <input className={styles.input} type="url" name="album_url"
            defaultValue={event?.album_url ?? ''} placeholder="https://" />
          <span className={styles.help}>
            Where the full set of photographs lives. Up to ten can be attached
            to the event itself below.
          </span>
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Notes</span>
          <textarea className={styles.textarea} name="notes" rows={2}
            defaultValue={event?.notes ?? ''} />
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save event' : 'Record event'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

export function AddEventImage({ eventId, used }: { eventId: string; used: number }) {
  const [state, formAction, pending] = useActionState(addEventImage, INITIAL);
  const full = used >= 10;

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="event_id" value={eventId} />
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Image link</span>
          <input className={styles.input} type="url" name="external_url" placeholder="https://"
            disabled={full} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Caption</span>
          <input className={styles.input} name="caption" disabled={full} />
        </label>
      </div>
      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--ghost" disabled={pending || full}>
          {pending ? 'Adding…' : `Add image (${used}/10)`}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {full ? 'Ten already attached — the rest belong behind the album link.' : state.message}
        </p>
      </div>
    </form>
  );
}

export function RemoveEventImage({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(removeEventImage, INITIAL);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="image_id" value={id} />
      <button type="submit" className="btn btn--quiet btn--sm" disabled={pending}>
        {pending ? '…' : 'Remove'}
      </button>
      {state.message ? <span className={styles.error}>{state.message}</span> : null}
    </form>
  );
}
