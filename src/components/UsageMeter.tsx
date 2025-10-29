// src/components/UsageMeter.tsx

'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { track } from '../lib/track';

export default function UsageMeter() {
  const [used, setUsed] = useState<number | null>(null);
  const cap = 20; // เพดานโหมด Free ที่ตั้งไว้

  useEffect(() => {
    (async () => {
      const { data: oid } = await supabase.rpc('get_default_org_id');
      const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', oid)
        .eq('name', 'request_submitted')
        .gte('ts', start);
      const u = count ?? 0;
      setUsed(u);

      const pct = Math.min(100, Math.round((u / cap) * 100));
      if (u >= Math.floor(cap * 0.9)) {
        await track('quota_touched', { type: 'requests', pct_used: pct, hardcap: u >= cap });
      }
    })();
  }, []);

  if (used === null) return null;
  const pct = Math.min(100, Math.round((used / cap) * 100));

  return (
    <div className="mt-2">
      <div className="text-[11px] text-slate-500 mb-1">Requests this month: {used}/{cap}</div>
      <div className="h-2 bg-slate-200 rounded">
        <div className="h-2 rounded" style={{ width: `${pct}%`, background: pct < 80 ? '#10b981' : pct < 100 ? '#f59e0b' : '#ef4444' }} />
      </div>
    </div>
  );
}
