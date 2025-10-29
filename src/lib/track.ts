// src/lib/track.ts

'use client';
import { supabase } from '../lib/supabaseClient';

type TrackProps = Record<string, any>;

export async function track(name: string, props: TrackProps = {}) {
  const [{ data: auth }, { data: oid }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('get_default_org_id'),
  ]);
  const user_id = auth.user?.id;
  if (!user_id || !oid) return; // ยังไม่พร้อม ไม่ต้อง error

  await supabase.from('events').insert({
    org_id: oid as string,
    user_id,
    name,
    props,
  });
}
