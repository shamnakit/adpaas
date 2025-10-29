// src/lib/orgs.ts

'use client';
import { supabase } from './supabaseClient';
import type { OrgInfo, MemberRow, Role } from './types';

export async function ensureDefaultOrg() {
  const { data, error } = await supabase.rpc('join_default_org');
  if (error) throw error;
  return data as string; // org_id
}

export async function getOrgInfo(): Promise<OrgInfo | null> {
  const { data, error } = await supabase.rpc('get_org_info');
  if (error) throw error;
  return data as OrgInfo | null;
}

export async function updateOrgInfo(patch: Partial<OrgInfo>) {
  const { data, error } = await supabase.rpc('update_org_info', { patch });
  if (error) throw error;
  return data as OrgInfo;
}

export async function listOrgMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase.rpc('list_org_members');
  if (error) throw error;
  return data as MemberRow[];
}

export async function inviteMember(email: string, role: Exclude<Role,'owner'>) {
  const { data, error } = await supabase.rpc('invite_member', { i_email: email, i_role: role });
  if (error) throw error;
  return data;
}

export async function updateMemberRole(userId: string, role: Exclude<Role,'owner'>) {
  const { error } = await supabase.rpc('update_member_role', { i_user: userId, i_role: role });
  if (error) throw error;
}

export async function removeMember(userId: string) {
  const { error } = await supabase.rpc('remove_member', { i_user: userId });
  if (error) throw error;
}
