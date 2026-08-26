import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/staff-session';

/**
 * Report downloads.
 *
 * CSV rather than XLSX: every one of these opens in Excel, in Google Sheets
 * and in a text editor, and generating it costs no dependency and no build
 * step. A branch officer on a slow connection gets a 40KB file rather than a
 * 400KB workbook.
 *
 * The query runs under the requester's own session, so the file contains
 * exactly what that person can already see on screen. There is no
 * `where branch = ...` here and there must never be one — the export must not
 * be a second, weaker copy of the authorisation rules.
 */

export const dynamic = 'force-dynamic';

/** RFC 4180: quote anything containing a comma, quote or newline. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(headers: string[], rows: unknown[][]): string {
  // A leading BOM so Excel on Windows reads it as UTF-8 rather than as
  // Latin-1, which is what turns "Kariakoo Narung'ombe" into mojibake.
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

const KINDS = new Set(['stations', 'reports', 'events', 'branches']);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: 'Unknown report.' }, { status: 404 });
  }

  const supabase = await getServerClient();
  const session = await getStaffSession();

  if (!supabase || !session.signedIn) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get('month');

  let headers: string[] = [];
  let rows: unknown[][] = [];

  if (kind === 'stations' || kind === 'reports') {
    const [stationRes, branchRes, catRes] = await Promise.all([
      supabase.from('stations' as never)
        .select('id, name, short_name, category_id, branch_id, zone_code, district_name, address, status, portfolio, last_report_month, contact_name, contact_phone')
        .limit(10000),
      supabase.from('branches' as never).select('id, name').limit(1000),
      supabase.from('tracker_categories' as never).select('id, name_en').limit(100),
    ]);

    const stations = (stationRes.data as unknown as Record<string, unknown>[]) ?? [];
    const branchName = new Map(
      ((branchRes.data as unknown as { id: string; name: string }[]) ?? [])
        .map((b) => [b.id, b.name]),
    );
    const catName = new Map(
      ((catRes.data as unknown as { id: string; name_en: string }[]) ?? [])
        .map((c) => [c.id, c.name_en]),
    );

    if (kind === 'stations') {
      headers = ['Station', 'Short name', 'Category', 'Branch', 'Zone', 'District',
        'Status', 'People', 'Last report', 'Contact', 'Phone'];
      rows = stations.map((s) => [
        s.name, s.short_name, catName.get(s.category_id as string),
        branchName.get(s.branch_id as string), s.zone_code, s.district_name,
        s.status, s.portfolio, s.last_report_month, s.contact_name, s.contact_phone,
      ]);
    } else {
      const ids = stations.map((s) => s.id as string);
      let query = supabase.from('station_reports' as never)
        .select('station_id, period_month, portfolio, accounts_opened, active_accounts, dormant_accounts, deposits_tzs, loans_count, loans_value_tzs, note')
        .order('period_month', { ascending: false })
        .limit(50000);
      if (ids.length) query = query.in('station_id', ids);
      if (month) query = query.eq('period_month', month);

      const { data } = await query;
      const byId = new Map(stations.map((s) => [s.id as string, s]));

      headers = ['Month', 'Station', 'Category', 'Branch', 'Zone', 'People',
        'Accounts opened', 'Active', 'Dormant', 'Coverage %', 'Deposits TZS',
        'Loans', 'Loan value TZS', 'Note'];
      rows = ((data as unknown as Record<string, unknown>[]) ?? []).map((r) => {
        const s = byId.get(r.station_id as string) ?? {};
        const people = Number(r.portfolio ?? 0);
        const opened = Number(r.accounts_opened ?? 0);
        return [
          String(r.period_month).slice(0, 7), s.name,
          catName.get(s.category_id as string), branchName.get(s.branch_id as string),
          s.zone_code, people, opened, r.active_accounts, r.dormant_accounts,
          people > 0 ? Math.round((opened / people) * 1000) / 10 : '',
          r.deposits_tzs, r.loans_count, r.loans_value_tzs, r.note,
        ];
      });
    }
  }

  if (kind === 'events') {
    const [eventRes, branchRes] = await Promise.all([
      supabase.from('tracked_events' as never)
        .select('name, event_date, end_date, venue, address, branch_id, zone_code, participants, budget_tzs, actual_spend_tzs, accounts_opened, deposits_tzs, album_url, notes')
        .order('event_date', { ascending: false })
        .limit(10000),
      supabase.from('branches' as never).select('id, name').limit(1000),
    ]);
    const branchName = new Map(
      ((branchRes.data as unknown as { id: string; name: string }[]) ?? [])
        .map((b) => [b.id, b.name]),
    );

    headers = ['Event', 'Date', 'Past or upcoming', 'Venue', 'Where', 'Branch',
      'Zone', 'Participants', 'Budget TZS', 'Spent TZS', 'Accounts opened',
      'Cost per account TZS', 'Deposits TZS', 'Album', 'Notes'];
    rows = ((eventRes.data as unknown as Record<string, unknown>[]) ?? []).map((e) => {
      const opened = Number(e.accounts_opened ?? 0);
      const spend = Number(e.actual_spend_tzs ?? 0);
      return [
        e.name, e.event_date,
        new Date(String(e.event_date)) < new Date() ? 'Past' : 'Upcoming',
        e.venue, e.address, branchName.get(e.branch_id as string), e.zone_code,
        e.participants, e.budget_tzs, e.actual_spend_tzs, opened,
        opened > 0 && spend > 0 ? Math.round(spend / opened) : '',
        e.deposits_tzs, e.album_url, e.notes,
      ];
    });
  }

  if (kind === 'branches') {
    const { data } = await supabase.from('branches' as never)
      .select('name, zone_code, is_active, year_established')
      .order('name', { ascending: true })
      .limit(2000);

    headers = ['Branch', 'Zone', 'Active', 'Established'];
    rows = ((data as unknown as Record<string, unknown>[]) ?? []).map((b) => [
      b.name, b.zone_code ?? 'not assigned', b.is_active, b.year_established,
    ]);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `konekt-${kind}${month ? `-${month.slice(0, 7)}` : ''}-${stamp}.csv`;

  return new NextResponse(csv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // A report is a snapshot of a moment; a cached one is a lie about when.
      'Cache-Control': 'no-store',
    },
  });
}
