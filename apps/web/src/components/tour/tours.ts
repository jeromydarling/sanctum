/**
 * Product-tour content. Each tour is tied to a section route and is a list of
 * steps; a step with a `target` points at an element tagged `data-tour="<target>"`,
 * and one without renders as a centered intro/outro card.
 *
 * Adding coverage later is just: tag a few elements with data-tour, then add a
 * TourDef here. The launcher (`TourButton`) shows automatically on the route.
 */
export interface TourStep {
  target?: string;
  title: string;
  body: string;
}

export interface TourDef {
  key: string;
  label: string;
  /** The section this tour teaches; the launcher shows on this exact path. */
  route: string;
  steps: TourStep[];
}

export const TOURS: TourDef[] = [
  // ---------- Operator ----------
  {
    key: 'operator-overview',
    label: 'Dashboard tour',
    route: '/operator',
    steps: [
      { title: 'Welcome to your dashboard', body: "This is the heartbeat of your community — a quick read on money coming in, requests waiting on you, and what's ahead. Here's the two-minute lay of the land." },
      { target: 'op-stats', title: 'Your numbers at a glance', body: 'Revenue to date, requests awaiting your review, upcoming events, and insurance documents to check — the four things worth knowing each morning.' },
      { target: 'op-pending', title: 'Requests waiting on you', body: 'New booking requests land here first. Approve or decline in a tap — or let renters book and pay straight through so this stays empty.' },
      { target: 'dash-nav', title: 'Everything has a home', body: 'Every part of your community lives in this menu — spaces, bookings, tenants, compliance, and your books. Wander in anytime; each section has its own tour.' },
    ],
  },
  {
    key: 'operator-bookings',
    label: 'Bookings tour',
    route: '/operator/bookings',
    steps: [
      { title: 'Where every event is managed', body: 'One-off rentals — from first request to confirmed and paid — all live here. Let me show you the flow.' },
      { target: 'op-bookings-tabs', title: 'Sort by where things stand', body: 'Switch between pending requests, upcoming confirmed events, and past ones. Pending is where new requests wait for your yes.' },
      { target: 'op-bookings-list', title: 'Each request, in context', body: "The event, the space, the date, and who's asking — with Approve and Decline right there. Declining lets you send a warm note, not just a no." },
      { target: 'op-bookings-add', title: 'Booked over the phone?', body: 'Add a booking yourself for walk-ins or regulars who called — it holds the time on your calendar so nothing double-books.' },
    ],
  },
  {
    key: 'operator-tenants',
    label: 'Tenants tour',
    route: '/operator/tenants',
    steps: [
      { title: 'Your recurring community', body: 'Weekly groups, classes, and long-term tenants — the relationships that fill your calendar month after month. This is more than a list; it\'s a gentle CRM.' },
      { target: 'op-tenants-stats', title: 'Recurring income, tracked', body: "What your tenants bring in each month — invoiced automatically — plus who's active and who you're due to check in with." },
      { target: 'op-tenants-list', title: 'A warm record for each', body: 'Open any tenant to see their schedule, billing, and a history of every call, note, and reminder — so nothing about the relationship gets lost.' },
      { target: 'op-tenants-add', title: 'Add a recurring tenant', body: 'Set them up once — schedule and rate — and Sanctum holds the time on your calendar and sends their invoice every month.' },
    ],
  },
  {
    key: 'operator-announcements',
    label: 'Announcements tour',
    route: '/operator/announcements',
    steps: [
      { title: 'Reach everyone at once', body: 'Send an alert to your tenants and upcoming renters — a closure, a schedule change, or a warm note. It goes out in-app and by email.' },
      { target: 'announce-compose', title: 'Write it once', body: 'A subject and a message — that\'s it. Keep it short; people read these on their phones.' },
      { target: 'announce-audience', title: 'Choose who hears it', body: 'Recurring tenants, renters with upcoming bookings, or both. The count updates live so you know exactly how many people you\'re reaching before you send.' },
      { target: 'announce-history', title: 'A record of what went out', body: 'Every announcement you send is kept here, with who it reached and when.' },
    ],
  },
  {
    key: 'operator-financials',
    label: 'Financials tour',
    route: '/operator/financials',
    steps: [
      { title: 'Books your treasurer will love', body: "Everything you've earned, the platform fee, and what's yours — clear enough to hand straight to a bookkeeper. Let me point out the useful bits." },
      { target: 'fin-stats', title: 'Gross, fees, and net', body: 'The whole year in three numbers, updated as bookings and invoices are paid.' },
      { target: 'fin-export', title: 'Export in a click', body: 'A transactions CSV or a print-ready year-end statement — everything a treasurer or accountant needs, no spreadsheet wrangling.' },
      { target: 'fin-qbo', title: 'QuickBooks, one click', body: 'Connect QuickBooks Online to push your transactions straight in as sales receipts — no manual entry.' },
      { target: 'fin-zapier', title: 'Or sync automatically via Zapier', body: 'Prefer hands-off? Paste a Zapier webhook and every paid booking and invoice flows into QuickBooks on its own. There\'s a setup guide right in the card.' },
    ],
  },
  {
    key: 'operator-spaces',
    label: 'Spaces tour',
    route: '/operator/spaces',
    steps: [
      { title: 'The rooms you offer', body: 'Every space renters can book — with photos, rates, and the extras they can add on. Here\'s how to shape a listing.' },
      { target: 'op-spaces-add', title: 'Add a space', body: 'Name it, price it, and describe it — hourly, half-day, full-day, even weekend rates. There\'s an Image Studio to make the photos shine.' },
      { target: 'op-spaces-list', title: 'Edit anytime', body: 'Each space shows here. Open one to adjust pricing, availability, and details whenever things change.' },
    ],
  },
  // ---------- Renter ----------
  {
    key: 'renter-find',
    label: 'Discovery tour',
    route: '/renter',
    steps: [
      { title: 'Find a welcoming space', body: 'Community halls, chapels, kitchens, classrooms — bookable spaces near you, including donation-based and free-for-ministry rooms. Let me show you how to search.' },
      { target: 'find-search', title: 'Search by city and type', body: 'Enter a city and the kind of space you need, then Search. Results update to match.' },
      { target: 'find-results', title: 'Request in one step', body: 'Each result shows the space, its rate, and photos. Found the one? "Request this space" walks you through dates, details, and payment.' },
    ],
  },
  {
    key: 'renter-bookings',
    label: 'Bookings tour',
    route: '/renter/bookings',
    steps: [
      { title: 'Your gatherings, all here', body: 'Requests you\'ve sent, confirmed events, and past ones — plus receipts — live in one place.' },
      { target: 'renter-bookings-list', title: 'Track each booking', body: "Open any booking to see its status, pay a balance, review the agreement, or find the details for the day." },
      { target: 'dash-nav', title: 'Find more anytime', body: 'Use this menu to discover new spaces, build an event page, or brush up in the learning hub whenever you need it.' },
    ],
  },
  {
    key: 'renter-sites',
    label: 'Event pages tour',
    route: '/renter/sites',
    steps: [
      { title: 'A public page for your event', body: 'Spin up a beautiful, shareable page — details, invitations, RSVPs — with an AI website builder. Here\'s how.' },
      { target: 'sites-new', title: 'Start with a title', body: 'Give your event a name and the builder creates a page you can shape with plain-language commands — no design skills needed.' },
      { target: 'sites-list', title: 'Edit and share', body: 'Your pages show here. Open one to edit, then publish and share the link with guests.' },
    ],
  },
];

/** The tour that teaches the section at `pathname`, if any (exact match). */
export function tourForPath(pathname: string): TourDef | undefined {
  return TOURS.find((t) => t.route === pathname);
}
