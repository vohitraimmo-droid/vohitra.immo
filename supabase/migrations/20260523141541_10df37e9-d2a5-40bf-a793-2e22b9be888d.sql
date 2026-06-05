ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS verification_cost_tokens integer NOT NULL DEFAULT 10;