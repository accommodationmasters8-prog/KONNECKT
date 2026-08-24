import type { MembershipTier } from '@/lib/supabase/types';
import styles from './TierBadge.module.css';

/**
 * Tier standing.
 *
 * Displays a value; never computes one. Tier is calculated in CRDB's core
 * banking systems from transaction counts, balances and credit standing, and
 * reaches Konekt over the reconciliation feed. Nothing in this component, or
 * anywhere in this codebase, derives a tier from banking data — Konekt must
 * not hold that data in the first place.
 */
export function TierBadge({
  tier,
  label,
  inGrace,
  graceLabel,
  size = 'md',
}: {
  tier: MembershipTier | null;
  label: string;
  inGrace?: boolean;
  graceLabel?: string;
  size?: 'sm' | 'md';
}) {
  if (!tier) {
    return <span className={`${styles.badge} ${styles.none} ${styles[size]}`}>{label}</span>;
  }

  return (
    <span className={`${styles.badge} ${styles[tier]} ${styles[size]}`}>
      <span className={styles.rungs} aria-hidden="true">
        <i /><i /><i />
      </span>
      {label}
      {inGrace && graceLabel ? (
        <span className={styles.grace}>{graceLabel}</span>
      ) : null}
    </span>
  );
}
