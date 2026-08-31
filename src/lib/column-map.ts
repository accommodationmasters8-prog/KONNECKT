import { normaliseHeader, type CsvRow } from '@/lib/csv';

/**
 * Work out which column is which.
 *
 * Real files are not written for this importer. The TCU register calls the
 * name `NAME OF UNIVERSITY`, calls the branch `NEAR BRANCH`, and has a column
 * literally headed `CATEGORY` that holds PUBLIC or PRIVATE — nothing to do
 * with the categories in this system. An importer that matches on exact
 * headers finds none of those, and one that trusts a header called `category`
 * files every row under a category that does not exist.
 *
 * So each field scores every column and takes the best. Scoring rather than a
 * list of aliases because the aliases are endless and the shapes are not: a
 * header containing "name" is probably the name, a header that is exactly
 * "name" almost certainly is, and a header containing "branch" is the branch
 * whatever else it contains.
 */

export type Field =
  | 'name' | 'branch' | 'category' | 'region' | 'district'
  | 'address' | 'contact' | 'phone' | 'portfolio' | 'year' | 'zone' | 'notes';

interface Rule {
  /** Header is exactly this, after normalising. Strongest signal there is. */
  exact?: string[];
  /** Header contains this word. */
  has?: string[];
  /** Header contains this and is therefore definitely NOT this field. */
  not?: string[];
}

const RULES: Record<Field, Rule> = {
  name: {
    exact: ['name', 'station', 'institution', 'title'],
    has: ['name', 'institution', 'university', 'college', 'school', 'hospital',
          'station', 'barrack', 'camp', 'stand', 'saloon', 'salon'],
    // "branch name" and "ward name" are not the station's name.
    not: ['branch', 'ward', 'district', 'region', 'zone', 'contact', 'street', 'file'],
  },
  branch: {
    exact: ['branch', 'crdb_branch'],
    has: ['branch'],
    not: [],
  },
  category: {
    exact: ['category', 'type', 'station_type', 'category_name'],
    has: ['category', 'segment'],
    not: [],
  },
  region: { exact: ['region', 'region_name'], has: ['region'], not: [] },
  district: { exact: ['district', 'district_name', 'council'], has: ['district'], not: [] },
  address: {
    exact: ['address', 'location', 'street', 'physical_address'],
    has: ['address', 'street', 'location', 'ward'],
    not: [],
  },
  contact: {
    exact: ['contact', 'contact_name', 'contact_person', 'focal_person'],
    has: ['contact', 'person', 'focal'],
    not: ['phone', 'number', 'email'],
  },
  phone: {
    exact: ['phone', 'mobile', 'telephone', 'contact_phone', 'msisdn'],
    has: ['phone', 'mobile', 'tel', 'msisdn'],
    not: [],
  },
  portfolio: {
    exact: ['portfolio', 'students', 'population', 'headcount', 'youth', 'members'],
    has: ['portfolio', 'student', 'population', 'headcount', 'enrol', 'youth',
          'recruit', 'rider', 'staff', 'member'],
    not: [],
  },
  year: {
    exact: ['year', 'yoe', 'year_established', 'established', 'year_of_establishment'],
    has: ['year', 'yoe', 'establish', 'founded'],
    not: [],
  },
  zone: { exact: ['zone', 'zone_code'], has: ['zone'], not: [] },
  notes: { exact: ['notes', 'note', 'remarks', 'comment'], has: ['remark', 'comment'], not: [] },
};

export type ColumnMap = Partial<Record<Field, string>>;

function score(header: string, rule: Rule): number {
  const h = normaliseHeader(header);
  if (!h) return 0;
  if (rule.not?.some((word) => h.includes(word))) return 0;
  if (rule.exact?.includes(h)) return 100;
  // A header that starts with the word beats one that merely contains it:
  // "branch_name" is the branch; "coordinating_branch_officer" is not.
  const hit = rule.has?.find((word) => h.includes(word));
  if (!hit) return 0;
  return h.startsWith(hit) ? 60 : 40;
}

/**
 * The best column for each field, and nothing for the fields with no match.
 *
 * A column is claimed once. Without that, `name_of_university` and
 * `university_category` can both win "name" and the second silently overwrites
 * the first — worse than no match, because it looks like it worked.
 */
export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const taken = new Set<string>();

  // Strongest field first: whatever the name column is, nothing else should
  // get to claim it.
  const order: Field[] = [
    'name', 'branch', 'zone', 'region', 'district', 'phone', 'contact',
    'portfolio', 'year', 'category', 'address', 'notes',
  ];

  for (const field of order) {
    let best = '';
    let bestScore = 0;

    for (const header of headers) {
      const key = normaliseHeader(header);
      if (!key || taken.has(key)) continue;
      const s = score(header, RULES[field]);
      if (s > bestScore) { bestScore = s; best = key; }
    }

    if (bestScore > 0) { map[field] = best; taken.add(best); }
  }

  return map;
}

/** The value for a field in one row, using a detected map. */
export function valueOf(row: CsvRow, map: ColumnMap, field: Field): string {
  const column = map[field];
  if (!column) return '';
  return (row[column] ?? '').trim();
}

/** How the mapping reads to a person, for the preview. */
export const FIELD_WORDING: Record<Field, string> = {
  name: 'Name',
  branch: 'Branch',
  category: 'Category',
  region: 'Region',
  district: 'District',
  address: 'Address',
  contact: 'Contact',
  phone: 'Phone',
  portfolio: 'People',
  year: 'Year',
  zone: 'Zone',
  notes: 'Notes',
};
