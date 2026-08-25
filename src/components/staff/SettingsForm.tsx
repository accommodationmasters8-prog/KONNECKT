'use client';

import { useActionState } from 'react';
import { saveSettings, type ActionResult } from '@/app/[locale]/staff/settings/actions';
import type { SettingKey, SettingValue } from '@/lib/admin/settings';
import { locales, localeNames } from '@/i18n';
import styles from './AdminForm.module.css';

const INITIAL: ActionResult = { ok: false, message: '' };

/**
 * The settings screen's form, one group per submit.
 *
 * Each group posts on its own so a slow save of the landing-page copy cannot
 * take the contact details with it, and so the confirmation appears next to
 * the fields it refers to rather than at the top of a long page.
 */
export function SettingsForm({
  group,
  fields,
  values,
}: {
  group: string;
  fields: SettingKey[];
  values: Record<string, SettingValue>;
}) {
  const [state, formAction, pending] = useActionState(saveSettings, INITIAL);

  return (
    <form action={formAction} className={styles.form}>
      {fields.map((field) => (
        <Field key={field.key} field={field} value={values[field.key]} />
      ))}

      <div className={styles.formFoot}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Saving…' : `Save ${group.toLowerCase()}`}
        </button>
        <p
          className={state.ok ? styles.ok : styles.error}
          role="status"
          aria-live="polite"
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}

function Field({ field, value }: { field: SettingKey; value: SettingValue }) {
  if (field.kind === 'boolean') {
    const on = value === true;
    return (
      <div className={styles.switchRow}>
        {/* The hidden companion tells the action this switch was on screen.
            Without it an unchecked box is indistinguishable from a field that
            was never rendered, and saving one group would clear another. */}
        <input type="hidden" name={`${field.key}:submitted`} value="1" />
        <label className={styles.switch}>
          <input type="checkbox" name={field.key} defaultChecked={on} />
          <span>
            <span className={styles.label}>{field.label}</span>
            {field.help ? <span className={styles.help}>{field.help}</span> : null}
          </span>
        </label>
      </div>
    );
  }

  if (field.is_localised) {
    const localised = (value && typeof value === 'object' ? value : {}) as Record<string, string>;
    return (
      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>{field.label}</legend>
        {field.help ? <p className={styles.help}>{field.help}</p> : null}
        <div className={styles.localeGrid}>
          {locales.map((locale) => (
            <label key={locale} className={styles.field}>
              <span className={styles.sublabel}>{localeNames[locale]}</span>
              {field.kind === 'long_text' ? (
                <textarea
                  className={styles.textarea}
                  name={`${field.key}:${locale}`}
                  rows={3}
                  defaultValue={localised[locale] ?? ''}
                />
              ) : (
                <input
                  className={styles.input}
                  name={`${field.key}:${locale}`}
                  defaultValue={localised[locale] ?? ''}
                />
              )}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const scalar = value == null ? '' : String(value);
  return (
    <label className={styles.field}>
      <span className={styles.label}>{field.label}</span>
      {field.help ? <span className={styles.help}>{field.help}</span> : null}
      {field.kind === 'long_text' ? (
        <textarea className={styles.textarea} name={field.key} rows={3} defaultValue={scalar} />
      ) : (
        <input
          className={styles.input}
          name={field.key}
          type={
            field.kind === 'email' ? 'email'
              : field.kind === 'url' ? 'url'
                : field.kind === 'phone' ? 'tel'
                  : field.kind === 'number' ? 'number' : 'text'
          }
          defaultValue={scalar}
        />
      )}
    </label>
  );
}
