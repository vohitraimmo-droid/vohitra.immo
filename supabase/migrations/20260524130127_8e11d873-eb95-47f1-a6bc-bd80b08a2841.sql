ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS boost_short_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS boost_long_enabled boolean NOT NULL DEFAULT true;

UPDATE public.site_settings SET
  boost_short_enabled = COALESCE(boost_enabled, true),
  boost_long_enabled = COALESCE(boost_enabled, true)
WHERE id = 1;

ALTER TABLE public.site_settings DROP COLUMN IF EXISTS boost_enabled;