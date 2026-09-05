-- Remove the admin "assign order to driver" step. Any active worker can
-- open the driver app with their own passcode and see every open
-- delivery for today; the delivery_orders row (and who delivered it)
-- is created at completion time, not at an assignment step.

alter table public.deliveries alter column driver_worker_id drop not null;

alter table public.delivery_orders
  add column completed_by_worker_id uuid references public.workers (id);

create index delivery_orders_completed_by_idx
  on public.delivery_orders (completed_by_worker_id);
