// src/lib/downloadWithAuth.ts
'use client';
import { supabase } from './supabaseClient';

export async function downloadPdfWithAuth(url: string, filename = 'approval.pdf') {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    alert('โปรดเข้าสู่ระบบก่อน');
    return;
  }

  // ลองใส่ debug=1 ครั้งแรกเพื่อได้ข้อความช่วยวิเคราะห์ถ้าเจอ 404
  const hasQuery = url.includes('?');
  const urlWithDebug = `${url}${hasQuery ? '&' : '?'}debug=1`;

  const res = await fetch(urlWithDebug, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const txt = await res.text().catch(()=>res.statusText);
    console.error('Export PDF failed:', res.status, txt);
    alert(`ดาวน์โหลดไม่สำเร็จ: ${res.status}\n${txt}`);
    return;
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const w = window.open(blobUrl, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
  }
}
