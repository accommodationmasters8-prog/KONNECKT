import styles from './PageHeader.module.css';
import type { ReactNode } from 'react';

/**
 * The header block every full page opens with. One rhythm across the whole
 * application, so moving between routes feels like moving inside one product.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  accent = 'teal',
  marker,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  accent?: 'teal' | 'green' | 'yellow' | 'pink';
  marker?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`on-ink ${styles.header}`}>
      <div className="shell">
        <div className="page-head">
          <p className={`t-eyebrow ${styles[accent]}`}>
            {marker}
            {eyebrow}
          </p>
          <h1 className={`t-h1 ${styles.title}`}>{title}</h1>
          {lead ? <p className={`t-lead ${styles.lead}`}>{lead}</p> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
