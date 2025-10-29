'use client';
import { useState } from 'react';
import type { OrgInfo } from '@/lib/types';
import LogoUploader from './LogoUploader';

type Props = {
  org: OrgInfo;
  onSave: (patch: Partial<OrgInfo>) => Promise<void>;
};

export default function OrgInfoCard({ org, onSave }: Props) {
  const [name, setName] = useState(org.name ?? '');
  const [province, setProvince] = useState(org.province ?? '');
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? '');
  const isOwner = org.my_role === 'owner';

  const save = async () => {
    await onSave({ name, province, logo_url: logoUrl });
  };

  return (
    <div className="rounded-2xl border border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Organization Identity</h2>
        <span className="text-xs opacity-70">Your Role: {org.my_role}</span>
      </div>

      <div className="flex items-start gap-6">
        <LogoUploader
          orgId={org.org_id}
          value={logoUrl}
          onUploaded={(url) => setLogoUrl(url)}
          disabled={!isOwner}
        />

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-sm opacity-80">ชื่อองค์กร</span>
            <input
              className="w-full rounded bg-white/5 px-3 py-2 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwner}
              placeholder="เช่น Cafe Moon Co., Ltd."
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm opacity-80">จังหวัด</span>
            <input
              className="w-full rounded bg:white/5 px-3 py-2 outline-none"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              disabled={!isOwner}
              placeholder="กรุงเทพมหานคร"
            />
          </label>

          <div className="col-span-full flex gap-2">
            <button
              onClick={save}
              disabled={!isOwner}
              className="rounded-lg px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
            >
              บันทึก
            </button>
            {!isOwner && (
              <span className="text-xs opacity-70 self-center">
                (คุณไม่มีสิทธิ์แก้ไข — Owner เท่านั้น)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Preview App Header */}
      <div className="mt-2 border-t border-white/10 pt-4">
        <div className="text-sm opacity-80 mb-2">Preview · App Header</div>
        <div className="flex items-center gap-2 rounded bg-white/5 p-3">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-6 w-6 rounded bg-white/10" />
          ) : (
            <div className="h-6 w-6 rounded bg-white/10" />
          )}
          <div className="text-sm">
            {name} <span className="opacity-60">· {org.my_role}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
