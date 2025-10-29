// src/app/requests/new/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

/** ---------- Presets ---------- */
const FUNNELS = ['รับรู้ (Awareness)','พิจารณา (Consideration)','คอนเวอร์ชัน (Conversion)','ใช้ซ้ำ (Loyalty)','บอกต่อ (Advocacy)'] as const;
type FunnelLabel = typeof FUNNELS[number];
type Funnel = 'Awareness'|'Consideration'|'Conversion'|'Loyalty'|'Advocacy';
const funnelToKey = (label?: FunnelLabel): Funnel | undefined => {
  if (!label) return undefined;
  if (label.includes('Awareness')) return 'Awareness';
  if (label.includes('Consideration')) return 'Consideration';
  if (label.includes('Conversion')) return 'Conversion';
  if (label.includes('Loyalty')) return 'Loyalty';
  if (label.includes('Advocacy')) return 'Advocacy';
  return undefined;
};
const funnelDisplay = (f?: Funnel) =>
  f==='Awareness'?'รับรู้ (Awareness)':
  f==='Consideration'?'พิจารณา (Consideration)':
  f==='Conversion'?'คอนเวอร์ชัน (Conversion)':
  f==='Loyalty'?'ใช้ซ้ำ (Loyalty)':
  f==='Advocacy'?'บอกต่อ (Advocacy)':'-';

const OBJECTIVES: Record<Funnel, string[]> = {
  Awareness: ['Reach','Impressions','Video Views'],
  Consideration: ['Website Traffic','Engagement','Content Views'],
  Conversion: ['Leads','Sales'],
  Loyalty: ['Repeat Purchase','Reactivation','Retention'],
  Advocacy: ['Referral','Review/Rating','UGC'],
};

const KPI_ALLOWED: Record<Funnel, string[]> = {
  Awareness:    ['Impressions','Reach','ViewRate','CPM','OTHER'],
  Consideration:['CTR','Sessions','Pageviews','CPC','OTHER'],
  Conversion:   ['Leads','CPL','CPA','CR','ROAS','OTHER'],
  Loyalty:      ['RepeatRate','TimeToRepeat','OTHER'],
  Advocacy:     ['ReferralCount','ReviewVolume','OTHER'],
};

const KPI_RECOMMENDED: Record<string, string[]> = {
  Awareness: ['Impressions','CPM'],
  Consideration: ['CTR','Sessions'],
  'Conversion:Leads': ['Leads','CPL'],
  'Conversion:Sales': ['CPA','ROAS'],
  Loyalty: ['RepeatRate'],
  Advocacy: ['ReferralCount','ReviewVolume'],
};

const KPI_TOOLTIPS: Record<string, string> = {
  Impressions:'จำนวนครั้งที่แสดงโฆษณา (Impressions · รับรู้)',
  Reach:'จำนวนคนที่เห็นโฆษณา (Reach · รับรู้)',
  ViewRate:'อัตราการดูจบ/ดูต่อ (View Rate = Views ÷ Impressions · วิดีโอ)',
  CPM:'ค่าใช้จ่ายต่อ 1,000 impressions (CPM)',
  CTR:'อัตราคลิก (CTR = Clicks ÷ Impressions · พิจารณา)',
  Sessions:'จำนวนเซสชันเข้าเว็บ (Sessions · พิจารณา)',
  Pageviews:'จำนวนการดูหน้า (Pageviews · พิจารณา)',
  CPC:'ค่าใช้จ่ายต่อคลิก (CPC · พิจารณา)',
  Leads:'จำนวนลูกค้าเป้าหมาย (Leads · คอนเวอร์ชัน)',
  CPL:'ต้นทุนต่อหนึ่งลูกค้าเป้าหมาย',
  CPA:'ต้นทุนต่อคำสั่งซื้อ',
  CR:'อัตราการคอนเวอร์ชัน',
  ROAS:'ผลตอบแทนต่อโฆษณา',
  RepeatRate:'สัดส่วนลูกค้าที่ซื้อซ้ำ',
  TimeToRepeat:'เวลาเฉลี่ยกว่าจะซื้อซ้ำ',
  ReferralCount:'จำนวนการบอกต่อ/ชวนเพื่อน',
  ReviewVolume:'จำนวน/คะแนนรีวิว',
  OTHER:'กำหนด KPI เอง เช่น CTR/CVR/Bounce%',
};

// Units
type UnitCode = 'COUNT'|'PERCENT'|'BAHT'|'PER_DAY'|'PER_7D'|'PER_30D';
const UNITS: Record<string, UnitCode[]> = {
  Impressions:['COUNT','PER_7D','PER_30D','PER_DAY'],
  Reach:['COUNT','PER_7D','PER_30D','PER_DAY'],
  Sessions:['COUNT','PER_7D','PER_30D','PER_DAY'],
  Pageviews:['COUNT','PER_7D','PER_30D','PER_DAY'],
  CTR:['PERCENT'],
  ViewRate:['PERCENT'],
  CR:['PERCENT'],
  CPL:['BAHT'],
  CPC:['BAHT'],
  CPM:['BAHT'],
  CPA:['BAHT'],
  ROAS:['PERCENT'],
  RepeatRate:['PERCENT'],
  TimeToRepeat:['COUNT'],
  ReferralCount:['COUNT','PER_7D','PER_30D','PER_DAY'],
  ReviewVolume:['COUNT','PER_7D','PER_30D'],
  OTHER:['COUNT','PERCENT','BAHT','PER_DAY','PER_7D','PER_30D'],
};
const UNIT_LABEL: Record<UnitCode, string> = {
  COUNT:  'จำนวน (Count)',
  PERCENT:'เปอร์เซ็นต์ (%)',
  BAHT:   'บาท (THB)',
  PER_DAY:'ต่อวัน (per day)',
  PER_7D: 'ต่อ 7 วัน (per 7 d)',
  PER_30D:'ต่อ 30 วัน (per 30 d)',
};
function isUnitCode(u: unknown): u is UnitCode {
  return typeof u === 'string' &&
    (u === 'COUNT' || u === 'PERCENT' || u === 'BAHT' || u === 'PER_DAY' || u === 'PER_7D' || u === 'PER_30D');
}

// Labels TH
const KPI_LABEL_TH: Record<string,string> = {
  Impressions: 'Impressions (จำนวนครั้งแสดงผล)',
  Reach: 'Reach (จำนวนผู้เห็นโฆษณา)',
  ViewRate: 'View Rate (อัตราการรับชม)',
  CPM: 'CPM (บาท/1,000 impressions)',
  CTR: 'CTR (อัตราคลิก)',
  Sessions: 'Sessions (เซสชันเข้าเว็บ)',
  Pageviews: 'Pageviews (จำนวนการดูหน้า)',
  CPC: 'CPC (บาท/คลิก)',
  Leads: 'Leads (ลูกค้าเป้าหมาย)',
  CPL: 'CPL (บาท/ลีด)',
  CPA: 'CPA (บาท/ออเดอร์)',
  CR: 'CR (อัตราแปลง)',
  ROAS: 'ROAS (รายได้/งบโฆษณา)',
  RepeatRate: 'Repeat Rate (สัดส่วนซื้อซ้ำ)',
  TimeToRepeat: 'Time to Repeat (เวลาถึงการซื้อซ้ำ)',
  ReferralCount: 'Referral Count (จำนวนบอกต่อ)',
  ReviewVolume: 'Review Volume (รีวิว/คะแนน)',
  OTHER: 'KPI อื่น (กำหนดเอง เช่น CTR/CVR)',
};

