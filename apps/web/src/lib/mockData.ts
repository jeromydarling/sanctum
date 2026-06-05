/**
 * Demo seed data. Mirrors the D1 seed so the in-memory demo sandbox looks
 * identical to a live deployment. Returns FRESH objects each call so demo mode
 * resets cleanly on reload.
 */
import type {
  Profile, Facility, Space, Resource, Booking, ComplianceDoc,
  Invoice, Review, Lead, Notification, EventMicrosite, AvailabilityBlock, PricingRule, Lease, Network,
  CrmInteraction,
} from '@sanctum/shared';

export interface StoreData {
  profiles: Profile[];
  facilities: Facility[];
  spaces: Space[];
  resources: Resource[];
  bookings: Booking[];
  compliance_docs: ComplianceDoc[];
  invoices: Invoice[];
  reviews: Review[];
  leads: Lead[];
  notifications: Notification[];
  event_microsites: EventMicrosite[];
  availability_blocks: AvailabilityBlock[];
  pricing_rules: PricingRule[];
  leases: Lease[];
  networks: Network[];
  crm_interactions: CrmInteraction[];
}

const NOW = '2026-06-01T12:00:00.000Z';
const FAC = 'fac-usr-demo-operator';

function iso(daysFromSeed: number, hour: number): string {
  const d = new Date('2026-06-01T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + daysFromSeed);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

export const DEMO_USERS: Record<string, Profile> = {
  operator: {
    id: 'usr-demo-operator', email: 'operator@demo.sanctum.app', full_name: 'Grace Okafor',
    role: 'operator', phone: '(612) 555-0142', organization_name: 'St. Brigid Community Center',
    organization_type: null, avatar_url: null, created_at: NOW, updated_at: NOW,
  },
  renter: {
    id: 'usr-demo-renter', email: 'renter@demo.sanctum.app', full_name: 'Marcus Bell',
    role: 'renter', phone: null, organization_name: 'Northside Youth Theater',
    organization_type: 'nonprofit', avatar_url: null, created_at: NOW, updated_at: NOW,
  },
  admin: {
    id: 'usr-demo-admin', email: 'admin@demo.sanctum.app', full_name: 'Sanctum Admin',
    role: 'admin', phone: null, organization_name: null,
    organization_type: null, avatar_url: null, created_at: NOW, updated_at: NOW,
  },
};

export function freshStore(): StoreData {
  const facility: Facility = {
    id: FAC, operator_id: 'usr-demo-operator', name: 'St. Brigid Community Center',
    slug: 'st-brigid-community-center', denomination: 'Nondenominational',
    description:
      'A neighborhood community center with spaces for every gathering — from wedding receptions in the Fellowship Hall to workshops, recitals, and shared meals. We believe a building that sits empty is a gift waiting to be given.',
    address: '1420 Linden Avenue', city: 'Minneapolis', state: 'MN', zip: '55404',
    phone: '(612) 555-0142', email: 'hello@stbrigidcenter.org', website: 'https://stbrigidcenter.org',
    logo_url: null, cover_image_url: null, stripe_account_id: 'acct_demo_operator', stripe_onboarded: 1,
    plan: 'growth', subscription_status: 'active', is_listed: 1, requires_approval: 0,
    approval_lead_days: 3, cancellation_policy: 'Full refund up to 7 days before your event.',
    facility_use_agreement_url: null, require_coi: 1, min_coi_amount_cents: 100000000,
    tax_exempt_id: null, network_id: 'net-tcfn',
    translations: {
      Spanish: {
        description:
          'Un centro comunitario del vecindario con espacios para toda ocasión: desde recepciones de boda en el Salón de Convivencia hasta talleres, recitales y comidas compartidas. Creemos que un edificio vacío es un regalo esperando ser entregado.',
      },
    },
    created_at: NOW, updated_at: NOW,
  };

  const spaces: Space[] = [
    space('spc-hall', 'Fellowship Hall', 'fellowship_hall', 200, 3200, 12000, 40000, 70000, 15000, 25000,
      'A bright, welcoming hall with hardwood floors, a stage, and a warming kitchen adjacent. Perfect for receptions, fundraisers, and community dinners.',
      ['stage', 'kitchen_access', 'sound_system', 'wifi', 'parking', 'wheelchair_accessible', 'tables_chairs', 'restrooms']),
    space('spc-chapel', 'The Chapel', 'chapel', 80, 1100, 9000, 30000, 50000, 12000, 20000,
      'An intimate chapel with warm light and excellent acoustics. A serene setting for small ceremonies, recitals, and gatherings.',
      ['piano', 'sound_system', 'wheelchair_accessible', 'parking', 'restrooms']),
    space('spc-class', 'Classroom 1', 'classroom', 30, 600, 4000, 14000, 24000, 5000, 5000,
      'A flexible classroom with movable tables, a projector, and fast Wi-Fi. Ideal for workshops, tutoring, and small meetings.',
      ['projector', 'wifi', 'tables_chairs', 'air_conditioning', 'wheelchair_accessible']),
    space('spc-kitchen', 'Commercial Kitchen', 'kitchen', 12, 800, 8000, 28000, 48000, 10000, 30000,
      'A fully-equipped commercial kitchen with two ovens, a six-burner range, prep tables, and ample cold storage. Health-department ready.',
      ['kitchen_access', 'wifi', 'parking', 'restrooms']),
    space('spc-gym', 'Community Gym', 'gym', 150, 5000, 10000, 35000, 60000, 13000, 20000,
      'A full-size gymnasium with a basketball court, bleachers, and an open floor plan. Great for sports, expos, and large gatherings.',
      ['parking', 'restrooms', 'wheelchair_accessible', 'sound_system']),
  ];

  const resources: Resource[] = [
    resource('res-tables', 'Round Tables (20)', 'furniture', 20, 5000),
    resource('res-chairs', 'Folding Chairs (200)', 'furniture', 200, 4000),
    resource('res-projector', 'Projector + Screen', 'av_equipment', 1, 3000),
    resource('res-pa', 'PA System', 'av_equipment', 1, 4500),
    resource('res-podium', 'Podium', 'furniture', 1, 1000),
    resource('res-urn', 'Coffee Urn (100 cup)', 'kitchen', 2, 1500),
  ];

  const bookings: Booking[] = [
    booking('bkg-1', 'spc-hall', 'usr-demo-renter', 'Spring Benefit Dinner', 'community', 160, iso(12, 17), iso(12, 22), 70000, 'approved'),
    booking('bkg-2', 'spc-class', 'usr-demo-renter2', 'Beginner Quilting Workshop', 'class', 18, iso(8, 10), iso(8, 14), 16000, 'approved'),
    { ...booking('bkg-3', 'spc-chapel', 'usr-demo-renter', 'Youth Spring Recital', 'concert', 70, iso(20, 18), iso(20, 21), 30000, 'confirmed'), deposit_cents: 20000, deposit_status: 'held' },
    booking('bkg-4', 'spc-gym', 'usr-demo-renter2', 'Community Wellness Fair', 'community', 140, iso(-10, 9), iso(-10, 15), 60000, 'completed'),
    booking('bkg-5', 'spc-kitchen', 'usr-demo-renter', 'Holiday Meal Prep', 'community', 10, iso(-25, 8), iso(-25, 16), 48000, 'completed'),
  ];

  const reviews: Review[] = [
    review('rev-1', 'bkg-4', 'spc-gym', 'usr-demo-renter2', 5, 'Spacious and welcoming', 'The gym was spotless and the staff helped us set up. Our wellness fair was a huge success.'),
    review('rev-2', 'bkg-5', 'spc-kitchen', 'usr-demo-renter', 5, 'A dream kitchen', 'Everything we needed to cook for 300 neighbors. Booking and payment were effortless.'),
    review('rev-3', null, 'spc-hall', 'usr-demo-renter2', 4, 'Beautiful hall', 'Gorgeous light and plenty of room. Would book again for our annual gala.'),
    review('rev-4', null, 'spc-chapel', 'usr-demo-renter', 5, 'Perfect acoustics', 'Our recital sounded incredible in the chapel. The piano was well-tuned.'),
  ];

  const compliance_docs: ComplianceDoc[] = [
    coi('coi-1', 'bkg-2', 'usr-demo-renter2', 'approved', 'Community Mutual', 'CM-884213', 100000000, '2026-12-31'),
    coi('coi-2', 'bkg-3', 'usr-demo-renter', 'pending', 'Northside Insurance Co', 'NS-771209', 200000000, '2026-09-15'),
    coi('coi-3', 'bkg-1', 'usr-demo-renter', 'pending', null, null, null, null),
  ];

  const leads: Lead[] = [
    lead('lead-1', 'Aisha Rahman', 'aisha@cityballet.org', 'City Youth Ballet', 'Interested in the Fellowship Hall for a weekend recital in the fall.', 'spc-hall', 'tour'),
    lead('lead-2', 'Tom Reilly', 'tom@reillyfamily.com', null, 'Looking to rent the chapel for a 50th anniversary celebration.', 'spc-chapel', 'inquiry'),
    lead('lead-3', 'Sofia Mendez', 'sofia@feedingneighbors.org', 'Feeding Neighbors', 'We run a weekly meal program and need kitchen access.', 'spc-kitchen', 'booked'),
  ];

  const invoices: Invoice[] = [
    invoice('inv-1', 'bkg-4', 'usr-demo-renter2', 'INV-20260522-A1B2C', 'Community Wellness Fair', 60000, 'paid'),
    invoice('inv-2', 'bkg-5', 'usr-demo-renter', 'INV-20260507-D3E4F', 'Holiday Meal Prep', 48000, 'sent'),
  ];

  const notifications: Notification[] = [
    {
      id: 'ntf-1', user_id: 'usr-demo-operator', title: 'New booking',
      body: 'Spring Benefit Dinner was booked — awaiting payment.', type: 'booking', is_read: 0,
      action_url: '/operator/bookings/bkg-1', created_at: NOW, updated_at: NOW,
    },
    {
      id: 'ntf-2', user_id: 'usr-demo-operator', title: 'Insurance to review',
      body: 'A certificate of insurance is pending approval.', type: 'compliance', is_read: 0,
      action_url: '/operator/compliance', created_at: NOW, updated_at: NOW,
    },
    {
      id: 'ntf-3', user_id: 'usr-demo-renter', title: 'Booking confirmed 🎉',
      body: 'Youth Spring Recital is confirmed.', type: 'booking', is_read: 1,
      action_url: '/renter/bookings/bkg-3', created_at: NOW, updated_at: NOW,
    },
  ];

  const profiles: Profile[] = [
    DEMO_USERS.operator, DEMO_USERS.renter, DEMO_USERS.admin,
    { id: 'usr-demo-renter2', email: 'renter2@demo.sanctum.app', full_name: 'Lena Park', role: 'renter', phone: null, organization_name: 'Riverside Quilters Guild', organization_type: 'community_group', avatar_url: null, created_at: NOW, updated_at: NOW },
  ];

  const event_microsites: EventMicrosite[] = [{
    id: 'site-1', facility_id: FAC, renter_id: 'usr-demo-renter', booking_id: 'bkg-3',
    slug: 'youth-spring-recital', title: 'Youth Spring Recital',
    content: {
      headline: 'Youth Spring Recital', date: 'June 21, 2026 · 6:00 PM',
      location: 'The Chapel, St. Brigid Community Center',
      body: 'Join us for an evening of music as our young performers share the songs they\'ve worked on all season. Doors open at 5:30. Light refreshments to follow.',
      cta: 'RSVP', cover: '', theme: 'indigo',
      translations: {
        Spanish: {
          headline: 'Recital de Primavera de los Jóvenes',
          body: 'Acompáñenos en una velada de música mientras nuestros jóvenes artistas comparten las canciones en las que han trabajado durante toda la temporada. Las puertas abren a las 5:30. Habrá un ligero refrigerio después.',
          cta: 'Confirmar asistencia',
        },
      },
    },
    is_published: 1, rsvp_enabled: 1, created_at: NOW, updated_at: NOW,
  }];

  const pricing_rules: PricingRule[] = [
    { id: 'pr-nonprofit', facility_id: FAC, org_type: 'nonprofit', discount_percent: 25, created_at: NOW, updated_at: NOW },
    { id: 'pr-school', facility_id: FAC, org_type: 'school', discount_percent: 10, created_at: NOW, updated_at: NOW },
  ];

  const leases: Lease[] = [
    {
      id: 'lease-daycare', facility_id: FAC, space_id: 'spc-class', renter_id: null,
      title: 'Little Lambs Daycare', tenant_name: 'Maria Gomez', tenant_email: 'maria@littlelambs.org',
      cadence: 'weekly', weekdays: [1, 2, 3, 4, 5], start_time_local: '08:00', end_time_local: '15:00',
      start_date: '2026-01-05', end_date: null, rate_cents: 120000, rate_period: 'month',
      status: 'active', notes: 'Long-term weekday tenant.', created_at: NOW, updated_at: NOW,
    },
    {
      id: 'lease-aa', facility_id: FAC, space_id: 'spc-chapel', renter_id: null,
      title: 'Tuesday Recovery Group', tenant_name: 'Community Recovery', tenant_email: null,
      cadence: 'weekly', weekdays: [2], start_time_local: '19:00', end_time_local: '20:30',
      start_date: '2026-02-03', end_date: null, rate_cents: 4000, rate_period: 'session',
      status: 'active', notes: 'Weekly community meeting.', created_at: NOW, updated_at: NOW,
    },
  ];

  const networks: Network[] = [{
    id: 'net-tcfn', owner_id: 'usr-demo-operator', name: 'Twin Cities Faith Network',
    slug: 'twin-cities-faith-network', description: 'A network of welcoming community spaces across the Twin Cities — open doors, shared flourishing.',
    brand_primary: '#3b5bdb', logo_url: null, created_at: NOW, updated_at: NOW,
  }];

  const crm_interactions: CrmInteraction[] = [
    { id: 'ti-1', facility_id: FAC, subject_kind: 'lease', subject_id: 'lease-daycare', kind: 'note', body: 'Signed a 12-month agreement. Lovely team — they keep Classroom 1 spotless.', due_at: null, done: 0, created_by: 'usr-demo-operator', created_at: '2026-01-05T15:00:00.000Z', updated_at: '2026-01-05T15:00:00.000Z' },
    { id: 'ti-2', facility_id: FAC, subject_kind: 'lease', subject_id: 'lease-daycare', kind: 'call', body: 'Maria called about adding Fridays in the fall. Asked her to send dates.', due_at: null, done: 0, created_by: 'usr-demo-operator', created_at: '2026-05-12T16:30:00.000Z', updated_at: '2026-05-12T16:30:00.000Z' },
    { id: 'ti-3', facility_id: FAC, subject_kind: 'lease', subject_id: 'lease-daycare', kind: 'reminder', body: 'Check in about the fall Friday expansion and renewal.', due_at: '2026-06-20T12:00:00.000Z', done: 0, created_by: 'usr-demo-operator', created_at: '2026-05-12T16:31:00.000Z', updated_at: '2026-05-12T16:31:00.000Z' },
    { id: 'ti-4', facility_id: FAC, subject_kind: 'renter', subject_id: 'usr-demo-renter', kind: 'note', body: 'Marcus and the Northside Youth Theater are wonderful to host — always early to set up.', due_at: null, done: 0, created_by: 'usr-demo-operator', created_at: '2026-05-18T14:00:00.000Z', updated_at: '2026-05-18T14:00:00.000Z' },
    { id: 'ti-5', facility_id: FAC, subject_kind: 'renter', subject_id: 'usr-demo-renter', kind: 'reminder', body: 'Send a thank-you note after the Spring Benefit Dinner.', due_at: '2026-06-14T12:00:00.000Z', done: 0, created_by: 'usr-demo-operator', created_at: '2026-05-18T14:01:00.000Z', updated_at: '2026-05-18T14:01:00.000Z' },
  ];

  return {
    profiles, facilities: [facility], spaces, resources, bookings,
    compliance_docs, invoices, reviews, leads, notifications, event_microsites,
    availability_blocks: [], pricing_rules, leases, networks, crm_interactions,
  };
}

// ---- builders ----
function space(id: string, name: string, type: string, cap: number, sqft: number, hr: number, half: number, full: number, wkd: number, dep: number, desc: string, amen: string[]): Space {
  return {
    id, facility_id: FAC, name, space_type: type as Space['space_type'], description: desc,
    capacity_persons: cap, square_footage: sqft, hourly_rate_cents: hr, half_day_rate_cents: half,
    full_day_rate_cents: full, weekend_hourly_rate_cents: wkd, deposit_amount_cents: dep,
    available_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    available_start_time: '07:00', available_end_time: '22:00', min_booking_hours: 1,
    max_booking_hours: null, buffer_minutes: 30, amenities: amen, images: [],
    allowed_uses: [], restricted_uses: [], pricing_mode: id === 'spc-chapel' ? 'donation' : 'standard',
    translations: id === 'spc-chapel'
      ? { Spanish: { description: 'Una capilla íntima con luz cálida y excelente acústica. Un entorno sereno para ceremonias pequeñas, recitales y reuniones.' } }
      : undefined,
    is_active: 1, created_at: NOW, updated_at: NOW,
  };
}
function resource(id: string, name: string, type: string, qty: number, flat: number): Resource {
  return { id, facility_id: FAC, name, resource_type: type, quantity: qty, hourly_rate_cents: 0, flat_rate_cents: flat, is_active: 1, created_at: NOW, updated_at: NOW };
}
function booking(id: string, space_id: string, renter_id: string, event_name: string, event_type: string, att: number, start: string, end: string, sub: number, status: string): Booking {
  return {
    id, facility_id: FAC, space_id, renter_id, event_name, event_type, event_description: null,
    expected_attendance: att, start_time: start, end_time: end, setup_start_time: null,
    subtotal_cents: sub, deposit_cents: 0, resource_fees_cents: 0, discount_cents: 0,
    total_cents: sub, platform_fee_cents: Math.round(sub * 0.015), status: status as Booking['status'],
    denial_reason: null, cancellation_reason: null, coi_uploaded: status === 'pending' ? 0 : 1,
    agreement_signed: status === 'pending' ? 0 : 1, agreement_signed_at: null,
    stripe_payment_intent_id: null, stripe_checkout_session_id: null,
    deposit_paid_at: null, balance_paid_at: status === 'confirmed' || status === 'completed' ? NOW : null,
    resource_ids: [], renter_notes: null, operator_notes: null, created_at: NOW, updated_at: NOW,
  };
}
function review(id: string, booking_id: string | null, space_id: string, renter_id: string, rating: number, headline: string, body: string): Review {
  return { id, booking_id, facility_id: FAC, space_id, renter_id, rating, headline, body, is_published: 1, operator_response: null, created_at: NOW, updated_at: NOW };
}
function coi(id: string, booking_id: string, renter_id: string, status: string, insurer: string | null, policy: string | null, cov: number | null, exp: string | null): ComplianceDoc {
  return { id, booking_id, renter_id, facility_id: FAC, doc_type: 'certificate_of_insurance', file_url: null, status: status as ComplianceDoc['status'], expiration_date: exp, insurer_name: insurer, policy_number: policy, coverage_amount_cents: cov, notes: null, reviewed_by: null, uploaded_at: NOW, reviewed_at: null, updated_at: NOW };
}
function lead(id: string, name: string, email: string, org: string | null, message: string, space_id: string, stage: string): Lead {
  return { id, facility_id: FAC, name, email, phone: null, organization: org, message, space_id, stage: stage as Lead['stage'], created_at: NOW, updated_at: NOW };
}
function invoice(id: string, booking_id: string, renter_id: string, number: string, label: string, amount: number, status: string): Invoice {
  return { id, facility_id: FAC, booking_id, renter_id, invoice_number: number, line_items: [{ label, quantity: 1, unit_cents: amount, amount_cents: amount }], subtotal_cents: amount, tax_cents: 0, total_cents: amount, platform_fee_cents: Math.round(amount * 0.015), status: status as Invoice['status'], due_date: null, paid_at: status === 'paid' ? NOW : null, created_at: NOW, updated_at: NOW };
}
