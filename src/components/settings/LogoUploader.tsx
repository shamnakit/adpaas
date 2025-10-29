'use client';
import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';

type Props = {
  orgId: string;
  value?: string | null;
  onUploaded: (publicUrl: string) => void;
  disabled?: boolean;
};

export default function LogoUploader({ orgId, value, onUploaded, disabled }: Props) {
  const [uploading, setUploading] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) return alert('ไฟล์ใหญ่เกิน 1MB');
    const okTypes = ['image/png','image/jpeg','image/jpg','image/svg+xml'];
    if (!okTypes.includes(file.type)) return alert('รองรับ .png .jpg .jpeg .svg');

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${orgId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from('org_logos').upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('org_logos').getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch (err: any) {
      alert(err.message ?? 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="h-20 w-20 rounded bg-white/5 flex items-center justify-center overflow-hidden">
        {value ? <img src={value} alt="logo" className="max-h-full max-w-full" /> : <span className="text-xs opacity-60">80×80</span>}
      </div>
      <label className={`cursor-pointer inline-flex items-center gap-2 rounded px-3 py-1.5 bg-white/10 hover:bg-white/15 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
        <input type="file" accept="image/*" className="hidden" onChange={onPick} disabled={disabled || uploading} />
        {uploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนโลโก้'}
      </label>
      {value && <span className="text-xs opacity-60 max-w-60 break-all">{value}</span>}
    </div>
  );
}
