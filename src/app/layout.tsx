// src/app/layout.tsx
import '@/styles/globals.css';
import React from 'react';
import type { Metadata } from 'next';
import ClientShell from '@/components/ClientShell';

export const metadata: Metadata = {
  title: 'ADPAAS',
  description: 'Adwords Planner, Audit & Approve System',
};

// แบนเนอร์เตือน .env (ถ้า key Supabase ไม่ถูกต้องจะเห็นชัด)
function EnvBanner() {
  const missing =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!missing) return null;
  return (
    <div className="w-full bg-red-600 text-white text-sm text-center py-2">
      Supabase ENV ไม่ครบ/ไม่ถูกต้อง (ตรวจไฟล์ .env.local และรีสตาร์ท dev server)
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-dvh bg-slate-50 text-slate-900">
        <EnvBanner />
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
