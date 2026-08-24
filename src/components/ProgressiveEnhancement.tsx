'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@/i18n';
import styles from './ProgressiveEnhancement.module.css';

/**
 * The only client-side JavaScript on this page.
 *
 * Two jobs, both deferred until after the page has painted:
 *   1. Register the service worker. This phase it caches static assets only.
 *   2. Hold on to the install prompt until there is a reason to show it.
 *
 * Standing rule: never prompt for PWA install on first page load. The prompt
 * appears only once the visitor has read past the map — by then they have seen
 * the point of the thing, and a home-screen icon means something. A dismissal
 * is remembered so it is never asked twice.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'konekt.install.dismissed';

export function ProgressiveEnhancement({ t }: { t: Dictionary }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [earned, setEarned] = useState(false);

  // --- Service worker ---------------------------------------------------
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A failed registration must never break the page. Static content
        // is already served and readable without it.
      });
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  // --- Capture the install prompt, do not fire it -----------------------
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      try {
        if (localStorage.getItem(DISMISSED_KEY) === '1') return;
      } catch {
        // Private mode or blocked storage: treat as not dismissed.
      }
      setDeferred(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // --- The value moment -------------------------------------------------
  useEffect(() => {
    const target = document.getElementById('membership');
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setEarned(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Nothing to do — the prompt simply may reappear next visit.
    }
    setDeferred(null);
  };

  const accept = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (!deferred || !earned) return null;

  return (
    <div className={styles.sheet} role="dialog" aria-label={t.install.prompt}>
      <div className={styles.body}>
        <p className={styles.title}>{t.install.prompt}</p>
        <p className={styles.text}>{t.install.body}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className="btn btn--primary" onClick={accept}>
          {t.install.accept}
        </button>
        <button type="button" className={styles.dismiss} onClick={dismiss}>
          {t.install.dismiss}
        </button>
      </div>
    </div>
  );
}
