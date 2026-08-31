'use client';

import { useState } from 'react';
import { ago, type ActivityItem } from '@/lib/activity-format';
import styles from './ActivityList.module.css';

/**
 * What has happened, five at a time.
 *
 * The whole list used to arrive at once — a hundred rows of it — which is not
 * something anybody reads, only something they scroll past. Five is what fits
 * in the glance this screen is opened for; the rest is one click away and
 * stays open once it is.
 */
export function ActivityList({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, 5);
  const hidden = items.length - shown.length;

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {shown.map((item) => (
          <li key={item.id} className={styles.item}>
            <span className={`${styles.dot} ${styles[item.kind]}`} aria-hidden="true" />
            <span className={styles.body}>
              <span className={styles.who}>{item.who}</span>
              {' '}
              <span className={styles.what}>{item.what}</span>
            </span>
            <time className={styles.when} dateTime={item.at}>{ago(item.at)}</time>
          </li>
        ))}
      </ul>

      {hidden > 0 || open ? (
        <button
          type="button"
          className={styles.more}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Show less' : `Show ${hidden} more`}
        </button>
      ) : null}
    </div>
  );
}
