// src/app/requests/[id]/summary/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { downloadPdfWithAuth } from '@/lib/downloadWithAuth';

type UnitCode = 'COUNT' | 'PERCENT' | 'BAHT' | 'PER_DAY' | 'PER_7D' | 'PER_30D';
type Gender = 'All' | 'Male' | 'Female';
type DayKey = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
type TimeRange = { day: DayKey; start: number; end: number };

const UNIT_LABEL: Record<UnitCode, string> = {
  COUNT: 'จำนวน',
  PERCENT: '%',
  BAHT: 'บาท',
  PER_DAY: 'ต่อวัน',
  PER_7D: 'ต่อ 7 วัน',
  PER_30D: 'ต่อ 30 วัน',
};
const THDAY: Record<DayKey, string> = { Sun: 'อา', Mon: 'จ', Tue: 'อ', Wed: 'พ', Thu: 'พฤ', Fri: 'ศ', Sat: 'ส' };
const dayMap: readonly DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const cls =
    status === 'draft'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : status === 'submitted'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : status === 'approved'
      ? 'bg-sky-100 text-sky-800 border-sky-200'
      : status === 'needs_changes'
      ? 'bg-rose-100 text-rose-800 border-rose-200'
      : status === 'rejected'
      ? 'bg-rose-100 text-rose-800 border-rose-200'
      : 'bg-slate-200 text-slate-700 border-slate-300';
  return <span className={`badge ${cls}`}>{status ?? '-'}</span>;
};

type KpiRow = {
  idx: number;
  type: string;
  operator: '>=' | '<=' | '=';
  target: number;
  unit: UnitCode;
  label: string | null;
  method: string | null;
  is_primary?: boolean | null;
};

type ChannelRow = { channel_type: string | null; custom_name: string | null };

