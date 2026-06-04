import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Network as NetworkIcon, Plus, ExternalLink } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Input, Select, Badge, EmptyState, Modal } from '../../components/ui.js';
import { useStore, wt } from '../../lib/store.js';
import { formatCents } from '../../lib/format.js';
import { genId } from '../../lib/ids.js';
import { notifyError } from '../../lib/errors.js';
import { slugify, type Network } from '@sanctum/shared';

export default function Networks() {
  const data = useStore((d) => d);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader title="Networks" subtitle="White-label licensing for dioceses, associations & conferences." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New network</Button>} />
      {data.networks.length === 0 ? (
        <EmptyState icon={<NetworkIcon className="h-8 w-8" />} title="No networks yet" body="Create a white-label network to bring many communities under one branded page — the diocesan/denominational sales channel." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create a network</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.networks.map((n) => {
            const facs = data.facilities.filter((f) => f.network_id === n.id);
            const ids = new Set(facs.map((f) => f.id));
            const gmv = data.bookings.filter((b) => ids.has(b.facility_id) && ['confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + b.subtotal_cents, 0);
            const owner = data.profiles.find((p) => p.id === n.owner_id);
            return (
              <Card key={n.id}><CardBody>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-card" style={{ background: n.brand_primary }} />
                    <div>
                      <h3 className="font-semibold">{n.name}</h3>
                      <p className="text-xs text-stone-warm">Owner: {owner?.full_name || owner?.email || '—'}</p>
                    </div>
                  </div>
                  <Link to={`/n/${n.slug}`} className="text-primary hover:underline"><ExternalLink className="h-4 w-4" /></Link>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <Badge tone="primary">{facs.length} communities</Badge>
                  <span className="tabular font-semibold text-success">{formatCents(gmv)} GMV</span>
                </div>
              </CardBody></Card>
            );
          })}
        </div>
      )}
      {open && <NewNetworkModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewNetworkModal({ onClose }: { onClose: () => void }) {
  const data = useStore((d) => d);
  const operators = data.profiles.filter((p) => p.role === 'operator' || p.role === 'staff');
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState(operators[0]?.id || '');
  const [color, setColor] = useState('#4338ca');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) { toast.error('Name the network'); return; }
    if (!ownerId) { toast.error('Choose an owner'); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const net: Network = {
        id: genId('net'), owner_id: ownerId, name: name.trim(),
        slug: `${slugify(name)}-${genId('x').slice(-4)}`, description: null,
        brand_primary: color, logo_url: null, created_at: now, updated_at: now,
      };
      await wt('networks', net);
      toast.success('Network created');
      onClose();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="New network">
      <div className="space-y-3">
        <Input label="Network name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Archdiocese of Saint Paul" />
        <Select label="Owner (network admin)" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          {operators.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
        </Select>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Brand color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-black/10" />
        </div>
        <p className="text-xs text-stone-warm">The owner manages branding and adds their communities from their dashboard.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={create}>Create network</Button></div>
      </div>
    </Modal>
  );
}
