'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { searchStations, type FoundStation } from '@/lib/search-actions';
import styles from './Finder.module.css';

/**
 * Find an institution by typing.
 *
 * Every screen that needed one of the twenty-one thousand institutions used to
 * be handed a list — the first thousand names in alphabetical order — and
 * asked to scroll. Past about "K" that list did not contain the answer at all,
 * so the screen was not slow, it was wrong.
 *
 * This is the replacement, and it is deliberately one component rather than
 * one per screen: the list, a visit, an event and a report filter are all the
 * same question. It has two modes because there are two answers — go there
 * (`href`), or put it in this form (`name`).
 *
 * It is a combobox in the ARIA sense, so it works from the keyboard: type to
 * filter, arrows to move, Enter to take, Escape to close. That is not
 * decoration — a branch officer filing thirty institutions is not reaching for
 * a mouse thirty times.
 */
export function Finder({
  name,
  href,
  label = 'Find an institution',
  placeholder = 'Type a name, district or region',
  categoryId,
  branchId,
  initial,
  autoFocus,
  textName,
  onPick,
}: {
  /** Field mode: the hidden input's name, carrying the chosen id. */
  name?: string;
  /** Navigate mode: where a result goes. */
  href?: (station: FoundStation) => string;
  label?: string;
  placeholder?: string;
  categoryId?: string | null;
  branchId?: string | null;
  /** What the field already holds, when editing something. */
  initial?: { id: string; name: string } | null;
  autoFocus?: boolean;
  /**
   * Field mode, second half: the name of a hidden input carrying the *text*.
   *
   * Some things being searched for are not on the register — a branch can
   * call on a school nobody has added yet — so the typed words are submitted
   * alongside the id, and the id is simply empty when there was nothing to
   * match. That is what lets one control serve both cases without asking the
   * person which one they are in.
   */
  textName?: string;
  /** Told what was picked, so a form can fill in what the register knows. */
  onPick?: (station: FoundStation | null) => void;
}) {
  const router = useRouter();
  const listId = useId();
  const [term, setTerm] = useState(initial?.name ?? '');
  const [results, setResults] = useState<FoundStation[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(initial ?? null);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  // Which request this is. A slow answer for "mwa" must not overwrite a fast
  // one for "mwanza" — without this the field flickers back to stale results.
  const seq = useRef(0);

  useEffect(() => {
    if (chosen && term === chosen.name) return;
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }

    const mine = ++seq.current;
    // 160ms: long enough that a typist does not fire a query per letter,
    // short enough that the list feels like it is keeping up.
    const timer = setTimeout(() => {
      startTransition(async () => {
        const found = await searchStations(term, { categoryId, branchId, limit: 20 });
        if (seq.current !== mine) return;
        setResults(found);
        setOpen(true);
        setCursor(-1);
      });
    }, 160);

    return () => clearTimeout(timer);
  }, [term, categoryId, branchId, chosen]);

  // Clicking anywhere else closes the list, the way every other menu behaves.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const take = (station: FoundStation) => {
    if (href) {
      router.push(href(station));
      return;
    }
    setChosen({ id: station.id, name: station.name });
    setTerm(station.name);
    setOpen(false);
    onPick?.(station);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open && results.length) setOpen(true);
      setCursor((c) => {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const next = c + step;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === 'Enter' && open && cursor >= 0 && results[cursor]) {
      event.preventDefault();
      take(results[cursor]);
      return;
    }
    if (event.key === 'Escape') setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={box}>
      <label className={styles.label} htmlFor={`${listId}-input`}>{label}</label>

      <div className={styles.field}>
        <SearchIcon />
        <input
          id={`${listId}-input`}
          type="search"
          className={styles.input}
          value={term}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={cursor >= 0 && results[cursor] ? `${listId}-${cursor}` : undefined}
          onChange={(e) => {
            setTerm(e.target.value);
            if (chosen) {
              setChosen(null);
              onPick?.(null);
            }
          }}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        {pending ? <span className={styles.working} aria-hidden="true" /> : null}
      </div>

      {name ? <input type="hidden" name={name} value={chosen?.id ?? ''} /> : null}
      {textName ? <input type="hidden" name={textName} value={chosen?.name ?? term} /> : null}

      {open ? (
        <ul className={styles.list} id={listId} role="listbox" aria-label={label}>
          {results.length === 0 ? (
            <li className={styles.none}>Nothing matches “{term.trim()}”.</li>
          ) : (
            results.map((station, i) => (
              <li key={station.id} id={`${listId}-${i}`} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  className={`${styles.hit} ${i === cursor ? styles.hitOn : ''}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => take(station)}
                >
                  <span className={styles.hitName}>{station.name}</span>
                  <span className={styles.hitWhere}>
                    {[station.district_name, station.region_name].filter(Boolean).join(', ')}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {/* Two characters, said once, rather than an empty list that looks
          broken while somebody is still typing the first word. */}
      {!open && term.trim().length === 1 ? (
        <p className={styles.hint}>Keep typing — two letters is enough.</p>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"
      className={styles.icon} stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round">
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.6 10.6L14 14" />
    </svg>
  );
}
