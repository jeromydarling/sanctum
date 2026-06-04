-- Security/damage deposits: collected with payment, then returned or withheld.
ALTER TABLE bookings ADD COLUMN deposit_status TEXT NOT NULL DEFAULT 'none'; -- none|held|returned|withheld
ALTER TABLE bookings ADD COLUMN deposit_returned_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN deposit_resolution_note TEXT;

-- Demo: the confirmed recital paid a deposit that's currently being held.
UPDATE bookings SET deposit_cents = 20000, deposit_status = 'held' WHERE id = 'bkg-3';
