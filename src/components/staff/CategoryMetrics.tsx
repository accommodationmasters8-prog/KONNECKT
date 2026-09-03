'use client';

import { useActionState } from 'react';
import { addMetric, setCategoryMetrics, type MetricResult } from
  '@/app/[locale]/staff/categories/metric-actions';
import styles from './CategoryMetrics.module.css';

export interface MetricOption {
  id: string;
  key: string;
  label: string;
  unit: 'count' | 'money' | 'percent';
  /** Built in, meaning it is a column rather than a filed value. */
  builtIn: boolean;
}

const UNIT_WORD: Record<MetricOption['unit'], string> = {
  count: 'a number',
  money: 'TSh',
  percent: 'a percentage',
};

/**
 * What this category tracks.
 *
 * The console used to ask every category for the same ten figures, because
 * those are the columns the table happens to have. That is the schema making
 * a decision the bank should be making: a university reports a roll and a
 * graduation intake, a boda stand reports riders and a daily float, and
 * neither list is the other's.
 *
 * Switching one off does not delete what was already filed against it. The
 * figures stay; they stop being asked for.
 */
export function CategoryMetrics({
  categoryId,
  all,
  chosen,
}: {
  categoryId: string;
  all: MetricOption[];
  chosen: string[];
}) {
  const [state, save, saving] = useActionState<MetricResult | null, FormData>(
    setCategoryMetrics,
    null,
  );
  const [added, add, adding] = useActionState<MetricResult | null, FormData>(addMetric, null);

  const on = new Set(chosen);

  return (
    <div className={styles.wrap}>
      <form action={save} className={styles.pick}>
        <input type="hidden" name="category_id" value={categoryId} />

        <div className={styles.grid}>
          {all.map((metric) => (
            <label key={metric.id} className={styles.row}>
              <input
                type="checkbox"
                name="metric"
                value={metric.id}
                defaultChecked={on.has(metric.id)}
              />
              <span className={styles.rowText}>
                <span className={styles.rowLabel}>{metric.label}</span>
                <span className={styles.rowUnit}>
                  {UNIT_WORD[metric.unit]}
                  {metric.builtIn ? '' : ' · added here'}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className={styles.foot}>
          <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save what this tracks'}
          </button>
          {state ? (
            <span className={state.ok ? styles.ok : styles.bad}>{state.message}</span>
          ) : null}
        </div>
      </form>

      <form action={add} className={styles.add}>
        <input type="hidden" name="category_id" value={categoryId} />
        <label className={styles.field}>
          <span>Track something new</span>
          <input name="label" placeholder="Group savings joined" maxLength={60} required />
        </label>
        <label className={styles.field}>
          <span>It is</span>
          <select name="unit" defaultValue="count">
            <option value="count">a number</option>
            <option value="money">an amount in TSh</option>
            <option value="percent">a percentage</option>
          </select>
        </label>
        <button type="submit" className="btn btn--quiet btn--sm" disabled={adding}>
          {adding ? 'Adding…' : 'Add'}
        </button>
        {added ? (
          <span className={added.ok ? styles.ok : styles.bad}>{added.message}</span>
        ) : null}
      </form>
    </div>
  );
}
