import { NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/staff-session';
import { buildReport } from '@/lib/report';

/**
 * Report downloads.
 *
 * The rows come from `buildReport`, which is also what the print view renders.
 * Two code paths producing "the same" report is two code paths that disagree
 * about a rounding rule within a month, and the disagreement gets discovered
 * in a board meeting. There is one path.
 *
 * CSV rather than XLSX: it opens in Excel, in Sheets and in a text editor,
 * needs no dependency, and a branch officer on a slow connection gets tens of
 * kilobytes rather than hundreds.
 */

export const dynamic = 'force-dynamic';

/** RFC 4180: quote anything containing a comma, quote or newline. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(headers: string[], rows: unknown[][]): string {
  // A leading BOM so Excel on Windows reads it as UTF-8 rather than Latin-1,
  // which is what turns "Kariakoo Narung'ombe" into mojibake.
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  const session = await getStaffSession();

  if (!session.signedIn) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const q = new URL(request.url).searchParams;
  const report = await buildReport({
    kind,
    from: q.get('from') ?? q.get('month') ?? undefined,
    to: q.get('to') ?? q.get('month') ?? undefined,
    zone: q.get('zone') ?? undefined,
    branch: q.get('branch') ?? undefined,
    category: q.get('category') ?? undefined,
    eventId: q.get('event') ?? undefined,
    periodKind: q.get('covers') ?? undefined,
    groupBy: q.get('group') ?? undefined,
    // Repeated ?col= parameters, so the URL stays readable and shareable.
    columns: q.getAll('col'),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `konekt-${report.kind}-${stamp}.csv`;

  return new NextResponse(csv(report.headers, report.rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // A report is a snapshot of a moment; a cached one is a lie about when.
      'Cache-Control': 'no-store',
    },
  });
}
