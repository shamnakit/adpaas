'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* =======================
 * Types
 * ======================= */
type Role = 'owner' | 'approver' | 'creator';

type OrgInfo = {
  org_id: string;
  name: string;
  province: string | null;
  industry_sector: string | null;
  company_size: string | null;
  ad_budget_range: string | null;
  platform_focus: string[] | null;
  logo_url: string | null;
  my_role: Role;
};

type MemberRow = {
  org_id: string;
  user_id: string | null; // null = invited (pending)
  full_name: string | null;
  email: string | null;
  role: Role;
  status: 'active' | 'invited';
  created_at: string;
};

/* =======================
 * Reusable Card UI
 * ======================= */
function Card({
  title,
  subtitle,
  children,
  footer,
  tone = 'default', // 'default' | 'locked' | 'warning'
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tone?: 'default' | 'locked' | 'warning';
}) {
  const toneBorder =
    tone === 'locked'
      ? 'border-amber-500/40'
      : tone === 'warning'
      ? 'border-red-500/40'
      : 'border-white/10';
  return (
    <div className={`rounded-2xl border ${toneBorder} bg-white/0 p-5 space-y-4`}>
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        {subtitle && <p className="text-sm opacity-70 mt-1">{subtitle}</p>}
      </div>
      {children}
      {footer && <div className="pt-2 border-t border-white/10">{footer}</div>}
    </div>
  );
}

function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm">{label}</span>
      {children}
      {(helper || error) && (
        <div className={`text-xs ${error ? 'text-red-400' : 'opacity-70'}`}>{error || helper}</div>
      )}
    </label>
  );
}

function SaveRow({
  onSave,
  disabled,
  note,
  label = 'บันทึก',
}: {
  onSave: () => void;
  disabled?: boolean;
  note?: string;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        onClick={onSave}
        disabled={disabled}
        className="rounded-lg px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
      >
        {label}
      </button>
      {note && <span className="text-xs opacity-70">{note}</span>}
    </div>
  );
}

function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'ok' | 'warn' | 'info';
}) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-700'
      : tone === 'warn'
      ? 'bg-yellow-700'
      : tone === 'info'
      ? 'bg-sky-700'
      : 'bg-white/10';
  return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{children}</span>;
}

/* =======================
 * Main Page
 * ======================= */
