'use client';
import { useEffect, useState } from 'react';
import { ensureDefaultOrg, listOrgMembers, inviteMember, updateMemberRole, removeMember, getOrgInfo } from '@/lib/orgs';
import type { MemberRow, OrgInfo } from '@/lib/types';

export default function MembersPage() {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'approver' | 'creator'>('creator');

  const refresh = async () => {
    await ensureDefaultOrg();
    const info = await getOrgInfo();
    setOrg(info);
    const list = await listOrgMembers();
    setRows(list);
  };

  useEffect(() => {
    (async () => {
      try { await refresh(); } finally { setLoading(false); }
    })();
  }, []);

  const isOwner = org?.my_role === 'owner';

  const onInvite = async () => {
    if (!inviteEmail) return alert('กรอกอีเมล');
    await inviteMember(inviteEmail, inviteRole);
    setInviteEmail('');
    await refresh();
    alert('ส่งคำเชิญแล้ว');
  };

  const onChangeRole = async (userId: string, role: 'approver' | 'creator') => {
    await updateMemberRole(userId, role);
    await refresh();
  };

  const onRemove = async (userId: string) => {
    if (!confirm('ยืนยันลบสมาชิกออกจากองค์กร?')) return;
    await removeMember(userId);
    await refresh();
  };

  if (loading) return <div className="p-6">กำลังโหลด...</div>;
  if (!org) return <div className="p-6 text-red-400">ไม่พบข้อมูลองค์กร</div>;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings — Members & Roles</h1>
        <div className="text-sm opacity-70">Your Role: {org.my_role}</div>
      </div>

      {/* Invite */}
      <div className="rounded-2xl border border-white/10 p-5 space-y-3">
        <h2 className="text-lg font-semibold">เชิญสมาชิก</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <input className="rounded bg-white/5 px-3 py-2" placeholder="email@example.com"
                 value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} disabled={!isOwner}/>
          <select className="rounded bg-white/5 px-3 py-2" value={inviteRole} onChange={e=>setInviteRole(e.target.value as any)} disabled={!isOwner}>
            <option value="creator">Creator</option>
            <option value="approver">Approver</option>
          </select>
          <button onClick={onInvite} disabled={!isOwner} className="rounded px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40">
            ส่งคำเชิญ
          </button>
          {!isOwner && <span className="text-xs opacity-70">(Owner เท่านั้น)</span>}
        </div>
        <div className="text-xs opacity-70">
          หมายเหตุ: Creator สร้าง/แก้คำขอของตนเอง, Approver เห็นและอนุมัติคำขอทั้งหมดในองค์กร
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg font-semibold mb-3">สมาชิกในองค์กร</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2 pr-4">ชื่อ</th>
                <th className="py-2 pr-4">อีเมล</th>
                <th className="py-2 pr-4">สิทธิ์</th>
                <th className="py-2 pr-4">สถานะ</th>
                <th className="py-2 pr-4">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} className="border-t border-white/10">
                  <td className="py-2 pr-4">{r.full_name ?? '-'}</td>
                  <td className="py-2 pr-4">{r.email ?? '-'}</td>
                  <td className="py-2 pr-4">
                    {r.role}
                    {r.role === 'owner' && <span className="ml-2 text-xs opacity-70">(Owner)</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${r.status==='active'?'bg-emerald-700':'bg-yellow-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {r.user_id && r.role !== 'owner' ? (
                      <div className="flex gap-2">
                        <select
                          className="rounded bg-white/5 px-2 py-1"
                          value={r.role}
                          onChange={e=>onChangeRole(r.user_id!, e.target.value as any)}
                          disabled={!isOwner}
                        >
                          <option value="creator">Creator</option>
                          <option value="approver">Approver</option>
                        </select>
                        <button
                          onClick={()=>onRemove(r.user_id!)}
                          disabled={!isOwner}
                          className="rounded px-2 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-40"
                        >
                          ลบ
                        </button>
                      </div>
                    ) : (
                      <span className="opacity-60 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length===0 && (
                <tr><td colSpan={5} className="py-6 text-center opacity-70">ยังไม่มีสมาชิก</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
