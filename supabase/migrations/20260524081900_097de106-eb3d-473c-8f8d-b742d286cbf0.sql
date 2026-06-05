CREATE TABLE public.cgu (
  id integer PRIMARY KEY DEFAULT 1,
  content_fr text NOT NULL DEFAULT '',
  content_mg text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Ensure only one row exists (singleton pattern)
CREATE UNIQUE INDEX cgu_singleton ON public.cgu ((true)) WHERE id = 1;

-- Insert default placeholder row
INSERT INTO public.cgu (id, content_fr, content_mg) VALUES (1, 'Les Conditions Générales d''Utilisation seront publiées prochainement.', 'Ny fitsipika fampiasana dia havoaka tsy ho ela.') ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.cgu ENABLE ROW LEVEL SECURITY;

-- Everyone can read CGU
CREATE POLICY "CGU: public read"
ON public.cgu
FOR SELECT
TO public
USING (true);

-- Only admins can update CGU
CREATE POLICY "CGU: admin update"
ON public.cgu
FOR UPDATE
TO public
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Prevent insert/delete (singleton table)
CREATE POLICY "CGU: no insert"
ON public.cgu
FOR INSERT
TO public
WITH CHECK (false);

CREATE POLICY "CGU: no delete"
ON public.cgu
FOR DELETE
TO public
USING (false);