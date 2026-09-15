-- Add "booked" status for newly created appointments (before customer confirms attendance).
-- "confirmed" is now reserved for when the customer actively confirms they will attend.
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'booked', 'confirmed', 'cancelled', 'completed'));
