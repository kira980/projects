-- Backfill profiles for any auth users that have no profile row.
-- This fixes accounts created before the trigger was active.
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
  id,
  raw_user_meta_data ->> 'full_name',
  raw_user_meta_data ->> 'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Recreate the trigger so all future signups get a profile row automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
