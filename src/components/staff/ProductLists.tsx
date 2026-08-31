'use client';

import { useActionState, useState } from 'react';
import {
  addProduct, setProductActive, setProductCategory, deleteProduct,
  type ActionResult,
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
  category_id: string | null;
  /** Every category this type is offered in; empty means everywhere. */
  category_ids?: string[];
}

export interface CategoryOption { id: string; name: string }

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

/** Which category a type belongs to, or everywhere. Saves on change. */
function CategoryPicker({
  kind,
  code,
  categoryIds,
  categories,
}: {
  kind: ProductKind;
  code: string;
  /** Every category this type is offered in. Empty means everywhere. */
  categoryIds: string[];
  categories: CategoryOption[];
}) {
  const [state, formAction, pending] = useActionState(setProductCategory, INITIAL);
  const [picked, setPicked] = useState<string[]>(categoryIds);

  const toggle = (id: string) => setPicked((current) =>
    current.includes(id) ? current.filter((c) => c !== id) : [...current, id]);

  const dirty =
    picked.length !== categoryIds.length
    || picked.some((id) => !categoryIds.includes(id));

  return (
    <form action={formAction} className={styles.scopeForm}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="code" value={code} />

      {/* Checkboxes, not a dropdown. A type belongs to as many categories as
          it belongs to, and the control has to be able to say so — a select
          could only ever name one. */}
      <fieldset className={styles.scope}>
        <legend className={styles.srOnly}>Categories for {code}</legend>

        <label className={picked.length === 0 ? styles.chipOn : styles.chip}>
          <input
            type="checkbox"
            className={styles.srOnly}
            checked={picked.length === 0}
            onChange={() => setPicked([])}
          />
          Everywhere
        </label>

        {categories.map((c) => (
          <label key={c.id} className={picked.includes(c.id) ? styles.chipOn : styles.chip}>
            <input
              type="checkbox"
              name="category_id"
              value={c.id}
              className={styles.srOnly}
              checked={picked.includes(c.id)}
              onChange={() => toggle(c.id)}
            />
            {c.name}
          </label>
        ))}
      </fieldset>

      {dirty ? (
        <button type="submit" className="btn btn--primary btn--sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      ) : null}

      {state.message ? (
        <span className={state.ok ? styles.ok : styles.error}>{state.message}</span>
      ) : null}
    </form>
  );
}

/** Delete outright. Refused by the database once anything references it. */
function DeleteProduct({ kind, code }: { kind: ProductKind; code: string }) {
  const [state, formAction, pending] = useActionState(deleteProduct, INITIAL);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="code" value={code} />
      <button type="submit" className="btn btn--quiet btn--sm" disabled={pending}>
        {pending ? '…' : 'Delete'}
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
  categories,
}: {
  kind: ProductKind;
  items: ProductItem[];
  locale: string;
  categories: CategoryOption[];
}) {
  return (
    <div className={list.wrap}>
      <table className={list.table}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Code</th>
            <th scope="col">Appears in</th>
            <th scope="col">In use</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.code} className={item.is_active ? undefined : list.retired}>
              <th scope="row">{locale === 'sw' ? item.label_sw : item.label_en}</th>
              <td><code className={list.code}>{item.code}</code></td>
              <td>
                <CategoryPicker
                  kind={kind}
                  code={item.code}
                  categoryIds={item.category_ids ?? []}
                  categories={categories}
                />
              </td>
              <td>{item.is_active ? 'Yes' : 'Retired'}</td>
              <td className={list.actions}>
                <ToggleProduct kind={kind} code={item.code} active={item.is_active} />
                <DeleteProduct kind={kind} code={item.code} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
