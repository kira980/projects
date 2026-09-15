-- Helper called by the app after signup/login to guarantee a profiles row exists.
-- Uses auth.uid() so it only ever creates/updates the caller's own profile.
create or replace function public.ensure_profile(p_full_name text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (auth.uid(), p_full_name)
  on conflict (id) do update
    set full_name  = coalesce(excluded.full_name, profiles.full_name),
        updated_at = now();
end;
$$;
