'use client';

import { useActionState, useState } from 'react';
import { importCsv, type ImportKind, type ImportResult } from '@/app/[locale]/staff/import/actions';
import styles from './ImportForm.module.css';
import admin from './AdminForm.module.css';

const INITIAL: ImportResult = {
  ran: false, preview: true, kind: null, mapping: [],
  toCreate: [], toUpdate: [], issues: [], message: '', ok: false,
};

const TEMPLATES: Record<ImportKind, { headers: string; example: string; note: string }> = {
  branches: {
    headers: 'name,zone,year_established,notes',
    example: 'Mwanza,LAKE,1998,\nGeita,LAKE,2011,\n"Kariakoo, Narung\'ombe",DAR_ES_SALAAM,1996,',
    note: 'Only the name is required. A branch already in the system is updated rather than duplicated.',
  },
  stations: {
    headers: 'name,branch,category,region,district,portfolio,contact,phone',
    example: 'University of Dodoma,Dodoma,Universities,Dodoma,Dodoma City,32000,,\nMakongo Secondary,Kinondoni,Secondary schools,Dar es Salaam,Kinondoni,1400,,',
    note: 'The branch and the category must already exist and must match by name. Everything else is optional.',
  },
};

/**
 * Bulk import.
 *
 * Two submits of the same form: the first previews, the second writes. That
 * ordering is the whole design — an import that goes straight in is one where
 * two hundred rows land wrong and nobody finds out until a zone manager asks
 * why their branch list doubled.
 *
 * The preview names every row it will skip and why, because "182 rows failed"
 * is a status and "line 47, Geita, no zone called GIETA" is a fix.
 */
