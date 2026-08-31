'use client';

import { useActionState, useState } from 'react';
import { importCsv, type ImportKind, type ImportResult } from '@/app/[locale]/staff/import/actions';
import styles from './ImportForm.module.css';
import admin from './AdminForm.module.css';

const INITIAL: ImportResult = {
  ran: false, preview: true, kind: null,
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
        <legend className={admin.label}>What does the file contain?</legend>

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
            <span className={styles.kindName}>{k === 'branches' ? 'Branches' : 'Stations'}</span>
            <span className={styles.kindNote}>
              {k === 'branches'
                ? 'Name, zone, year opened'
                : 'Name, its branch, its category'}
            </span>
          </label>
        ))}
      </fieldset>
      )}

      <div className={styles.template}>
        <p className={styles.templateHead}>Columns for this file</p>
        <code className={styles.templateCode}>
          {fixedCategory && fixedBranch
            ? 'name,region,district,portfolio,contact,phone'
            : fixedCategory
              ? 'name,branch,region,district,portfolio,contact,phone'
              : fixedBranch
                ? 'name,category,region,district,portfolio,contact,phone'
                : template.headers}
        </code>
        <p className={styles.templateNote}>
          {fixedCategory || fixedBranch
          ? `Every row lands ${[
              fixedCategory ? `in ${fixedCategory.name}` : null,
              fixedBranch ? `at ${fixedBranch.name}` : null,
            ].filter(Boolean).join(' and ')}, so the file needs no ${[
              fixedCategory ? 'category' : null,
              fixedBranch ? 'branch' : null,
            ].filter(Boolean).join(' or ')} column — one is ignored if it is there.`
          : template.note}{' '}
        Column names are matched loosely, so
          {' '}<code>Branch Name</code>, <code>branch_name</code> and{' '}
          <code>branch</code> are all the same column, and any other columns in
          your sheet are left alone.
        </p>
        {canChooseZone ? null : (
          <p className={styles.templateNote}>
            Whatever the zone column says, your rows are filed into your own zone.
          </p>
        )}
      </div>

      <label className={admin.field}>
        <span className={admin.label}>Upload a spreadsheet</span>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className={styles.file}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
        />
        <span className={admin.help}>
          {fileName ? `Selected: ${fileName}. ` : ''}
          Excel (<strong>.xlsx</strong>) or CSV, whichever you already have.
          Upload your working sheet as it is — columns it does not recognise
          are ignored, so there is no template to fill in first.
        </span>
      </label>

      <label className={admin.field}>
        <span className={admin.label}>Or paste the rows</span>
        <textarea
          name="pasted"
          rows={7}
          className={styles.paste}
          placeholder={`${template.headers}\n${template.example}`}
          spellCheck={false}
        />
        <span className={admin.help}>
          Copy the cells straight out of the spreadsheet, header row included.
        </span>
      </label>

      <div className={styles.actions}>
        <button
          type="submit"
          name="commit"
          value="no"
          className="btn btn--quiet"
          disabled={pending}
        >
          {pending ? 'Checking…' : 'Check the file'}
        </button>

        <button
          type="submit"
          name="commit"
          value="yes"
          className="btn btn--primary"
          disabled={pending || !previewed}
          title={previewed ? undefined : 'Check the file first'}
        >
          {previewed
            ? `Import ${state.toCreate.length + state.toUpdate.length} rows`
            : 'Import'}
        </button>

        {state.message ? (
          <p className={state.ok ? admin.ok : admin.error} role="status" aria-live="polite">
            {state.message}
          </p>
        ) : null}
      </div>

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
