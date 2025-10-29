// src/app/api/requests/[id]/export/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
// ใช้ standalone build เพื่อเลี่ยงโหลด Helvetica.afm
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import fs from 'node:fs';
import path from 'node:path';

/* ---------- Types ---------- */
type RequestFull = {
  id: string;
  org_id: string;
  request_code: string | null;
  status: string | null;
  funnel_stage: string | null;
  objective: string | null;
  platform: string | null;
  campaign_name: string | null;
  budget_value: number | null;
  budget_unit: 'PER_DAY' | 'PER_MONTH' | 'TOTAL_PROJECT' | null;
  final_url: string | null;
  languages: string[] | null;
  locations: string[] | null;
  project_start_date: string | null;
  project_end_date: string | null;
  notes: string | null;
  created_at: string | null;
  submitted_at: string | null;
};

type KpiRow = {
  idx: number;
  type: string | null;
  operator: string | null;
  target: number | null;
  unit: 'COUNT'|'PERCENT'|'BAHT'|'PER_DAY'|'PER_7D'|'PER_30D' | null;
  label: string | null;
  method: string | null;
  is_primary: boolean | null;
};

type ScheduleRow = { day_of_week: number; start_minute: number; end_minute: number };

type ChannelRow = {
  channel_type: 'FACEBOOK'|'GOOGLE'|'TIKTOK'|'LINE'|'INSTAGRAM'|'X'|'OTHER';
  custom_name: string | null;
  idx: number | null;
};

/* ---------- Helpers ---------- */
const fmtMoney = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDateTimeICT = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(dt);
};

function unitTh(unit?: string | null) {
  return unit === 'PER_DAY' ? 'วัน' : unit === 'PER_MONTH' ? 'เดือน' : unit === 'TOTAL_PROJECT' ? 'โครงการ' : '';
}

const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;
const minutesToHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function groupSchedule(rows: ScheduleRow[]) {
  if (!rows?.length) return '—';
  const key = (r: ScheduleRow) => `${minutesToHHMM(r.start_minute)}-${minutesToHHMM(r.end_minute)}`;
  const map = new Map<string, number[]>();
  rows.forEach((r) => {
    const k = key(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r.day_of_week);
  });
  const ranges: string[] = [];
  for (const [k, days] of map) {
    days.sort((a, b) => a - b);
    let s = days[0], prev = days[0];
    const parts: string[] = [];
    for (let i = 1; i < days.length; i++) {
      if (days[i] === prev + 1) { prev = days[i]; continue; }
      parts.push(s === prev ? DOW[s] : `${DOW[s]}–${DOW[prev]}`);
      s = prev = days[i];
    }
    parts.push(s === prev ? DOW[s] : `${DOW[s]}–${DOW[prev]}`);
    ranges.push(`${parts.join(', ')} ${k.replace('-', '–')}`);
  }
  return ranges.join(', ');
}

const channelLabel = (t: ChannelRow['channel_type'], custom?: string | null) =>
  t === 'FACEBOOK'   ? 'Facebook Ads' :
  t === 'GOOGLE'     ? 'Google Ads'   :
  t === 'TIKTOK'     ? 'TikTok'       :
  t === 'LINE'       ? 'LINE Ads'     :
  t === 'INSTAGRAM'  ? 'Instagram'    :
  t === 'X'          ? 'X'            :
  `OTHER: ${custom ?? ''}`;

function calcProjectDays(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff >= 1 ? diff : null;
}

function fontPath(file: string) { return path.join(process.cwd(), 'public', 'fonts', file); }
function useEmbeddedThaiFonts(doc: InstanceType<typeof PDFDocument>) {
  try {
    const reg = fs.readFileSync(fontPath('Sarabun-Regular.ttf'));
    const bold = fs.readFileSync(fontPath('Sarabun-Bold.ttf'));
    doc.registerFont('TH_REG', reg);
    doc.registerFont('TH_BOLD', bold);
    doc.font('TH_REG');
  } catch (e) {
    console.error('Font load failed, fallback to Courier', e);
    doc.font('Courier');
  }
}

/* ---------- Auth helpers (SSR, no service key) ---------- */
function getAuthHeaderOrCookie(req: NextRequest) {
  const h = req.headers.get('authorization');
  if (h) return h;
  const c = req.cookies.get('sb-access-token')?.value || cookies().get('sb-access-token')?.value;
  return c ? `Bearer ${c}` : null;
}
function createSbFromReq(req: NextRequest, authHeader: string | null) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => req.cookies.get(n)?.value || cookies().get(n)?.value,
        set() {},
        remove() {},
      },
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    } as any
  );
}

