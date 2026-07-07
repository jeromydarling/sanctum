import { Link } from 'react-router-dom';
import { Logo } from '../Logo.js';

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-stone-warm">
            Open doors. Stronger communities. The tools that help local communities share what they already have.
          </p>
        </div>
        <FooterCol title="Platform" links={[
          { to: '/features', label: 'Features' },
          { to: '/find', label: 'Find a space' },
          { to: '/pricing', label: 'Pricing' },
          { to: '/signup', label: 'List your space' },
          { to: '/login', label: 'Sign in' },
        ]} />
        <FooterCol title="Company" links={[
          { to: '/about', label: 'Our mission' },
          { to: '/privacy', label: 'Privacy' },
        ]} />
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Get in touch</h4>
          <a href="mailto:hello@sanctum.app" className="block text-sm text-stone-warm hover:text-ink">hello@sanctum.app</a>
          <a href="mailto:help@sanctum.app" className="block text-sm text-stone-warm hover:text-ink">help@sanctum.app</a>
        </div>
      </div>
      <div className="border-t border-black/5">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-stone-warm sm:flex-row">
          <p>© {new Date().getFullYear()} Sanctum. Priced for access, not extraction.</p>
          <p>Built for the communities that hold a neighborhood together.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-stone-warm hover:text-ink">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return <div id="main" tabIndex={-1} className="flex min-h-screen flex-col outline-none">{children}</div>;
}
