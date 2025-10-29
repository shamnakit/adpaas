// src/app/requests/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { downloadPdfWithAuth } from '../../lib/downloadWithAuth';

type ReqRow = {
  id: string;
  campaign_name: string | null;
  objective: string | null;
  platform: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'needs_changes' | 'rejected' | string;
};

export default function Requests() {
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const subInited = useRef(false);

  const fetchRows = async (oid?: string|null) => {
    setErr(null);
    try {
      const myOrg = oid ?? orgId ?? (await supabase.rpc('get_default_org_id')).data;
      if (!myOrg) {
        setRows([]);
        setErr('ยังไม่พบองค์กรของคุณ');
        return;
      }
      setOrgId(String(myOrg));
      const { data, error } = await supabase
        .from('ad_requests')
        .select('id,campaign_name,objective,platform,status')
        .eq('org_id', myOrg)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as ReqRow[]);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'โหลดรายการไม่สำเร็จ');
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // ตั้งค่า org context (RLS)
        await supabase.rpc('join_default_org');
        const { data: oid } = await supabase.rpc('get_default_org_id');
        await fetchRows(oid);

        // ---- Realtime: subscribe แค่ครั้งเดียวเมื่อรู้ orgId ----
        if (!subInited.current && oid) {
          subInited.current = true;
          const channel = supabase
            .channel('ad_requests_list')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'ad_requests' },
              (payload) => {
                // ป้องกันกรณีข้ามองค์กร: เช็ก org_id ถ้ามีใน new/old
                const newRow: any = (payload as any).new || {};
                const oldRow: any = (payload as any).old || {};
                const belongs =
                  newRow?.org_id === oid || oldRow?.org_id === oid;

                if (!belongs) return;

                setRows((prev) => {
                  const next = [...prev];
                  if (payload.eventType === 'INSERT' && newRow?.id) {
                    // prepend ถ้าไม่ได้อยู่ในลิสต์
                    if (!next.find((r) => r.id === newRow.id)) {
                      next.unshift({
                        id: newRow.id,
                        campaign_name: newRow.campaign_name,
                        objective: newRow.objective,
                        platform: newRow.platform,
                        status: newRow.status,
                      });
                    }
                  } else if (payload.eventType === 'UPDATE' && newRow?.id) {
                    const i = next.findIndex((r) => r.id === newRow.id);
                    if (i !== -1) {
                      next[i] = {
                        id: newRow.id,
                        campaign_name: newRow.campaign_name,
                        objective: newRow.objective,
                        platform: newRow.platform,
                        status: newRow.status,
                      };
                    }
                  } else if (payload.eventType === 'DELETE' && oldRow?.id) {
                    return next.filter((r) => r.id !== oldRow.id);
                  }
                  return next;
                });
              }
            )
            .subscribe();

          // cleanup
          return () => {
            try { supabase.removeChannel(channel); } catch {}
          };
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []); // mount

  const createDemo = async () => {
    try {
      setLoading(true);
      const { data: oid, error: gErr } = await supabase.rpc('get_default_org_id');
      if (gErr) throw gErr;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!oid || !uid) throw new Error('ยังไม่พร้อม (org/user)');

      const { data, error } = await supabase
        .from('ad_requests')
        .insert({
          org_id: oid,
          created_by: uid,
          status: 'draft',
          platform: 'Search',
          objective: 'Leads',
          campaign_name: 'Demo — TH Leads',
        })
        .select('id,campaign_name,objective,platform,status')
        .single();

      if (error) throw error;
      if (data) setRows((r) => [data as ReqRow, ...r]);
    } catch (e: any) {
      alert('Add demo row ไม่สำเร็จ: ' + (e?.message ?? 'unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (s: ReqRow['status']) => {
    const cls =
      s === 'draft'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : s === 'approved'
        ? 'bg-sky-100 text-sky-800 border-sky-200'
        : s === 'needs_changes'
        ? 'bg-rose-100 text-rose-800 border-rose-200'
        : s === 'rejected'
        ? 'bg-rose-200 text-rose-900 border-rose-300'
        : 'bg-emerald-100 text-emerald-800 border-emerald-200'; // submitted (default)
    return <span className={'badge ' + cls}>{s}</span>;
  };

  const canExport = (s: ReqRow['status']) => s !== 'draft';

  const exportOne = (r: ReqRow) => {
    const isApproved = r.status === 'approved';
    const url = isApproved
      ? `/api/requests/${r.id}/approval.pdf`
      : `/api/requests/${r.id}/export`;
    const filename = isApproved
      ? `adpaas-approval-${r.id}.pdf`
      : `adpaas-request-${r.id}.pdf`;
    downloadPdfWithAuth(url, filename);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Requests</h1>
        <div className="flex gap-2">
          <button
            className="btn"
            onClick={() => fetchRows()}
            disabled={loading}
            title="รีเฟรชรายการ"
          >
            Refresh
          </button>
          <Link href="/requests/new" className="btn btn-primary">
            + New Request
          </Link>
          <button className="btn" onClick={createDemo} disabled={loading}>
            Add demo row
          </button>
        </div>
      </div>

      {err && (
        <div className="card bg-rose-50 text-rose-700 border border-rose-200">
          <div className="font-medium">มีข้อผิดพลาด</div>
          <div className="text-sm">{err}</div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2">#</th>
              <th>Campaign / Objective</th>
              <th>Platform</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="border-t">
                <td colSpan={5} className="py-6 text-center text-slate-500">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="border-t">
                <td colSpan={5} className="py-6 text-center text-slate-500">ยังไม่มีคำขอ</td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">{i + 1}</td>
                  <td className="max-w-[520px] pr-3">
                    <div className="font-medium">{r.campaign_name ?? '-'}</div>
                    <div className="text-xs text-slate-500">Objective: {r.objective ?? '-'}</div>
                  </td>
                  <td>{r.platform ?? '-'}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      {r.status === 'draft' && (
                        <Link
                          className="text-blue-700 hover:underline"
                          href={`/requests/new?id=${r.id}`}
                        >
                          Edit
                        </Link>
                      )}

                      <Link
                        className="text-emerald-700 hover:underline"
                        href={`/requests/${r.id}/summary`}
                      >
                        Review →
                      </Link>

                      {canExport(r.status) ? (
                        <button
                          className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => exportOne(r)}
                          title={
                            r.status === 'approved'
                              ? 'Export PDF: Approval (หลังอนุมัติ)'
                              : 'Export PDF: Request Form (สำหรับยื่นขออนุมัติ)'
                          }
                        >
                          Export PDF
                        </button>
                      ) : (
                        <button
                          className="px-3 py-1 rounded bg-slate-200 text-slate-500 cursor-not-allowed"
                          disabled
                          title="กรุณากรอกให้ครบและกด Submit ก่อนจึงจะ Export PDF ได้"
                        >
                          Export PDF
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
