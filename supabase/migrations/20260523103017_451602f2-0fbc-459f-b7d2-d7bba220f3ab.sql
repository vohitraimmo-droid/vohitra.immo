-- Add listing_type to properties (rent or sale)
DO $$ BEGIN
  CREATE TYPE public.listing_type AS ENUM ('rent', 'sale');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listing_type public.listing_type NOT NULL DEFAULT 'rent';