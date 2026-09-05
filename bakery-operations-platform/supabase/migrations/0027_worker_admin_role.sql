-- Stage 27: an "admin" role on workers.
--
-- אחראי משמרת (can_manage_shift) may RECORD money actions — advances,
-- goods arrivals, vendor debt payments. Correcting or deleting one that is
-- already on the books is a separate, stronger permission: only a worker
-- flagged is_admin may edit the day's history from the kiosk.
--
-- Existing shift managers do NOT get it automatically — the owner grants
-- it per worker in העובדים → ניהול.

alter table public.workers
  add column if not exists is_admin boolean not null default false;

comment on column public.workers.is_admin is
  'Kiosk admin: may edit/delete any of today''s recorded actions in /workers/history.';

notify pgrst, 'reload schema';
