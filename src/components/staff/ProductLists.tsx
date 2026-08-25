'use client';

import { useActionState } from 'react';
import {
  addProduct, setProductActive, type ActionResult,
} from '@/app/[locale]/staff/settings/actions';
import styles from './AdminForm.module.css';
import list from './ProductLists.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

export type ProductKind = 'account' | 'loan';

export interface ProductItem {
  code: string;
  label_en: string;
  label_sw: string;
  is_active: boolean;
}

export function AddProduct({ kind, noun }: { kind: ProductKind; noun: string }) {
  const [state, formAction, pending] = useActionState(addProduct, INITIAL);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="kind" value={kind} />
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Name (English)</span>
          <input className={styles.input} name="label_en" required />
          <span className={styles.help}>
            The code every filed month is keyed on comes from this and cannot
            be changed afterwards, so name it the way it will be named in five
            years.
          </span>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Name (Kiswahili)</span>
          <input className={styles.input} name="label_sw" />
          <span className={styles.help}>Left blank, the English name is used.</span>
        </label>
      </div>
      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Adding…' : `Add a ${noun}`}
        </button>
        <p className={state.ok ? styles.ok : styles.error} role="status" aria-live="polite">
          {state.message}
        </p>
      </div>
    </form>
  );
}

/** Retire or restore. Never a delete — see the action for why. */
export function ToggleProduct({
  kind,
  code,
  active,
}: {
  kind: ProductKind;
  code: string;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(setProductActive, INITIAL);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <button type="submit" className="btn btn--quiet btn--sm" disabled={pending}>
        {pending ? '…' : active ? 'Retire' : 'Bring back'}
      </button>
      {state.message && !state.ok ? (
        <span className={styles.error}>{state.message}</span>
      ) : null}
    </form>
  );
}

export function ProductTable({
  kind,
  items,
  locale,
}: {
  kind: ProductKind;
  items: ProductItem[];
  locale: string;
}) {
  return (
    <div className={list.wrap}>
      <table className={list.table}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Code</th>
            <th scope="col">In use</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.code} className={item.is_active ? undefined : list.retired}>
              <th scope="row">{locale === 'sw' ? item.label_sw : item.label_en}</th>
              <td><code className={list.code}>{item.code}</code></td>
              <td>{item.is_active ? 'Yes' : 'Retired'}</td>
              <td>
                <ToggleProduct kind={kind} code={item.code} active={item.is_active} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
