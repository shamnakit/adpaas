// src/lib/fetch.js  (ไฟล์ที่ log เคยชี้)
import { AD_REQUESTS_MAIN_FIELDS } from '@/lib/adRequestsFields';

export async function fetchAdRequestById(id) {
  const url =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ad_requests` +
    `?select=${encodeURIComponent(AD_REQUESTS_MAIN_FIELDS)}` +
    `&id=eq.${id}`;

  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      Prefer: 'return=representation',
    },
  });
  if (!res.ok) throw new Error('ไม่พบคำขอ หรือคุณไม่มีสิทธิ์เข้าถึง (RLS)');
  const rows = await res.json();
  return rows?.[0] ?? null;
}
