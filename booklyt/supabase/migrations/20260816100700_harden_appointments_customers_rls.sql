-- Close public read/write on appointments and customers.
--
-- Before: "appointments: public select own" USING (true) let anyone holding the
-- browser-visible anon key read every appointment row, including
-- customer_name, customer_phone, customer_email and notes. "public insert"
-- WITH CHECK (true) let anyone insert arbitrary rows. Same for customers.
--
-- These existed because /api/book, /api/slots, /manage-booking/[token] and
-- /api/appointment/confirm/[token] used the anon client. All four now use the
-- service-role client, where authorization is the unguessable manage_token or
-- server-side validation, so the policies are no longer load-bearing.
--
-- Owners keep full access to their own rows via the "owner all" policies.

drop policy if exists "appointments: public select own" on public.appointments;
drop policy if exists "appointments: public insert"     on public.appointments;
drop policy if exists "customers: public insert"        on public.customers;

notify pgrst, 'reload schema';
