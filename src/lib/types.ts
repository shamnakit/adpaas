// src/lib/types.ts

export type Role = 'owner' | 'approver' | 'creator';

export interface OrgInfo {
  org_id: string;
  name: string;
  province: string | null;
  industry_sector: string | null;
  company_size: string | null;
  ad_budget_range: string | null;
  platform_focus: string[];
  logo_url: string | null;
  my_role: Role;
}

export interface MemberRow {
  org_id: string;
  user_id: string | null; // null = invited (pending)
  full_name: string | null;
  email: string | null;
  role: 'owner' | 'approver' | 'creator';
  status: 'active' | 'invited';
  created_at: string;
}
