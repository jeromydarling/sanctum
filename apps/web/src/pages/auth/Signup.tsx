import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, User, ArrowRight } from 'lucide-react';
import { Logo } from '../../components/Logo.js';
import { Button, Input, Card } from '../../components/ui.js';
import { useAuth } from '../../lib/auth.js';
import { homeForRole } from '../../lib/nav.js';
import { notifyError } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';
import type { Role } from '@sanctum/shared';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('operator');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', organization_name: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await signup({ ...form, role });
      // New operators go through the guided AI setup; renters head to discovery.
      navigate(u.role === 'operator' ? '/onboarding' : homeForRole(u.role));
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6 py-12">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="mt-6 font-display text-3xl font-bold">Open your doors</h1>
        <p className="mt-1 text-sm text-stone-warm">Already with us? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <RoleCard active={role === 'operator'} onClick={() => setRole('operator')} icon={Building2} title="I manage a space" sub="Open your facility to the community" />
          <RoleCard active={role === 'renter'} onClick={() => setRole('renter')} icon={User} title="I'm looking to rent" sub="Find a place for your event" />
        </div>

        <Card className="mt-5"><form onSubmit={submit} className="space-y-4 p-6">
          <Input label="Your name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Grace Okafor" />
          <Input label={role === 'operator' ? 'Community / organization name' : 'Organization (optional)'} required={role === 'operator'} value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} placeholder={role === 'operator' ? 'St. Brigid Community Center' : 'Northside Youth Theater'} />
          <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@community.org" />
          <Input label="Password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="At least 8 characters." placeholder="••••••••" />
          <Button type="submit" full loading={busy}>Create my account <ArrowRight className="h-4 w-4" /></Button>
          <p className="text-center text-xs text-stone-warm">Free for 30 days. No card required. By continuing you agree to our <Link to="/privacy" className="underline">privacy commitment</Link>.</p>
        </form></Card>
      </div>
    </div>
  );
}

function RoleCard({ active, onClick, icon: Icon, title, sub }: { active: boolean; onClick: () => void; icon: typeof Building2; title: string; sub: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-card border-2 p-4 text-left transition', active ? 'border-primary bg-primary-50' : 'border-black/10 bg-white hover:border-primary/30')}>
      <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-stone-warm')} />
      <div className="mt-2 text-sm font-semibold">{title}</div>
      <div className="mt-0.5 text-xs text-stone-warm">{sub}</div>
    </button>
  );
}
