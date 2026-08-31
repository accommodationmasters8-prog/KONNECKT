/**
 * CSV, parsed properly.
 *
 * Splitting on commas is what everyone writes first and it is wrong for the
 * first branch called "Kariakoo, Narung'ombe". This handles what RFC 4180
 * actually says: quoted fields, commas and newlines inside them, doubled
 * quotes as an escape, and the byte-order mark Excel puts at the front of
 * every file it saves.
 *
 * Semicolons are accepted as a separator too. A machine set to a European
 * locale saves "CSV" with semicolons and no warning, and the person who
 * exported it has no idea that happened.
 */

export type CsvRow = Record<string, string>;

/** Split one CSV document into rows of raw cells. */
export function parseCsv(input: string): string[][] {
  // The BOM is invisible and would otherwise become part of the first header,
  // so `name` arrives as `﻿name` and matches nothing.
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  // Whichever separator appears more outside quotes wins. Counting on the
  // header line alone is enough and cannot be thrown by a comma inside a
  // quoted address further down.
  const header = text.split('\n', 1)[0] ?? '';
  const sep = (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        // A doubled quote is a literal quote; a lone one closes the field.
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = false;
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') { quoted = true; continue; }
    if (c === sep) { row.push(cell); cell = ''; continue; }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }

  // Whatever is left when the text runs out is the last cell of the last row,
  // unless the file ended with a newline and both are empty.
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }

  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/**
 * Rows keyed by header name.
 *
 * Headers are matched loosely — case, spaces, underscores and dashes all
 * collapse — because the file is exported from someone's own spreadsheet and
 * "Branch Name", "branch_name" and "branch name" are the same column to a
 * person and three different ones to a computer.
 */
export function parseCsvRows(input: string): { headers: string[]; rows: CsvRow[] } {
  const raw = parseCsv(input);
  if (raw.length === 0) return { headers: [], rows: [] };

  const headers = raw[0].map((h) => h.trim());
  const keys = headers.map(normaliseHeader);

  const rows = raw.slice(1).map((cells) => {
    const row: CsvRow = {};
    keys.forEach((key, i) => {
      if (key) row[key] = (cells[i] ?? '').trim();
    });
    return row;
  });

  return { headers, rows };
}

export function normaliseHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * The first value present under any of these column names.
 *
 * Every export names things differently — `name`, `branch`, `branch_name`,
 * `station_name` — and rejecting a file over a header nobody chose on purpose
 * is how a bulk import becomes six emails.
 */
export function pick(row: CsvRow, ...names: string[]): string {
  for (const name of names) {
    const value = row[normaliseHeader(name)];
    if (value !== undefined && value !== '') return value;
  }
  return '';
}

/** A whole number, or null when the cell is blank or not one. */
export function num(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[\s,]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}
