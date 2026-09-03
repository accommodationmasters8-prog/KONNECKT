'use client';

import { useEffect, useState } from 'react';
import styles from './StaffShell.module.css';

/** Per browser, per person. Not an account setting — the same officer on a
    phone at a venue and a desktop at the branch wants different answers. */
const KEY = 'konekt.theme';

type Choice = 'system' | 'light' | 'dark';

const ORDER: Choice[] = ['system', 'light', 'dark'];

const LABEL: Record<Choice, string> = {
  system: 'Match the system',
  light: 'Light',
  dark: 'Dark',
};

/**
 * Light, dark, or whatever the machine says.
 *
 * Three states rather than two. A two-state toggle has to pick a starting
 * side, and whichever it picks is wrong for half the people opening the
 * console at seven in the morning — following the operating system is the
 * only default that is right for everybody, so it stays reachable rather
 * than being a thing you fall out of the first time you touch the control.
 *
 * Like the rail, the state lives on `document.documentElement` so the inline
 * script below can apply it before the first frame. Anything held in React
 * state paints light first and corrects itself after hydration, which is a
 * white flash on every single navigation for the people who chose dark.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>('system');

  useEffect(() => {
    const stamped = document.documentElement.dataset.theme;
    setChoice(stamped === 'dark' || stamped === 'light' ? stamped : 'system');
  }, []);

  const advance = () => {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    setChoice(next);

    if (next === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;

    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Site data blocked. The toggle still works for this page; it just
      // does not survive a reload.
    }
  };

  return (
    <button
      type="button"
      onClick={advance}
      className={styles.themeToggle}
      title={`Appearance: ${LABEL[choice]}`}
    >
      <ThemeIcon choice={choice} />
      <span className={styles.railToggleLabel}>{LABEL[choice]}</span>
    </button>
  );
}

function ThemeIcon({ choice }: { choice: Choice }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round">
      {choice === 'dark' ? (
        <path d="M13.2 9.6A5.6 5.6 0 016.4 2.8a5.6 5.6 0 106.8 6.8z" />
      ) : (
        <>
          <circle cx="8" cy="8" r="3.1" />
          {choice === 'light' ? (
            <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1" />
          ) : (
            /* System: a sun with the dark half filled in — the control says
               "whatever the machine says" rather than naming a side. */
            <path d="M8 4.9v6.2a3.1 3.1 0 000-6.2z" fill="currentColor" stroke="none" />
          )}
        </>
      )}
    </svg>
  );
}

/**
 * Applies the saved choice before the page paints.
 *
 * Inline and synchronous for the same reason the rail's is: anything deferred
 * runs after the first frame, and the first frame is the flash.
 */
export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{var t=localStorage.getItem('${KEY}');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`,
      }}
    />
  );
}
