import type { StaffRole } from '@/lib/supabase/types';

/**
 * The operating manual, as data.
 *
 * One source, three readings. HQ gets every chapter; a zone manager gets the
 * chapters that describe what a zone manager can actually do; a branch officer
 * gets theirs. Writing three documents would have guaranteed that two of them
 * eventually described a system that no longer exists — so the audience lives
 * on each block instead, and the page filters.
 *
 * `roles` is about *relevance*, not secrecy. Nothing here is a credential and
 * nothing here is enforcement: row level security decides what anybody can
 * touch, and a zone manager reading HQ's chapter would gain nothing. Hiding it
 * only spares them a page about buttons they do not have.
 */
export type ManualRole = Extract<StaffRole, 'hq' | 'zone' | 'branch'>;

const ALL: ManualRole[] = ['hq', 'zone', 'branch'];

export interface ManualBlock {
  kind: 'p' | 'steps' | 'table' | 'note' | 'warn' | 'list' | 'tree';
  /** Paragraph or note text; the note's first line is its heading. */
  text?: string;
  heading?: string;
  items?: string[];
  steps?: { what: string; how: string }[];
  table?: { head: string[]; rows: string[][] };
}

export interface ManualSection {
  id: string;
  title: string;
  /** Who this chapter is written for. */
  roles: ManualRole[];
  lead?: string;
  blocks: ManualBlock[];
}

