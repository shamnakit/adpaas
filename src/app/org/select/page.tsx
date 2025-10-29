'use client';
import { useEffect, useState } from 'react';
import { ensureDefaultOrg, getOrgInfo, updateOrgInfo } from '@/lib/orgs';
import type { OrgInfo } from '@/lib/types';
import OrgInfoCard from '@/components/settings/OrgInfoCard';
import BusinessProfileForm from '@/components/settings/BusinessProfileForm';

export default function OrgSettingsPage() {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await ensureDefaultOrg();
        const info = await getOrgInfo();
        setOrg(info);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (patch: Partial<OrgInfo>) => {
    const updated = await updateOrgInfo(patch);
    setOrg(updated);
  };

  if (loading) return <div className="p-6">กำลังโหลด...</div>;
  if (!org) return <div className="p-6 text-red-400">ไม่พบข้อมูลองค์กร</div>;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl font-semibold">Settings — Organization Info</h1>
      <OrgInfoCard org={org} onSave={handleSave} />
      <BusinessProfileForm org={org} onSave={handleSave} />
    </div>
  );
}
