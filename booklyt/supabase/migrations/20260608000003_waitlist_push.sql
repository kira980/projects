-- Allow push subscriptions to be linked to a waitlist entry (for customer notifications)
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS waitlist_entry_id UUID REFERENCES public.waitlist_entries(id) ON DELETE CASCADE;
