// src/components/AuthButton.tsx
'use client';
import { supabase } from '../lib/supabaseClient';

export default function AuthButton() {
  return (
    <button
      className="btn btn-primary"
      onClick={() => supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })}
    >
      Sign in with Google
    </button>
  );
}