export default function SettingsOnePage() {
  const [loading, setLoading] = useState(true);

  // Org state
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgName, setOrgName] = useState('');
  const [province, setProvince] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Business profile
  const INDUSTRIES = [
    'ร้านอาหาร-คาเฟ่',
    'คลินิก/สุขภาพ',
    'ฟิตเนส/กีฬา',
    'การศึกษา/ติว',
    'ค้าปลีก',
    'บริการทั่วไป',
    'อื่นๆ',
  ] as const;
  const COMPANY_SIZES = ['1-10', '11-30', '31-100', '100+'] as const;
  const BUDGETS = ['<10k', '10k-50k', '50k-200k', '200k+'] as const;
  const PLATFORMS = ['Google Ads', 'Meta Ads', 'TikTok Ads', 'อื่นๆ'] as const;

  const [industry, setIndustry] = useState<string>('');
  const [size, setSize] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [platforms, setPlatforms] = useState<string[]>([]);

  // Members
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'creator' | 'approver'>('creator');

  // Notifications & workflow (local for MVP)
  const [notifNewRequest, setNotifNewRequest] = useState(true);
  const [notifResult, setNotifResult] = useState(true);
  const [notifQuota, setNotifQuota] = useState(true);
  const [digestTime, setDigestTime] = useState('09:00');
  const [workflowMode, setWorkflowMode] = useState<'single' | 'anyof'>('single');

  const isOwner = org?.my_role === 'owner';

  // Left in-page nav
  const [activeId, setActiveId] = useState<string>('org');
  const sectionIds = ['org', 'pdf', 'business', 'members', 'notifications', 'plan', 'help'];
  const observers = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Ensure org exists for current user (creates one as owner if none)
        await supabase.rpc('join_default_org', {});

        // Load org info from VIEW (avoid RPC cache issues)
        const { data: d1, error: e1 } = await supabase
          .from('current_org_info')
          .select('*')
          .single();
        if (e1) throw e1;
        const info = d1 as OrgInfo;

        setOrg(info);
        setOrgName(info?.name ?? '');
        setProvince(info?.province ?? '');
        setLogoUrl(info?.logo_url ?? null);
        setIndustry(info?.industry_sector ?? '');
        setSize(info?.company_size ?? '');
        setBudget(info?.ad_budget_range ?? '');
        setPlatforms(info?.platform_focus ?? []);

        // Load member list from VIEW
        const { data: d2, error: e2 } = await supabase
          .from('vw_org_member_list')
          .select('*')
          .order('created_at', { ascending: true });
        if (e2) throw e2;
        setMembers((d2 ?? []) as MemberRow[]);
      } catch (err: any) {
        console.error(err);
        alert(err.message ?? 'โหลด Settings ไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    // in-page anchor highlight
    const opts: IntersectionObserverInit = { rootMargin: '-120px 0px -70% 0px', threshold: 0.1 };
    const cb: IntersectionObserverCallback = (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) setActiveId((en.target as HTMLElement).id);
      });
    };
    const obs = new IntersectionObserver(cb, opts);
    observers.current = obs;
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [loading]);

  const leftNav = useMemo(
    () => [
      { id: 'org', label: 'Organization' },
      { id: 'pdf', label: 'PDF Preview' },
      { id: 'business', label: 'Business Profile' },
      { id: 'members', label: 'Members & Roles' },
      { id: 'notifications', label: 'Notifications & Workflow' },
      { id: 'plan', label: 'Plan & Quota' },
      { id: 'help', label: 'Help & Policy' },
    ],
    []
  );

  const togglePlatform = (p: string) =>
    setPlatforms((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]));

  /* =======================
   * Actions
   * ======================= */
  const saveOrgIdentity = async () => {
    try {
      const patch = { name: orgName, province, logo_url: logoUrl };
      const { error } = await supabase.rpc('update_org_info', { patch });
      if (error) throw error;

      // refresh compact
      setOrg((prev) =>
        prev
          ? {
              ...prev,
              name: patch.name ?? prev.name,
              province: (patch.province ?? prev.province) as any,
              logo_url: (patch.logo_url ?? prev.logo_url) as any,
            }
          : prev
      );

      toast('บันทึก Organization สำเร็จ');
    } catch (e: any) {
      alert(e.message ?? 'บันทึกไม่สำเร็จ');
    }
  };

  const saveBusinessProfile = async () => {
    try {
      const patch = {
        industry_sector: industry || null,
        company_size: size || null,
        ad_budget_range: budget || null,
        platform_focus: platforms,
        province: province || null,
      };
      const { error } = await supabase.rpc('update_org_info', { patch });
      if (error) throw error;

      setOrg((prev) => (prev ? { ...prev, ...patch } as OrgInfo : prev));
      toast('บันทึก Business Profile สำเร็จ');
    } catch (e: any) {
      alert(e.message ?? 'บันทึกไม่สำเร็จ');
    }
  };

  const onUploadLogo = async (file: File) => {
    if (!org?.org_id) return;
    if (file.size > 1_000_000) return alert('ไฟล์ใหญ่เกิน 1MB');
    const okTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!okTypes.includes(file.type)) return alert('รองรับ .png .jpg .jpeg .svg');

    const ext = file.name.split('.').pop();
    const path = `${org.org_id}/logo.${ext}`;
    const { error: upErr } = await supabase.storage.from('org_logos').upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      alert(upErr.message ?? 'อัปโหลดไม่สำเร็จ');
      return;
    }
    const { data } = supabase.storage.from('org_logos').getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    toast('อัปโหลดโลโก้สำเร็จ — อย่าลืมกดบันทึกการ์ดนี้');
  };

  const refreshMembers = async () => {
    const { data, error } = await supabase
      .from('vw_org_member_list')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setMembers((data ?? []) as MemberRow[]);
  };

  const onInvite = async () => {
    if (!isOwner) return;
    if (!inviteEmail) return alert('กรอกอีเมล');
    const { error } = await supabase.rpc('invite_member', { i_email: inviteEmail, i_role: inviteRole });
    if (error) return alert(error.message ?? 'เชิญไม่สำเร็จ');
    setInviteEmail('');
    toast('ส่งคำเชิญแล้ว');
    await refreshMembers();
  };

  const onChangeRole = async (userId: string, newRole: 'creator' | 'approver') => {
    if (!isOwner) return;
    const { error } = await supabase.rpc('update_member_role', { i_user: userId, i_role: newRole });
    if (error) return alert(error.message ?? 'เปลี่ยนสิทธิ์ไม่สำเร็จ');
    toast('เปลี่ยนสิทธิ์สำเร็จ');
    await refreshMembers();
  };

  const onRemove = async (userId: string) => {
    if (!isOwner) return;
    if (!confirm('ยืนยันลบสมาชิกออกจากองค์กร?')) return;
    const { error } = await supabase.rpc('remove_member', { i_user: userId });
    if (error) return alert(error.message ?? 'ลบไม่สำเร็จ');
    toast('ลบสมาชิกสำเร็จ');
    await refreshMembers();
  };

  const saveNotifications = () => {
    // TODO: wire to DB
    toast('บันทึกการแจ้งเตือนแล้ว');
  };

  const saveWorkflow = () => {
    // TODO: wire to DB
    toast('บันทึกเวิร์กโฟลว์แล้ว');
  };

  // Plan & quota placeholders (hook to real endpoint later)
  const planName = 'Free';
  const quotaUsed = 7;
  const quotaTotal = 10;
  const quotaPct = Math.min(100, Math.round((quotaUsed / quotaTotal) * 100));

  if (loading) return <div className="p-6">กำลังโหลด Settings…</div>;
  if (!org) return <div className="p-6 text-red-400">ไม่พบข้อมูลองค์กร</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-6">
        {/* Left Nav */}
        <nav className="lg:sticky lg:top-6 h-max rounded-xl border border-white/10 p-3">
          <div className="text-sm font-medium mb-2 opacity-80">เมนู</div>
          <ul className="space-y-1">
            {leftNav.map((it) => (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  className={`block rounded px-3 py-1.5 text-sm hover:bg-white/5 ${
                    activeId === it.id ? 'bg-white/10' : ''
                  }`}
                >
                  {it.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-xs opacity-70">
            <div className="flex items-center gap-2">
              {org.logo_url ? (
                <img src={org.logo_url} alt="logo" className="h-4 w-4 rounded bg-white/10" />
              ) : (
                <div className="h-4 w-4 rounded bg-white/10" />
              )}
              <span className="truncate">{org.name}</span>
            </div>
            <div className="mt-1">Your Role: {org.my_role}</div>
          </div>
        </nav>

        {/* Right Content */}
        <div className="space-y-6">
          {/* Organization */}
          <section id="org" className="scroll-mt-24">
            <Card
              title="Organization · Identity & Branding"
              subtitle="ตั้งโลโก้และข้อมูลองค์กรสำหรับแอปและ PDF"
              footer={
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-70">สิทธิ์ของคุณ: {org.my_role}</div>
                  <SaveRow
                    onSave={saveOrgIdentity}
                    disabled={!isOwner}
                    note={!isOwner ? 'Owner เท่านั้นที่แก้ไขได้' : ''}
                  />
                </div>
              }
            >
              <div className="flex flex-col md:flex-row gap-6">
                {/* Logo + Actions */}
                <div className="shrink-0">
                  <div className="h-20 w-20 rounded bg-white/5 flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="logo" className="max-h-full max-w-full" />
                    ) : (
                      <span className="text-xs opacity-60">80×80</span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <label
                      className={`cursor-pointer inline-flex items-center gap-2 rounded px-3 py-1.5 bg-white/10 hover:bg-white/15 ${
                        !isOwner ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!isOwner}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onUploadLogo(f);
                        }}
                      />
                      เปลี่ยนโลโก้
                    </label>
                    {logoUrl && (
                      <button
                        disabled={!isOwner}
                        onClick={() => setLogoUrl(null)}
                        className="rounded px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-40"
                      >
                        ลบโลโก้
                      </button>
                    )}
                  </div>
                  <div className="text-xs opacity-60 mt-1">รองรับ .png .jpg .jpeg .svg ≤ 1MB</div>
                </div>

                {/* Fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="ชื่อองค์กร" helper="เช่น Cafe Moon Co., Ltd.">
                    <input
                      className="w-full rounded bg-white/5 px-3 py-2"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={!isOwner}
                    />
                  </Field>
                  <Field label="จังหวัด" helper="ใช้แสดงคำแนะนำพื้นที่ในแดชบอร์ด">
                    <input
                      className="w-full rounded bg-white/5 px-3 py-2"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      disabled={!isOwner}
                    />
                  </Field>

                  <div className="col-span-full">
                    <div className="text-sm opacity-80 mb-1">Preview · App Header</div>
                    <div className="flex items-center gap-2 rounded bg-white/5 p-3">
                      {logoUrl ? (
                        <img src={logoUrl} className="h-6 w-6 rounded bg-white/10" />
                      ) : (
                        <div className="h-6 w-6 rounded bg-white/10" />
                      )}
                      <div className="text-sm">
                        {orgName || 'บริษัทของคุณ'} <span className="opacity-60">· {org.my_role}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* PDF Preview */}
          <section id="pdf" className="scroll-mt-24">
            <Card title="PDF Preview Header" subtitle="ตัวอย่างหัวกระดาษที่ใช้ในไฟล์อนุมัติ (อ่านอย่างเดียว)">
              <div className="rounded border border-white/10 p-4 bg-white/5">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} className="h-8 w-8 rounded bg-white/10" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-white/10" />
                  )}
                  <div className="text-sm">
                    <div className="font-medium">{orgName || 'บริษัทของคุณ'}</div>
                    <div className="opacity-70">แบบขออนุมัติแคมเปญโฆษณา (ADPAAS)</div>
                  </div>
                </div>
              </div>
              <div className="text-xs opacity-70">* ใช้หัวกระดาษนี้เวลาสร้าง PDF อนุมัติ</div>
            </Card>
          </section>

          {/* Business Profile */}
          <section id="business" className="scroll-mt-24">
            <Card
              title="Business Profile · Segment & Readiness"
              subtitle="ข้อมูลนี้ใช้วิเคราะห์แบบรวมเพื่อพัฒนาผลิตภัณฑ์และการตลาด"
              footer={<SaveRow onSave={saveBusinessProfile} disabled={!isOwner} note={!isOwner ? 'Owner เท่านั้นที่แก้ไขได้' : ''} />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Industry Sector">
                  <select
                    className="w-full rounded bg-white/5 px-3 py-2"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    disabled={!isOwner}
                  >
                    <option value="">— เลือก —</option>
                    {INDUSTRIES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Company Size">
                  <select
                    className="w-full rounded bg-white/5 px-3 py-2"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    disabled={!isOwner}
                  >
                    <option value="">— เลือก —</option>
                    {COMPANY_SIZES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Ad Budget Range (ต่อเดือน)">
                  <select
                    className="w-full rounded bg-white/5 px-3 py-2"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    disabled={!isOwner}
                  >
                    <option value="">— เลือก —</option>
                    {BUDGETS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Province" helper="ใช้สำหรับการแนะนำเบื้องต้น">
                  <input
                    className="w-full rounded bg-white/5 px-3 py-2"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    disabled={!isOwner}
                  />
                </Field>

                <div className="col-span-full">
                  <div className="text-sm mb-1">Platform Focus</div>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => (isOwner ? togglePlatform(p) : null)}
                        className={`px-3 py-1.5 rounded-lg border ${
                          platforms?.includes(p)
                            ? 'bg-emerald-600 border-emerald-500'
                            : 'bg-white/5 border-white/10'
                        } ${!isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs opacity-70 mt-1">เลือกได้หลายแพลตฟอร์ม</div>
                </div>
              </div>
            </Card>
          </section>

          {/* Members */}
          <section id="members" className="scroll-mt-24">
            <div className="mb-2 text-sm opacity-80">Your Role: {org.my_role}</div>

            <Card title="Invite Member" subtitle="เชิญด้วยอีเมลและกำหนดสิทธิ์เริ่มต้น" footer={<SaveRow onSave={onInvite} disabled={!isOwner} label="ส่งคำเชิญ" note={!isOwner ? 'Owner เท่านั้น' : ''} />}>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[260px] max-w-[360px]">
                  <Field label="อีเมล">
                    <input
                      className="w-full rounded bg-white/5 px-3 py-2"
                      placeholder="email@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={!isOwner}
                    />
                  </Field>
                </div>
                <div>
                  <Field label="สิทธิ์เริ่มต้น">
                    <select
                      className="rounded bg-white/5 px-3 py-2"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      disabled={!isOwner}
                    >
                      <option value="creator">Creator</option>
                      <option value="approver">Approver</option>
                    </select>
                  </Field>
                </div>
              </div>
              <div className="text-xs opacity-70 mt-2">
                Creator: สร้าง/แก้คำขอของตนเอง · Approver: เห็น/อนุมัติคำขอทั้งหมด
              </div>
            </Card>

            <Card title="Members & Roles" subtitle="จัดการสิทธิ์ของสมาชิกในทีม">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left opacity-70">
                    <tr>
                      <th className="py-2 pr-4">ชื่อ</th>
                      <th className="py-2 pr-4">อีเมล</th>
                      <th className="py-2 pr-4">สิทธิ์</th>
                      <th className="py-2 pr-4">สถานะ</th>
                      <th className="py-2 pr-4 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((r, i) => (
                      <tr key={i} className="border-t border-white/10">
                        <td className="py-2 pr-4">{r.full_name ?? '-'}</td>
                        <td className="py-2 pr-4">{r.email ?? '-'}</td>
                        <td className="py-2 pr-4">
                          {r.role}
                          {r.role === 'owner' && (
                            <span className="ml-1 text-xs opacity-60">(Owner)</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge tone={r.status === 'active' ? 'ok' : 'warn'}>{r.status}</Badge>
                        </td>
                        <td className="py-2 pr-0">
                          <div className="flex justify-end gap-2">
                            {r.user_id && r.role !== 'owner' ? (
                              <>
                                <select
                                  className="rounded bg-white/5 px-2 py-1"
                                  value={r.role}
                                  onChange={(e) =>
                                    onChangeRole(r.user_id!, e.target.value as any)
                                  }
                                  disabled={!isOwner}
                                >
                                  <option value="creator">Creator</option>
                                  <option value="approver">Approver</option>
                                </select>
                                <button
                                  onClick={() => onRemove(r.user_id!)}
                                  disabled={!isOwner}
                                  className="rounded px-2 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-40"
                                >
                                  ลบ
                                </button>
                              </>
                            ) : (
                              <span className="opacity-60 text-xs">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {members.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center opacity-70">
                          ยังไม่มีสมาชิก — ใช้การ์ด “Invite Member” ด้านบน
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* Notifications & Workflow */}
          <section id="notifications" className="scroll-mt-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                title="Email Notifications"
                subtitle="เลือกเหตุการณ์ที่ต้องการรับอีเมลสรุป"
                footer={<SaveRow onSave={saveNotifications} disabled={!isOwner} />}
              >
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={notifNewRequest}
                    onChange={(e) => setNotifNewRequest(e.target.checked)}
                    disabled={!isOwner}
                  />
                  แจ้ง Approver เมื่อมี Request ใหม่
                </label>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={notifResult}
                    onChange={(e) => setNotifResult(e.target.checked)}
                    disabled={!isOwner}
                  />
                  แจ้ง Creator เมื่อ Approve / Needs Changes
                </label>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={notifQuota}
                    onChange={(e) => setNotifQuota(e.target.checked)}
                    disabled={!isOwner}
                  />
                  แจ้ง Owner เมื่อใช้โควตาถึง 70%
                </label>
                <Field label="Daily Digest Time" helper="เวลาส่งสรุปรายวัน (ค่าเริ่ม 09:00)">
                  <input
                    type="time"
                    className="rounded bg-white/5 px-3 py-2"
                    value={digestTime}
                    onChange={(e) => setDigestTime(e.target.value)}
                    disabled={!isOwner}
                  />
                </Field>
              </Card>

              <Card
                title="Approval Workflow"
                subtitle="กำหนดรูปแบบการอนุมัติ"
                footer={<SaveRow onSave={saveWorkflow} disabled={!isOwner} />}
                tone={'default'}
              >
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    name="wf"
                    checked={workflowMode === 'single'}
                    onChange={() => setWorkflowMode('single')}
                    disabled={!isOwner}
                  />
                  Single approver
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="wf"
                    checked={workflowMode === 'anyof'}
                    onChange={() => setWorkflowMode('anyof')}
                    disabled={!isOwner}
                  />
                  Any-of (หลายคน ใครอนุมัติก็ผ่าน)
                </label>
                <div className="text-xs opacity-70 mt-2">* โหมดขั้นสูงเปิดใน Starter+</div>
              </Card>
            </div>
          </section>

          {/* Plan & Quota */}
          <section id="plan" className="scroll-mt-24">
            <Card title="Plan & Quota" subtitle="สถานะการใช้งานและการอัปเกรด">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="opacity-70">Current Plan</div>
                  <div className="text-base font-semibold">{planName}</div>
                </div>
                <div className="flex-1 min-w-[200px] max-w-[460px]">
                  <div className="text-sm opacity-80 mb-1">
                    Requests: {quotaUsed}/{quotaTotal} ({quotaPct}%)
                  </div>
                  <div className="h-2 rounded bg-white/10 overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${quotaPct}%` }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="rounded px-4 py-2 bg-amber-600 hover:bg-amber-500">
                    Upgrade
                  </button>
                  <button className="rounded px-4 py-2 bg-white/10 hover:bg-white/15">
                    Add-ons
                  </button>
                </div>
              </div>
            </Card>
          </section>

          {/* Help & Policy */}
          <section id="help" className="scroll-mt-24">
            <Card title="Help & Policy" subtitle="ทรัพยากรช่วยเหลือและนโยบายใช้งาน">
              <ul className="list-disc pl-6 text-sm space-y-1">
                <li>อัปโหลดโลโก้: รองรับ .png .jpg .jpeg .svg ขนาด ≤ 1MB</li>
                <li>Business Profile ใช้วิเคราะห์แบบรวม (ไม่ระบุตัวบุคคล)</li>
                <li>SLA: Free (no guarantee), Starter 48 ชม., Growth 24 ชม., Business 8 ชม.</li>
              </ul>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

/* =======================
 * Tiny toast
 * ======================= */
function toast(msg: string) {
  if (typeof window !== 'undefined') {
    const el = document.createElement('div');
    el.textContent = msg;
    el.className =
      'fixed z-[9999] bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/80 text-white text-sm shadow-lg';
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s ease';
      setTimeout(() => el.remove(), 300);
    }, 1200);
  }
}
