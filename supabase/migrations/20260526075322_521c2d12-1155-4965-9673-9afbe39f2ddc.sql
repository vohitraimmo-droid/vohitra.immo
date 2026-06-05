
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.delete_unconfirmed_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  WITH del AS (
    DELETE FROM auth.users
    WHERE email_confirmed_at IS NULL
      AND confirmed_at IS NULL
      AND created_at < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM del;

  RETURN deleted_count;
END;
$$;

-- Unschedule if exists then reschedule (every 5 minutes)
DO $$
BEGIN
  PERFORM cron.unschedule('delete-unconfirmed-users');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'delete-unconfirmed-users',
  '*/5 * * * *',
  $$ SELECT public.delete_unconfirmed_users(); $$
);
