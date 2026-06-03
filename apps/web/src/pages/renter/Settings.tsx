import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Input, Select, Modal } from '../../components/ui.js';
import { useStore, wt, getData } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { profile } from '../../lib/selectors.js';
import { api } from '../../lib/api.js';
import { isLive, getToken } from '../../lib/config.js';
import { notifyError } from '../../lib/errors.js';
import { ORG_TYPES, ORG_TYPE_LABELS, type Profile } from '@sanctum/shared';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const data = useStore((d) => d);
  const me = profile(data, user!.id);
  const [form, setForm] = useState<Profile | null>(me || null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!form) return null;
  function set<K extends keyof Profile>(k: K, v: Profile[K]) { setForm((f) => (f ? { ...f, [k]: v } : f)); }

  async function save() {
    setBusy(true);
    try { await wt('profiles', form!); toast.success('Profile saved'); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  }
  async function exportData() {
    if (isLive()) {
      const res = await fetch('/api/account/export', { headers: { Authorization: `Bearer ${getToken()}` } });
      downloadBlob(await res.blob(), 'sanctum-export.json');
    } else {
      downloadBlob(new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' }), 'sanctum-export-demo.json');
    }
    toast.success('Your data is downloading');
  }
  async function deleteAccount() {
    try { if (isLive()) await api('/account/delete', { body: {} }); toast.success('Account deleted'); logout(); navigate('/'); }
    catch (e) { notifyError(e); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Your profile and account." />
      <Card><CardBody className="space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <Input label="Full name" value={form.full_name || ''} onChange={(e) => set('full_name', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Organization (optional)" value={form.organization_name || ''} onChange={(e) => set('organization_name', e.target.value)} />
          <Select label="Organization type" value={form.organization_type || 'individual'} onChange={(e) => set('organization_type', e.target.value as Profile['organization_type'])}>
            {ORG_TYPES.map((t) => <option key={t} value={t}>{ORG_TYPE_LABELS[t]}</option>)}
          </Select>
          <Input label="Phone" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Email" value={form.email} disabled />
        </div>
        <div className="flex justify-end"><Button onClick={save} loading={busy}>Save</Button></div>
      </CardBody></Card>

      <Card className="mt-5"><CardBody className="space-y-3">
        <h2 className="font-semibold">Your data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}><Download className="h-4 w-4" /> Export my data</Button>
          <Button variant="ghost" className="text-danger hover:bg-danger/5" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete my account</Button>
        </div>
      </CardBody></Card>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete your account?">
        <p className="text-sm text-stone-warm">This permanently erases your bookings, documents, and reviews. This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteOpen(false)}>Keep my account</Button><Button variant="danger" onClick={deleteAccount}>Delete everything</Button></div>
      </Modal>
    </div>
  );
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
