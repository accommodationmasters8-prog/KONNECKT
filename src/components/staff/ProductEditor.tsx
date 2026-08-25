'use client';

import { useActionState } from 'react';
import { saveProduct, type ActionResult } from '@/app/[locale]/staff/products/actions';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

export interface ProductRow {
  code: string;
  label_en: string;
  label_sw: string;
  description_en: string | null;
  description_sw: string | null;
  min_age: number | null;
  max_age: number | null;
  requires_guardian: boolean;
  is_active: boolean;
  display_order: number;
}

/**
 * Add or edit an account type.
 *
 * The code is fixed once it exists: every account record stores it, so
 * changing it would rewrite what those records mean. Editing an existing
 * product therefore edits its labels, its age rules and whether it is still
 * offered — never its identity.
 */
export function ProductEditor({ product }: { product?: ProductRow }) {
  const [state, formAction, pending] = useActionState(saveProduct, INITIAL);
  const editing = Boolean(product);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Code</span>
          <input
            className={styles.input}
            name="code"
            defaultValue={product?.code ?? ''}
            readOnly={editing}
            required
            placeholder="graduate_account"
          />
          <span className={styles.help}>
            {editing
              ? 'Fixed. Every account already recorded stores this code.'
              : 'Lower case, no spaces. Stored on every account opened against this product.'}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Order</span>
          <input className={styles.input} type="number" name="display_order"
            defaultValue={product?.display_order ?? 0} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Name (English)</span>
          <input className={styles.input} name="label_en" defaultValue={product?.label_en ?? ''} required />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Name (Kiswahili)</span>
          <input className={styles.input} name="label_sw" defaultValue={product?.label_sw ?? ''} required />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Minimum age</span>
          <input className={styles.input} type="number" min="0" max="120" name="min_age"
            defaultValue={product?.min_age ?? ''} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Maximum age</span>
          <input className={styles.input} type="number" min="0" max="120" name="max_age"
            defaultValue={product?.max_age ?? ''} />
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Description (English)</span>
          <textarea className={styles.textarea} name="description_en" rows={2}
            defaultValue={product?.description_en ?? ''} />
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Description (Kiswahili)</span>
          <textarea className={styles.textarea} name="description_sw" rows={2}
            defaultValue={product?.description_sw ?? ''} />
        </label>
      </div>

      <div className={styles.switchRow}>
        <label className={styles.switch}>
          <input type="checkbox" name="requires_guardian" defaultChecked={product?.requires_guardian ?? false} />
          <span>
            <span className={styles.label}>Needs a guardian</span>
            <span className={styles.help}>For products opened by a minor. The consent record is separate and still required.</span>
          </span>
        </label>
      </div>

      <div className={styles.switchRow}>
        <label className={styles.switch}>
          <input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} />
          <span>
            <span className={styles.label}>Still offered</span>
            <span className={styles.help}>Turn off to retire it. Accounts already opened on it keep their record.</span>
          </span>
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save product' : 'Add account type'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}
