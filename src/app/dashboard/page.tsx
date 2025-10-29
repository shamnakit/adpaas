'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/** Charts */
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  LineChart,
  Line,
  LabelList,
} from 'recharts';

/** Icons */
import { LayoutList, Clock, Edit3, CheckCircle2, XCircle } from 'lucide-react';

/* =========================
   Types
   ========================= */
type CardStat = { label: string; value: number | string };
type FunnelRow = { funnel_stage: string; n: number };
type StatusDaily = { d: string; status: string; n: number };

const STATUSES = ['created', 'submitted', 'approved', 'needs_changes', 'rejected'] as const;
type StatusKey = typeof STATUSES[number];

type StatusMonthlyRow = { m: string; status: StatusKey; n: number };
type MonthAgg = { m: string } & Record<StatusKey, number>;

/* =========================
   Utils
   ========================= */
const fmtMonthKey = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
const addMonths = (d: Date, delta: number) => new Date(d.getFullYear(), d.getMonth() + delta, 1);
const numberWithCommas = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const toThaiMonth = (iso: string) => {
  const d = new Date(iso);
  const m = d.toLocaleString('th-TH', { month: 'short' });
  const y = d.getFullYear();
  return `${m} ${y.toString().slice(-2)}`;
};
const toNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* =========================
   Page
   ========================= */
