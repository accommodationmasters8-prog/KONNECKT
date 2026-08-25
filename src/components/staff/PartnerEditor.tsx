'use client';

import { useActionState, useRef, useState } from 'react';
import {
  savePlacement, deletePlacement, type ActionResult,
} from '@/app/[locale]/staff/partners/actions';
import { getBrowserClient } from '@/lib/supabase/browser';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };
const BUCKET = 'partner-logos';
const MAX_BYTES = 512 * 1024;

export interface PlacementRow {
  id: string;
  name: string;
  placement: string;
  website_url: string | null;
  logo_path: string | null;
  display_order: number;
  is_active: boolean;
  usage_approved_by: string | null;
}

/**
 * Add or edit one partner placement, logo and all.
 *
 * The file goes straight from the browser to Supabase Storage and only its
 * path is posted with the form. That keeps a 512KB upload off the server
 * action's request body, and it means a failed upload fails on its own, before
 * anything is written to the table.
 *
 * The publish switch is deliberately awkward: it needs a name in "cleared by".
 * The database enforces that too — this is the version of the rule that
 * explains itself rather than returning a constraint violation.
 */
export function PartnerEditor({
  row,
  onDone,
}: {
  row?: PlacementRow;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(savePlacement, INITIAL);
  const [logoPath, setLogoPath] = useState(row?.logo_path ?? '');
  const [uploadState, setUploadState] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    const client = getBrowserClient();
    if (!client) {
      setUploadState('No database is attached, so there is nowhere to upload to.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadState('That file is over 512KB. A logo that big is a photograph — export an SVG or a trimmed PNG.');
      return;
    }

    setUploading(true);
    setUploadState('Uploading…');

    // Name it after the partner and the clock: two people uploading "logo.svg"
    // in the same minute must not overwrite each other.
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    const path = `${Date.now()}-${safe}`;

    const { error } = await client.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
    });

    setUploading(false);

    if (error) {
      setUploadState(error.message);
      return;
    }
    setLogoPath(path);
    setUploadState(`Uploaded ${file.name}.`);
  }

  return (
    <form
      action={(data) => {
        formAction(data);
        onDone?.();
      }}
      className={styles.form}
    >
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <input type="hidden" name="logo_path" value={logoPath} />

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Partner name</span>
          <input className={styles.input} name="name" defaultValue={row?.name ?? ''} required />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Where it appears</span>
          <select className={styles.select} name="placement" defaultValue={row?.placement ?? 'landing_strip'}>
            <option value="landing_strip">Landing page strip</option>
            <option value="events_page">Events page</option>
            <option value="footer">Footer</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Website</span>
          <input
            className={styles.input}
            name="website_url"
            type="url"
            placeholder="https://"
            defaultValue={row?.website_url ?? ''}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Order</span>
          <input
            className={styles.input}
            name="display_order"
            type="number"
            defaultValue={row?.display_order ?? 0}
          />
        </label>

        <div className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Logo</span>
          <span className={styles.help}>
            SVG, PNG or WebP, up to 512KB. Upload the partner&rsquo;s own file —
            never a redrawn version of someone else&rsquo;s mark.
          </span>
          <input
            ref={fileInput}
            className={styles.input}
            type="file"
            accept="image/svg+xml,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <span className={styles.help} role="status" aria-live="polite">
            {uploadState || (logoPath ? `Current file: ${logoPath}` : 'No file yet.')}
          </span>
        </div>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Use cleared by</span>
          <span className={styles.help}>
            The person at CRDB who confirmed this mark may be shown. Required
            before it can be published — the database refuses an active
            placement without it.
          </span>
          <input
            className={styles.input}
            name="usage_approved_by"
            defaultValue={row?.usage_approved_by ?? ''}
          />
        </label>
      </div>

      <div className={styles.switchRow}>
        <label className={styles.switch}>
          <input type="checkbox" name="is_active" defaultChecked={row?.is_active ?? false} />
          <span>
            <span className={styles.label}>Show on the site</span>
            <span className={styles.help}>Live for every visitor as soon as this is saved.</span>
          </span>
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending || uploading}>
          {pending ? 'Saving…' : row ? 'Save partner' : 'Add partner'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

/** Remove a placement. Its audit trail outlives it. */
export function DeletePlacement({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState(deletePlacement, INITIAL);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn--quiet btn--sm" disabled={pending}>
        {pending ? 'Removing…' : 'Remove'}
      </button>
      <span className="visually-hidden">{name}</span>
      {state.message ? (
        <span className={state.ok ? styles.ok : styles.error}>{state.message}</span>
      ) : null}
    </form>
  );
}
