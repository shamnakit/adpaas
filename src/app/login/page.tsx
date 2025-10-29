// src/app/login/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ถ้ามี session อยู่แล้ว → ไป /dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard`
      : undefined;

  const signInGoogle = async () => {
    try {
      setBusy(true);
      setErr(null);
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      });
      // จะ redirect ออกไปทันที
    } catch (e: any) {
      setErr(e?.message ?? 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้');
    } finally {
      setBusy(false);
    }
  };

  const signInEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      setBusy(true);
      setErr(null);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      alert('ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว');
    } catch (e: any) {
      setErr(e?.message ?? 'ไม่สามารถส่งลิงก์อีเมลได้');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      setBusy(true);
      await supabase.auth.signOut();
      alert('ออกจากระบบแล้ว');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-slate-600 text-sm">
          ใช้บัญชี Google หรือรับลิงก์ทางอีเมลเพื่อเริ่มใช้งาน ADPAAS
        </p>

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <button
          onClick={signInGoogle}
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:opacity-60"
        >
          เข้าสู่ระบบด้วย Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-[1px] flex-1 bg-slate-200" />
          <span>หรือ</span>
          <div className="h-[1px] flex-1 bg-slate-200" />
        </div>

        <form onSubmit={signInEmail} className="grid gap-3">
          <label className="text-sm text-slate-700">อีเมล</label>
          <input
            type="email"
            required
            value={email}
            onChange={(v) => setEmail(v.target.value)}
            placeholder="you@company.com"
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
          >
            ส่งลิงก์เข้าสู่ระบบไปที่อีเมล
          </button>
        </form>

        <button
          onClick={signOut}
          disabled={busy}
          className="mt-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
        >
          ออกจากระบบ
        </button>

        <p className="mt-4 text-xs text-slate-500">
          ฟรี ไม่ต้องใช้บัตรเครดิต
        </p>
      </div>
    </main>
  );
}