export default function Dashboard() {
  const router = useRouter();
  const search = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardStat[]>([]);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [daily, setDaily] = useState<StatusDaily[]>([]);
  const [monthly, setMonthly] = useState<MonthAgg[]>([]);
  const [stacked, setStacked] = useState(true);
  const [monthsWin, setMonthsWin] = useState<6 | 12>(6);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [funnelAsPercent, setFunnelAsPercent] = useState(true);

  // --- PKCE `?code=...`
  useEffect(() => {
    const code = search.get('code');
    if (!code) return;
    supabase.auth
      .exchangeCodeForSession(window.location.href)
      .catch((e) => console.warn('[Dashboard] exchange error', e))
      .finally(() => router.replace('/dashboard'));
  }, [search, router]);

  // --- Load Data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        // 0) org_id
        const { data: orgData, error: orgErr } = await supabase.rpc('get_default_org_id');
        if (orgErr) throw orgErr;
        const orgId: string | null = orgData ?? null;
        if (!orgId) throw new Error('ยังไม่ได้เลือก/เข้าร่วมองค์กร (orgId = null)');

        // 1) Cards
        const [totalRes, waitingRes, needsRes, approvedRes, rejectedRes] = await Promise.all([
          supabase.from('ad_requests').select('*', { head: true, count: 'exact' }).eq('org_id', orgId),
          supabase.from('ad_requests').select('*', { head: true, count: 'exact' }).eq('org_id', orgId).eq('status', 'submitted'),
          supabase.from('ad_requests').select('*', { head: true, count: 'exact' }).eq('org_id', orgId).eq('status', 'needs_changes'),
          supabase.from('ad_requests').select('*', { head: true, count: 'exact' }).eq('org_id', orgId).eq('status', 'approved'),
          supabase.from('ad_requests').select('*', { head: true, count: 'exact' }).eq('org_id', orgId).eq('status', 'rejected'),
        ]);
        if (cancelled) return;

        setCards([
          { label: 'คำขอทั้งหมด', value: totalRes.count ?? 0 },
          { label: 'รออนุมัติ', value: waitingRes.count ?? 0 },
          { label: 'สั่งแก้', value: needsRes.count ?? 0 },
          { label: 'อนุมัติแล้ว', value: approvedRes.count ?? 0 },
          { label: 'Reject', value: rejectedRes.count ?? 0 },
        ]);

        // 2) Funnel (เดือนล่าสุด)
        const { data: dist, error: distErr } = await supabase
          .from('mv_funnel_distribution_monthly')
          .select('m, org_id, funnel_stage, n')
          .eq('org_id', orgId)
          .order('m', { ascending: false })
          .order('funnel_stage', { ascending: true })
          .limit(50);
        if (distErr) throw distErr;

        let latestMonth: string | null = null;
        const rows = (dist as any[]) || [];
        for (const r of rows) if (!latestMonth || r.m > latestMonth) latestMonth = r.m;

        const latestFunnel = rows
          .filter((r) => r.m === latestMonth)
          .map((r) => ({ funnel_stage: String(r.funnel_stage), n: toNum(r.n) })) as FunnelRow[];
        if (!cancelled) setFunnel(latestFunnel);

        // 3) แนวโน้มรายวัน (14 วัน)
        const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
        const { data: dly, error: dlyErr } = await supabase
          .from('mv_request_status_daily')
          .select('d,status,n')
          .eq('org_id', orgId)
          .gte('d', since)
          .order('d', { ascending: true });
        if (dlyErr) throw dlyErr;
        if (!cancelled)
          setDaily(((dly as StatusDaily[]) || []).map((r) => ({ d: r.d, status: String(r.status), n: toNum(r.n) })));

        // 4) รายเดือน (เติม 0 และรวมตามสถานะ)  ← ใช้เป็นกราฟแรก
        {
          const start = addMonths(new Date(), -monthsWin + 1);
          const startKey = fmtMonthKey(start);

          const { data: mon, error: monErr } = await supabase
            .from('v_request_status_monthly_current') // ถ้ายังไม่มี view นี้ เปลี่ยนเป็น 'v_request_status_monthly'
            .select('m,status,n')
            .eq('org_id', orgId)
            .gte('m', startKey)
            .order('m', { ascending: true });
          if (monErr) throw monErr;

          const byMonth: Record<string, MonthAgg> = {};

          // เติมเดือนว่าง
          for (let i = 0; i < monthsWin; i++) {
            const key = fmtMonthKey(addMonths(start, i));
            byMonth[key] = { m: key, created: 0, submitted: 0, approved: 0, needs_changes: 0, rejected: 0 };
          }

          // เติมข้อมูลจาก DB
          (mon as StatusMonthlyRow[] | null)?.forEach((r) => {
            const key = r.m;
            if (STATUSES.includes(r.status)) {
              const k = r.status as StatusKey;
              byMonth[key][k] = (byMonth[key][k] ?? 0) + toNum(r.n);
            }
          });

          if (!cancelled) {
            setMonthly(Object.values(byMonth).sort((a, b) => a.m.localeCompare(b.m)));
          }
        }
      } catch (err: any) {
        console.error('[Dashboard] load error:', err);
        if (!cancelled) setErrorMsg(err?.message ?? 'โหลดข้อมูลไม่สำเร็จ');
        if (!cancelled) {
          setFunnel([]);
          setDaily([]);
          setMonthly([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthsWin]);

  /* ========= Derived ========= */
  const days = useMemo(() => Array.from(new Set(daily.map((d) => d.d))), [daily]);
  const dailySeries = useMemo(() => {
    return days.map((d) => ({
      d,
      submitted: daily.find((x) => x.d === d && x.status === 'submitted')?.n ?? 0,
      approved: daily.find((x) => x.d === d && x.status === 'approved')?.n ?? 0,
    }));
  }, [days, daily]);

  const hasMonthly = useMemo(
    () => monthly.some((m) => m.created + m.submitted + m.approved + m.needs_changes + m.rejected > 0),
    [monthly],
  );
  const hasFunnel = useMemo(() => funnel.some((f) => toNum(f.n) > 0), [funnel]);
  const hasDaily = useMemo(() => dailySeries.some((d) => d.submitted > 0 || d.approved > 0), [dailySeries]);

  const monthlyTotal = useMemo(
    () =>
      monthly.map((m) => ({
        m: m.m,
        total: m.created + m.submitted + m.approved + m.needs_changes + m.rejected,
      })),
    [monthly],
  );
  const hasMonthlyTotal = useMemo(() => monthlyTotal.some((x) => x.total > 0), [monthlyTotal]);

  /* ========= Render ========= */
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">ADPAAS Dashboard</h1>
        <div className="flex items-center gap-2">
          <select
            value={monthsWin}
            onChange={(e) => setMonthsWin(+e.target.value as 6 | 12)}
            className="border rounded px-2 py-1 text-sm"
            aria-label="ช่วงเวลา"
          >
            <option value={6}>ย้อนหลัง 6 เดือน</option>
            <option value={12}>ย้อนหลัง 12 เดือน</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</div>
      )}

      {loading ? (
        <Skeletons />
      ) : (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatusCard label="คำขอทั้งหมด" value={cards[0]?.value ?? '-'} Icon={LayoutList} badgeClass="bg-slate-100 text-slate-700" />
            <StatusCard label="รออนุมัติ" value={cards[1]?.value ?? '-'} Icon={Clock} badgeClass="bg-sky-100 text-sky-700" />
            <StatusCard label="สั่งแก้" value={cards[2]?.value ?? '-'} Icon={Edit3} badgeClass="bg-amber-100 text-amber-700" />
            <StatusCard label="อนุมัติแล้ว" value={cards[3]?.value ?? '-'} Icon={CheckCircle2} badgeClass="bg-emerald-100 text-emerald-700" />
            <StatusCard label="Reject" value={cards[4]?.value ?? 0} Icon={XCircle} badgeClass="bg-rose-100 text-rose-700" tooltipIfZero="ยังไม่มีรายการ Reject" />
          </div>

          {/* Monthly Bar (กราฟแรก) */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-slate-800">จำนวนคำขอต่อเดือน (แยกตามสถานะ)</div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" className="h-4 w-4" checked={stacked} onChange={(e) => setStacked(e.target.checked)} />
                ซ้อนแท่ง (stack)
              </label>
            </div>
            {hasMonthly ? <MonthlyBarChart data={monthly} stacked={stacked} /> : <EmptyGraphNote />}
          </div>

          {/* Funnel */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-slate-800">สัดส่วนคำขอตาม Funnel (เดือนล่าสุด)</div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" className="h-4 w-4" checked={funnelAsPercent} onChange={(e) => setFunnelAsPercent(e.target.checked)} />
                แสดงเป็น %
              </label>
            </div>
            {hasFunnel ? <FunnelVerticalChart data={funnel} asPercent={funnelAsPercent} /> : <EmptyGraphNote />}
          </div>

          {/* Monthly Total */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-slate-800">จำนวนคำขอทั้งหมดต่อเดือน</div>
            </div>
            {hasMonthlyTotal ? <MonthlyTotalBarChart data={monthlyTotal} /> : <EmptyGraphNote />}
          </div>

          {/* Daily line */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="font-medium mb-2 text-slate-800">แนวโน้มรายวัน (14 วัน) — submitted / approved</div>
            {hasDaily ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="d" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value: number, name: string) => [numberWithCommas(value), name]} />
                    <Legend />
                    <Line type="monotone" dataKey="submitted" name="Submitted" dot={false} className="line-submitted" isAnimationActive={false} />
                    <Line type="monotone" dataKey="approved" name="Approved" dot={false} className="line-approved" isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyGraphNote />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* =========================
   UI Bits
   ========================= */
function Skeletons() {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-4 shadow-sm animate-pulse">
            <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
            <div className="h-6 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-white p-4 shadow-sm h-40 animate-pulse" />
      <div className="rounded-lg border bg-white p-4 shadow-sm h-40 animate-pulse" />
    </div>
  );
}

function EmptyGraphNote() {
  return <div className="text-sm text-slate-500">ยังไม่มีข้อมูล</div>;
}

function StatusCard({
  label,
  value,
  Icon,
  badgeClass,
  tooltipIfZero,
}: {
  label: string;
  value: number | string;
  Icon: React.ComponentType<React.ComponentProps<'svg'>>;
  badgeClass: string;
  tooltipIfZero?: string;
}) {
  const showTip = tooltipIfZero && (value === 0 || value === '0');
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm flex items-start justify-between" title={showTip ? tooltipIfZero : undefined}>
      <div>
        <div className={`inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-medium ${badgeClass}`}>
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </div>
        <div className="mt-2 text-2xl font-semibold text-slate-900">{typeof value === 'number' ? numberWithCommas(value) : value}</div>
      </div>
    </div>
  );
}

/* =========================
   Charts
   ========================= */
function MonthlyBarChart({ data, stacked }: { data: MonthAgg[]; stacked: boolean }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="m" tickFormatter={toThaiMonth} />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(value: number, name: string) => [numberWithCommas(value), name]} labelFormatter={(label) => toThaiMonth(label as string)} />
          <Legend />
          <Bar dataKey="created" name="Draft/Created" stackId={stacked ? 's' : undefined} className="bar-created" fill="var(--status-created)" />
          <Bar dataKey="submitted" name="Submitted" stackId={stacked ? 's' : undefined} className="bar-submitted" fill="var(--status-submitted)" />
          <Bar dataKey="approved" name="Approved" stackId={stacked ? 's' : undefined} className="bar-approved" fill="var(--status-approved)" />
          <Bar dataKey="needs_changes" name="Needs changes" stackId={stacked ? 's' : undefined} className="bar-needs" fill="var(--status-needs)" />
          <Bar dataKey="rejected" name="Rejected" stackId={stacked ? 's' : undefined} className="bar-rejected" fill="var(--status-rejected)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyTotalBarChart({ data }: { data: { m: string; total: number }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="m" tickFormatter={toThaiMonth} />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(value: number) => [numberWithCommas(value), 'ทั้งหมด']} labelFormatter={(label) => toThaiMonth(label as string)} />
          <Legend />
          <Bar dataKey="total" name="ทั้งหมด" fill="var(--blue)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const FUNNEL_ORDER = ['Awareness', 'Consideration', 'Conversion', 'Loyalty', 'Advocacy'] as const;
type FunnelKey = (typeof FUNNEL_ORDER)[number];
const TH_LABEL: Record<string, string> = {
  Awareness: 'รับรู้',
  Consideration: 'พิจารณา',
  Conversion: 'แปลง',
  Loyalty: 'ภักดี',
  Advocacy: 'บอกต่อ',
};

function FunnelVerticalChart({ data, asPercent }: { data: FunnelRow[]; asPercent: boolean }) {
  const rows = useMemo(() => {
    const total = data.reduce((s, r) => s + toNum(r.n), 0);
    const ordered = [...data].sort(
      (a, b) => FUNNEL_ORDER.indexOf(a.funnel_stage as FunnelKey) - FUNNEL_ORDER.indexOf(b.funnel_stage as FunnelKey),
    );
    return ordered.map((r) => {
      const n = toNum(r.n);
      const pct = total > 0 ? (n * 100) / total : 0;
      return { ...r, n, pct, pctLabel: `${pct.toFixed(0)}%`, labelTH: TH_LABEL[r.funnel_stage] ?? r.funnel_stage };
    });
  }, [data]);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }} barSize={42}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="labelTH" />
          <YAxis allowDecimals={false} domain={asPercent ? [0, 100] : undefined} />
          <Tooltip
            formatter={(value: number) => (asPercent ? [`${value.toFixed(1)}%`, '% ต่อรวมเดือน'] : [numberWithCommas(value), 'จำนวน'])}
            labelFormatter={(k) => `ขั้น: ${k as string}`}
          />
          <Bar dataKey={asPercent ? 'pct' : 'n'} name={asPercent ? '% ต่อรวมเดือน' : 'จำนวนคำขอ'} className="bar-funnel" fill="var(--status-submitted)">
            {asPercent && <LabelList dataKey="pctLabel" position="top" />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
