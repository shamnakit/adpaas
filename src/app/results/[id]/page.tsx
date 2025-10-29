// src/app/results/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // ปรับ path ให้ตรงโปรเจกต์คุณ
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

type Funnel = 'Awareness'|'Consideration'|'Conversion'|'Loyalty'|'Advocacy';

type KpiType =
  | 'Impressions' | 'Reach' | 'ViewRate' | 'CPM' | 'CTR'
  | 'Sessions' | 'Pageviews' | 'CPC'
  | 'Leads' | 'CPL' | 'CPA' | 'CR' | 'ROAS'
  | 'RepeatRate' | 'TimeToRepeat' | 'ReferralCount' | 'ReviewVolume'
  | 'OTHER';

type KpiRow = {
  type: KpiType;
  operator: '>='|'<='|'=';
  target: number | null;
  unit: 'COUNT'|'PERCENT'|'BAHT'|'PER_DAY'|'PER_7D'|'PER_30D'|'OTHER'|string;
  label: string | null;
  method: string | null;
  idx: number | null; // ใช้ดู KPI หลัก (idx=0)
};

type ApprovedRow = {
  id: string;
  campaign_name: string | null;
  funnel_stage: Funnel | null;
  objective: string | null;
  budget_daily: number | null;
  approved_at: string | null; // ISO
  ad_request_kpis: KpiRow[];
};

const FUNNELS: Funnel[] = ['Awareness','Consideration','Conversion','Loyalty','Advocacy'];

function fmtBaht(n?: number | null) {
  if (n == null) return '-';
  return n.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 });
}
function fmtNum(n?: number | null) {
  if (n == null) return '-';
  return n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}
function fmtDate(d?: string | null) {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return dt.toLocaleString('th-TH', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return d; }
}

