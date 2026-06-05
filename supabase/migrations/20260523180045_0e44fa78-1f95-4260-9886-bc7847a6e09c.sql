
-- Wave 3: storage policies + lock down SECURITY DEFINER execution

-- 1. Storage: admins can read KYC documents to validate requests
CREATE POLICY "KYC: admin read"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND public.is_admin(auth.uid()));

-- 2. Storage: property-photos public read (bucket is public, make policy explicit)
CREATE POLICY "Property photos: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-photos');

-- 3. Storage: property-photos owner update
CREATE POLICY "Property photos: owner update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Storage: site-assets public read + admin delete
CREATE POLICY "Site assets: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-assets');

CREATE POLICY "Site assets: admin delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));

-- 5. REVOKE EXECUTE on sensitive SECURITY DEFINER functions from public/anon roles.
-- These are called only by service-role (supabaseAdmin) — service_role bypasses grants.
REVOKE EXECUTE ON FUNCTION public.debit_tokens(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_tokens(uuid, integer, text) FROM PUBLIC, anon, authenticated;

-- get_visit_phone is invoked via RPC by authenticated clients — keep authenticated EXECUTE
REVOKE EXECUTE ON FUNCTION public.get_visit_phone(uuid) FROM PUBLIC, anon;
