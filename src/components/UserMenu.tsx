// src/components/UserMenu.tsx

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => { mounted = false; sub?.subscription.unsubscribe(); };
  }, []);

  if (!email) {
    return (
      <button
        className="badge"
        onClick={() =>
          supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
          })
        }
      >
        Sign in
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600">{email}</span>
      <button className="badge" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}