export default function ResultsPage() {
  const [rows, setRows] = useState<ApprovedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ฟิลเตอร์
  const [q, setQ] = useState('');
  const [funnel, setFunnel] = useState<''|Funnel>('');
  const [dateFrom, setDateFrom] = useState<string>(''); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>('');     // yyyy-mm-dd

  // ดึงเฉพาะคำขอที่อนุมัติแล้ว
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from('ad_requests')
          .select(`
            id,
            campaign_name,
            funnel_stage,
            objective,
            budget_daily,
            approved_at,
            ad_request_kpis (
              type, operator, target, unit, label, method, idx
            )
          `)
          .eq('status', 'approved')
          .order('approved_at', { ascending: false });

        if (error) throw error;
        setRows((data ?? []) as unknown as ApprovedRow[]);
      } catch (e: any) {
        setErr(e?.message ?? 'โหลดข้อมูลล้มเหลว');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // apply filters ฝั่ง client (พอสำหรับ v2)
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (funnel && r.funnel_stage !== funnel) return false;
      if (q) {
        const needle = q.toLowerCase();
        const hay = [
          r.campaign_name ?? '',
          r.objective ?? '',
          r.funnel_stage ?? '',
          ...(r.ad_request_kpis?.map(k => k.label ?? k.type) ?? []),
        ].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (dateFrom) {
        const a = r.approved_at ? new Date(r.approved_at).getTime() : 0;
        const f = new Date(dateFrom + 'T00:00:00').getTime();
        if (a < f) return false;
      }
      if (dateTo) {
        const a = r.approved_at ? new Date(r.approved_at).getTime() : 0;
        const t = new Date(dateTo + 'T23:59:59').getTime();
        if (a > t) return false;
      }
      return true;
    });
  }, [rows, q, funnel, dateFrom, dateTo]);

  // การ์ดสรุป
  const cards = useMemo(() => {
    const n = filtered.length;

    const budgets = filtered.map(r => r.budget_daily ?? 0).filter(v => v > 0);
    const budgetAvg = budgets.length ? budgets.reduce((a,b)=>a+b,0)/budgets.length : 0;

    const lastApproved = filtered[0]?.approved_at ?? null;

    // นับสัดส่วนตาม Funnel (ใช้ทำกราฟ)
    const funnelCount: Record<Funnel, number> = {
      Awareness:0, Consideration:0, Conversion:0, Loyalty:0, Advocacy:0
    };
    filtered.forEach(r => {
      const f = (r.funnel_stage ?? '') as Funnel;
      if (FUNNELS.includes(f)) funnelCount[f]++;
    });

    const chartData = FUNNELS.map(f => ({ name: f, count: funnelCount[f] }));

    return { n, budgetAvg, lastApproved, chartData };
  }, [filtered]);

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Results — ผลลัพธ์แคมเปญที่อนุมัติแล้ว</h1>
        <p className="text-sm text-neutral-400">
          ดูผลรวม/รายการของแคมเปญที่ <span className="font-medium text-emerald-400">Approved</span> แล้ว พร้อมสรุป KPI ที่ตั้งไว้ (เวอร์ชันนี้ยังไม่ดึงค่าผลจริงจากภายนอก)
        </p>
      </header>

      {/* Filters */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-neutral-400">ค้นหา</label>
          <input
            className="w-full mt-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="ค้นหาจากชื่อแคมเปญ / Objective / KPI"
            value={q}
            onChange={e=>setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400">Funnel</label>
          <select
            className="w-full mt-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            value={funnel}
            onChange={e=>setFunnel(e.target.value as any)}
          >
            <option value="">ทั้งหมด</option>
            {FUNNELS.map(f=><option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-400">ตั้งแต่</label>
            <input type="date"
              className="w-full mt-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              value={dateFrom}
              onChange={e=>setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400">ถึง</label>
            <input type="date"
              className="w-full mt-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              value={dateTo}
              onChange={e=>setDateTo(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="จำนวนแคมเปญ (Approved)" value={cards.n.toLocaleString('th-TH')} />
        <Card title="งบเฉลี่ยต่อวัน" value={fmtBaht(cards.budgetAvg)} />
        <Card title="อนุมัติครั้งล่าสุด" value={fmtDate(cards.lastApproved)} />
      </section>

      {/* Chart by Funnel */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">สัดส่วนตาม Funnel (ในผลลัพธ์ที่กรองอยู่)</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={cards.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-2xl border border-neutral-800 overflow-hidden">
        <div className="border-b border-neutral-800 bg-neutral-950/60 p-3">
          <h3 className="font-medium">รายการแคมเปญที่อนุมัติแล้ว</h3>
          <p className="text-xs text-neutral-400">
            เคล็ดลับ: คลิกชื่อแคมเปญเพื่อดู KPI ทั้งหมด (รวม KPI หลักที่ idx=0)
          </p>
        </div>

        {loading ? (
          <div className="p-6 text-center text-neutral-400">กำลังโหลด...</div>
        ) : err ? (
          <div className="p-6 text-center text-red-400">เกิดข้อผิดพลาด: {err}</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-neutral-400">ไม่พบรายการตามเงื่อนไขที่เลือก</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-950/60 border-b border-neutral-800">
                <tr>
                  <Th>Campaign</Th>
                  <Th>Funnel</Th>
                  <Th>Objective</Th>
                  <Th>KPI หลัก</Th>
                  <Th>เป้า</Th>
                  <Th>หน่วย</Th>
                  <Th>งบ/วัน</Th>
                  <Th>Approved</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {filtered.map(r => {
                  const main = [...(r.ad_request_kpis ?? [])].sort((a,b)=>(a.idx??999)-(b.idx??999))[0];
                  const mainLabel = main ? (main.label || main.type) : '-';
                  const mainTarget = main?.target ?? null;
                  const mainUnit = main?.unit ?? '-';
                  return (
                    <tr key={r.id} className="hover:bg-neutral-900/40">
                      <Td>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.campaign_name ?? '(ไม่ระบุชื่อ)'}</span>
                          <span className="text-xs text-neutral-400">ID: {r.id}</span>
                        </div>
                      </Td>
                      <Td>{r.funnel_stage ?? '-'}</Td>
                      <Td>{r.objective ?? '-'}</Td>
                      <Td>{mainLabel}</Td>
                      <Td>
                        {mainTarget != null ? (
                          <>
                            <span className="text-neutral-400 mr-1">{main?.operator}</span>
                            {fmtNum(mainTarget)}
                          </>
                        ) : '-'}
                      </Td>
                      <Td>{mainUnit}</Td>
                      <Td>{fmtBaht(r.budget_daily)}</Td>
                      <Td>{fmtDate(r.approved_at)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Export buttons (โครงไว้ก่อน) */}
      <section className="flex items-center gap-3">
        <button
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm hover:bg-neutral-800"
          onClick={()=>exportCSV(filtered)}
        >
          Export CSV
        </button>
        <button
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm hover:bg-neutral-800"
          onClick={()=>window.print()}
        >
          พิมพ์ / บันทึกเป็น PDF (ผ่าน Print)
        </button>
      </section>
    </div>
  );
}

/* ---------- Small UI helpers ---------- */
function Card({ title, value }: { title: string; value: string; }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2 text-xs font-medium text-neutral-400">{children}</th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-3 align-top">{children}</td>
  );
}

/* ---------- Export CSV (ง่าย ๆ) ---------- */
function exportCSV(rows: ApprovedRow[]) {
  if (!rows.length) return;

  const header = [
    'id','campaign_name','funnel_stage','objective',
    'main_kpi','operator','target','unit',
    'budget_daily','approved_at'
  ];
  const lines = [header.join(',')];

  rows.forEach(r => {
    const main = [...(r.ad_request_kpis ?? [])].sort((a,b)=>(a.idx??999)-(b.idx??999))[0];
    const rec = [
      r.id,
      safeCsv(r.campaign_name ?? ''),
      r.funnel_stage ?? '',
      safeCsv(r.objective ?? ''),
      safeCsv(main ? (main.label || main.type) : ''),
      main?.operator ?? '',
      main?.target ?? '',
      main?.unit ?? '',
      r.budget_daily ?? '',
      r.approved_at ?? '',
    ];
    lines.push(rec.join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `adpaas_results_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function safeCsv(s: string) {
  const needsQuote = /[",\n]/.test(s);
  const esc = s.replaceAll('"','""');
  return needsQuote ? `"${esc}"` : esc;
}
