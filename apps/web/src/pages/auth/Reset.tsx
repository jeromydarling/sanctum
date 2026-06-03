import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Logo } from '../../components/Logo.js';
import { Button, Input, Card, CardBody } from '../../components/ui.js';
import { api } from '../../lib/api.js';
import { notifyError } from '../../lib/errors.js';

export default function Reset() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setBusy(true);
    try {
      await api('/auth/reset', { auth: false, body: { token, password } });
      setDone(true);
      toast.success('Password updated — you can sign in now');
      setTimeout(() => navigate('/login'), 1500);
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6 py-12">
      <div className="w-full max-w-sm">
        <Logo />
        {!token ? (
          <Card className="mt-6"><CardBody className="text-center">
            <h1 className="font-display text-2xl font-bold">Invalid link</h1>
            <p className="mt-2 text-sm text-stone-warm">This reset link is missing its token. Request a new one.</p>
            <Button className="mt-4" asLink="/forgot">Request a new link</Button>
          </CardBody></Card>
        ) : done ? (
          <Card className="mt-6"><CardBody className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success"><Check className="h-6 w-6" /></div>
            <h1 className="mt-3 font-display text-2xl font-bold">All set</h1>
            <p className="mt-2 text-sm text-stone-warm">Redirecting you to sign in…</p>
          </CardBody></Card>
        ) : (
          <>
            <h1 className="mt-6 font-display text-3xl font-bold">Choose a new password</h1>
            <Card className="mt-5"><form onSubmit={submit} className="space-y-4 p-6">
              <Input label="New password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
              <Input label="Confirm password" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <Button type="submit" full loading={busy}>Update password</Button>
              <p className="text-center text-xs text-stone-warm"><Link to="/login" className="underline">Back to sign in</Link></p>
            </form></Card>
          </>
        )}
      </div>
    </div>
  );
}
