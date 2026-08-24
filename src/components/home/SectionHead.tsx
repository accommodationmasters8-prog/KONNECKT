import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './SectionHead.module.css';

/**
 * Section header used on every page and every landing block, so the whole
 * application shares one heading rhythm instead of each page inventing its own.
 */
export function SectionHead({
  eyebrow,
  accent = 'teal',
  title,
  lead,
  action,
  id,
  marker,
}: {
  eyebrow: string;
  accent?: 'teal' | 'green' | 'yellow' | 'pink';
  title: string;
  lead?: string;
  action?: { href: string; label: string };
  id?: string;
  marker?: ReactNode;
}) {
  return (
    <div className={`reveal-head ${styles.head}`}>
      <div className={styles.top}>
        <p className={`t-eyebrow ${styles.eyebrow} ${styles[accent]}`}>
          {marker}
          {eyebrow}
        </p>
        {action ? (
          <Link href={action.href} prefetch={false} className={styles.action}>
            {action.label}
            <span className={styles.actionChevron} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <h2 id={id} className={`t-h2 ${styles.title}`}>{title}</h2>
      {lead ? <p className={`t-lead ${styles.lead}`}>{lead}</p> : null}
    </div>
  );
}
