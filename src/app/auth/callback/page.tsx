// src/app/auth/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { track } from '../../../lib/track';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // 1) แลก code → session (PKCE)
        try {
          // supabase-js v2 รองรับส่งทั้ง URL
          // @ts-ignore
          await supabase.auth.exchangeCodeForSession(window.location.href);
        } catch {
          // บางกรณี (hash flow เก่า) ให้ลองดึง session ตรง
          await supabase.auth.getSession();
        }

        // 2) ผูกผู้ใช้เข้า Default Org (single-org)
        const { data: oid, error: jErr } = await supabase.rpc('join_default_org');
        if (jErr) console.error('join_default_org error:', jErr);
        if (oid) localStorage.setItem('adpaas_org_id', String(oid));

        // 3) tracking
        await track('auth_login', {});
      } catch (e) {
        console.error('auth callback error:', e);
        router.replace('/?auth=error');
        return;
      }
      // 4) ไปหน้าแรกหลังล็อกอิน
      router.replace('/dashboard');
    })();
  }, [router]);

  return <div className="card">กำลังเข้าสู่ระบบ…</div>;
}
