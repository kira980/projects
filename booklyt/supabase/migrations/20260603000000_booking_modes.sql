alter table public.businesses
  add column if not exists booking_mode text not null default 'appointment'
    check (booking_mode in ('appointment', 'group')),
  add column if not exists group_capacity integer not null default 1
    check (group_capacity >= 1);

alter table public.appointments
  add column if not exists participants_count integer not null default 1
    check (participants_count >= 1);
