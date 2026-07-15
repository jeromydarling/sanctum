import { MarketingNav } from '../../components/marketing/MarketingNav.js';
import { Footer, MarketingShell } from '../../components/marketing/Footer.js';

export default function Privacy() {
  return (
    <MarketingShell>
      <MarketingNav />
      <article className="container-x max-w-3xl py-16">
        <h1 className="font-display text-4xl font-bold">Privacy</h1>
        <p className="mt-2 text-sm text-stone-warm">Last updated June 2026</p>
        <div className="mt-8 space-y-6 leading-relaxed text-ink/80">
          <p>We treat your data the way we'd want ours treated: collected only when it's needed, used only to run the service you asked for, and never sold. This page explains what we keep and the control you have over it.</p>
          <Section title="What we collect">
            <ul className="ml-5 list-disc space-y-1">
              <li>Account details you provide (name, email, organization).</li>
              <li>Spaces, bookings, documents, and messages you create in the product.</li>
              <li>Basic technical logs needed to keep the service secure and reliable.</li>
            </ul>
          </Section>
          <Section title="How we use it">
            <p>To operate your account, process bookings and payments, send the notifications you expect, and improve the product. Payments are handled by Stripe; we never store full card numbers.</p>
          </Section>
          <Section title="Your controls">
            <p>From <strong>Settings</strong> you can export everything we hold about you as a single file, and you can delete your account at any time. Deleting your account erases the records you own from our database.</p>
          </Section>
          <Section title="Data sharing">
            <p>We share data only with the processors that make Sanctum work — our hosting and infrastructure provider (Cloudflare), our payment processor (Stripe), and our email delivery — and only as much as each needs to run the service. We do not sell personal information. When you book a space, the relevant details are shared with that Operator (and vice-versa) so the booking can happen.</p>
          </Section>
          <Section title="Cookies & analytics">
            <p>We use a small number of strictly necessary cookies to keep you signed in. For usage measurement we use privacy-first, cookieless analytics that don’t track you across sites or build an advertising profile.</p>
          </Section>
          <Section title="Retention">
            <p>We keep your data for as long as your account is active. When you delete your account we erase the records you own; limited transactional records (for example, payment and tax records) may be retained where the law requires.</p>
          </Section>
          <Section title="Contact">
            <p>Questions, or want to exercise a data right? Email <a className="text-primary hover:underline" href="mailto:help@sanctum.garden">help@sanctum.garden</a> and a real person will answer. See also our <a className="text-primary hover:underline" href="/terms">Terms of Service</a>.</p>
          </Section>
        </div>
      </article>
      <Footer />
    </MarketingShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
