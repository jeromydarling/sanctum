import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, Badge, Input, EmptyState } from '../../components/ui.js';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../lib/store.js';
import { initials } from '../../lib/format.js';

const ROLE_TONE = { operator: 'primary', renter: 'gold', admin: 'danger', staff: 'neutral' } as const;

export default function AdminUsers() {
  const data = useStore((d) => d);
  const [q, setQ] = useState('');
  const users = data.profiles.filter((p) =>
    !q || p.full_name?.toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Users" subtitle="Everyone on the platform." />
      <div className="mb-4 max-w-sm"><Input placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {users.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No users found" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-black/5 bg-cream text-left text-xs text-stone-warm">
              <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Role</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-semibold text-white">{initials(u.full_name)}</span>{u.full_name || '—'}</div></td>
                  <td className="px-4 py-3 text-stone-warm">{u.email}</td>
                  <td className="px-4 py-3 text-stone-warm">{u.organization_name || '—'}</td>
                  <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
