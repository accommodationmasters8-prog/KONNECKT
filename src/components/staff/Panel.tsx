import type { ReactNode } from 'react';
import styles from './Panel.module.css';

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div>
          <h2 className={`t-h3 ${styles.title}`}>{title}</h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A panel that starts shut.
 *
 * For the detail somebody occasionally wants and mostly scrolls past. A screen
 * where everything is expanded is a screen where nothing is emphasised — the
 * figures at the top stop being the answer and become the first of nine things.
 *
 * A native <details>: the control is one people know, it needs no JavaScript,
 * it takes a keyboard for free, and it opens on print.
 */
export function FoldPanel({
  title,
  note,
  count,
  children,
  open = false,
}: {
  title: string;
  /** A word on what is inside, so the bar says whether opening it is worth it. */
  note?: string;
  /** How many rows are in there, shown on the bar. */
  count?: number;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className={styles.fold} open={open}>
      <summary className={styles.foldHead}>
        <span className={styles.foldTitle}>{title}</span>
        {count !== undefined ? <span className={styles.foldCount}>{count}</span> : null}
        {note ? <span className={styles.foldNote}>{note}</span> : null}
        <span className={styles.foldChevron} aria-hidden="true">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className={styles.foldBody}>{children}</div>
    </details>
  );
}

/** A queue or report with nothing in it yet — said plainly, never faked. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
