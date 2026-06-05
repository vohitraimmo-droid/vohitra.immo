-- 1) Prevent owners from self-assigning premium/verified status
CREATE OR REPLACE FUNCTION public.prevent_owner_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium
     OR NEW.premium_until IS DISTINCT FROM OLD.premium_until
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    NEW.is_premium   := OLD.is_premium;
    NEW.premium_until := OLD.premium_until;
    NEW.is_verified  := OLD.is_verified;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_owner_privilege_escalation ON public.properties;
CREATE TRIGGER trg_prevent_owner_privilege_escalation
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_privilege_escalation();

-- 2) Restrict direct SELECT on property_contacts to owner/admin only.
-- Tenants with a contact_unlock must use get_visit_phone() SECURITY DEFINER.
DROP POLICY IF EXISTS "Contacts: owner/admin select" ON public.property_contacts;

CREATE POLICY "Contacts: owner/admin select"
ON public.property_contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_contacts.property_id
      AND (p.owner_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);