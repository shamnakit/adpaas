// src/app/review/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function ReviewConsolePage(){
  const { id } = useParams<{id:string}>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean>(false);
  const [req, setReq] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [aud, setAud] = useState<any>(null);
  const [sch, setSch] = useState<any[]>([]);

  useEffect(()=>{ (async()=>{
    setLoading(true);
    try{
      // Guard: เรียก RPC ตรวจสิทธิ์รีวิว
      const { data: can } = await supabase.rpc('can_review_request', { request_id: id });
      if(!can){ setAllowed(false); router.replace(`/requests/${id}/summary`); return; }
      setAllowed(true);

      // โหลดข้อมูลหลัก (เฉพาะที่ใช้รีวิว)
      const { data: r } = await supabase
        .from('ad_requests')
        .select('id,status,campaign_name,platform,funnel_stage,objective,budget_value,budget_unit,project_start_date,project_end_date,final_url,languages,locations,notes')
        .eq('id', id).single();
      setReq(r);

      const { data: k } = await supabase
        .from('ad_request_kpis')
        .select('idx,type,operator,target,unit,label,method,is_primary')
        .eq('request_id', id)
        .order('idx', { ascending: true });
      setKpis(k||[]);

      const { data: a } = await supabase
        .from('ad_request_audience')
        .select('gender,age_min,age_max')
        .eq('request_id', id)
        .maybeSingle();
      setAud(a||{});

      const { data: sc } = await supabase
        .from('ad_request_schedules')
        .select('day_of_week,start_minute,end_minute')
        .eq('request_id', id)
        .order('day_of_week', { ascending: true })
        .order('start_minute', { ascending: true });
      setSch(sc||[]);
    }catch(e){
      console.error(e);
    }finally{
      setLoading(false);
    }
  })(); },[id,router]);

  const doAction = async (action:'approve'|'ask_fix'|'reject')=>{
    try{
      // ตัวอย่างการอัปเดตสถานะ + บันทึกเหตุการณ์
      const newStatus = action==='approve'?'approved': action==='reject'?'rejected':'changes_requested';

      const { error: e1 } = await supabase
        .from('ad_requests')
        .update({ status: newStatus })
        .eq('id', id);
      if(e1) throw e1;

      await supabase.from('ad_request_events').insert({
        request_id: id, event_type: action, actor: (await supabase.auth.getUser()).data.user?.id
      });

      if(action==='ask_fix'){
        alert('ส่งคำขอแก้ไขแล้ว');
      }else if(action==='approve'){
        alert('อนุมัติแล้ว');
      }else{
        alert('ปฏิเสธแล้ว');
      }

      router.replace(`/requests/${id}/summary`);
    }catch(e:any){
      alert(`ดำเนินการไม่สำเร็จ: ${e?.message||'unknown'}`);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      <div className="grid gap-4">
        <div className="card">
          <div className="font-medium text-lg">{req?.campaign_name || 'Review Request'}</div>
          <div className="text-xs text-slate-500 mt-1">
            {req?.funnel_stage ? `Funnel: ${req.funnel_stage} · `:''}
            {req?.objective ? `Objective: ${req.objective} · `:''}
            {req?.platform ? `Platform: ${req.platform}`:''}
          </div>
        </div>

        {/* Overview / Issues (สรุปปัญหา/เตือน) */}
        <div className="card">
          <div className="font-medium mb-2">ภาพรวม & ประเด็นที่ต้องดู</div>
          <ul className="list-disc pl-5 text-sm">
            {!req?.final_url && <li className="text-rose-600">ยังไม่มี Final URL</li>}
            {(kpis||[]).length===0 && <li className="text-rose-600">ยังไม่กำหนด KPI</li>}
            {/* เติมกฎอื่น ๆ ได้ */}
            {(req?.final_url && (kpis||[]).length>0) && <li className="text-emerald-700">ไม่มีประเด็นสำคัญ</li>}
          </ul>
        </div>

        {/* KPI */}
        <div className="card">
          <div className="font-medium mb-2">KPI & วิธีวัด</div>
          {(kpis||[]).map(k=>(
            <div key={k.idx} className="border rounded-xl p-3 text-sm mb-2">
              <div className="font-medium">{k.is_primary?'(Primary) ':''}{k.type==='OTHER'? (k.label || 'KPI อื่น'): k.type}</div>
              <div className="text-xs text-slate-600 my-1">เป้า: {k.operator} {k.target} {k.unit}</div>
              <div className="text-xs whitespace-pre-wrap">{k.method}</div>
            </div>
          ))}
        </div>

        {/* Budget & Dates */}
        <div className="card">
          <div className="font-medium mb-2">งบประมาณ & วันที่</div>
          <div className="text-sm">Budget: {req?.budget_value ? `฿${Number(req.budget_value).toLocaleString('th-TH')} (${req?.budget_unit})` : '-'}</div>
          <div className="text-sm">ช่วง: {(req?.project_start_date || '-')+' → '+(req?.project_end_date || '-')}</div>
        </div>

        {/* Audience */}
        <div className="card">
          <div className="font-medium mb-2">กลุ่มประชากร</div>
          <div className="text-sm">
            เพศ: {aud?.gender || '-'} · อายุ: {(aud?.age_min ?? '')}{typeof aud?.age_max==='number'? `–${aud?.age_max}`:''}
          </div>
        </div>

        {/* Schedule */}
        <div className="card">
          <div className="font-medium mb-2">ตารางเวลา</div>
          <div className="grid gap-1 text-sm">
            {(sch||[]).map((r:any,i:number)=>(
              <div key={i}>• {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.day_of_week]} {r.start_minute}–{r.end_minute} นาที</div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="font-medium mb-2">บันทึก</div>
          <div className="text-sm whitespace-pre-wrap">{req?.notes || '—'}</div>
        </div>
      </div>

      {/* Sidebar: เฉพาะการดำเนินการ (ไม่มีคะแนน) */}
      <div className="grid gap-4">
        <div className="card">
          <div className="font-medium mb-2">การดำเนินการ</div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={()=>doAction('approve')}>Approve</button>
            <button className="btn" onClick={()=>doAction('ask_fix')}>Ask Fix</button>
            <button className="btn" onClick={()=>doAction('reject')}>Reject</button>
          </div>
          {!allowed && !loading && <div className="text-xs text-rose-600 mt-2">คุณไม่มีสิทธิ์รีวิวคำขอนี้</div>}
        </div>
      </div>
    </div>
  );
}
