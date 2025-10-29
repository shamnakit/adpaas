// src/app/requests/[id]/summary/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type UnitCode = 'COUNT'|'PERCENT'|'BAHT'|'PER_DAY'|'PER_7D'|'PER_30D';
type Gender = 'All'|'Male'|'Female';
type DayKey = 'Sun'|'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat';
type TimeRange = { day: DayKey; start: number; end: number };

const THDAY: Record<DayKey,string> = {Sun:'อา',Mon:'จ',Tue:'อ',Wed:'พ',Thu:'พฤ',Fri:'ศ',Sat:'ส'};
const UNIT_LABEL: Record<UnitCode,string> = {
  COUNT:'จำนวน', PERCENT:'%', BAHT:'บาท', PER_DAY:'ต่อวัน', PER_7D:'ต่อ 7 วัน', PER_30D:'ต่อ 30 วัน'
};

function hhmm(mins:number){ const h=Math.floor(mins/60), m=mins%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
function calcProjectDays(start?: string|null, end?: string|null){
  if(!start || !end) return null;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const d = Math.floor((e.getTime()-s.getTime())/(1000*60*60*24)) + 1;
  return d>0? d : null;
}

// ---- ช่องทางยิงแอด (TH labels)
type ChannelType = 'FACEBOOK'|'GOOGLE'|'TIKTOK'|'LINEADS'|'INSTAGRAM'|'X'|'OTHER';
const CHANNEL_TH: Record<ChannelType,string> = {
  FACEBOOK: 'Facebook Ads (เฟซบุ๊ก)',
  GOOGLE: 'Google Ads (แอดเวิร์ดส์)',
  TIKTOK: 'TikTok Ads',
  LINEADS: 'LINE Ads',
  INSTAGRAM: 'Instagram Ads',
  X: 'X (Twitter) Ads',
  OTHER: 'ช่องทางอื่น',
};

export default function RequestSummaryPage(){
  const { id } = useParams<{id:string}>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [orgOk, setOrgOk] = useState(true);
  const [req, setReq] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [sch, setSch] = useState<TimeRange[]>([]);
  const [aud, setAud] = useState<{gender: Gender; age_min?: number|null; age_max?: number|null}|null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [channels, setChannels] = useState<Array<{channel_type: ChannelType; custom_name: string|null}>>([]);
  const [busyApprove, setBusyApprove] = useState(false);

  const reloadAll = async ()=>{
    // คอนเท็กซ์องค์กร (RLS)
    await supabase.rpc('join_default_org');

    // 1) คำขอ
    const { data: r } = await supabase
      .from('ad_requests')
      .select(`
        id,status,org_id,created_by,campaign_name,platform,funnel_stage,objective,
        budget_value,budget_unit,project_start_date,project_end_date,
        final_url,languages,locations,notes,submitted_at,created_at
      `)
      .eq('id', id).single();
    setReq(r);

    // 2) KPI
    const { data: k } = await supabase
      .from('ad_request_kpis')
      .select('idx,type,operator,target,unit,label,method,is_primary')
      .eq('request_id', id)
      .order('idx', { ascending: true });
    setKpis(k||[]);

    // 3) ตารางเวลา
    const { data: sc } = await supabase
      .from('ad_request_schedules')
      .select('day_of_week,start_minute,end_minute')
      .eq('request_id', id)
      .order('day_of_week', { ascending: true })
      .order('start_minute', { ascending: true });
    const dayMap: DayKey[] = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    setSch((sc||[]).map((s:any)=>({day: dayMap[s.day_of_week], start:s.start_minute, end:s.end_minute})));

    // 4) Audience
    const { data: a } = await supabase
      .from('ad_request_audience')
      .select('gender,age_min,age_max')
      .eq('request_id', id)
      .maybeSingle();
    setAud(a||{gender:'All'});

    // 5) ช่องทางยิงแอด
    const { data: ch } = await supabase
      .from('ad_request_channels')
      .select('channel_type, custom_name')
      .eq('request_id', id)
      .order('channel_type', { ascending: true });
    setChannels((ch||[]) as any[]);

    // 6) ไทม์ไลน์
    const { data: ev } = await supabase
      .from('ad_request_events')
      .select('event_type,actor,created_at,meta')
      .eq('request_id', id)
      .order('created_at', { ascending: true });
    setEvents(ev||[]);

    // 7) ความเห็น
    const { data: cm } = await supabase
      .from('ad_request_comments')
      .select('section,comment,author,created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: true });
    setComments(cm||[]);
  };

  useEffect(()=>{ (async()=>{
    try{
      setLoading(true);
      await reloadAll();
      setOrgOk(true);
    }catch(e:any){
      console.error(e);
      setOrgOk(false);
    }finally{
      setLoading(false);
    }
  })(); },[id]);

  // อนุมัติจาก event
  const approvedOutside = useMemo(()=>{
    let n = 0;
    for(const e of events){
      if(e.event_type==='approve_outside_pdf') n++;
      if(e.event_type==='revoke_approve_outside_pdf') n = Math.max(0, n-1);
    }
    return n>0;
  },[events]);

  const statusBadge = (st?:string)=>(
    <span className={`badge ${st==='approved'?'bg-emerald-600 text-white border-emerald-700':
                          st==='rejected'?'bg-rose-600 text-white border-rose-700':
                          st==='needs_changes'?'bg-amber-500 text-white border-amber-600':
                          st==='draft'?'bg-amber-100 text-amber-800 border-amber-200':
                          'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
      {st}
    </span>
  );

  const nextStep = (st?:string)=>{
    if(st==='submitted' || st==='in_review') return 'รอทีมรีวิวตรวจทาน (ปกติภายใน 1–2 วันทำการ)';
    if(st==='needs_changes') return 'โปรดแก้ไขตามข้อเสนอแนะ แล้วส่งอีกครั้ง';
    if(st==='approved') return 'คำขออนุมัติแล้ว เตรียมดำเนินการตามแผน';
    if(st==='rejected') return 'คำขอถูกปฏิเสธ หากต้องการส่งใหม่ โปรดปรับรายละเอียดให้เหมาะสม';
    return '';
  };

  // ✅ ใช้ RPC set_request_status เพื่อกัน RLS
  const toggleOutsideApprove = async (checked:boolean)=>{
    try{
      setBusyApprove(true);
      const { data:auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if(!uid) throw new Error('กรุณาเข้าสู่ระบบก่อน');

      await supabase.rpc('join_default_org');

      // 1) บันทึก event
      const ev = checked ? 'approve_outside_pdf' : 'revoke_approve_outside_pdf';
      const { error: e1 } = await supabase
        .from('ad_request_events')
        .insert({ request_id:id, actor: uid, event_type: ev });
      if (e1) throw e1;

      // 2) เซ็ตสถานะผ่าน RPC (ต้องมีฟังก์ชัน set_request_status)
      const nextStatus = checked ? 'approved' : 'submitted';
      const { error: e2 } = await supabase
        .rpc('set_request_status', { p_request_id: String(id), p_status: nextStatus });
      if (e2) throw e2;

      // 3) รีโหลด
      await reloadAll();
    }catch(e:any){
      console.error('[toggleOutsideApprove] error', e);
      alert('เปลี่ยนสถานะไม่สำเร็จ: ' + (e?.message ?? 'unknown error'));
    }finally{
      setBusyApprove(false);
    }
  };

  // helper: render list values
  const csv = (arr?: string[]|null)=> (arr?.length ? arr.join(', ') : '-');

  // ช่องทางยิงแอด (TH + custom)
  const channelsDisplay = useMemo(()=>{
    if(!channels?.length) return '-';
    return channels.map(c=>{
      const base = CHANNEL_TH[(c.channel_type||'OTHER') as ChannelType] || 'ช่องทางอื่น';
      const custom = c.custom_name?.trim() ? ` (${c.custom_name.trim()})` : '';
      return base + custom;
    }).join(', ');
  },[channels]);

  const projectDays = calcProjectDays(req?.project_start_date, req?.project_end_date);

  // ✅ แก้ TS7053: ไม่ index map ด้วยค่า any; ใช้ if-else
  const budgetLine = useMemo(()=>{
    const val = req?.budget_value;
    const unit = req?.budget_unit as string | null | undefined;
    if (!val) return '-';
    let unitTh = '';
    if (unit === 'PER_DAY') unitTh = 'ต่อวัน';
    else if (unit === 'PER_MONTH') unitTh = 'ต่อเดือน';
    else if (unit === 'TOTAL_PROJECT') unitTh = 'ทั้งโครงการ';
    return `฿${Number(val).toLocaleString('th-TH')}${unitTh ? ` (${unitTh})` : ''}`;
  }, [req?.budget_value, req?.budget_unit]);

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      <div className="grid gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="font-medium text-lg">{req?.campaign_name || 'Campaign'}</div>
            {statusBadge(req?.status)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {req?.funnel_stage ? `Funnel: ${req.funnel_stage} · `:''}
            {req?.objective ? `Objective: ${req.objective} · `:''}
            {req?.platform ? `Platform: ${req.platform}`:''}
          </div>
        </div>

        {/* Summary — ครบขึ้น + ภาษาไทยกำกับ */}
        <div className="card">
          <div className="font-medium mb-2">สรุป</div>
          <div className="text-sm grid gap-1">
            <div>Funnel / Objective: {(req?.funnel_stage||'-') + ' / ' + (req?.objective||'-')}</div>
            <div>Platform: {req?.platform || '-'}</div>
            <div>ช่องทางยิงแอด: {channelsDisplay}</div>
            <div>Budget: {budgetLine}</div>
            <div>
              ช่วงโครงการ: {(req?.project_start_date || '-')+' → '+(req?.project_end_date || '-')}
              {projectDays? ` (${projectDays} วัน)` : ''}
            </div>
            <div>Languages / ภาษา: {csv(req?.languages)}</div>
            <div>Locations / พื้นที่: {csv(req?.locations)}</div>
            <div>Final URL: {req?.final_url || '-'}</div>
          </div>
        </div>

        {/* KPI */}
        <div className="card">
          <div className="font-medium mb-2">KPI & วิธีวัดผล</div>
          {kpis.length===0 ? <div className="text-sm text-slate-500">ไม่มีการกำหนด KPI</div> : (
            <div className="grid gap-2">
              {kpis.map((k:any)=>(
                <div key={k.idx} className="border rounded-xl p-3 text-sm">
                  <div className="font-medium">{k.is_primary?'(Primary) ':''}{k.type==='OTHER'? (k.label || 'KPI อื่น'): k.type}</div>
                  <div className="text-xs text-slate-600 my-1">
                    เป้า: {k.operator} {k.target} {k.unit? `(${UNIT_LABEL[k.unit as UnitCode]||k.unit})`:''}
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
            เพศ: {aud?.gender==='All'?'ทั้งหมด': aud?.gender==='Male'?'ผู้ชาย':'ผู้หญิง'}
            {' · '}
            อายุ: {(typeof aud?.age_min==='number' || typeof aud?.age_max==='number')
              ? `${aud?.age_min ?? ''}${typeof aud?.age_max==='number'? `–${aud?.age_max}`:''} ปี`
              : 'ไม่กำหนด'}
          </div>
        </div>

        {/* Schedule */}
        <div className="card">
          <div className="font-medium mb-2">ตารางโฆษณา (Ad schedule)</div>
          {sch.length===0 ? <div className="text-sm text-slate-500">ไม่กำหนดตารางเวลา</div> : (
            <div className="grid gap-1 text-sm">
              {sch.map((r,i)=>(
                <div key={i} className="flex gap-2">
                  <div className="w-16">{THDAY[r.day]} ({r.day})</div>
                  <div>{hhmm(r.start)} – {hhmm(r.end)}</div>
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
          {events.length===0 ? <div className="text-sm text-slate-500">—</div> : (
            <div className="grid gap-1 text-xs">
              {events.map((ev,i)=>(
                <div key={i}>• {new Date(ev.created_at).toLocaleString()} — {ev.event_type}</div>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="card">
          <div className="font-medium mb-2">ข้อเสนอแนะจากทีมรีวิว</div>
          {comments.length===0 ? <div className="text-sm text-slate-500">—</div> : (
            <div className="grid gap-2">
              {comments.map((c,i)=>(
                <div key={i} className="border rounded-xl p-3 text-sm">
                  <div className="text-xs text-slate-500 mb-1">{c.section || 'ทั่วไป'}</div>
                  <div className="whitespace-pre-wrap">{c.comment}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="grid gap-4">
        <div className="card">
          <div className="font-medium mb-2">สถานะ & ขั้นตอนต่อไป</div>
          <div className="text-sm mb-2">{statusBadge(req?.status)}</div>
          <div className="text-xs text-slate-600">{nextStep(req?.status)}</div>

        {/* CTA */}
          <div className="flex gap-2 mt-3">
            {req?.status==='needs_changes' && (
              <button className="btn btn-primary" onClick={()=>router.push(`/requests/new?id=${id}`)}>แก้ไขคำขอ</button>
            )}
            {(req?.status==='submitted' || req?.status==='in_review') && (
              <button className="btn" onClick={()=>alert('ยังไม่เปิดใช้: ถอนคำขอ')}>ถอนคำขอ</button>
            )}
          </div>

          {!orgOk && <div className="text-xs text-rose-600 mt-2">คุณไม่มีสิทธิ์เข้าดูคำขอนี้</div>}
        </div>

        {/* ✅ อนุมัติเอกสารระบบ (ผ่าน PDF) */}
        <div className="card">
          <div className="font-medium mb-2">อนุมัติเอกสารระบบ (ผ่าน PDF)</div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={approvedOutside || req?.status==='approved'}
              onChange={(e)=>toggleOutsideApprove(e.target.checked)}
              disabled={busyApprove}
            />
            <span>ยืนยันว่าได้รับไฟล์อนุมัติเป็น PDF แล้ว</span>
          </label>
          {busyApprove && <div className="text-xs text-slate-500 mt-1">กำลังบันทึก…</div>}
        </div>
      </div>
    </div>
  );
}
