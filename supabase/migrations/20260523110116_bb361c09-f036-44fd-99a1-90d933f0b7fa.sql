
-- 1) property_reports table
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'dismissed', 'removed');

CREATE TABLE public.property_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status public.report_status NOT NULL DEFAULT 'pending',
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_reports_property ON public.property_reports(property_id);
CREATE INDEX idx_property_reports_status ON public.property_reports(status);

ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports: own insert"
  ON public.property_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reports: own or admin select"
  ON public.property_reports FOR SELECT
  USING (auth.uid() = reporter_id OR public.is_admin(auth.uid()));

CREATE POLICY "Reports: admin update"
  ON public.property_reports FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- 2) Sanitize trigger on properties: block phone / email / URL in title & description
CREATE OR REPLACE FUNCTION public.validate_property_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blob text;
BEGIN
  blob := lower(coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));

  -- URL / domain
  IF blob ~ '(https?://|www\.|\.com|\.fr|\.mg|\.org|\.net|t\.me/|wa\.me/|bit\.ly|tinyurl)' THEN
    RAISE EXCEPTION 'Les liens ne sont pas autorisés dans le titre ou la description. Les locataires doivent débloquer vos coordonnées via la plateforme.';
  END IF;

  -- Email
  IF blob ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' THEN
    RAISE EXCEPTION 'Les adresses e-mail ne sont pas autorisées dans le titre ou la description.';
  END IF;

  -- Phone numbers: any run of 8+ digits (allowing spaces, dots, dashes, +)
  IF regexp_replace(blob, '[^0-9]', '', 'g') ~ '[0-9]{8,}' THEN
    RAISE EXCEPTION 'Les numéros de téléphone ne sont pas autorisés dans le titre ou la description. Renseignez-les uniquement dans le champ téléphone.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_property_content ON public.properties;
CREATE TRIGGER trg_validate_property_content
  BEFORE INSERT OR UPDATE OF title, description ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.validate_property_content();
