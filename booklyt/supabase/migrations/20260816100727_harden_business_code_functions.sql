-- Pin search_path on both business-code functions (linter 0011) and make the
-- collision check independent of RLS.
--
-- generate_business_code() runs inside a BEFORE INSERT trigger as the calling
-- role. Its uniqueness check reads public.businesses under RLS, so it is only
-- correct while a permissive public-select policy exists on that table. If that
-- policy is ever tightened the check goes blind and silently relies on the
-- unique constraint to raise. SECURITY DEFINER makes it correct regardless.

create or replace function public.generate_business_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate text;
  attempts  int := 0;
begin
  loop
    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'generate_business_code: could not find a free code after 50 attempts';
    end if;
    candidate := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (
      select 1 from public.businesses where business_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.set_business_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.business_code is null then
    new.business_code := public.generate_business_code();
  end if;
  return new;
end;
$$;

-- Not part of the public API surface; only the trigger should invoke these.
revoke execute on function public.generate_business_code() from public, anon, authenticated;
revoke execute on function public.set_business_code()      from public, anon, authenticated;

-- Event-trigger helper; calling it directly over REST is meaningless and it
-- should never have been exposed (linter 0028/0029).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ensure_profile is intentionally callable by signed-in users, but not by anon:
-- it acts on auth.uid(), which is null for anon, so an anon call can only fail.
revoke execute on function public.ensure_profile(text) from public, anon;
grant  execute on function public.ensure_profile(text) to authenticated;

notify pgrst, 'reload schema';
