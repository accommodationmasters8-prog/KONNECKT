import { KonektMark } from '../KonektMark';
import styles from './EmptyState.module.css';
import type { ReactNode } from 'react';

/**
 * The honest empty state.
 *
 * Used wherever there is genuinely nothing yet. It says so plainly rather than
 * showing skeleton rows that imply content is loading, or filler that implies
 * content exists. Nothing on this platform publishes unverified, so pages will
 * be empty before they are full, and that has to look deliberate.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.mark} aria-hidden="true">
        <KonektMark />
      </div>
      <h2 className={`t-h3 ${styles.title}`}>{title}</h2>
      <p className={`t-caption ${styles.body}`}>{body}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
