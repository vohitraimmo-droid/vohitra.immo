-- =========================================================
-- 1) property_contacts : numéro de visite isolé + RLS stricte
-- =========================================================
CREATE TABLE IF NOT EXISTS public.property_contacts (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  visit_phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill depuis properties.visit_phone
INSERT INTO public.property_contacts (property_id, visit_phone)
SELECT id, visit_phone FROM public.properties
WHERE visit_phone IS NOT NULL AND visit_phone <> ''
ON CONFLICT (property_id) DO NOTHING;

-- On peut maintenant supprimer la colonne dangereuse
ALTER TABLE public.properties DROP COLUMN IF EXISTS visit_phone;

ALTER TABLE public.property_contacts ENABLE ROW LEVEL SECURITY;

-- Owner & admin : lecture + écriture
CREATE POLICY "Contacts: owner/admin select"
  ON public.property_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_contacts.property_id
        AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.contact_unlocks cu
      WHERE cu.property_id = property_contacts.property_id
        AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Contacts: owner/admin insert"
  ON public.property_contacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_contacts.property_id
        AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "Contacts: owner/admin update"
  ON public.property_contacts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_contacts.property_id
        AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_contacts.property_id
        AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE TRIGGER property_contacts_updated_at
  BEFORE UPDATE ON public.property_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mettre à jour get_visit_phone pour lire la nouvelle table
CREATE OR REPLACE FUNCTION public.get_visit_phone(_property_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_owner uuid;
BEGIN
  SELECT pc.visit_phone, p.owner_id INTO v_phone, v_owner
    FROM public.properties p
    LEFT JOIN public.property_contacts pc ON pc.property_id = p.id
   WHERE p.id = _property_id;

  IF v_phone IS NULL THEN RETURN NULL; END IF;
  IF auth.uid() = v_owner THEN RETURN v_phone; END IF;
  IF public.is_admin(auth.uid()) THEN RETURN v_phone; END IF;
  IF EXISTS (
    SELECT 1 FROM public.contact_unlocks
    WHERE user_id = auth.uid() AND property_id = _property_id
  ) THEN
    RETURN v_phone;
  END IF;
  RETURN NULL;
END;
$$;

-- =========================================================
-- 2) debit_tokens : débit atomique anti-race
-- =========================================================
CREATE OR REPLACE FUNCTION public.debit_tokens(
  _user_id uuid,
  _cost int,
  _reason text
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_bal int;
BEGIN
  IF _cost <= 0 THEN
    RAISE EXCEPTION 'INVALID_COST' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET tokens_balance = tokens_balance - _cost
   WHERE id = _user_id
     AND tokens_balance >= _cost
  RETURNING tokens_balance INTO new_bal;

  IF new_bal IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_TOKENS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.token_transactions (user_id, amount, reason)
  VALUES (_user_id, -_cost, _reason);

  RETURN new_bal;
END;
$$;

-- Personne ne peut l'appeler en RPC : usage server-only via service role
REVOKE EXECUTE ON FUNCTION public.debit_tokens(uuid, int, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debit_tokens(uuid, int, text) FROM anon, authenticated;

-- Crédit (refunds, admin) — service role uniquement
CREATE OR REPLACE FUNCTION public.credit_tokens(
  _user_id uuid,
  _amount int,
  _reason text
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_bal int;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET tokens_balance = tokens_balance + _amount
   WHERE id = _user_id
  RETURNING tokens_balance INTO new_bal;

  IF new_bal IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.token_transactions (user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  RETURN new_bal;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.credit_tokens(uuid, int, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_tokens(uuid, int, text) FROM anon, authenticated;

-- =========================================================
-- 3) Realtime : retirer les tables sensibles non écoutées
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'kyc_requests') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.kyc_requests';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'token_purchase_requests') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.token_purchase_requests';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'property_reports') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.property_reports';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'visit_bookings') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.visit_bookings';
  END IF;
END $$;