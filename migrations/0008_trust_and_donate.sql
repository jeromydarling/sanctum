-- Trust & liability: stored use-agreement text + e-signature audit on bookings.
ALTER TABLE facilities ADD COLUMN use_agreement_text TEXT;
ALTER TABLE bookings ADD COLUMN agreement_signer TEXT;
ALTER TABLE bookings ADD COLUMN agreement_ip TEXT;

-- Rent-or-donate: how a space is priced.
-- 'standard' = listed rates, 'donation' = pay-what-you-can, 'free' = free for ministries.
ALTER TABLE spaces ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'standard';

-- Demo: a default agreement + a donation-based chapel.
UPDATE facilities SET use_agreement_text =
  'FACILITY USE AGREEMENT' || char(10) || char(10) ||
  'This agreement is between St. Brigid Community Center ("Host") and the Renter named in the booking.' || char(10) || char(10) ||
  '1. Permitted use. The space is rented solely for the event described in the booking.' || char(10) ||
  '2. Care of the space. The Renter leaves the space clean and undamaged, and is responsible for their guests.' || char(10) ||
  '3. Insurance & liability. The Renter carries liability insurance where required and assumes responsibility for their event.' || char(10) ||
  '4. Conduct. No unlawful, unsafe, or prohibited activities. The Host''s posted rules apply.' || char(10) ||
  '5. Payment & deposits. Fees and any refundable deposit are due per the booking.' || char(10) ||
  '6. Cancellation. Per the Host''s stated cancellation policy.'
  WHERE id = 'fac-usr-demo-operator';
UPDATE spaces SET pricing_mode = 'donation' WHERE id = 'spc-chapel';
