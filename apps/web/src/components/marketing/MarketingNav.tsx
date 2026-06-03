import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui.js';
import { Logo } from '../Logo.js';
import { useAuth, homeForCurrent } from '../../lib/useHome.js';
import { cn } from '../../lib/cn.js';

const LINKS = [
  { to: '/about', label: 'Our mission' },
  { to: '/find', label: 'Find a space' },
  { to: '/pricing', label: 'Pricing' },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('sticky top-0 z-40 transition-all', scrolled ? 'border-b border-black/5 bg-cream/85 backdrop-blur-md' : 'bg-transparent')}>
      <nav className="container-x flex h-16 items-center justify-between">
        <Logo />
        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="link-underline text-sm font-medium text-ink/80 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button size="sm" onClick={() => navigate(homeForCurrent(user.role))}>Go to dashboard</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asLink="/login">Sign in</Button>
              <Button size="sm" asLink="/signup">Open your doors</Button>
            </>
          )}
        </div>
        <button className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-black/5 bg-cream px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="py-1 text-sm font-medium">{l.label}</Link>
            ))}
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" full asLink="/login">Sign in</Button>
              <Button size="sm" full asLink="/signup">Get started</Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
