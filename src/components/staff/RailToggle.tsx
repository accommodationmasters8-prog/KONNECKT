'use client';

import { useEffect, useState } from 'react';
import styles from './StaffShell.module.css';

/** Where the choice is kept. Per browser, per person — not an account setting. */
const KEY = 'konekt.rail';

/**
 * Collapse the rail to its icons.
 *
 * A branch officer comparing two columns of figures wants the width; somebody
 * moving between sections wants the labels. Rather than choosing for them, the
 * rail does both and remembers which.
 *
 * The state lives on `document.documentElement` rather than in React, so the
 * inline script in the shell can set it before first paint. Holding it in
 * component state would mean the rail renders wide, then jumps narrow once
 * hydration catches up — on every navigation.
 */
export function RailToggle() {
  const [collapsed, setCollapsed] = useState(false);

  // Read what the pre-paint script already applied, so the button starts out
  // agreeing with what is on screen.
  useEffect(() => {
    setCollapsed(document.documentElement.dataset.rail === 'collapsed');
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.dataset.rail = next ? 'collapsed' : 'open';
    try {
      localStorage.setItem(KEY, next ? 'collapsed' : 'open');
    } catch {
      // A browser with site data blocked still gets the toggle; it just does
      // not survive the next page load. Losing the preference is not a reason
      // to lose the control.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={styles.railToggle}
      aria-pressed={collapsed}
      title={collapsed ? 'Expand the menu' : 'Collapse the menu'}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
        <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={styles.railToggleLabel}>Collapse</span>
    </button>
  );
}

/**
 * Applies the saved state before the page paints.
 *
 * Inline and synchronous on purpose: anything deferred runs after the first
 * frame, which is exactly the flash this exists to prevent.
 */
export function RailStateScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{document.documentElement.dataset.rail=localStorage.getItem('${KEY}')==='collapsed'?'collapsed':'open'}catch(e){}`,
      }}
    />
  );
}
