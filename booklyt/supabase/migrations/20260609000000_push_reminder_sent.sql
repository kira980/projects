-- Track when a push reminder was sent for an appointment
-- so the cron does not re-send it.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS push_reminder_sent_at TIMESTAMPTZ;
