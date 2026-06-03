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
            <p>We share data only with the processors that make Sanctum work (such as our hosting and payment providers), and only as much as each needs. We do not sell personal information.</p>
          </Section>
          <Section title="Contact">
            <p>Questions? Email <a className="text-primary hover:underline" href="mailto:help@sanctum.app">help@sanctum.app</a> and a real person will answer.</p>
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
