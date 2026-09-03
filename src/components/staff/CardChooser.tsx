'use client';

import { useEffect, useState } from 'react';
import styles from './CardChooser.module.css';

export interface CardOption {
  key: string;
  label: string;
}

const STORE = 'konekt.cards';

/** The id of the stylesheet the pre-paint script writes, so the component can
    take it back down once it owns the state. */
const BOOT = 'konekt-card-boot';

/**
 * Which of the headline figures this person wants to see.
 *
 * Nine cards is the full set the bank tracks, and nine is more than most
 * people want to look at every morning: a branch officer working a deposit
 * target does not need the dormant column on screen to do their job. The
 * choice is per browser, not per account — it is a view preference, not
 * a permission, and nothing here changes what the figures are.
 *
 * The cards themselves are rendered by the server; this only hides them, so
 * the page still works with JavaScript off (everything shows).
 */
export function CardChooser({ options }: { options: CardOption[] }) {
  const [chosen, setChosen] = useState<string[] | null>(null);

  useEffect(() => {
    let next: string[] = options.map((o) => o.key);
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          // Keep only keys that still exist, so a renamed card cannot strand
          // somebody with a blank row of figures.
          const valid = parsed.filter((k): k is string =>
            typeof k === 'string' && options.some((o) => o.key === k));
          if (valid.length) next = valid;
        }
      }
    } catch { /* private browsing, or storage disabled — show everything */ }
    setChosen(next);

    // The pre-paint stylesheet has done its job. Leaving it up would mean a
    // card the person switches back on stays hidden by a rule React cannot
    // reach.
    document.getElementById(BOOT)?.remove();
  }, [options]);

  useEffect(() => {
    if (!chosen) return;
    for (const option of options) {
      const el = document.querySelector<HTMLElement>(`[data-card="${option.key}"]`);
      if (el) el.hidden = !chosen.includes(option.key);
    }
    try {
      window.localStorage.setItem(STORE, JSON.stringify(chosen));
    } catch { /* nothing to do; the choice just will not survive the tab */ }
  }, [chosen, options]);

  if (!chosen) return null;

  const toggle = (key: string) =>
    setChosen((prev) => {
      const list = prev ?? [];
      // Never let the last one go: an empty row of figures is not a view
      // anybody chose on purpose.
      if (list.includes(key)) {
        return list.length === 1 ? list : list.filter((k) => k !== key);
      }
      return [...list, key];
    });

  return (
    <details className={styles.wrap}>
      <summary className={styles.summary}>
        <span>Cards</span>
        <span className={styles.count}>{chosen.length}/{options.length}</span>
      </summary>
      <div className={styles.menu}>
        {options.map((option) => (
          <label key={option.key} className={styles.row}>
            <input
              type="checkbox"
              checked={chosen.includes(option.key)}
              onChange={() => toggle(option.key)}
            />
            <span>{option.label}</span>
          </label>
        ))}
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.reset}
            onClick={() => setChosen(options.map((o) => o.key))}
          >
            Show all
          </button>
        </div>
      </div>
    </details>
  );
}

/**
 * Hides the cards this browser switched off, before the page paints.
 *
 * Without this the server sends all nine, they paint, and then the effect
 * above hides six of them — a full row of figures appearing and vanishing on
 * every navigation. The rail and the theme both solve this the same way, and
 * the reasoning is the same: the first frame is the flash.
 *
 * It writes a `:not()` rule rather than hiding each card, because the stored
 * value is the list to keep and the script has no way to know the full set.
 */
export function CardStateScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html:
          `try{var k=JSON.parse(localStorage.getItem('${STORE}')||'[]');` +
          `if(Array.isArray(k)&&k.length){` +
          `var s=document.createElement('style');s.id='${BOOT}';` +
          `s.textContent='[data-card]:not('+k.map(function(x){` +
          `return '[data-card=\"'+String(x).replace(/[^a-zA-Z0-9_-]/g,'')+'\"]'` +
          `}).join(',')+'){display:none!important}';` +
          `document.head.appendChild(s)}}catch(e){}`,
      }}
    />
  );
}
