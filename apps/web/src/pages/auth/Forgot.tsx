import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Check } from 'lucide-react';
import { Logo } from '../../components/Logo.js';
import { Button, Input, Card, CardBody } from '../../components/ui.js';
import { api } from '../../lib/api.js';
import { notifyError } from '../../lib/errors.js';
import { Turnstile, type TurnstileState } from '../../components/Turnstile.js';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ts, setTs] = useState<TurnstileState>({ active: false, token: null });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ts.active && !ts.token) { notifyError(new Error('Please complete the verification challenge')); return; }
    setBusy(true);
    try {
      await api('/auth/forgot', { auth: false, body: { email, turnstile_token: ts.token } });
      setSent(true);
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6 py-12">
      <div className="w-full max-w-sm">
        <Logo />
        <Link to="/login" className="mt-6 inline-flex items-center gap-1 text-sm text-stone-warm hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
        {sent ? (
          <Card className="mt-4"><CardBody className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success"><Check className="h-6 w-6" /></div>
            <h1 className="mt-3 font-display text-2xl font-bold">Check your inbox</h1>
            <p className="mt-2 text-sm text-stone-warm">If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. It's valid for one hour.</p>
          </CardBody></Card>
        ) : (
          <>
            <h1 className="mt-4 font-display text-3xl font-bold">Reset your password</h1>
            <p className="mt-1 text-sm text-stone-warm">Enter your email and we'll send you a reset link.</p>
            <Card className="mt-5"><form onSubmit={submit} className="space-y-4 p-6">
              <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@community.org" />
              <Turnstile onChange={setTs} />
              <Button type="submit" full loading={busy}><Mail className="h-4 w-4" /> Send reset link</Button>
            </form></Card>
          </>
        )}
      </div>
    </div>
  );
}