export const MANUAL: ManualSection[] = [
  {
    id: 'structure',
    title: 'The structure everything hangs on',
    roles: ALL,
    lead: 'Konekt has exactly one hierarchy, and every figure in the system rolls up through it.',
    blocks: [
      {
        kind: 'tree',
        items: [
          'ZONE — e.g. Lake, Northern, Dar es Salaam',
          'BRANCH — belongs to one zone',
          'STATION — the place itself; belongs to one branch',
          'REPORT — one period of figures for that station',
        ],
      },
      {
        kind: 'p',
        text: 'Stations are also sorted into categories — the kind of place each one is. Categories cut across the tree: a category can have stations in every zone, which is how the whole country is compared one kind of place at a time.',
      },
      {
        kind: 'note',
        heading: 'Why this matters',
        text: 'A branch that has not been put in a zone is invisible to that zone’s manager — and so is every station reporting through it. Assigning zones to branches is not tidying up; it is what makes the middle level work at all.',
      },
    ],
  },

  {
    id: 'levels',
    title: 'The three levels',
    roles: ALL,
    lead: 'Everyone signs into the same system and sees the same screens. What differs is how much of the country those screens are filled with — decided once, by the account, not by anything the user picks.',
    blocks: [
      {
        kind: 'table',
        table: {
          head: ['Level', 'Sees', 'Beyond filing, can also'],
          rows: [
            ['HQ', 'The whole country', 'Create zones, categories, product types and access codes'],
            ['Zone manager', 'Their own zone, and nothing outside it', 'Open and edit branches inside that zone'],
            ['Branch manager', 'Their own branch and its stations', 'Add and edit their own stations'],
            ['Field agent', 'One branch', 'The same rights as that branch’s manager'],
          ],
        },
      },
      {
        kind: 'note',
        heading: 'Reporting is not restricted to one level',
        text: 'HQ, a zone manager and a branch manager can all file, correct and delete figures. If a branch is offline its zone can file on its behalf; if a zone is stuck, HQ can. Nobody is ever blocked from recording something they can already see.',
      },
    ],
  },

  {
    id: 'day-one',
    title: 'Your first ten minutes',
    roles: ['branch'],
    lead: 'You run one branch. Everything you need is two clicks from the screen you land on.',
    blocks: [
      {
        kind: 'steps',
        steps: [
          { what: 'Open Konekt', how: 'The first thing on the page is which of your stations still owe figures this period — named, and each one a link straight to its form. Not a count: the names.' },
          { what: 'Click a station and file it', how: 'Enter the period’s numbers, and break them down by account type and loan type if you have that detail.' },
          { what: 'Add anything new', how: 'A new stand, a new SACCOS, a new campus — add it from your branch page and it belongs to your branch from that moment.' },
          { what: 'Record what you ran', how: 'Any activation drive or market day goes on the Events screen, with up to ten pictures attached.' },
        ],
      },
    ],
  },

  {
    id: 'zone-week',
    title: 'Running your zone',
    roles: ['zone'],
    lead: 'You see every branch in your zone and nothing outside it. Your job in the system is to see the gaps and close them without going through Dar.',
    blocks: [
      {
        kind: 'steps',
        steps: [
          { what: 'See which branches are behind', how: 'The Branches screen lists every branch in your zone with how many of its stations have filed. The gaps are visible without opening anything.' },
          { what: 'Compare them', how: 'Performance ranks your branches on deposits, accounts, coverage and month-on-month movement. Coverage is the column that matters: accounts opened against the people actually there.' },
          { what: 'Fill a gap yourself', how: 'If a branch cannot file, you can file for it. Open the branch, open the station, enter the period.' },
          { what: 'Open a new branch when one opens', how: 'Add it in your own zone panel. You cannot put it in another zone, and you do not need HQ to do it.' },
        ],
      },
    ],
  },

  {
    id: 'hq-month',
    title: 'Reading the country',
    roles: ['hq'],
    lead: 'You are the only level that sees everything, and the only one that can change the shape of the system.',
    blocks: [
      {
        kind: 'steps',
        steps: [
          { what: 'Read the country', how: 'The overview totals every category, station, branch and zone, with the three channels — SimBanking activated, cards issued, Lipa Hapa registered — beside the accounts they came from.' },
          { what: 'Find the gap', how: 'Categories side by side. A category with 40,000 accounts and 2% coverage is a bigger opportunity than one with 8,000 and 60% — that comparison is the point of the screen.' },
          { what: 'Drill until it is a place', how: 'Country → zone → branch → station. Every level opens, and every level can be acted on from where you are standing.' },
          { what: 'Take it out of the system', how: 'Build the report you need — any subject, any date range — and take away a clean PDF and a CSV from the same selection.' },
        ],
      },
    ],
  },

  {
    id: 'admin',
    title: 'What the administrator controls',
    roles: ['hq'],
    lead: 'The HQ account is the only one that can change the shape of the system — the zones, the branches, the categories, and the vocabulary everyone files against.',
    blocks: [
      {
        kind: 'table',
        table: {
          head: ['Area', 'Where', 'What you can do'],
          rows: [
            ['Zones', 'Branches', 'Add a zone; rename one without touching anything filed against it'],
            ['Branches', 'Branches', 'Add into any zone panel; edit name, zone, years, open/closed, notes; move between zones; assign zones in bulk from Settings'],
            ['Stations', 'Branch or category', 'Add to any branch; edit every field; set its reporting rhythm; delete it and its history'],
            ['Categories', 'Categories', 'Add; delete; add loan types that exist only inside one category'],
            ['Account & loan types', 'Settings', 'Add; scope to a category; retire; delete one added by mistake'],
            ['Figures', 'Any station', 'File, correct or delete any period, anywhere in the country'],
            ['Access', 'Access', 'Issue a code at any level with an expiry; revoke any code'],
            ['Housekeeping', 'Settings · Audit', 'Clear the sample data; read who changed what'],
          ],
        },
      },
    ],
  },

  {
    id: 'permissions',
    title: 'Who can do what',
    roles: ALL,
    lead: 'The whole permission model. It is enforced by the database itself, not by which buttons a screen happens to show — so it holds even if somebody bypasses the interface entirely.',
    blocks: [
      {
        kind: 'table',
        table: {
          head: ['Action', 'HQ', 'Zone', 'Branch'],
          rows: [
            ['File, correct or delete figures', 'Country', 'Own zone', 'Own branch'],
            ['Add or edit a station', 'Country', 'Own zone', 'Own branch'],
            ['Delete a station', 'Country', 'Own zone', 'Own branch'],
            ['Record an event, with pictures', 'Country', 'Own zone', 'Own branch'],
            ['Download reports and exports', 'Country', 'Own zone', 'Own branch'],
            ['Add a branch', 'Any zone', 'Own zone', '—'],
            ['Edit a branch', 'Any', 'Own zone', '—'],
            ['Move a branch to another zone', 'Yes', '—', '—'],
            ['Add or rename a zone', 'Yes', '—', '—'],
            ['Add or delete a category', 'Yes', '—', '—'],
            ['Maintain account and loan types', 'Yes', '—', '—'],
            ['Issue or revoke access codes', 'Yes', '—', '—'],
            ['See another zone’s figures', 'Yes', 'Never', 'Never'],
          ],
        },
      },
    ],
  },

  {
    id: 'access',
    title: 'Getting people in',
    roles: ['hq'],
    lead: 'Nobody signs up for Konekt. HQ issues a code, the holder redeems it once, and that redemption creates their account at exactly the level the code carried. There is no other way in.',
    blocks: [
      {
        kind: 'steps',
        steps: [
          { what: 'Issue the code', how: 'On the Access screen: the person’s name, the level, the zone or branch it applies to, and an expiry date. The system generates a code in the form KNK-XXXX-XXXX.' },
          { what: 'Pass it to the holder', how: 'By whatever channel HQ already trusts. The code is single-use, so a copy that leaks after redemption is worthless.' },
          { what: 'They redeem it', how: 'On the sign-in page: the code, their own name, and a passphrase of at least ten characters. The account is created at the level the code specified — they cannot choose their own scope.' },
          { what: 'From then on, the passphrase', how: 'The code is spent. It cannot be redeemed again, and the Access screen shows exactly when it was used and by whom.' },
        ],
      },
      {
        kind: 'warn',
        heading: 'If somebody leaves',
        text: 'Revoke their code on the Access screen. Codes are never deleted — the record of who was given what access has to survive, which is what an audit asks for first.',
      },
    ],
  },

  {
    id: 'report',
    title: 'What a report contains',
    roles: ALL,
    lead: 'One report is one period for one station. Each station reports on the rhythm that suits it — a campus during registration week has daily numbers, a SACCOS has monthly ones — and that is set per station, not imposed nationally.',
    blocks: [
      {
        kind: 'table',
        table: {
          head: ['Field', 'What it means'],
          rows: [
            ['People in the portfolio', 'How many are actually at that station. The denominator for coverage.'],
            ['Accounts opened', 'New accounts in the period.'],
            ['Active accounts', 'Of those opened, how many are being used.'],
            ['Dormant accounts', 'Opened and gone quiet. The number to attack.'],
            ['Deposits mobilised', 'Value deposited in the period, in TZS.'],
            ['Loans given / loan value', 'Count and value of loans in the period.'],
            ['SimBanking activated', 'How many of those accounts were switched on.'],
            ['Cards issued', 'Cards handed over in the period.'],
            ['Lipa Hapa registered', 'Merchants registered for Lipa Hapa.'],
            ['Account breakdown', 'The same accounts split by account type.'],
            ['Loan breakdown', 'The same loans split by loan type.'],
          ],
        },
      },
      {
        kind: 'note',
        heading: 'Why the three channels matter',
        text: 'An account opened and never activated is a number on a form, not a customer. Carrying SimBanking, cards and Lipa Hapa beside the accounts they came from is what answers the question worth asking: which kind of place actually converts.',
      },
    ],
  },

  {
    id: 'events',
    title: 'Events, with pictures',
    roles: ALL,
    lead: 'Activation drives, campus days and market visits are recorded as events.',
    blocks: [
      {
        kind: 'p',
        text: 'An event carries the station it was held at, the date, participants, accounts opened on the day, the three channels, budget, and up to ten pictures. Any level that can reach the place it happened can add or edit it, so a branch records its own and nobody has to transcribe anything.',
      },
      {
        kind: 'p',
        text: 'The events screen separates what is coming from what has already happened. A single event can be exported on its own — a full dossier with its pictures attached, ready to send.',
      },
    ],
  },

  {
    id: 'exports',
    title: 'Reports and exports',
    roles: ALL,
    lead: 'The report builder is a short wizard rather than a fixed list of reports. Choose the subject, choose the range, filter it, and take it away in two formats built from the same query — so the PDF and the spreadsheet can never disagree.',
    blocks: [
      {
        kind: 'table',
        table: {
          head: ['Choose', 'Options'],
          rows: [
            ['Subject', 'Filed figures · Stations · Events · Branches · A single event dossier'],
            ['Date range', 'Any start and any end. There is no cap and no fixed period list.'],
            ['Filters', 'Zone, branch, category, or one named event'],
            ['Format', 'A print-ready PDF, and a CSV, from the same selection'],
          ],
        },
      },
      {
        kind: 'p',
        text: 'Whatever the range, a report only ever contains what the person building it is allowed to see. A zone manager’s national-range export is still their zone.',
      },
    ],
  },

  {
    id: 'public',
    title: 'What the public can see',
    roles: ALL,
    lead: 'The coverage map is open — any CRDB staff member can pull it up on a phone with no password, and so can anyone else. The line drawn is between presence and performance.',
    blocks: [
      {
        kind: 'table',
        table: {
          head: ['Published, no sign-in', 'Held back'],
          rows: [
            ['Which regions and districts CRDB reaches', 'Station names and their categories'],
            ['How many stations per region and per zone', 'Deposits, accounts, coverage, loans'],
            ['How much of the country is covered', 'SimBanking, cards, Lipa Hapa'],
            ['—', 'Every contact name and phone number'],
          ],
        },
      },
      {
        kind: 'p',
        text: 'Signing in deepens the same page rather than opening a second one: the region you click then also shows what kind of places are there, what has been opened, and how many have filed.',
      },
    ],
  },

  {
    id: 'guardrails',
    title: 'The guardrails',
    roles: ALL,
    lead: 'A few rules are built into the system rather than left to procedure. They are worth knowing because they explain what Konekt will refuse to do.',
    blocks: [
      {
        kind: 'list',
        items: [
          'Scope is enforced by the database, not the screen. A zone manager cannot reach another zone’s figures by any route — not by a link, not by an export, not by editing a web address.',
          'A retired product type is not deleted. Months already filed reference it, and removing it would leave those figures labelled with nothing.',
          'Deleting is refused where it would destroy history. A loan type with figures against it cannot be deleted; the system says so and offers retirement instead.',
          'Access codes are revoked, never deleted. The record of who held what access survives.',
          'A code is single-use, and every failure to redeem gives the same message — so somebody guessing codes learns nothing from which guess got further.',
          'One period per station per rhythm. The same month cannot be filed twice; a correction edits the existing figure rather than adding a second one.',
        ],
      },
      {
        kind: 'note',
        heading: 'The one thing to get right first',
        text: 'Every branch must sit in a zone. A branch with no zone is invisible to its zone manager, and so is every station reporting through it — the figures are still recorded, but the middle of the organisation cannot see them.',
      },
    ],
  },
];

/** The chapters written for one level, in order. */
export function manualFor(role: string): ManualSection[] {
  const key = (['hq', 'zone', 'branch'] as const).find((r) => r === role) ?? 'branch';
  return MANUAL.filter((s) => s.roles.includes(key));
}

export const MANUAL_SUBTITLE: Record<ManualRole, string> = {
  hq: 'Every chapter, including the ones only HQ can act on.',
  zone: 'Written for a zone manager: your zone, your branches, and what you can change without going through HQ.',
  branch: 'Written for a branch: what to file, when, and how to add what you have just opened.',
};