/* ---------- Handler ---------- */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params?.id;
    if (!id || id === 'preview') {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
    }

    const authHeader = getAuthHeaderOrCookie(req);
    const supabase = createSbFromReq(req, authHeader);

    // Auth (รองรับทั้ง header และ cookie)
    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.slice('Bearer '.length);
      const { data, error } = await supabase.auth.getUser(jwt);
      if (error || !data?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    } else {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // ให้ RLS อยู่ใน org เดียวกับฝั่งเว็บ (ไม่ใช้ .catch)
    const { error: joinErr } = await supabase.rpc('join_default_org');
    if (joinErr) console.warn('join_default_org error:', joinErr);
    const { data: _orgId, error: getOrgErr } = await supabase.rpc('get_default_org_id');
    if (getOrgErr) console.warn('get_default_org_id error:', getOrgErr);

    // 1) request head
    const { data: reqRow, error: reqErr } = await supabase
      .from('ad_requests')
      .select(`
        id, org_id, request_code, status, funnel_stage, objective, platform,
        campaign_name, budget_value, budget_unit, final_url, languages, locations,
        project_start_date, project_end_date, notes, created_at, submitted_at
      `)
      .eq('id', id)
      .single();

    if (reqErr || !reqRow) {
      return NextResponse.json({ error: reqErr?.message || 'Request not found' }, { status: 404 });
    }

    // 2) KPIs
    const { data: kpisRaw } = await supabase
      .from('ad_request_kpis')
      .select('idx,type,operator,target,unit,label,method,is_primary')
      .eq('request_id', id)
      .order('idx', { ascending: true });

    const kpis = (kpisRaw || []) as KpiRow[];

    // 3) Schedules
    const { data: schsRaw } = await supabase
      .from('ad_request_schedules')
      .select('day_of_week,start_minute,end_minute')
      .eq('request_id', id)
      .order('day_of_week', { ascending: true });

    const schs = (schsRaw || []) as ScheduleRow[];

    // 4) Channels
    const { data: chsRaw } = await supabase
      .from('ad_request_channels')
      .select('channel_type, custom_name, idx')
      .eq('request_id', id)
      .order('idx', { ascending: true });

    const channelsText =
      (chsRaw && chsRaw.length)
        ? (chsRaw as ChannelRow[]).map(c => channelLabel(c.channel_type, c.custom_name)).join(', ')
        : '—';

    // 5) Build PDF (ฟอร์มยื่นขอ — ไม่มีลายน้ำ APPROVED)
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    useEmbeddedThaiFonts(doc);

    const nodeStream = doc as unknown as NodeJS.ReadableStream;
    const body = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err) => controller.error(err));
      },
      cancel() { try { doc.end(); } catch {} },
    });

    // Header
    doc.font('TH_BOLD').fontSize(16).text('REQUEST FORM  /  แบบฟอร์มยื่นขออนุมัติ');
    doc.font('TH_REG').fontSize(10).text(`Printed: ${fmtDateTimeICT(new Date())}`);
    doc.moveDown(0.4);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();

    // Summary
    const pair = (label: string, value: string) => {
      doc.font('TH_REG').fontSize(10).fillColor('#000').text(label + '  ', { continued: true });
      doc.fillColor('#111').text(value ?? '—');
    };
    const toCSV = (arr?: string[] | null) => (arr?.length ? arr.join(', ') : '—');

    doc.moveDown(0.8);
    doc.font('TH_BOLD').fontSize(12).text('CAMPAIGN SUMMARY  /  สรุปแคมเปญ');
    doc.moveDown(0.2);

    const pDays = calcProjectDays(reqRow.project_start_date, reqRow.project_end_date);
    pair('Campaign Name / ชื่อแคมเปญ', reqRow.campaign_name ?? '—');
    pair('Platform / แพลตฟอร์ม', reqRow.platform ?? '—');
    pair('Funnel / Objective / ฟันเนล / วัตถุประสงค์', `${reqRow.funnel_stage ?? '—'} / ${reqRow.objective ?? '—'}`);
    pair('Channels / ช่องทางยิงแอด', channelsText);
    if (reqRow.budget_value) {
      pair('Budget / งบประมาณ', `฿${fmtMoney(reqRow.budget_value)} / ${unitTh(reqRow.budget_unit)}`);
    } else {
      pair('Budget / งบประมาณ', '-');
    }
    pair('Project Period / ช่วงเวลาโครงการ',
      `${reqRow.project_start_date || '-'} → ${reqRow.project_end_date || '-'}${pDays ? ` (${pDays} วัน)` : ''}`);
    pair('Final URL / ลิงก์ปลายทาง', reqRow.final_url || '—');
    pair('Locations / พื้นที่', toCSV(reqRow.locations));
    pair('Languages / ภาษา', toCSV(reqRow.languages));
    pair('Status / สถานะ', reqRow.status || '—');
    pair('Created / วันที่สร้าง', fmtDateTimeICT(reqRow.created_at));
    pair('Submitted / วันที่ส่งอนุมัติ', fmtDateTimeICT(reqRow.submitted_at));

    doc.moveDown(0.6);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();

    // KPIs
    doc.moveDown(0.8);
    doc.font('TH_BOLD').fontSize(12).text('KPI SUMMARY');
    doc.moveDown(0.2);

    const tableX = doc.page.margins.left;
    let y = doc.y;
    const widths = [30, 140, 70, 80, 70, 150];
    const headers = ['#', 'KPI', 'Operator', 'Target', 'Unit', 'Method'];

    const drawRow = (cells: string[], bold = false) => {
      let x = tableX;
      doc.font(bold ? 'TH_BOLD' : 'TH_REG').fontSize(10).fillColor('#000');
      for (let i = 0; i < cells.length; i++) {
        doc.text(String(cells[i] ?? '—'), x + 4, y + 4, { width: widths[i] - 8 });
        x += widths[i];
      }
    };

    doc.rect(tableX, y, widths.reduce((a, b) => a + b, 0), 22).stroke();
    drawRow(headers, true);
    y += 22;

    for (let i = 0; i < Math.max(1, kpis.length); i++) {
      const k = kpis[i];
      const isEmpty = !k;
      const idx = isEmpty ? '' : String((k.idx ?? i) + 1);
      const kpiName = isEmpty ? '—' : (k.type === 'OTHER' ? (k.label ?? 'OTHER') : (k.type ?? '—'));
      const operator = isEmpty ? '—' : (k.operator ?? '—');
      const target = isEmpty ? '—'
        : k.unit === 'PERCENT' ? `${fmtMoney(k.target)} %`
        : k.unit === 'BAHT' ? `${fmtMoney(k.target)} บาท`
        : fmtMoney(k.target);
      const unit = isEmpty ? '—' : (k.unit ?? '—');
      const method = isEmpty ? '—' : (k.method ?? '—');

      doc.rect(tableX, y, widths.reduce((a, b) => a + b, 0), 22).stroke();
      drawRow([idx, kpiName, operator, target, unit, method], !isEmpty && (k.idx ?? i) === 0);
      y += 22;

      if (y > doc.page.height - doc.page.margins.bottom - 120) {
        doc.addPage();
        y = doc.y;
        doc.rect(tableX, y, widths.reduce((a, b) => a + b, 0), 22).stroke();
        drawRow(headers, true);
        y += 22;
      }
    }

    doc.moveDown(0.6);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();

    // Schedule
    doc.moveDown(0.8);
    doc.font('TH_BOLD').fontSize(12).text('AD SCHEDULE');
    doc.moveDown(0.2);
    doc.font('TH_REG').fontSize(10).text(groupSchedule(schs));

    // Notes
    if (reqRow.notes) {
      doc.moveDown(0.8);
      doc.font('TH_BOLD').fontSize(12).text('บันทึก / Notes');
      doc.moveDown(0.2);
      doc.font('TH_REG').fontSize(10).text(String(reqRow.notes), { width: 520 });
    }

    // Sign block
    doc.moveDown(1.0);
    const line = (label: string) => {
      const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const mid = doc.page.margins.left + w * 0.62;
      doc.font('TH_REG').fontSize(10).text(label, { continued: true });
      doc.text('  ');
      const y0 = doc.y + 12;
      doc.moveTo(mid, y0).lineTo(mid + w * 0.35, y0).stroke();
      doc.moveDown(1.0);
    };
    line('Requested by');
    line('Reviewed by');
    line('Approved by');

    // Footer
    doc.moveTo(doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 20)
      .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - doc.page.margins.bottom - 20)
      .stroke();
    doc.font('TH_REG').fontSize(9).text(
      'ADPAAS — Adwords Planner, Audit & Approve System',
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom - 16,
      { continued: true }
    );
    doc.text(`Printed on ${fmtDateTimeICT(new Date())}`, { align: 'right' });

    doc.end();

    return new NextResponse(body as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="adpaas-request-${id}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e: any) {
    const debug = new URL(req.url).searchParams.get('debug') === '1';
    if (debug) {
      return NextResponse.json({
        reason: 'PDF_GENERATION_ERROR',
        message: e?.message ?? String(e),
        stack: e?.stack ?? null,
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
