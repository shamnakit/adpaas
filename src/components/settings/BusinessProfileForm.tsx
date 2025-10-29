'use client';
import { useState } from 'react';
import type { OrgInfo } from '@/lib/types';

const INDUSTRIES = ['ร้านอาหาร-คาเฟ่','คลินิก/สุขภาพ','ฟิตเนส/กีฬา','การศึกษา/ติว','ค้าปลีก','บริการทั่วไป','อื่นๆ'] as const;
const COMPANY_SIZES = ['1-10','11-30','31-100','100+'] as const;
const BUDGETS = ['<10k','10k-50k','50k-200k','200k+'] as const;
const PLATFORMS = ['Google Ads','Meta Ads','TikTok Ads','อื่นๆ'] as const;

type Props = {
  org: OrgInfo;
  onSave: (patch: Partial<OrgInfo>) => Promise<void>;
};

export default function BusinessProfileForm({ org, onSave }: Props) {
  const [industry, setIndustry] = useState(org.industry_sector ?? '');
  const [size, setSize] = useState(org.company_size ?? '');
  const [budget, setBudget] = useState(org.ad_budget_range ?? '');
  const [platforms, setPlatforms] = useState<string[]>(org.platform_focus ?? []);
  const [province, setProvince] = useState(org.province ?? '');
  const isOwner = org.my_role === 'owner';

  const togglePlatform = (p: string) => {
    setPlatforms((arr) => arr.includes(p) ? arr.filter(x => x !== p) : [...arr, p]);
  };

  const save = async () => {
    await onSave({
      industry_sector: industry,
      company_size: size,
      ad_budget_range: budget,
      platform_focus: platforms,
      province
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 p-5 space-y-5">
      <h2 className="text-lg font-semibold">Business Profile (สำหรับ Marketing & Funding Insight)</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-sm opacity-80">Industry Sector</span>
          <select className="w-full rounded bg-white/5 px-3 py-2"
            value={industry} onChange={e=>setIndustry(e.target.value)} disabled={!isOwner}>
            <option value="">— เลือก —</option>
            {INDUSTRIES.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm opacity-80">Company Size</span>
          <select className="w-full rounded bg-white/5 px-3 py-2"
            value={size} onChange={e=>setSize(e.target.value)} disabled={!isOwner}>
            <option value="">— เลือก —</option>
            {COMPANY_SIZES.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm opacity-80">Ad Budget Range (ต่อเดือน)</span>
          <select className="w-full rounded bg-white/5 px-3 py-2"
            value={budget} onChange={e=>setBudget(e.target.value)} disabled={!isOwner}>
            <option value="">— เลือก —</option>
            {BUDGETS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm opacity-80">Province</span>
          <input className="w-full rounded bg-white/5 px-3 py-2"
            value={province} onChange={e=>setProvince(e.target.value)} disabled={!isOwner} placeholder="กรุงเทพมหานคร"/>
        </label>

        <div className="col-span-full">
          <div className="text-sm opacity-80 mb-1">Platform Focus</div>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p}
                type="button"
                onClick={()=>togglePlatform(p)}
                disabled={!isOwner}
                className={`px-3 py-1.5 rounded-lg border ${platforms.includes(p)?'bg-emerald-600 border-emerald-500':'bg-white/5 border-white/10'} disabled:opacity-40`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <button onClick={save} disabled={!isOwner} className="rounded-lg px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40">
          บันทึก
        </button>
        {!isOwner && <span className="ml-3 text-xs opacity-70">(Owner เท่านั้นที่แก้ไขได้)</span>}
      </div>
    </div>
  );
}