export function ImportForm({
  canChooseZone,
  initialKind = 'branches',
  fixedCategory,
  fixedBranch,
}: {
  canChooseZone: boolean;
  /** Preselected when arriving from a link that already knows the answer —
   *  "Import stations" on the branches screen should not then ask which. */
  initialKind?: ImportKind;
  /** Set on a category screen: every row lands in this category, and the file
   *  needs no category column. `{ slug, name }` so the form can say which. */
  fixedCategory?: { slug: string; name: string };
  /** Set on a branch screen: every row lands at this branch, and the file
   *  needs no branch column. */
  fixedBranch?: { id: string; name: string };
}) {
  const [state, formAction, pending] = useActionState(importCsv, INITIAL);
  const locked = Boolean(fixedCategory || fixedBranch);
  const [kind, setKind] = useState<ImportKind>(locked ? 'stations' : initialKind);
  const [fileName, setFileName] = useState('');

  const template = TEMPLATES[kind];
  const previewed = state.ran && state.preview && state.ok;
  const total = state.toCreate.length + state.toUpdate.length;

  const columns = fixedCategory && fixedBranch
    ? 'name, region, district, portfolio, contact, phone'
    : fixedCategory
      ? 'name, branch, region, district, portfolio, contact, phone'
      : fixedBranch
        ? 'name, category, region, district, portfolio, contact, phone'
        : template.headers.replace(/,/g, ', ');

  return (
    <form action={formAction} className={styles.form} encType="multipart/form-data">
      {fixedCategory ? (
        <input type="hidden" name="fixed_category" value={fixedCategory.slug} />
      ) : null}
      {fixedBranch ? (
        <input type="hidden" name="fixed_branch" value={fixedBranch.id} />
      ) : null}

      {locked ? (
        <input type="hidden" name="kind" value="stations" />
      ) : (
        <fieldset className={styles.kinds}>
          <legend className={styles.legend}>What is in the file?</legend>
          {(Object.keys(TEMPLATES) as ImportKind[]).map((k) => (
            <label key={k} className={kind === k ? styles.kindOn : styles.kind}>
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className={styles.radio}
              />
              {k === 'branches' ? 'Branches' : 'Stations'}
            </label>
          ))}
        </fieldset>
      )}

      {/* The upload control, as an actual button.
          A bare <input type="file"> renders as a small grey affair that people
          genuinely miss — it was the least visible thing on a screen that
          exists to do one job. The input is still the input; the label is what
          you see and click. */}
      <label className={styles.drop}>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className={styles.fileInput}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
        />
        <span className={styles.dropIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <span className={styles.dropText}>
          <span className={styles.dropTitle}>
            {fileName || 'Choose an Excel or CSV file'}
          </span>
          <span className={styles.dropHint}>
            {fileName
              ? 'Click to choose a different file'
              : 'Any Excel or CSV, up to 40MB — columns are matched for you'}
          </span>
        </span>
      </label>

      <details className={styles.aside}>
        <summary className={styles.asideHead}>Which columns?</summary>
        <p className={styles.asideBody}>
          <code>{columns}</code> — names are matched loosely, and any other
          column in your sheet is ignored.
        </p>
        <textarea
          name="pasted"
          rows={5}
          className={styles.paste}
          placeholder="…or paste the rows here, header included"
          spellCheck={false}
        />
      </details>

      <div className={styles.actions}>
        {previewed ? (
          <button type="submit" name="commit" value="yes" className="btn btn--primary btn--lg" disabled={pending}>
            {pending ? 'Importing…' : `Import ${total} ${total === 1 ? 'row' : 'rows'}`}
          </button>
        ) : (
          <button type="submit" name="commit" value="no" className="btn btn--primary btn--lg" disabled={pending}>
            {pending ? 'Checking…' : 'Check the file'}
          </button>
        )}

        {previewed ? (
          <button type="submit" name="commit" value="no" className="btn btn--quiet" disabled={pending}>
            Check again
          </button>
        ) : null}

        {previewed && total > 0 ? (
          <span className={styles.atomic}>
            All {total} together, or none at all.
          </span>
        ) : null}

        {state.message ? (
          <p className={state.ok ? admin.ok : admin.error} role="status" aria-live="polite">
            {state.message}
          </p>
        ) : null}
      </div>

      {state.mapping.length > 0 ? (
        <div className={styles.mapping}>
          <p className={styles.mappingHead}>How your columns were read</p>
          <ul className={styles.mappingList}>
            {state.mapping.map((m) => (
              <li key={m.field}>
                <span className={styles.mappingField}>{m.field}</span>
                <span className={styles.mappingArrow} aria-hidden="true">←</span>
                <code className={styles.mappingCol}>{m.column}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.ran && (state.toCreate.length > 0 || state.toUpdate.length > 0) ? (
        <div className={styles.report}>
          {state.toCreate.length > 0 ? (
            <section className={styles.reportBlock}>
              <h3 className={styles.reportHead}>
                <span className={styles.tagAdd}>Add</span>
                {state.toCreate.length} new
              </h3>
              <ul className={styles.reportList}>
                {state.toCreate.slice(0, 40).map((r) => (
                  <li key={`c${r.line}`}>
                    <span className={styles.rowName}>{r.name}</span>
                    <span className={styles.rowDetail}>{r.detail}</span>
                  </li>
                ))}
                {state.toCreate.length > 40 ? (
                  <li className={styles.more}>and {state.toCreate.length - 40} more</li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {state.toUpdate.length > 0 ? (
            <section className={styles.reportBlock}>
              <h3 className={styles.reportHead}>
                <span className={styles.tagUpdate}>Update</span>
                {state.toUpdate.length} already here
              </h3>
              <ul className={styles.reportList}>
                {state.toUpdate.slice(0, 40).map((r) => (
                  <li key={`u${r.line}`}>
                    <span className={styles.rowName}>{r.name}</span>
                    <span className={styles.rowDetail}>{r.detail}</span>
                  </li>
                ))}
                {state.toUpdate.length > 40 ? (
                  <li className={styles.more}>and {state.toUpdate.length - 40} more</li>
                ) : null}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {state.issues.length > 0 ? (
        <section className={styles.problems}>
          <h3 className={styles.reportHead}>
            <span className={styles.tagSkip}>Skipped</span>
            {state.issues.length} rows
          </h3>
          <p className={styles.templateNote}>
            These are named by line so they can be fixed in the spreadsheet and
            the file re-uploaded. Everything else still imports.
          </p>
          <ul className={styles.reportList}>
            {state.issues.slice(0, 60).map((issue) => (
              <li key={`${issue.line}-${issue.name}`}>
                <span className={styles.rowLine}>line {issue.line}</span>
                <span className={styles.rowName}>{issue.name}</span>
                <span className={styles.rowProblem}>{issue.problem}</span>
              </li>
            ))}
            {state.issues.length > 60 ? (
              <li className={styles.more}>and {state.issues.length - 60} more</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </form>
  );
}
