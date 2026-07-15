import { Link } from 'react-router-dom';
import { MarketingNav } from '../../components/marketing/MarketingNav.js';
import { Footer, MarketingShell } from '../../components/marketing/Footer.js';

/**
 * Terms of Service + Cancellation/Refund policy. Plain-language but functional
 * marketplace terms. Have counsel review before launch and set the entity /
 * governing-law details.
 */
export default function Terms() {
  return (
    <MarketingShell>
      <MarketingNav />
      <article className="container-x max-w-3xl py-16">
        <h1 className="font-display text-4xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-stone-warm">Last updated {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        <div className="mt-8 space-y-6 leading-relaxed text-ink/80">
          <p>Welcome to Sanctum. These Terms are an agreement between you and Sanctum (“Sanctum,” “we,” “us”). By creating an account or using the service, you agree to these Terms and to our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. If you don’t agree, please don’t use Sanctum.</p>

          <Section title="What Sanctum is">
            <p>Sanctum is a marketplace and set of tools that helps community spaces (“Operators”) list rooms and take bookings, and helps groups (“Renters”) find and book them. <strong>Sanctum is not a party to the rental agreement between an Operator and a Renter</strong>, is not the owner or manager of any space, and does not inspect or guarantee any listing. The agreement for use of a space is between the Operator and the Renter, on the Operator’s posted terms and use agreement.</p>
          </Section>

          <Section title="Accounts">
            <p>You must provide accurate information, keep your credentials secure, and be responsible for activity under your account. You must be able to form a binding contract and use the service lawfully. We may suspend or close accounts that violate these Terms.</p>
          </Section>

          <Section title="Operator responsibilities">
            <ul className="ml-5 list-disc space-y-1">
              <li>List spaces you’re authorized to rent, described accurately, at prices you set (including free or donation).</li>
              <li>Honor confirmed bookings, hold any required insurance, and comply with the laws, permits, and safety rules that apply to your space.</li>
              <li>Set and clearly communicate your own cancellation, deposit, and use policies.</li>
              <li>To receive payouts, complete onboarding with our payments processor, Stripe, and accept its terms.</li>
            </ul>
          </Section>

          <Section title="Renter responsibilities">
            <p>Use spaces only for the booked purpose, follow the Operator’s posted rules and use agreement, leave the space as you found it, carry any required insurance, and pay the amounts due. Typing your name to sign a use agreement is a legally binding electronic signature.</p>
          </Section>

          <Section title="Payments, fees & taxes">
            <p>Payments are processed by <strong>Stripe</strong>; we never store full card numbers. Renters are charged the amounts shown at booking. Sanctum charges Operators a subscription plan plus a transparent <strong>1.5% platform fee</strong> on the rental subtotal of paid bookings (never on refundable deposits). Payment-processing fees may also apply. Operators are responsible for their own taxes on booking revenue; Sanctum is responsible for taxes on its own fees. Subscriptions renew monthly until paused or canceled.</p>
          </Section>

          <Section title="Cancellations, refunds & deposits">
            <ul className="ml-5 list-disc space-y-1">
              <li><strong>Renter cancellations</strong> follow the Operator’s posted cancellation policy for that space.</li>
              <li><strong>Operator cancellations</strong> of a paid booking are refunded to the Renter in full, including the platform fee.</li>
              <li><strong>Refunds</strong> are returned to the original payment method. When we refund a booking we reverse the corresponding payout from the Operator’s connected account.</li>
              <li><strong>Deposits</strong> are refundable and held by the Operator; the Operator resolves (returns or withholds) a deposit after the event, per their posted policy.</li>
              <li><strong>Subscriptions:</strong> you can pause or cancel anytime from Settings; cancellation stops future renewals and is not retroactively refunded for the current period.</li>
            </ul>
          </Section>

          <Section title="Acceptable use">
            <p>Don’t use Sanctum to break the law, infringe others’ rights, post false or harmful listings, circumvent fees, scrape or attack the service, or facilitate unsafe or discriminatory activity. We may remove content or accounts that do.</p>
          </Section>

          <Section title="Your content">
            <p>You keep ownership of the content you post (listings, descriptions, event pages, reviews). You grant Sanctum a license to host and display it to operate and promote the service. You’re responsible for the content you post and must have the rights to it.</p>
          </Section>

          <Section title="Disclaimers & liability">
            <p>The service is provided “as is.” Because Sanctum is not a party to rentals and doesn’t control spaces or events, to the fullest extent permitted by law we are not liable for the acts, omissions, spaces, or events of Operators or Renters, and our total liability for any claim relating to the service is limited to the fees you paid us in the prior twelve months. Nothing here limits liability that can’t be limited by law.</p>
          </Section>

          <Section title="Indemnity">
            <p>You agree to indemnify Sanctum against claims arising from your use of the service, your listings or bookings, or your breach of these Terms.</p>
          </Section>

          <Section title="Changes & termination">
            <p>We may update these Terms; material changes will be posted here with a new date. You may stop using Sanctum at any time and delete your account from Settings. These Terms are governed by the laws of the jurisdiction in which Sanctum is established, without regard to conflict-of-laws rules.</p>
          </Section>

          <Section title="Contact">
            <p>Questions about these Terms? Email <a className="text-primary hover:underline" href="mailto:help@sanctum.garden">help@sanctum.garden</a> and a real person will answer.</p>
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
