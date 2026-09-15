-- Allow one subscription row per (endpoint, appointment_id) pair
-- so a customer booking multiple appointments keeps each appointment's subscription independent.
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_appt_idx
  ON push_subscriptions (endpoint, appointment_id)
  WHERE appointment_id IS NOT NULL;
