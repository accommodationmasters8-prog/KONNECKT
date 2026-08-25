'use client';

import { useActionState } from 'react';
import {
  saveAccountBreakdown, saveLoanBreakdown, type ActionResult,
} from '@/app/[locale]/staff/stations/actions';
import styles from './AdminForm.module.css';
import grid from './BreakdownForms.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

export interface ProductOption { code: string; label: string }

export interface AccountRow {
  product_code: string;
  opened: number;
  active: number;
  dormant: number;
  deposits_tzs: number;
}

export interface LoanRow {
  loan_code: string;
  count: number;
  value_tzs: number;
}

/**
 * The account-type split for one month.
 *
 * A grid rather than a stack of labelled fields: this is the same four
 * questions asked seven times, and a form that repeats a legend seven times is
 * a form nobody finishes. The header row is the legend, once.
 *
 * Every type is always on screen, including the ones at zero. A branch that
 * has to press "add a type" to record Scholar Account is a branch that files a
 * split missing Scholar Account.
 */
export function AccountBreakdownForm({
  reportId,
  stationId,
  products,
  rows,
  totals,
}: {
  reportId: string;
  stationId: string;
  products: ProductOption[];
  rows: AccountRow[];
  /** The month's header figures, so a split that does not add up says so. */
  totals: { opened: number; active: number; dormant: number; deposits: number };
}) {
  const [state, formAction, pending] = useActionState(saveAccountBreakdown, INITIAL);
  const by = new Map(rows.map((r) => [r.product_code, r]));

  const sum = rows.reduce(
    (a, r) => ({
      opened: a.opened + Number(r.opened),
      deposits: a.deposits + Number(r.deposits_tzs),
    }),
    { opened: 0, deposits: 0 },
  );

  // Only worth saying once the split has been started at all.
  const mismatch = rows.length > 0 && sum.opened !== totals.opened;

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="report_id" value={reportId} />
      <input type="hidden" name="station_id" value={stationId} />

      <div className={grid.wrap}>
        <table className={grid.table}>
          <thead>
            <tr>
              <th scope="col">Account type</th>
              <th scope="col" className={grid.num}>Opened</th>
              <th scope="col" className={grid.num}>Active</th>
              <th scope="col" className={grid.num}>Dormant</th>
              <th scope="col" className={grid.num}>Deposits (TZS)</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const row = by.get(p.code);
              return (
                <tr key={p.code}>
                  <th scope="row" className={grid.rowLabel}>
                    <input type="hidden" name="product_code" value={p.code} />
                    {p.label}
                  </th>
                  <td>
                    <input className={grid.cell} type="number" min="0" name={`opened__${p.code}`}
                      defaultValue={row?.opened || ''} aria-label={`${p.label} opened`} />
                  </td>
                  <td>
                    <input className={grid.cell} type="number" min="0" name={`active__${p.code}`}
                      defaultValue={row?.active || ''} aria-label={`${p.label} active`} />
                  </td>
                  <td>
                    <input className={grid.cell} type="number" min="0" name={`dormant__${p.code}`}
                      defaultValue={row?.dormant || ''} aria-label={`${p.label} dormant`} />
                  </td>
                  <td>
                    <input className={grid.cell} type="number" min="0" step="1000"
                      name={`deposits__${p.code}`}
                      defaultValue={Number(row?.deposits_tzs) || ''}
                      aria-label={`${p.label} deposits`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mismatch ? (
        <p className={grid.reconcile} role="status">
          The split adds up to <strong>{sum.opened.toLocaleString()}</strong> accounts, but the
          month says <strong>{totals.opened.toLocaleString()}</strong>. Neither figure is
          changed by the other — correct whichever is wrong.
        </p>
      ) : null}

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save the account split'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

/** The same shape, for loans: how many of each kind, and how much they came to. */
export function LoanBreakdownForm({
  reportId,
  stationId,
  products,
  rows,
  totals,
}: {
  reportId: string;
  stationId: string;
  products: ProductOption[];
  rows: LoanRow[];
  totals: { count: number; value: number };
}) {
  const [state, formAction, pending] = useActionState(saveLoanBreakdown, INITIAL);
  const by = new Map(rows.map((r) => [r.loan_code, r]));

  const sum = rows.reduce((a, r) => a + Number(r.count), 0);
  const mismatch = rows.length > 0 && sum !== totals.count;

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="report_id" value={reportId} />
      <input type="hidden" name="station_id" value={stationId} />

      <div className={grid.wrap}>
        <table className={grid.table}>
          <thead>
            <tr>
              <th scope="col">Loan type</th>
              <th scope="col" className={grid.num}>How many</th>
              <th scope="col" className={grid.num}>Value (TZS)</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const row = by.get(p.code);
              return (
                <tr key={p.code}>
                  <th scope="row" className={grid.rowLabel}>
                    <input type="hidden" name="loan_code" value={p.code} />
                    {p.label}
                  </th>
                  <td>
                    <input className={grid.cell} type="number" min="0" name={`count__${p.code}`}
                      defaultValue={row?.count || ''} aria-label={`${p.label} count`} />
                  </td>
                  <td>
                    <input className={grid.cell} type="number" min="0" step="1000"
                      name={`value__${p.code}`}
                      defaultValue={Number(row?.value_tzs) || ''}
                      aria-label={`${p.label} value`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mismatch ? (
        <p className={grid.reconcile} role="status">
          The split adds up to <strong>{sum.toLocaleString()}</strong> loans, but the month says{' '}
          <strong>{totals.count.toLocaleString()}</strong>.
        </p>
      ) : null}

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save the loan split'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}
