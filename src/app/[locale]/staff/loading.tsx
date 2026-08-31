import styles from './loading.module.css';

/**
 * What the console shows while the next screen is being built.
 *
 * Every page in here renders on the server, so a click used to leave the old
 * screen sitting there — nothing moved, and the second before the new page
 * arrived read as a click that had not registered. This makes that second
 * visible: the rail and the header stay put, and only the body is replaced,
 * which is also the truth about what is changing.
 *
 * Shapes, not a spinner. A spinner says "wait"; a block where the metrics go
 * says what is coming, and the eye has already found the right place by the
 * time the real figures land.
 */
export default function StaffLoading() {
  return (
    <div className={styles.wrap} role="status" aria-label="Loading">
      <div className={styles.metrics}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.card}>
            <span className={`${styles.line} ${styles.short}`} />
            <span className={`${styles.line} ${styles.big}`} />
            <span className={`${styles.line} ${styles.medium}`} />
          </div>
        ))}
      </div>

      <div className={styles.panel}>
        <span className={`${styles.line} ${styles.title}`} />
        <span className={`${styles.line} ${styles.medium}`} />
        <div className={styles.rows}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={styles.row} />
          ))}
        </div>
      </div>
    </div>
  );
}
