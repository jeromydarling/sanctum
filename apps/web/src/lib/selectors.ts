/** Derived reads over the store, scoped by the current user. */
import type { StoreData } from './mockData.js';
import type { Facility, Space, Booking } from '@sanctum/shared';

export function facilityForOperator(d: StoreData, operatorId: string): Facility | undefined {
  return d.facilities.find((f) => f.operator_id === operatorId);
}

export function spacesForFacility(d: StoreData, facilityId: string): Space[] {
  return d.spaces.filter((s) => s.facility_id === facilityId);
}

export function bookingsForFacility(d: StoreData, facilityId: string): Booking[] {
  return d.bookings
    .filter((b) => b.facility_id === facilityId)
    .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time));
}

export function bookingsForRenter(d: StoreData, renterId: string): Booking[] {
  return d.bookings
    .filter((b) => b.renter_id === renterId)
    .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time));
}

export function spaceName(d: StoreData, spaceId: string): string {
  return d.spaces.find((s) => s.id === spaceId)?.name || 'Space';
}

export function facilityName(d: StoreData, facilityId: string): string {
  return d.facilities.find((f) => f.id === facilityId)?.name || 'Facility';
}

export function renterName(d: StoreData, renterId: string): string {
  const p = d.profiles.find((x) => x.id === renterId);
  return p?.full_name || p?.organization_name || 'Renter';
}

export function profile(d: StoreData, id: string) {
  return d.profiles.find((p) => p.id === id);
}
