'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import UserMenu from '@/components/UserMenu';

type Props = { children: React.ReactNode };
const PUBLIC_PATHS = new Set<string>(['/', '/login']);

function FullscreenLoader({ note }: { note?: string }) {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="flex flex-col items-center gap-2 text-slate-600">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        <div className="text-sm">กำลังเตรียมหน้า…</div>
        {note && <div className="text-xs text-slate-400">{note}</div>}
      </div>
    </div>
  );
}

export default function ClientShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [firstCheckAt] = useState<number>(() => Date.now());

  // implicit flow (hash tokens) → รอ
  const hasOAuthHash = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash || '';
    return hash.includes('access_token') || hash.includes('refresh_token');
  }, []);

  // PKCE (?code=...) → ไม่บังการเรนเดอร์ แต่ "ห้าม" รีไดเรกต์กลับ /
  const hasOAuthCode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const qs = new URLSearchParams(window.location.search);
    return !!qs.get('code');
  }, []);

  // โหลด session + subscribe
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data?.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setHasSession(!!session);
      if (event === 'SIGNED_IN' && PUBLIC_PATHS.has(pathname ?? '/')) {
        router.replace('/dashboard');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [pathname, router]);

  // รีไดเรกต์กลับหน้าแรกเฉพาะกรณี "ไม่มี session" + "ไม่ใช่หน้า public" + "ไม่อยู่ระหว่าง OAuth"
  useEffect(() => {
    if (hasSession === null || hasOAuthHash || hasOAuthCode) return;
    const isPublic = PUBLIC_PATHS.has(pathname ?? '/');
    if (!hasSession && !isPublic) router.replace('/');
  }, [hasSession, hasOAuthHash, hasOAuthCode, pathname, router]);

  // Loader: รอผลเช็ค session หรือกำลังประมวลผล hash token
  if (hasSession === null || hasOAuthHash) {
    const waited = ((Date.now() - firstCheckAt) / 1000).toFixed(1);
    return <FullscreenLoader note={`รอ session ~${waited}s`} />;
  }

  const isPublic = PUBLIC_PATHS.has(pathname ?? '/');

  // หน้า public หรือยังไม่ล็อกอิน (และไม่ได้อยู่ระหว่าง OAuth) → แสดง children ตรง ๆ
  if (isPublic || !hasSession) {
    return <>{children}</>;
  }

  // โหมด App (ล็อกอินแล้ว) — แสดง Shell + Sidebar
  return (
    <div className="min-h-dvh grid" style={{ gridTemplateColumns: '280px 1fr' }}>
      <aside className="border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="font-semibold">ADPAAS</Link>
          <div className="text-xs text-slate-500">Single-org mode</div>
        </div>

        <nav className="p-3 grid gap-1 text-sm">
          <Link className="badge" href="/dashboard">Home (Dashboard)</Link>
          <Link className="badge" href="/requests">Requests</Link>
          <Link className="badge" href="/requests/new">New Request</Link>
          <Link className="badge" href="/results/preview">Results</Link>
          <Link className="badge" href="/settings">Settings</Link>
          <Link className="badge" href="/help">Help & Docs</Link>
        </nav>

        <div className="mt-auto p-3 border-t">
          <UserMenu />
          <div className="text-[11px] text-slate-500 mt-2">Plan/Storage · 0%</div>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="border-b bg-white">
          <div className="p-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">ADPAAS · Dashboard</div>
          </div>
        </header>
        <main className="p-4">{children}</main>
        <footer className="border-t text-xs text-slate-500 p-4 text-center">
          © {new Date().getFullYear()} ADPAAS
        </footer>
      </div>
    </div>
  );
}
