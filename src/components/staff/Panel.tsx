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

/** A queue or report with nothing in it yet — said plainly, never faked. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
