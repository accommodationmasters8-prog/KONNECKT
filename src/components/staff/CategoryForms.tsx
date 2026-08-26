'use client';

import { useActionState } from 'react';
import {
  createCategory, addCategoryLoanType, type ActionResult,
} from '@/app/[locale]/staff/categories/actions';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

export function CategoryForm() {
  const [state, formAction, pending] = useActionState(createCategory, INITIAL);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input className={styles.input} name="name_en" required
            placeholder="Hospitals & clinics" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Name (Kiswahili)</span>
          <input className={styles.input} name="name_sw" placeholder="Hospitali" />
          <span className={styles.help}>Left blank, the English name is used.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>What its people are called</span>
          <input className={styles.input} name="member_noun_en" placeholder="staff" />
          <span className={styles.help}>
            Used everywhere in the category. &ldquo;3,400 staff without an
            account&rdquo; reads as a finding; &ldquo;3,400 people&rdquo; reads
            as a database.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>And in Kiswahili</span>
          <input className={styles.input} name="member_noun_sw" placeholder="wafanyakazi" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Colour</span>
          <select className={styles.select} name="colour" defaultValue="teal">
            <option value="teal">Teal</option>
            <option value="green">Green</option>
            <option value="gold">Gold</option>
            <option value="pink">Pink</option>
            <option value="ink">Ink</option>
          </select>
          <span className={styles.help}>What its cards and charts are drawn in.</span>
        </label>

        <label className={`${styles.field} ${styles.gridWide}`}>
          <span className={styles.label}>Description</span>
          <input className={styles.input} name="description"
            placeholder="What belongs in this category and what does not." />
        </label>
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add category'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

/** Add a loan type that only this category's stations will see. */
export function AddCategoryLoanType({ categoryId }: { categoryId: string }) {
  const [state, formAction, pending] = useActionState(addCategoryLoanType, INITIAL);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="category_id" value={categoryId} />
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Loan type</span>
          <input className={styles.input} name="label_en" required
            placeholder="Tuition advance" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>In Kiswahili</span>
          <input className={styles.input} name="label_sw" />
        </label>
      </div>
      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add loan type'}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}
