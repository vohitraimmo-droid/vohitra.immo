
-- 1. Restrict visit_phone column from public/authenticated reads
REVOKE SELECT (visit_phone) ON public.properties FROM anon, authenticated;

-- Helper RPC: returns visit_phone only if caller is owner, admin, or has an unlock
CREATE OR REPLACE FUNCTION public.get_visit_phone(_property_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_owner uuid;
BEGIN
  SELECT visit_phone, owner_id INTO v_phone, v_owner
    FROM public.properties WHERE id = _property_id;
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

REVOKE EXECUTE ON FUNCTION public.get_visit_phone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visit_phone(uuid) TO authenticated;

-- 2. Explicit deny client writes on contact_unlocks (admin client bypasses RLS)
CREATE POLICY "Unlocks: no client insert" ON public.contact_unlocks
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Unlocks: no client update" ON public.contact_unlocks
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Unlocks: no client delete" ON public.contact_unlocks
  FOR DELETE TO authenticated, anon USING (false);

-- 3. Storage: restrict property-photos upload to the folder owned by the uploader
DROP POLICY IF EXISTS "Property photos: authenticated upload" ON storage.objects;
CREATE POLICY "Property photos: owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-photos'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.is_admin(auth.uid())
    )
  );

-- 4. user_roles: prevent admins from changing their own role
DROP POLICY IF EXISTS "Roles: admin manage" ON public.user_roles;
CREATE POLICY "Roles: admin insert others" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND user_id <> auth.uid());
CREATE POLICY "Roles: admin update others" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND user_id <> auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND user_id <> auth.uid());
CREATE POLICY "Roles: admin delete others" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND user_id <> auth.uid());

-- 5. Trigger-only SECURITY DEFINER functions: revoke EXECUTE from API roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_property_content() FROM PUBLIC, anon, authenticated;
