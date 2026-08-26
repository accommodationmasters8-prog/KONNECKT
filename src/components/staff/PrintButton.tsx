'use client';

/**
 * Opens the browser's print dialogue.
 *
 * A button rather than an instruction to press Ctrl+P: the people using this
 * are on a branch desktop and a phone, and one of those has no Ctrl key.
 * Hidden when printing, so it never appears on the paper.
 */
export function PrintButton() {
  return (
    <button type="button" className="btn btn--primary btn--sm" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
