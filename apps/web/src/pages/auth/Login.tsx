import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Building2, User, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { Logo } from '../../components/Logo.js';
import { Button, Input, Card, CardBody } from '../../components/ui.js';
import { useAuth } from '../../lib/auth.js';
import { homeForRole } from '../../lib/nav.js';
import { notifyError } from '../../lib/errors.js';

export default function Login() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const dest = (location.state as { from?: string })?.from;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      navigate(dest || homeForRole(u.role));
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  function demo(role: 'operator' | 'renter' | 'admin') {
    demoLogin(role);
    navigate(homeForRole(role === 'admin' ? 'admin' : role));
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="mesh-gradient absolute inset-0 opacity-60" />
        <div className="absolute -left-20 top-32 h-72 w-72 rounded-full bg-primary-500/30 blur-3xl animate-blob" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo className="text-white" />
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight">Open doors.<br />Stronger communities.</h1>
            <p className="mt-4 max-w-sm text-white/70">Welcome back. Your spaces, your renters, and your community are waiting.</p>
          </div>
          <p className="text-sm text-white/50">Priced for access, not extraction.</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center bg-cream px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden"><Logo /></div>
          <h2 className="mt-6 font-display text-3xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-stone-warm">New here? <Link to="/signup" className="font-medium text-primary hover:underline">Open your doors →</Link></p>

          <Card className="mt-6 border-primary/10 bg-primary-50/40">
            <CardBody>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-700"><Sparkles className="h-4 w-4" /> Explore instantly — no signup</p>
              <p className="mt-1 text-xs text-stone-warm">One click drops you into a full sandbox with demo data.</p>
              <div className="mt-3 grid gap-2">
                <DemoBtn icon={Building2} label="Tour as a facility operator" onClick={() => demo('operator')} />
                <DemoBtn icon={User} label="Tour as a renter" onClick={() => demo('renter')} />
                <DemoBtn icon={ShieldCheck} label="Tour as platform admin" onClick={() => demo('admin')} />
              </div>
            </CardBody>
          </Card>

          <div className="my-6 flex items-center gap-3 text-xs text-stone-warm">
            <span className="h-px flex-1 bg-black/10" /> or sign in with email <span className="h-px flex-1 bg-black/10" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@community.org" />
            <div>
              <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <Link to="/forgot" className="mt-1.5 block text-right text-xs font-medium text-primary hover:underline">Forgot your password?</Link>
            </div>
            <Button type="submit" full loading={busy}>Sign in <ArrowRight className="h-4 w-4" /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function DemoBtn({ icon: Icon, label, onClick }: { icon: typeof Building2; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-card border border-black/10 bg-white px-3.5 py-2.5 text-left text-sm font-medium transition hover:border-primary/40 hover:bg-primary-50">
      <Icon className="h-4 w-4 text-primary" /> {label}
    </button>
  );
}
