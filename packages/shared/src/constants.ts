/** Shared domain constants for Sanctum. */

export const ROLES = ['operator', 'staff', 'renter', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const SPACE_TYPES = [
  'sanctuary',
  'fellowship_hall',
  'classroom',
  'kitchen',
  'gym',
  'outdoor',
  'parking',
  'office',
  'nursery',
  'chapel',
  'other',
] as const;
export type SpaceType = (typeof SPACE_TYPES)[number];

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  sanctuary: 'Sanctuary',
  fellowship_hall: 'Fellowship Hall',
  classroom: 'Classroom',
  kitchen: 'Commercial Kitchen',
  gym: 'Gym',
  outdoor: 'Outdoor Space',
  parking: 'Parking Lot',
  office: 'Office / Meeting Room',
  nursery: 'Nursery',
  chapel: 'Chapel',
  other: 'Other Space',
};

export const SPACE_TYPE_EMOJI: Record<SpaceType, string> = {
  sanctuary: '⛪',
  fellowship_hall: '🍽️',
  classroom: '📚',
  kitchen: '🍳',
  gym: '🏀',
  outdoor: '🌳',
  parking: '🅿️',
  office: '💼',
  nursery: '🧸',
  chapel: '🕯️',
  other: '🏛️',
};

export const BOOKING_STATUSES = [
  'pending',
  'approved',
  'denied',
  'cancelled',
  'confirmed',
  'completed',
  'no_show',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ORG_TYPES = [
  'individual',
  'nonprofit',
  'for_profit',
  'government',
  'school',
  'religious',
  'community_group',
  'other',
] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  individual: 'Individual',
  nonprofit: 'Nonprofit',
  for_profit: 'Business',
  government: 'Government',
  school: 'School',
  religious: 'Faith Community',
  community_group: 'Community Group',
  other: 'Other',
};

export const DOC_TYPES = [
  'certificate_of_insurance',
  'facility_use_agreement',
  'nonprofit_verification',
  'background_check',
  'other',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_STATUSES = ['pending', 'approved', 'rejected', 'expired'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const AMENITIES = [
  'projector',
  'sound_system',
  'kitchen_access',
  'wifi',
  'parking',
  'wheelchair_accessible',
  'stage',
  'piano',
  'tables_chairs',
  'air_conditioning',
  'restrooms',
  'coffee_service',
] as const;
export type Amenity = (typeof AMENITIES)[number];

export const AMENITY_LABELS: Record<Amenity, string> = {
  projector: 'Projector',
  sound_system: 'Sound System',
  kitchen_access: 'Kitchen Access',
  wifi: 'Wi-Fi',
  parking: 'Parking',
  wheelchair_accessible: 'Wheelchair Accessible',
  stage: 'Stage',
  piano: 'Piano',
  tables_chairs: 'Tables & Chairs',
  air_conditioning: 'Air Conditioning',
  restrooms: 'Restrooms',
  coffee_service: 'Coffee Service',
};

/** Subscription plans Sanctum charges facility operators. */
export const PLANS = ['starter', 'growth', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanInfo {
  id: Plan;
  name: string;
  priceCents: number;
  spaceLimit: number | null; // null = unlimited
  blurb: string;
  features: string[];
}

export const PLAN_DETAILS: Record<Plan, PlanInfo> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceCents: 900,
    spaceLimit: 3,
    blurb: 'For communities just opening their doors.',
    features: [
      'Up to 3 spaces',
      'Online booking & approvals',
      'Insurance & agreement tracking',
      'Instant payouts via Stripe',
      '1.5% per paid booking',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceCents: 1900,
    spaceLimit: 10,
    blurb: 'For active rental programs finding their rhythm.',
    features: [
      'Up to 10 spaces',
      'Everything in Starter',
      'Analytics & utilization reports',
      'Public event microsites',
      'AI policy & description helpers',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: 2900,
    spaceLimit: null,
    blurb: 'For large or multi-campus communities.',
    features: [
      'Unlimited spaces',
      'Everything in Growth',
      'Multi-campus management',
      'Priority support',
      'White-label for networks',
    ],
  },
};

/** AI usage caps to control spend. */
export const AI_DAILY_LIMIT_PER_USER = 100;
export const AI_DAILY_LIMIT_PER_IP = 15;

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

/** Brand. */
export const BRAND = {
  name: 'Sanctum',
  tagline: 'Open doors. Stronger communities.',
  supportEmail: 'help@sanctum.app',
} as const;