// Operators
const OPERATORS: Record<string, Array<'>='|'<='|'='>> = {
  Impressions: ['>='],
  Reach: ['>='],
  ViewRate: ['>=', '<=', '='],
  CPM: ['<=', '=', '>='],
  CTR: ['>=', '<=', '='],
  Sessions: ['>='],
  Pageviews: ['>='],
  CPC: ['<=', '=', '>='],
  Leads: ['>='],
  CPL: ['<=', '=', '>='],
  CPA: ['<=', '=', '>='],
  CR: ['>=', '<=', '='],
  ROAS: ['>=', '<=', '='],
  RepeatRate: ['>=', '<=', '='],
  TimeToRepeat: ['<=', '=', '>='],
  ReferralCount: ['>='],
  ReviewVolume: ['>='],
  OTHER: ['>=', '<=', '='],
};

const LANG_PRESETS = ['Thai','English'] as const;
const PLATFORM_PRESETS = ['Search','Performance Max','Video'] as const;
const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const;
const THDAY: Record<string,string> = {Sun:'อา',Mon:'จ',Tue:'อ',Wed:'พ',Thu:'พฤ',Fri:'ศ',Sat:'ส'};
type BudgetUnit = 'PER_DAY'|'PER_MONTH'|'TOTAL_PROJECT';

/** ---------- Channels (NEW) ---------- */
type ChannelType = 'FACEBOOK'|'GOOGLE'|'TIKTOK'|'LINE'|'INSTAGRAM'|'X'|'OTHER';
type ChannelItem = { type: ChannelType; custom?: string };

const CHANNEL_UI: Array<{label:string; type: Exclude<ChannelType,'OTHER'>}> = [
  { label:'Facebook Ads', type:'FACEBOOK' },
  { label:'Google Ads',   type:'GOOGLE' },
  { label:'TikTok',       type:'TIKTOK' },
  { label:'LINE Ads',     type:'LINE' },
  { label:'Instagram',    type:'INSTAGRAM' },
  { label:'X',            type:'X' },
];
const typeToLabel = (t: ChannelType, custom?: string) =>
  t === 'FACEBOOK' ? 'Facebook Ads' :
  t === 'GOOGLE'   ? 'Google Ads' :
  t === 'TIKTOK'   ? 'TikTok' :
  t === 'LINE'     ? 'LINE Ads' :
  t === 'INSTAGRAM'? 'Instagram' :
  t === 'X'        ? 'X' :
  `OTHER: ${custom || ''}`;

/** ---------- Types ---------- */
type KpiRow = {
  type?: string;
  operator?: '>='|'<='|'=';
  value?: number;
  unit?: UnitCode;
  label?: string;     // เมื่อ OTHER
  method: string;     // วิธีวัด
};
type TimeRange = { day: (typeof DAYS)[number]; start: number; end: number };
type Gender = 'All'|'Male'|'Female';

type Form = {
  id?: string;
  status: 'draft'|'submitted';
  funnel?: Funnel;
  objective?: string;
  kpis: KpiRow[];
  /** ---------- Channels (NEW) ---------- */
  channels: ChannelItem[];
  newChannelCustom: string;

  platformPreset?: typeof PLATFORM_PRESETS[number] | null;
  platformCustom: string;
  campaignName: string;
  budgetValue?: number;
  budgetUnit?: BudgetUnit;
  projectStart: string | null;
  projectEnd: string | null;
  languages: string[];
  newLanguage: string;
  locations: string[];
  finalUrl: string;
  urlProtocol: 'http://'|'https://';
  urlRest: string;
  timeRanges: TimeRange[];
  scheduleNote: string;
  audienceGender: Gender;
  audienceAgeMin?: number;
  audienceAgeMax?: number;
  notes: string;
};

const initialForm: Form = {
  status: 'draft',
  funnel: undefined,
  objective: undefined,
  kpis: [{ method:'' } as KpiRow],
  /** ---------- Channels (NEW) ---------- */
  channels: [],
  newChannelCustom: '',

  platformPreset: null,
  platformCustom: '',
  campaignName: '',
  budgetValue: undefined,
  budgetUnit: undefined,
  projectStart: null,
  projectEnd: null,
  languages: ['Thai'],
  newLanguage: '',
  locations: ['กรุงเทพฯ'],
  finalUrl: '',
  urlProtocol: 'https://',
  urlRest: '',
  timeRanges: [
    { day:'Mon', start:8*60, end:16*60 },
    { day:'Tue', start:8*60, end:16*60 },
    { day:'Wed', start:8*60, end:16*60 },
    { day:'Thu', start:8*60, end:16*60 },
    { day:'Fri', start:8*60, end:16*60 },
    { day:'Sat', start:11*60, end:17*60 },
    { day:'Sun', start:11*60, end:17*60 },
  ],
  scheduleNote: '',
  audienceGender: 'All',
  audienceAgeMin: undefined,
  audienceAgeMax: undefined,
  notes: '',
};