export default function RequestSummaryPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [req, setReq] = useState<any>(null);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [sch, setSch] = useState<TimeRange[]>([]);
  const [aud, setAud] = useState<{ gender: Gender; age_min?: number | null; age_max?: number | null } | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [canReview, setCanReview] = useState<boolean>(false);
  const [busyApprove, setBusyApprove] = useState(false);

  // ---------- helpers ----------
  const nextStepText = (st?: string) => {
    if (st === 'submitted' || st === 'in_review') return 'รอทีมรีวิวตรวจทาน (ปกติภายใน 1–2 วันทำการ)';
    if (st === 'needs_changes' || st === 'changes_requested') return 'โปรดแก้ไขตามข้อเสนอแนะ แล้วส่งอีกครั้ง';
    if (st === 'approved') return 'คำขออนุมัติแล้ว เตรียมดำเนินการตามแผน';
    if (st === 'rejected') return 'คำขอถูกปฏิเสธ';
    if (st === 'draft') return 'ยังเป็นฉบับร่าง กรุณากด Submit ก่อน';
    return '';
  };

  const calcProjectDays = (start?: string | null, end?: string | null) => {
    if (!start || !end) return null;
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff >= 1 ? diff : null;
  };

  const BUDGET_UNIT_THAI: Record<'PER_DAY' | 'PER_MONTH' | 'TOTAL_PROJECT', string> = {
    PER_DAY: 'ต่อวัน',
    PER_MONTH: 'ต่อเดือน',
    TOTAL_PROJECT: 'ทั้งโครงการ',
  };

  // outside approve (derived)
  const approvedOutside = useMemo(() => {
    let n = 0;
    for (const e of events) {
      if (e.event_type === 'approve_outside_pdf') n++;
      if (e.event_type === 'revoke_approve_outside_pdf') n = Math.max(0, n - 1);
    }
    return n > 0;
  }, [events]);

  // ---------- load ----------
  const reloadAll = async () => {
    // main
    const { data: r } = await supabase
      .from('ad_requests')
      .select(
        `
        id,status,org_id,created_by,campaign_name,platform,funnel_stage,objective,
        budget_value,budget_unit,project_start_date,project_end_date,
        final_url,languages,locations,notes,submitted_at,created_at
      `
      )
      .eq('id', id)
      .single();
    setReq(r);

    // kpis
    const { data: k } = await supabase
      .from('ad_request_kpis')
      .select('idx,type,operator,target,unit,label,method,is_primary')
      .eq('request_id', id)
      .order('idx', { ascending: true });
    setKpis((k || []) as KpiRow[]);

    // schedule
    const { data: sc } = await supabase
      .from('ad_request_schedules')
      .select('day_of_week,start_minute,end_minute')
      .eq('request_id', id)
      .order('day_of_week', { ascending: true })
      .order('start_minute', { ascending: true });
    setSch(
      (sc || []).map((s: any) => ({
        day: dayMap[s.day_of_week],
        start: s.start_minute,
        end: s.end_minute,
      }))
    );

    // audience
    const { data: a } = await supabase
      .from('ad_request_audience')
      .select('gender,age_min,age_max')
      .eq('request_id', id)
      .maybeSingle();
    setAud(a || { gender: 'All' });

    // channels
    const { data: ch } = await supabase
      .from('ad_request_channels')
      .select('channel_type,custom_name')
      .eq('request_id', id)
      .order('channel_type', { ascending: true });
    setChannels((ch || []) as ChannelRow[]);

    // events
    const { data: ev } = await supabase
      .from('ad_request_events')
      .select('event_type,actor,created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: true });
    setEvents(ev || []);

    // comments
    const { data: cm } = await supabase
      .from('ad_request_comments')
      .select('section,comment,author,created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: true });
    setComments(cm || []);

    // can_review_request (แก้ไม่ใช้ .catch)
    let canRes = false;
    try {
      const { data } = await supabase.rpc('can_review_request', { request_id: id });
      canRes = Boolean(data);
    } catch {
      canRes = false;
    }
    setCanReview(canRes);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const { data: sessionRes } = await supabase.auth.getSession();
        if (!sessionRes.session) {
          location.href = '/login';
          return;
        }
        await supabase.rpc('join_default_org');
        await reloadAll();
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- outside approve toggle ----------
  const canToggleApproveOutside = req?.status === 'submitted';

  const toggleOutsideApprove = async (checked: boolean) => {
    try {
      setBusyApprove(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;

      if (checked) {
        await supabase.from('ad_request_events').insert({ request_id: id, actor: uid, event_type: 'approve_outside_pdf' });
        await supabase.from('ad_requests').update({ status: 'approved' }).eq('id', id as string);
      } else {
        await supabase
          .from('ad_request_events')
          .insert({ request_id: id, actor: uid, event_type: 'revoke_approve_outside_pdf' });
        await supabase.from('ad_requests').update({ status: 'submitted' }).eq('id', id as string);
      }

      await reloadAll();
    } catch (e: any) {
      alert('บันทึกล้มเหลว: ' + (e?.message || 'unknown'));
    } finally {
      setBusyApprove(false);
    }
  };

  // ---------- export ----------
  const exportPdf = () => {
    const isApproved = req?.status === 'approved';
    const url = isApproved ? `/api/requests/${id}/approval.pdf` : `/api/requests/${id}/export`;
    const filename = isApproved ? `adpaas-approval-${id}.pdf` : `adpaas-request-${id}.pdf`;
    downloadPdfWithAuth(url, filename);
  };

  const projectDays = calcProjectDays(req?.project_start_date, req?.project_end_date);

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      {/* LEFT */}
      <div className="grid gap-4">
        {/* Header */}
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-lg truncate">{req?.campaign_name || 'Campaign'}</div>
              <div className="text-xs text-slate-500 mt-1">
                {req?.funnel_stage ? `Funnel: ${req.funnel_stage} · ` : ''}
                {req?.objective ? `Objective: ${req.objective} · ` : ''}
                {req?.platform ? `Platform: ${req.platform}` : ''}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {req?.status && req.status !== 'draft' ? (
                <button
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                  onClick={exportPdf}
                  title={req?.status === 'approved' ? 'Export PDF: Approval' : 'Export PDF: Request Form'}
                >
                  Export PDF
                </button>
              ) : (
                <button className="px-3 py-1.5 rounded bg-slate-200 text-slate-500 text-sm" disabled>
                  Export PDF
                </button>
              )}
              <StatusBadge status={req?.status} />
            </div>
          </div>

          {loading && <div className="text-xs text-slate-500 mt-2">กำลังโหลด…</div>}
          {errorMsg && <div className="text-xs text-rose-600 mt-2">ผิดพลาด: {errorMsg}</div>}
        </div>

        {/* Summary */}
        <div className="card">
          <div className="font-medium mb-2">สรุป</div>
          {!req ? (
            <div className="text-sm text-slate-500">—</div>
          ) : (
            <div className="text-sm grid gap-1">
              <div>
                Funnel / Objective: <span className="text-slate-700">{req.funnel_stage || '-'}</span> /{' '}
                <span className="text-slate-700">{req.objective || '-'}</span>
              </div>
              <div>
                Platform: <span className="text-slate-700">{req.platform || '-'}</span>
              </div>

              <div>
                Channels:{' '}
                <span className="text-slate-700">
                  {channels.length
                    ? channels
                        .map((c) => (c.custom_name?.trim() ? c.custom_name!.trim() : c.channel_type || '-'))
                        .join(', ')
                    : '-'}
                </span>
              </div>

              <div>
                Budget:{' '}
                <span className="text-slate-700">
                  {typeof req.budget_value === 'number'
                    ? `฿${Number(req.budget_value).toLocaleString('th-TH')} ${
                        req.budget_unit ? `(${BUDGET_UNIT_THAI[req.budget_unit as 'PER_DAY' | 'PER_MONTH' | 'TOTAL_PROJECT']})` : ''
                      }`
                    : '-'}
                </span>
              </div>

              <div>
                Project:{' '}
                <span className="text-slate-700">
                  {(req.project_start_date || '-') + ' → ' + (req.project_end_date || '-')}
                  {projectDays ? ` (${projectDays} วัน)` : ''}
                </span>
              </div>

              <div>
                Languages:{' '}
                <span className="text-slate-700">
                  {Array.isArray(req.languages) && req.languages.length ? req.languages.join(', ') : '-'}
                </span>
              </div>

              <div>
                Locations:{' '}
                <span className="text-slate-700">
                  {Array.isArray(req.locations) && req.locations.length
                    ? req.locations.filter(Boolean).join(', ')
                    : '-'}
                </span>
              </div>

              <div>
                Final URL:{' '}
                <span className="text-blue-700">
                  {req.final_url ? (
                    <a href={req.final_url} target="_blank" rel="noreferrer" className="hover:underline">
                      {req.final_url}
                    </a>
                  ) : (
                    '-'
                  )}
                </span>
              </div>

              <div className="text-xs text-slate-500 mt-1">
                Created: {req.created_at ? new Date(req.created_at).toLocaleString('th-TH') : '-'} · Submitted:{' '}
                {req.submitted_at ? new Date(req.submitted_at).toLocaleString('th-TH') : '-'}
              </div>
            </div>
          )}
        </div>

        {/* KPI */}
        <div className="card">
          <div className="font-medium mb-2">KPI & วิธีวัดผล</div>
          {kpis.length === 0 ? (
            <div className="text-sm text-slate-500">ไม่มีการกำหนด KPI</div>
          ) : (
            <div className="grid gap-2">
              {kpis.map((k) => (
                <div key={k.idx} className="border rounded-xl p-3 text-sm">
                  <div className="font-medium">
                    {k.is_primary ? '(Primary) ' : ''}
                    {k.type === 'OTHER' ? k.label || 'KPI อื่น' : k.type}
                  </div>
                  <div className="text-xs text-slate-600 my-1">
                    เป้า: {k.operator} {k.target}{' '}
                    {k.unit ? `(${UNIT_LABEL[k.unit as UnitCode] || k.unit})` : ''}
                  </div>
                  <div className="text-xs whitespace-pre-wrap">{k.method}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audience */}
        <div className="card">
          <div className="font-medium mb-2">กลุ่มประชากร (Audience)</div>
          <div className="text-sm">
            เพศ:{' '}
            {aud?.gender === 'All' ? 'ทั้งหมด' : aud?.gender === 'Male' ? 'ผู้ชาย' : 'ผู้หญิง'}
            {' · '}
            อายุ:{' '}
            {typeof aud?.age_min === 'number' || typeof aud?.age_max === 'number'
              ? `${aud?.age_min ?? ''}${typeof aud?.age_max === 'number' ? `–${aud?.age_max}` : ''} ปี`
              : 'ไม่กำหนด'}
          </div>
        </div>

        {/* Schedule */}
        <div className="card">
          <div className="font-medium mb-2">ตารางโฆษณา (Ad schedule)</div>
          {sch.length === 0 ? (
            <div className="text-sm text-slate-500">ไม่กำหนดตารางเวลา</div>
          ) : (
            <div className="grid gap-1 text-sm">
              {sch.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <div className="w-16">{THDAY[r.day]} ({r.day})</div>
                  <div>
                    {hhmm(r.start)} – {hhmm(r.end)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card">
          <div className="font-medium mb-2">บันทึก / Tracking</div>
          <div className="text-sm whitespace-pre-wrap">{req?.notes || '—'}</div>
        </div>

        {/* Timeline */}
        <div className="card">
          <div className="font-medium mb-2">ไทม์ไลน์</div>
          {events.length === 0 ? (
            <div className="text-sm text-slate-500">—</div>
          ) : (
            <div className="grid gap-1 text-xs">
              {events.map((ev, i) => (
                <div key={i}>• {new Date(ev.created_at).toLocaleString()} — {ev.event_type}</div>
              ))}
            </div>
          )}
        </div>

        {/* Comments (read-only placeholder) */}
        {comments.length > 0 && (
          <div className="card">
            <div className="font-medium mb-2">ข้อเสนอแนะจากทีมรีวิว</div>
            <div className="grid gap-2">
              {comments.map((c, i) => (
                <div key={i} className="border rounded-xl p-3 text-sm">
                  <div className="text-xs text-slate-500 mb-1">{c.section || 'ทั่วไป'}</div>
                  <div className="whitespace-pre-wrap">{c.comment}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div className="grid gap-4">
        <div className="card">
          <div className="font-medium mb-2">สถานะ & ขั้นตอนต่อไป</div>
          <div className="text-sm mb-2">
            <StatusBadge status={req?.status} />
          </div>
          <div className="text-xs text-slate-600">{nextStepText(req?.status)}</div>
        </div>

        {/* อนุมัติเอกสารระบบ (ผ่าน PDF) */}
        <div className="card">
          <div className="font-medium mb-2">อนุมัติเอกสารระบบ (ผ่าน PDF)</div>
          <label
            className={`flex items-start gap-2 ${
              !canToggleApproveOutside ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={approvedOutside || req?.status === 'approved'}
              onChange={(e) => toggleOutsideApprove(e.target.checked)}
              disabled={!canToggleApproveOutside || busyApprove}
              title={!canToggleApproveOutside ? 'อนุญาตเฉพาะเมื่อสถานะเป็น submitted' : ''}
            />
            <span className="text-sm">
              ยืนยันว่าได้รับไฟล์อนุมัติเป็น PDF แล้ว
              {busyApprove && <span className="ml-2 text-xs text-slate-500">(กำลังบันทึก…)</span>}
            </span>
          </label>
          <div className="text-xs text-slate-500 mt-2">
            {approvedOutside
              ? 'มีการติ๊กอนุมัตินอกระบบอย่างน้อย 1 ครั้งแล้ว'
              : 'ยังไม่มีการอนุมัตินอกระบบ'}
          </div>
        </div>
      </div>
    </div>
  );
}
