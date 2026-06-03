import { useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, Send } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Input, Textarea } from '../../components/ui.js';
import { useStore, getData, touch } from '../../lib/store.js';
import { api } from '../../lib/api.js';
import { isLive } from '../../lib/config.js';
import { genId } from '../../lib/ids.js';
import { notifyError } from '../../lib/errors.js';

export default function Announcements() {
  const data = useStore((d) => d);
  const operatorCount = data.profiles.filter((p) => p.role === 'operator' || p.role === 'staff').length;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!title.trim()) { toast.error('Add a title'); return; }
    setBusy(true);
    try {
      if (isLive()) {
        const res = await api<{ recipients: number }>('/admin/announce', { body: { title, body } });
        toast.success(`Sent to ${res.recipients} operator${res.recipients !== 1 ? 's' : ''}`);
      } else {
        const d = getData();
        const now = new Date().toISOString();
        d.profiles.filter((p) => p.role === 'operator' || p.role === 'staff').forEach((p) => {
          d.notifications.push({ id: genId('ntf'), user_id: p.id, title, body: body || null, type: 'announcement', is_read: 0, action_url: null, created_at: now, updated_at: now });
        });
        touch();
        toast.success(`Sent to ${operatorCount} operator${operatorCount !== 1 ? 's' : ''}`);
      }
      setTitle(''); setBody('');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Announcements" subtitle="Send a platform-wide notice to every facility operator." />
      <Card><CardBody className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-stone-warm"><Megaphone className="h-4 w-4 text-primary" /> Reaching {operatorCount} operator{operatorCount !== 1 ? 's' : ''}</div>
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New: AI policy builder is live" />
        <Textarea label="Message" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share what's new, a tip, or an update…" />
        <div className="flex justify-end"><Button loading={busy} onClick={send}><Send className="h-4 w-4" /> Send announcement</Button></div>
      </CardBody></Card>
    </div>
  );
}