/** ---------- Helpers ---------- */
const Card = ({title, subtitle, children}:{title:string; subtitle?:string; children:React.ReactNode}) => (
  <div className="card grid gap-3">
    <div>
      <div className="font-medium">{title}</div>
      {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
    </div>
    {children}
  </div>
);

function isHttpUrl(s:string){ try{const u=new URL(s);return u.protocol==='http:'||u.protocol==='https:';}catch{return false;} }
function mm(h:number,m:number){ return h*60+m; }
function hhmm(mins:number){ const h=Math.floor(mins/60), m=mins%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }

function allowedKpis(funnel?: Funnel, objective?: string){
  if(!funnel) return [];
  if(funnel==='Conversion' && objective==='Sales') return ['CPA','ROAS','CR','OTHER'];
  return KPI_ALLOWED[funnel];
}
function recommendedKpis(funnel?: Funnel, objective?: string){
  if(!funnel) return [];
  if(funnel==='Conversion' && objective==='Sales') return KPI_RECOMMENDED['Conversion:Sales'];
  if(funnel==='Conversion') return KPI_RECOMMENDED['Conversion:Leads'];
  return KPI_RECOMMENDED[funnel];
}
function isKpiValid(k:KpiRow, funnel?:Funnel, objective?:string){
  const allow = new Set(allowedKpis(funnel,objective));
  const nameOk = k.type && allow.has(k.type) && (k.type!=='OTHER' || (k.label && k.label.trim().length>=2));
  const opOk = !!k.operator;
  const valOk = typeof k.value==='number' && !Number.isNaN(k.value);
  const unitOk = !!k.unit;
  const methodOk = !!k.method && k.method.trim().length>=5;
  return Boolean(nameOk && opOk && valOk && unitOk && methodOk);
}
function calcProjectDays(start?: string|null, end?: string|null){
  if(!start || !end) return null;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const diff = Math.floor((e.getTime()-s.getTime())/(1000*60*60*24)) + 1;
  return diff>0 ? diff : null;
}
function validate(f:Form){
  const missing:string[]=[];
  if(!f.campaignName || f.campaignName.trim().length<3) missing.push('กรอกชื่อแคมเปญ');
  if(!f.funnel) missing.push('เลือกขั้นของฟันเนล (Funnel)');
  if(!f.objective) missing.push('เลือกวัตถุประสงค์ (Objective)');
  if(!f.kpis.some(k => isKpiValid(k, f.funnel, f.objective))) {
    missing.push('ต้องมี KPI อย่างน้อย 1 รายการที่สอดคล้อง พร้อมค่าเป้า/หน่วย/วิธีวัด');
  }
  /** ---------- Channels (NEW) ---------- */
  if(!f.channels.length) missing.push('เลือกช่องทางยิงแอดอย่างน้อย 1 ช่องทาง');

  if(!f.budgetUnit) missing.push('เลือกหน่วยงบประมาณ');
  if(!f.budgetValue || f.budgetValue<=0) missing.push('กรอกจำนวนงบประมาณ (>0)');
  if(!f.locations.filter(s=>s.trim()).length) missing.push('ระบุพื้นที่โฆษณาอย่างน้อย 1 บรรทัด');
  const fullUrl = f.urlRest ? `${f.urlProtocol}${f.urlRest.replace(/^\/*/,'')}` : '';
  if(!fullUrl || !isHttpUrl(fullUrl)) missing.push('ลิงก์ปลายทาง (Final URL) ไม่ถูกต้อง');

  const byDay:Record<string, TimeRange[]> = {};
  f.timeRanges.forEach(tr => { byDay[tr.day] ??= []; byDay[tr.day].push(tr); });
  Object.entries(byDay).forEach(([d,arr])=>{
    const sorted=[...arr].sort((a,b)=>a.start-b.start);
    for(let i=1;i<sorted.length;i++){
      if(sorted[i].start < sorted[i-1].end) missing.push(`ช่วงเวลา ${THDAY[d]} ซ้อนทับกัน`);
    }
  });

  if (typeof f.audienceAgeMin === 'number' && typeof f.audienceAgeMax === 'number' && f.audienceAgeMin > f.audienceAgeMax) {
    missing.push('อายุต่ำสุดต้องน้อยกว่าหรือเท่ากับอายุสูงสุด');
  }

  return {missing, fullUrl};
}
const platformToSave = (f: Form) => {
  const custom = f.platformCustom?.trim();
  return custom ? custom : (f.platformPreset ?? null);
};

/** ---------- Fields set (ตรงกับ schema จริง) ---------- */
const MAIN_FIELDS = `
  id, status, org_id, created_by, campaign_name, platform,
  funnel_stage, objective, budget_value, budget_unit,
  project_start_date, project_end_date, final_url,
  languages, locations, notes, created_at, submitted_at, request_code
`;

/** ---------- Page ---------- */
export default function NewRequest(){
  const router = useRouter();
  const search = useSearchParams();
  const editId = search.get('id') || undefined;

  const [f,setF] = useState<Form>(initialForm);
  const [orgId,setOrgId] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);       // init org + (optional) draft
  const [loadingDraft,setLoadingDraft] = useState(false);
  const [orgError,setOrgError] = useState<string|null>(null);

  const {missing, fullUrl} = useMemo(()=>validate(f),[f]);
  const ready = missing.length===0;

  const projectDays = useMemo(()=>calcProjectDays(f.projectStart, f.projectEnd),[f.projectStart,f.projectEnd]);
  const estTotalBudget = useMemo(()=>{
    if(!f.budgetValue || !f.budgetUnit) return undefined;
    if(f.budgetUnit==='TOTAL_PROJECT') return f.budgetValue;
    if(f.budgetUnit==='PER_DAY') return projectDays ? f.budgetValue * projectDays : undefined;
    if(f.budgetUnit==='PER_MONTH') return projectDays ? Math.ceil(projectDays/30) * f.budgetValue : undefined;
    return undefined;
  },[f.budgetValue,f.budgetUnit,projectDays]);

  // 1) เตรียม org + session
  useEffect(()=>{ (async()=>{
    setLoading(true);
    setOrgError(null);
    try {
      const { data:sessionRes } = await supabase.auth.getSession();
      if(!sessionRes.session){
        alert('กรุณาเข้าสู่ระบบก่อน');
        router.replace('/login');
        setLoading(false);
        return;
      }
      const { data:oid, error:err1 } = await supabase.rpc('join_default_org');
      if(err1) setOrgError(err1.message);
      const myOrg = oid || (await supabase.rpc('get_default_org_id')).data;
      if(myOrg) setOrgId(String(myOrg));
    } catch(e:any){
      setOrgError(e?.message || 'ไม่สามารถเตรียมข้อมูลองค์กรได้');
    } finally {
      setLoading(false);
    }
  })(); },[router]);

  // 2) ถ้ามี ?id= โหลดดราฟต์
  useEffect(()=>{ (async()=>{
    if(!editId) return;
    setLoadingDraft(true);
    try{
      // main
      const { data: req, error: e1 } = await supabase
        .from('ad_requests')
        .select(MAIN_FIELDS)
        .eq('id', editId)
        .single();
      if(e1) throw e1;
      if(!req) throw new Error('ไม่พบคำขอ');

      // url split
      let urlProtocol: 'http://'|'https://' = 'https://';
      let urlRest = '';
      if (req.final_url && typeof req.final_url === 'string') {
        try {
          const u = new URL(req.final_url);
          urlProtocol = (u.protocol === 'http:' ? 'http://' : 'https://');
          urlRest = (u.host + u.pathname + u.search + u.hash).replace(/^\/+/, '');
        } catch {
          urlRest = req.final_url.replace(/^https?:\/\//i,'');
        }
      }

      // kpis
      const { data: kpis } = await supabase
        .from('ad_request_kpis')
        .select('idx,type,operator,target,unit,label,method')
        .eq('request_id', editId)
        .order('idx', { ascending: true });

      const kpiRows: KpiRow[] = (kpis || []).map((r:any)=>({
        type: r.type ?? undefined,
        operator: r.operator ?? undefined,
        value: typeof r.target==='number' ? r.target : undefined,
        unit: r.unit ?? undefined,
        label: r.type==='OTHER' ? (r.label ?? '') : '',
        method: r.method ?? '',
      }));
      if(kpiRows.length===0){ kpiRows.push({method:''}); }

      // schedules
      const { data: sch } = await supabase
        .from('ad_request_schedules')
        .select('day_of_week,start_minute,end_minute')
        .eq('request_id', editId)
        .order('day_of_week', { ascending: true })
        .order('start_minute', { ascending: true });

      const dayMap = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const;
      const ranges: TimeRange[] = (sch || []).map((s:any)=>({
        day: dayMap[s.day_of_week as number],
        start: s.start_minute,
        end: s.end_minute,
      }));

      // audience
      const { data: aud } = await supabase
        .from('ad_request_audience')
        .select('gender,age_min,age_max,extras')
        .eq('request_id', editId)
        .maybeSingle();

      // แยก platform preset/custom
      let platformPreset: Form['platformPreset'] = null;
      let platformCustom = '';
      if (req.platform && PLATFORM_PRESETS.includes(req.platform)) {
        platformPreset = req.platform as Form['platformPreset'];
      } else {
        platformCustom = req.platform ?? '';
      }

      // ---------- Channels (load)
      const { data: ch } = await supabase
        .from('ad_request_channels')
        .select('channel_type, custom_name, idx')
        .eq('request_id', editId)
        .order('idx', { ascending: true });

      const channels: ChannelItem[] = (ch || []).map((r:any)=>({
        type: r.channel_type,
        custom: r.channel_type === 'OTHER' ? r.custom_name ?? '' : undefined
      }));

      setF({
        id: req.id,
        status: (req.status ?? 'draft'),
        funnel: req.funnel_stage ?? undefined,
        objective: req.objective ?? undefined,
        kpis: kpiRows,

        channels,
        newChannelCustom: '',

        platformPreset,
        platformCustom,
        campaignName: req.campaign_name ?? '',
        budgetValue: req.budget_value ?? undefined,
        budgetUnit: req.budget_unit ?? undefined,
        projectStart: req.project_start_date ?? null,
        projectEnd: req.project_end_date ?? null,
        languages: Array.isArray(req.languages) ? req.languages : (req.languages ?? []),
        newLanguage: '',
        locations: Array.isArray(req.locations) ? req.locations : (req.locations ?? []),
        finalUrl: req.final_url ?? '',
        urlProtocol,
        urlRest,
        timeRanges: ranges.length? ranges : initialForm.timeRanges,
        scheduleNote: '',
        audienceGender: (aud?.gender ?? 'All') as Gender,
        audienceAgeMin: typeof aud?.age_min === 'number' ? aud?.age_min : undefined,
        audienceAgeMax: typeof aud?.age_max === 'number' ? aud?.age_max : undefined,
        notes: req.notes ?? '',
      });
    }catch(err:any){
      console.error('load draft error:', err);
      alert('โหลดดราฟต์ไม่สำเร็จ: '+(err?.message ?? 'unknown'));
    }finally{
      setLoadingDraft(false);
    }
  })(); },[editId]);

  // URL preview
  useEffect(()=>{ setF(x=>({...x, finalUrl: f.urlRest? `${f.urlProtocol}${f.urlRest.replace(/^\/*/,'')}` : '' })); /* eslint-disable-next-line */},[f.urlProtocol,f.urlRest]);

  // ---------- KPI change helper ----------
  const setKpi = <K extends keyof KpiRow>(i:number, key:K, val:KpiRow[K])=>{
    setF(x=>{
      const k = {...x.kpis[i], [key]: val};
      if(key==='type' && typeof val==='string'){
        const ops = OPERATORS[val] || ['>='];
        const uts = UNITS[val] || ['COUNT'];
        k.operator = ops[0];
        k.unit = uts[0];
        if(val!=='OTHER'){ k.label=''; }
      }
      const kpis = x.kpis.map((r,idx)=> idx===i ? k : r);
      return {...x, kpis};
    });
  };
  const addKpiRow = () => setF(x=>({...x, kpis:[...x.kpis, { method:'' } as KpiRow]}));
  const removeKpiRow = (i:number) => setF(x=>({...x, kpis:x.kpis.filter((_,idx)=>idx!==i)}));

  // ---------- Channels helpers (NEW) ----------
  const toggleStdChannel = (t: Exclude<ChannelType,'OTHER'>) => {
    setF(x=>{
      const exists = x.channels.findIndex(c => c.type === t) >= 0;
      const next = exists
        ? x.channels.filter(c => c.type !== t)
        : [...x.channels, { type: t }];
      // set idx by order in array
      return {...x, channels: next};
    });
  };
  const addCustomChannel = () => {
    const name = f.newChannelCustom.trim();
    if(!name) return;
    // prevent duplicate OTHER with same name (case-insensitive)
    const dup = f.channels.some(c => c.type==='OTHER' && (c.custom||'').trim().toLowerCase() === name.toLowerCase());
    if(dup) { setF(x=>({...x, newChannelCustom:''})); return; }
    setF(x=>({...x, channels: [...x.channels, { type:'OTHER', custom: name }], newChannelCustom:'' }));
  };
  const removeChannelAt = (i:number) => setF(x=>({...x, channels: x.channels.filter((_,idx)=> idx!==i)}));
  const moveChannel = (i:number, dir:-1|1) => {
    setF(x=>{
      const arr = [...x.channels];
      const j = i + dir;
      if(j<0 || j>=arr.length) return x;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return {...x, channels: arr};
    });
  };

  // ---------- Time ranges ----------
  const addRange = (d:(typeof DAYS)[number]) => setF(x=>({...x, timeRanges:[...x.timeRanges, {day:d,start:9*60,end:18*60}]}));
  const setRange  = (i:number, patch:Partial<TimeRange>) => setF(x=>({...x, timeRanges:x.timeRanges.map((r,idx)=> idx===i? {...r, ...patch}: r)}));
  const removeRange = (i:number) => setF(x=>({...x, timeRanges:x.timeRanges.filter((_,idx)=>idx!==i)}));

  // ---------- Languages ----------
  const toggleLang = (v:string) =>
    setF(x=>({...x, languages: x.languages.includes(v) ? x.languages.filter(t=>t!==v) : [...x.languages, v]}));
  const addCustomLanguage = ()=>{
    const lang=f.newLanguage.trim();
    if(!lang) return;
    if(!f.languages.includes(lang)) setF(x=>({...x, languages:[...x.languages,lang], newLanguage:''}));
    else setF(x=>({...x, newLanguage:''}));
  };

  // Ensure org id before write
  const ensureOrgId = async () => {
    if (orgId) return orgId;
    const { data:oid } = await supabase.rpc('join_default_org');
    if(oid){ setOrgId(String(oid)); return String(oid); }
    const { data:gid } = await supabase.rpc('get_default_org_id');
    if(gid){ setOrgId(String(gid)); return String(gid); }
    throw new Error('ยังไม่พบองค์กรของคุณ');
  };

  // ✅ audience upsert
  const upsertAudience = async (requestId: string) => {
    const payload = {
      request_id: requestId,
      gender: f.audienceGender,
      age_min: typeof f.audienceAgeMin==='number' ? f.audienceAgeMin : null,
      age_max: typeof f.audienceAgeMax==='number' ? f.audienceAgeMax : null,
      extras: null as any, // เผื่ออนาคต (JSONB)
    };
    const { error } = await supabase
      .from('ad_request_audience')
      .upsert(payload, { onConflict: 'request_id' });
    if (error) throw new Error('บันทึกกลุ่มประชากรไม่สำเร็จ: ' + error.message);
  };

  // ✅ channels upsert (delete & insert with idx)
  const upsertChannels = async (requestId: string) => {
    // sanitize & unique (server sideก็กันซ้ำด้วย unique constraint แล้ว)
    const clean = f.channels
      .map(c => ({
        type: c.type,
        custom: c.type==='OTHER' ? (c.custom||'').trim() : null
      }))
      .filter(c => c.type !== 'OTHER' || (c.custom && c.custom.length>0));

    await supabase.from('ad_request_channels').delete().eq('request_id', requestId);
    if(!clean.length) return;

    const rows = clean.map((c, idx) => ({
      request_id: requestId,
      channel_type: c.type,
      custom_name: c.type==='OTHER' ? c.custom : null,
      idx
    }));
    const { error } = await supabase.from('ad_request_channels').insert(rows);
    if(error) throw new Error('บันทึกช่องทางยิงแอดไม่สำเร็จ: ' + error.message);
  };

  /** ---------- Save Draft ---------- */
  /** ---------- Save Draft ---------- */
const saveDraft = async ()=>{
  try{
    const oid = await ensureOrgId();
    const { data:auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if(!uid){ alert('กรุณาเข้าสู่ระบบใหม่'); router.replace('/login'); return; }

    const payload = {
      org_id: oid,
      created_by: uid,
      status: 'draft' as const,
      funnel_stage: f.funnel ?? null,
      objective: f.objective ?? null,
      platform: platformToSave(f),
      campaign_name: f.campaignName?.trim() || 'Untitled',
      budget_value: f.budgetValue ?? null,
      budget_unit: f.budgetUnit ?? null,
      project_start_date: f.projectStart,
      project_end_date: f.projectEnd,
      final_url: fullUrl || null,
      languages: f.languages,
      locations: f.locations,
      notes: f.notes || null,
    };

    // helper: บันทึก KPI เฉพาะที่ valid
    const saveKpis = async (requestId: string) => {
      const validKpis = f.kpis
        .filter(k => isKpiValid(k, f.funnel, f.objective))
        .map((k, idx) => ({
          request_id: requestId,
          idx,
          type: k.type,
          operator: k.operator,
          target: k.value,
          unit: k.unit,
          label: k.type==='OTHER' ? (k.label || null) : null,
          method: k.method,
          is_primary: idx === 0,
        }));
      await supabase.from('ad_request_kpis').delete().eq('request_id', requestId);
      if (validKpis.length) {
        const { error } = await supabase.from('ad_request_kpis').insert(validKpis);
        if (error) throw new Error('บันทึก KPI (draft) ไม่สำเร็จ: ' + error.message);
      }
    };

    if(!f.id){
      const { data, error } = await supabase
        .from('ad_requests')
        .insert(payload)
        .select('id')
        .single();
      if(error){ alert('บันทึกดราฟต์ไม่สำเร็จ: '+error.message); return; }
      const newId = data!.id as string;
      setF(x=>({...x, id: newId }));

      // บันทึก Channels & KPI ของ draft
      await upsertChannels(newId);
      await saveKpis(newId);

      await supabase.from('ad_request_events').insert({request_id:newId, actor: uid, event_type: 'save_draft'});
      alert('บันทึกดราฟต์แล้ว');
    }else{
      const { error } = await supabase
        .from('ad_requests')
        .update(payload)
        .eq('id', f.id);
      if(error){ alert('อัปเดตดราฟต์ไม่สำเร็จ: '+error.message); return; }

      await upsertChannels(f.id);
      await saveKpis(f.id); // ✅ บันทึก KPI ตอน draft ด้วย

      await supabase.from('ad_request_events').insert({request_id:f.id, actor: uid, event_type: 'save_draft'});
      alert('อัปเดตดราฟต์แล้ว');
    }
  }catch(e:any){
    if(e?.message?.toLowerCase?.().includes('unauthenticated')){
      alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      router.replace('/login');
      return;
    }
    alert('เกิดข้อผิดพลาด: '+(e?.message||'saveDraft failed'));
    console.error('saveDraft failed:', e);
  }
};


  /** ---------- Submit ---------- */
  const submit = async ()=>{
    try{
      if(!ready){ window.scrollTo({top:0, behavior:'smooth'}); return; }

      const oid = await ensureOrgId();
      const { data:auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if(!uid){ alert('กรุณาเข้าสู่ระบบใหม่'); router.replace('/login'); return; }

      // 1) upsert แถวหลักเป็น submitted
      let requestId = f.id;
      const mainPayload = {
        org_id: oid,
        created_by: uid,
        status: 'submitted' as const,
        funnel_stage: f.funnel,
        objective: f.objective,
        platform: platformToSave(f),
        campaign_name: f.campaignName?.trim() || 'Untitled',
        budget_value: f.budgetValue ?? null,
        budget_unit: f.budgetUnit ?? null,
        project_start_date: f.projectStart,
        project_end_date: f.projectEnd,
        final_url: fullUrl || null,
        languages: f.languages,
        locations: f.locations,
        notes: f.notes || null,
        submitted_at: new Date().toISOString(),
      };

      if(!requestId){
        const { data, error } = await supabase
          .from('ad_requests')
          .insert(mainPayload)
          .select('id')
          .single();
        if(error){ alert('บันทึกไม่สำเร็จ: '+error.message); return; }
        requestId = data!.id as string;
        setF(x=>({...x, id: requestId!}));
      }else{
        const { error } = await supabase
          .from('ad_requests')
          .update(mainPayload)
          .eq('id', requestId);
        if(error){ alert('อัปเดตคำขอไม่สำเร็จ: '+error.message); return; }
      }

      // 2) KPI — เฉพาะที่ valid
      const validKpis = f.kpis
        .filter(k => isKpiValid(k, f.funnel, f.objective))
        .map((k, idx) => ({
          request_id: requestId!,
          idx,
          type: k.type,
          operator: k.operator,
          target: k.value,
          unit: k.unit,
          label: k.type==='OTHER' ? (k.label || null) : null,
          method: k.method,
          is_primary: idx === 0,
        }));

      await supabase.from('ad_request_kpis').delete().eq('request_id', requestId!);
      if(validKpis.length === 0){
        alert('ต้องมี KPI อย่างน้อย 1 รายการที่ครบถ้วน');
        window.scrollTo({top:0, behavior:'smooth'});
        return;
      }
      {
        const { error } = await supabase.from('ad_request_kpis').insert(validKpis);
        if(error){ alert('บันทึก KPI ไม่สำเร็จ: '+error.message); return; }
      }

      // 3) Schedules — เขียนตามฟอร์ม
      await supabase.from('ad_request_schedules').delete().eq('request_id', requestId!);
      const schPayload = f.timeRanges.map(r=>({
        request_id: requestId!,
        day_of_week: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(r.day),
        start_minute: r.start,
        end_minute: r.end,
      }));
      if(schPayload.length){
        const { error } = await supabase.from('ad_request_schedules').insert(schPayload);
        if(error){ alert('บันทึกตารางเวลาไม่สำเร็จ: '+error.message); return; }
      }

      // 4) Audience — upsert
      await upsertAudience(requestId!);

      // 5) Channels — upsert (สำคัญ)
      await upsertChannels(requestId!);

      // 6) Event แล้วพาไปหน้า Summary
      await supabase.from('ad_request_events').insert({request_id: requestId!, actor: uid, event_type: 'submitted'});
      router.replace(`/requests/${requestId}/summary`);
    }catch(e:any){
      if(e?.message?.toLowerCase?.().includes('unauthenticated')){
        alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
        router.replace('/login');
        return;
      }
      alert('เกิดข้อผิดพลาด: '+(e?.message||'submit failed'));
      console.error('submit failed:', e);
    }
  };

  const allowedObj = f.funnel ? OBJECTIVES[f.funnel] : [];
  const allowedKpiList = allowedKpis(f.funnel, f.objective);
  const recKpi = recommendedKpis(f.funnel, f.objective);
  const actionDisabled = loading || !orgId;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      {/* LEFT */}
      <div className="grid gap-4">
        {(loadingDraft || (editId && !f.id)) && (
          <div className="card bg-slate-50 text-slate-600">กำลังโหลดดราฟต์…</div>
        )}

        {/* ชื่อแคมเปญ */}
        <Card title={`ชื่อแคมเปญ (Campaign name) ${f.id ? '· แก้ไข #' + f.id : ''}`}>
          <div className="flex items-center gap-2">
            <input
              className={`border rounded-xl px-3 py-2 w-full ${(!f.campaignName || f.campaignName.trim().length<3)?'border-rose-400':''}`}
              placeholder="เปิดสาขาใหม่ คาเฟ่ลาดพร้าว · ต.ค. 2025"
              value={f.campaignName}
              onChange={e=>setF(x=>({...x, campaignName:e.target.value}))}
              disabled={actionDisabled}
            />
            <button className="btn" onClick={saveDraft} disabled={actionDisabled}>
              {loading ? 'กำลังเตรียม…' : 'บันทึกเป็นฉบับร่าง'}
            </button>
          </div>
          {orgError && <div className="text-xs text-rose-600 mt-1">เตือน: {orgError}</div>}
          {!loading && !orgId && <div className="text-xs text-rose-600 mt-1">ไม่พบองค์กรของคุณ ลองเข้าสู่ระบบใหม่</div>}
        </Card>

        {/* Funnel */}
        <Card title="ขั้นของฟันเนล (Funnel)">
          <div className="flex flex-wrap gap-2">
            {FUNNELS.map(lbl=>(
              <button
                key={lbl}
                className={`badge ${funnelToKey(lbl)===f.funnel?'bg-emerald-600 text-white border-emerald-700':''}`}
                onClick={()=>setF(x=>({...x, funnel: funnelToKey(lbl) }))}
                disabled={actionDisabled}
              >
                {lbl}
              </button>
            ))}
          </div>
        </Card>

        {/* Objective */}
        <Card title="วัตถุประสงค์ (Objective) · แนะนำตาม Funnel">
          {!f.funnel ? <div className="text-sm text-slate-500">เลือก Funnel ก่อน</div> : (
            <>
              <div className="text-xs text-slate-600 mb-2">
                แนะนำ:{' '}
                {(f.funnel ? OBJECTIVES[f.funnel] : []).slice(0, 2).map((o: string) => (
                  <span key={o} className="badge ml-1">
                    {o === 'UGC' ? 'UGC (คอนเทนต์จากผู้ใช้)' : o}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {allowedObj.map((o: string) => (
                  <button
                    key={o}
                    className={`badge ${f.objective === o ? 'bg-emerald-600 text-white border-emerald-700' : ''}`}
                    onClick={() => setF((x) => ({ ...x, objective: o }))}
                    disabled={actionDisabled}
                  >
                    {o === 'UGC' ? 'UGC (คอนเทนต์จากผู้ใช้)' : o}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* KPI */}
        <Card
          title="ตัววัดผล & วิธีวัดผล (KPI & Measurement) · เลือกได้หลายตัว"
          subtitle="ต้องมี KPI อย่างน้อย 1 รายการที่สอดคล้องกับ Funnel/Objective"
        >
          {(!f.funnel || !f.objective) ? (
            <div className="text-sm text-slate-500">เลือก Funnel และ Objective ก่อน</div>
          ):(
            <>
              <div className="text-xs text-slate-600 mb-2">
                KPI แนะนำ: {recKpi.map(k=><span key={k} className="badge ml-1">{KPI_LABEL_TH[k] ?? k}</span>)}
              </div>
              <div className="grid gap-3">
                {f.kpis.map((k, i) => {
                  const notAllowed = !!k.type && !allowedKpiList.includes(k.type);
                  const ops = k.type ? (OPERATORS[k.type] || ['>=']) : ['>='];
                  const units: UnitCode[] = k.type ? (UNITS[k.type] || (['COUNT'] as UnitCode[])) : (['COUNT'] as UnitCode[]);

                  return (
                    <div key={i} className="grid gap-2 border rounded-xl p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="border rounded-xl px-2 py-2"
                          value={k.type ?? ''}
                          onChange={(e)=> setKpi(i,'type', e.target.value)}
                          title={k.type? KPI_TOOLTIPS[k.type] : ''}
                          disabled={actionDisabled}
                        >
                          <option value="">-- เลือก KPI --</option>
                          {allowedKpiList.map(t => <option key={t} value={t}>{KPI_LABEL_TH[t] ?? t}</option>)}
                        </select>

                        {k.type==='OTHER' && (
                          <input
                            className={`border rounded-xl px-3 py-2 w-56 ${(!k.label || k.label.trim().length<2)?'border-rose-400':''}`}
                            placeholder="ชื่อ KPI อื่น เช่น CTR/CVR/Bounce%"
                            value={k.label || ''}
                            onChange={e=> setKpi(i,'label', e.target.value)}
                            disabled={actionDisabled}
                          />
                        )}

                        <select
                          className="border rounded-xl px-2 py-2"
                          value={k.operator ?? ''}
                          onChange={(e)=> setKpi(i,'operator', e.target.value as any)}
                          disabled={actionDisabled}
                        >
                          {ops.map(o=> <option key={o} value={o}>{o}</option>)}
                        </select>

                        <input
                          inputMode="decimal"
                          className={`border rounded-xl px-3 py-2 w-32 ${(typeof k.value!=='number')?'border-rose-400':''}`}
                          placeholder={k.type==='CPL'?'เช่น 60':'เช่น 2.5'}
                          value={(k.value ?? '').toString()}
                          onChange={(e)=> setKpi(i,'value', Number((e.target.value||'').replace(/[^\d.]/g,'')))}
                          disabled={actionDisabled}
                        />

                        <select
                          className="border rounded-xl px-2 py-2"
                          value={k.unit ?? ''}
                          onChange={(e)=> setKpi(i,'unit', e.target.value as UnitCode)}
                          disabled={actionDisabled}
                        >
                          {units.map((u: UnitCode)=> <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
                        </select>

                        {f.kpis.length>1 && (
                          <button className="btn" onClick={()=>removeKpiRow(i)} disabled={actionDisabled}>ลบ</button>
                        )}
                      </div>

                      <textarea
                        className={`border rounded-xl p-2 w-full min-h-[70px] ${(!k.method || k.method.trim().length<5)?'border-rose-400':''}`}
                        placeholder={
                          f.funnel==='Conversion'
                            ? (f.objective==='Sales'
                                ? 'ตัวอย่าง: CPA/ROAS จาก GA4 event: purchase · attribution 30 วัน'
                                : 'ตัวอย่าง: CPL = Spend ÷ GA4 event: lead_submit · 30 วัน')
                            : f.funnel==='Awareness'
                                ? 'ตัวอย่าง: CPM = ค่าโฆษณา / (Impressions/1000) · 7–30 วัน'
                                : f.funnel==='Consideration'
                                    ? 'ตัวอย่าง: CTR = Clicks ÷ Impressions; Sessions จาก GA4'
                                    : f.funnel==='Loyalty'
                                        ? 'ตัวอย่าง: Repeat Rate = ลูกค้าซื้อซ้ำ ÷ ลูกค้าทั้งหมด'
                                        : 'ตัวอย่าง: Referral Count จากฟอร์มชวนเพื่อน / รีวิวแพลตฟอร์ม'
                        }
                        value={k.method}
                        onChange={e=> setKpi(i,'method', e.target.value)}
                        disabled={actionDisabled}
                      />

                      {notAllowed && <div className="text-rose-600 text-xs">KPI นี้ไม่สอดคล้องกับ Funnel/Objective — แนะนำ: {recKpi.map(s=>KPI_LABEL_TH[s] ?? s).join(', ')}</div>}
                      {!isKpiValid(k, f.funnel, f.objective) && (
                        <div className="text-rose-600 text-xs">KPI แถวนี้ยังไม่ครบ/ไม่สอดคล้อง (ต้องระบุชนิด, ตัวดำเนินการ, ค่าเป้า, หน่วย และวิธีวัด)</div>
                      )}
                    </div>
                  );
                })}
                <button className="btn btn-primary w-fit" onClick={addKpiRow} disabled={actionDisabled}>+ เพิ่ม KPI</button>
              </div>
            </>
          )}
        </Card>

        {/* ---------- Ad Channels (NEW) ---------- */}
        <Card
          title="ช่องทางยิงแอด (Ad Channels) · เลือกได้หลายช่องทาง"
          subtitle="เลือกแพลตฟอร์มที่จะใช้ยิงแอด สามารถเพิ่มช่องทางอื่น ๆ ได้"
        >
          <div className="flex flex-wrap gap-2 mb-2">
            {CHANNEL_UI.map(ch => {
              const active = f.channels.some(c => c.type === ch.type);
              return (
                <button
                  key={ch.type}
                  className={`badge ${active ? 'bg-emerald-600 text-white border-emerald-700' : ''}`}
                  onClick={()=>toggleStdChannel(ch.type)}
                  disabled={actionDisabled}
                >
                  {ch.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              className="border rounded-xl px-3 py-2 w-80"
              placeholder="เพิ่มช่องทางอื่น ๆ (เช่น Shopee Ads, JD Central, AdNetwork ฯลฯ)"
              value={f.newChannelCustom}
              onChange={e=> setF(x=>({...x, newChannelCustom:e.target.value}))}
              onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addCustomChannel(); } }}
              disabled={actionDisabled}
            />
            <button className="btn" onClick={addCustomChannel} disabled={actionDisabled}>เพิ่ม</button>
          </div>

          {f.channels.length>0 && (
            <div className="grid gap-2 mt-3">
              {f.channels.map((c, i)=>(
                <div key={i} className="flex items-center gap-2 border rounded-xl px-3 py-2">
                  <div className="text-sm flex-1">
                    {typeToLabel(c.type, c.custom)}
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn" onClick={()=>moveChannel(i,-1)} disabled={actionDisabled || i===0}>↑</button>
                    <button className="btn" onClick={()=>moveChannel(i, 1)} disabled={actionDisabled || i===f.channels.length-1}>↓</button>
                    <button className="btn" onClick={()=>removeChannelAt(i)} disabled={actionDisabled}>ลบ</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {f.channels.length===0 && (
            <div className="text-xs text-rose-600 mt-2">โปรดเลือกอย่างน้อย 1 ช่องทาง</div>
          )}
        </Card>

        {/* Platform */}
        <Card title="ชนิดแคมเปญ (Platform)">
          <div className="flex flex-wrap gap-2 mb-2">
            {PLATFORM_PRESETS.map(p=>(
              <button
                key={p}
                className={`badge ${f.platformPreset===p && !f.platformCustom.trim() ? 'bg-emerald-600 text-white border-emerald-700':''}`}
                onClick={()=>setF(x=>({...x, platformPreset:p, platformCustom:''}))}
                disabled={actionDisabled}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="border rounded-xl px-3 py-2 w-full"
              placeholder="ระบุชนิดอื่น ๆ (เช่น Discovery / Demand Gen / Display / Shopping ฯลฯ)"
              value={f.platformCustom}
              onChange={e=> setF(x=>({...x, platformCustom:e.target.value}))}
              disabled={actionDisabled}
            />
          </div>
          <div className="text-xs text-slate-500">ถ้ากรอกช่องนี้ ระบบจะใช้ค่านี้แทนตัวเลือกด้านบน</div>
        </Card>

        {/* Audience — ต่อจาก Platform */}
        <Card title="กลุ่มประชากร (Audience · เพศ/อายุ)">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm w-16">เพศ</label>
            <select
              className="border rounded-xl px-2 py-2"
              value={f.audienceGender}
              onChange={e=> setF(x=>({...x, audienceGender: e.target.value as Gender}))}
              disabled={actionDisabled}
            >
              <option value="All">ทั้งหมด</option>
              <option value="Male">ผู้ชาย</option>
              <option value="Female">ผู้หญิง</option>
            </select>

            <label className="text-sm w-20">อายุต่ำสุด</label>
            <input
              inputMode="numeric"
              className="border rounded-xl px-3 py-2 w-24"
              placeholder="เช่น 18"
              value={typeof f.audienceAgeMin==='number'? f.audienceAgeMin : ''}
              onChange={e=> setF(x=>({...x, audienceAgeMin: Number((e.target.value||'').replace(/[^\d]/g,'')) || undefined }))}
              disabled={actionDisabled}
            />

            <label className="text-sm w-20">อายุสูงสุด</label>
            <input
              inputMode="numeric"
              className="border rounded-xl px-3 py-2 w-24"
              placeholder="เช่น 45"
              value={typeof f.audienceAgeMax==='number'? f.audienceAgeMax : ''}
              onChange={e=> setF(x=>({...x, audienceAgeMax: Number((e.target.value||'').replace(/[^\d]/g,'')) || undefined }))}
              disabled={actionDisabled}
            />
          </div>
          <div className="text-xs text-slate-500">* ถ้าไม่ระบุอายุ ระบบจะถือว่า “ไม่กำหนดช่วงอายุ”</div>
        </Card>

        {/* Budget */}
        <Card title="งบประมาณโครงการ (Budget)">
          <div className="flex flex-wrap items-center gap-2">
            <input
              inputMode="numeric"
              className={`border rounded-xl px-3 py-2 w-48 ${(!f.budgetValue || f.budgetValue<=0)?'border-rose-400':''}`}
              placeholder={f.budgetUnit==='PER_MONTH'?'เช่น 30,000': f.budgetUnit==='TOTAL_PROJECT'?'เช่น 50,000':'เช่น 1,000'}
              value={f.budgetValue ?? ''}
              onChange={e=> setF(x=>({...x, budgetValue: Number((e.target.value||'').replace(/[^\d]/g,'')) || undefined }))}
              disabled={actionDisabled}
            />
            <select
              className={`border rounded-xl px-2 py-2 ${!f.budgetUnit?'border-rose-400':''}`}
              value={f.budgetUnit ?? ''}
              onChange={e=> setF(x=>({...x, budgetUnit: e.target.value as BudgetUnit}))}
              disabled={actionDisabled}
            >
              <option value="">-- เลือกหน่วยงบ --</option>
              <option value="PER_DAY">ต่อวัน</option>
              <option value="PER_MONTH">ต่อเดือน</option>
              <option value="TOTAL_PROJECT">ทั้งโครงการ</option>
            </select>
            {typeof estTotalBudget==='number' && (
              <div className="text-xs text-slate-600">
                ประมาณการรวม: ฿{estTotalBudget.toLocaleString('th-TH')}
                {projectDays ? ` (จากช่วงโครงการ ${projectDays} วัน)` : ''}
              </div>
            )}
          </div>
        </Card>

        {/* Project dates */}
        <Card title="ช่วงเวลาโครงการ (Project Dates)">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm w-20">เริ่ม</label>
            <input type="date" className="border rounded-xl px-3 py-2" value={f.projectStart ?? ''} onChange={e=>setF(x=>({...x, projectStart: e.target.value || null}))} disabled={actionDisabled}/>
            <label className="text-sm w-20">สิ้นสุด</label>
            <input type="date" className="border rounded-xl px-3 py-2" value={f.projectEnd ?? ''} onChange={e=>setF(x=>({...x, projectEnd: e.target.value || null}))} disabled={actionDisabled}/>
            {projectDays && <div className="text-xs text-slate-600">รวม {projectDays} วัน</div>}
          </div>
        </Card>

        {/* Locations */}
        <Card title="พื้นที่โฆษณา (Locations) · เพิ่ม/ลบได้">
          <div className="grid gap-2">
            {f.locations.map((loc,i)=>(
              <div key={i} className="flex items-center gap-2">
                <input
                  className={`border rounded-xl px-3 py-2 flex-1 ${!loc.trim()?'border-rose-400':''}`}
                  placeholder="เช่น กรุงเทพฯ, เชียงใหม่"
                  value={loc}
                  onChange={e=> setF(x=>({...x, locations: x.locations.map((s,idx)=> idx===i? e.target.value : s)}))}
                  disabled={actionDisabled}
                />
                <button className="btn" onClick={()=> setF(x=>({...x, locations:x.locations.filter((_,idx)=>idx!==i)}))} disabled={actionDisabled}>ลบ</button>
              </div>
            ))}
            <button className="btn btn-primary w-fit" onClick={()=> setF(x=>({...x, locations:[...x.locations, '']}))} disabled={actionDisabled}>+ เพิ่มพื้นที่</button>
          </div>
        </Card>

        {/* Languages */}
        <Card title="ภาษา (Languages)">
          <div className="flex flex-wrap gap-2">
            {(['Thai','English'] as const).map(l=>(
              <button
                key={l}
                className={`badge ${f.languages.includes(l)?'bg-emerald-600 text-white border-emerald-700':''}`}
                onClick={()=>toggleLang(l)}
                disabled={actionDisabled}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              className="border rounded-xl px-3 py-2 w-64"
              placeholder="เพิ่มภาษาอื่น เช่น Chinese, Japanese"
              value={f.newLanguage}
              onChange={e=>setF(x=>({...x, newLanguage:e.target.value}))}
              onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); /* eslint-disable-next-line */ addCustomLanguage(); } }}
              disabled={actionDisabled}
            />
            <button className="btn" onClick={addCustomLanguage} disabled={actionDisabled}>เพิ่มภาษา</button>
          </div>
        </Card>

        {/* Final URL */}
        <Card title="ลิงก์ปลายทาง (Final URL) · หน้า Landing Page">
          <div className="flex items-center gap-2">
            <select className="border rounded-xl px-2 py-2" value={f.urlProtocol} onChange={e=> setF(x=>({...x, urlProtocol: e.target.value as any}))} disabled={actionDisabled}>
              <option value="https://">https://</option>
              <option value="http://">http://</option>
            </select>
            <input
              className={`border rounded-xl px-3 py-2 flex-1 ${(!f.finalUrl || !isHttpUrl(f.finalUrl))?'border-rose-400':''}`}
              placeholder="examplecafe.com/reservation"
              value={f.urlRest}
              onChange={e=> setF(x=>({...x, urlRest:e.target.value}))}
              disabled={actionDisabled}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1">ตัวอย่าง: {f.urlProtocol}{f.urlRest||'examplecafe.com/reservation'}</div>
        </Card>

        {/* Schedule */}
        <Card title="ตารางเวลาโฆษณา (Ad schedule) · หลายช่วง/วัน" subtitle="ตั้งช่วงเวลาแตกต่างระหว่างวันทำงาน/วันหยุดได้">
          <div className="grid gap-2">
            {f.timeRanges.map((r,i)=>(
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select className="border rounded-xl px-2 py-2" value={r.day} onChange={e=> setRange(i,{day: e.target.value as any})} disabled={actionDisabled}>
                  {DAYS.map(d=> <option key={d} value={d}>{THDAY[d]} ({d})</option>)}
                </select>
                <label className="text-sm">เริ่ม</label>
                <input type="time" className="border rounded-xl px-2 py-2" value={hhmm(r.start)}
                       onChange={e=>{ const [h,m]=e.target.value.split(':').map(Number); setRange(i,{start:mm(h,m)})}}
                       disabled={actionDisabled}
                />
                <label className="text-sm">จบ</label>
                <input type="time" className="border rounded-xl px-2 py-2" value={hhmm(r.end)}
                       onChange={e=>{ const [h,m]=e.target.value.split(':').map(Number); setRange(i,{end:mm(h,m)})}}
                       disabled={actionDisabled}
                />
                <button className="btn" onClick={()=> removeRange(i)} disabled={actionDisabled}>ลบช่วง</button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <select className="border rounded-xl px-2 py-2" onChange={(e)=> addRange(e.target.value as any)} defaultValue="" disabled={actionDisabled}>
                <option value="" disabled>+ เพิ่มช่วงเวลา (เลือกวัน)</option>
                {DAYS.map(d=> <option key={d} value={d}>{THDAY[d]} ({d})</option>)}
              </select>
              <div className="text-xs text-slate-500">หลีกเลี่ยงช่วงเวลาซ้อนทับ ระบบจะเตือน</div>
            </div>
            <input
              className="border rounded-xl px-3 py-2"
              placeholder="กำหนดเอง (เช่น เปิดตลอด 24/7 เฉพาะเทศกาล)"
              value={f.scheduleNote}
              onChange={e=> setF(x=>({...x, scheduleNote:e.target.value}))}
              disabled={actionDisabled}
            />
          </div>
        </Card>

        {/* Notes */}
        <Card title="บันทึก/หมายเหตุ (Notes)">
          <textarea
            className="border rounded-xl p-3 w-full min-h-[100px]"
            placeholder="พิมพ์โน้ตเพิ่มเติม เช่น เงื่อนไขโปรโมชัน, UGC ที่ต้องการ ฯลฯ"
            value={f.notes}
            onChange={e=> setF(x=>({...x, notes: e.target.value}))}
            disabled={actionDisabled}
          />
        </Card>

        {/* CTAs */}
        <div className="flex flex-wrap gap-2 sticky bottom-4">
          <button className="btn" onClick={saveDraft} disabled={actionDisabled}>
            {loading ? 'กำลังเตรียม…' : 'บันทึกเป็นฉบับร่าง'}
          </button>
          <button
            className={`btn btn-primary ${(!ready || actionDisabled)?'opacity-60 cursor-not-allowed':''}`}
            onClick={submit}
            disabled={!ready || actionDisabled}
          >
            ตรวจทาน & ส่งอนุมัติ
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div className="grid gap-4">
        <div className="card">
          <div className="font-medium mb-2">Checklist ความครบถ้วน</div>
          {missing.length===0 ? <div className="text-emerald-700 text-sm">ครบถ้วน พร้อมส่ง ✅</div> : (
            <ul className="list-disc pl-5 text-sm">{missing.map((m,i)=><li key={i} className="text-rose-600">{m}</li>)}</ul>
          )}
          {f.funnel && f.objective && (
            <div className="text-xs text-slate-600 mt-2">
              KPI ที่อนุญาต: {allowedKpiList.map(s=>KPI_LABEL_TH[s] ?? s).join(', ')} · แนะนำ: {recKpi.map(s=>KPI_LABEL_TH[s] ?? s).join(', ')}
            </div>
          )}
          <div className="text-xs text-slate-600 mt-2">
            Channels: {f.channels.length ? f.channels.map(c=>typeToLabel(c.type,c.custom)).join(', ') : '-'}
          </div>
          {loading && <div className="text-xs text-slate-500 mt-2">กำลังเตรียมองค์กร…</div>}
          {!loading && !orgId && <div className="text-xs text-rose-600 mt-2">ยังไม่พบองค์กรสำหรับผู้ใช้</div>}
        </div>

        <div className="card">
          <div className="font-medium mb-2">สรุปแบบย่อ</div>
          <div className="text-xs grid gap-1 text-slate-700">
            <div>Funnel: {funnelDisplay(f.funnel)}</div>
            <div>Objective: {f.objective==='UGC'?'UGC (คอนเทนต์จากผู้ใช้)':(f.objective ?? '-')}</div>
            <div>Platform: {platformToSave(f) ?? '-'}</div>
            <div>Channels: {f.channels.length ? f.channels.map(c=>typeToLabel(c.type,c.custom)).join(', ') : '-'}</div>
            <div>Campaign: {f.campaignName || '-'}</div>
            <div>Budget: {f.budgetValue?`฿${f.budgetValue.toLocaleString('th-TH')} ${f.budgetUnit==='PER_DAY'?'ต่อวัน':f.budgetUnit==='PER_MONTH'?'ต่อเดือน':f.budgetUnit==='TOTAL_PROJECT'?'ต่อโครงการ':''}`:'-'}</div>
            <div>Project: {(f.projectStart||'-')+' → '+(f.projectEnd||'-')}{projectDays?` (${projectDays} วัน)`:''}</div>
            <div>Locations: {f.locations.filter(Boolean).join(', ')||'-'}</div>
            <div>Languages: {f.languages.join(', ')||'-'}</div>
            <div>Final URL: {fullUrl||'-'}</div>
            <div>Audience: เพศ {f.audienceGender==='All'?'ทั้งหมด':(f.audienceGender==='Male'?'ผู้ชาย':'ผู้หญิง')}
              {typeof f.audienceAgeMin==='number' || typeof f.audienceAgeMax==='number'
                ? ` · อายุ${typeof f.audienceAgeMin==='number'?` ${f.audienceAgeMin}`:''}${typeof f.audienceAgeMax==='number'?`–${f.audienceAgeMax}`:''} ปี`
                : ' · อายุ: ไม่กำหนด'
              }
            </div>
            <div>Time ranges: {f.timeRanges.length} ช่วง</div>
          </div>
        </div>
      </div>
    </div>
  );
}
