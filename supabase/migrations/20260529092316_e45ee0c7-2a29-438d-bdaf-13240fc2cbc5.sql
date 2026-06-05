CREATE OR REPLACE FUNCTION public.prevent_owner_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role (admin server functions) and admins to update privileged fields
  IF auth.role() = 'service_role' OR public.is_admin(auth.uid()) THEN
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
$function$;