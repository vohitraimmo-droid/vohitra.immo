-- Remove sensitive tables from Realtime publication.
-- profiles (email/phone) and verification_requests (KYC) don't need live broadcasts;
-- the app can refetch on demand. messages stays (RLS-protected, needed for chat UX).
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.verification_requests;

-- Explicit deny policies on token_transactions for client roles
-- (mirrors the pattern used on contact_unlocks / subscriptions).
CREATE POLICY "Tx: no client insert"
  ON public.token_transactions
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Tx: no client update"
  ON public.token_transactions
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Tx: no client delete"
  ON public.token_transactions
  FOR DELETE TO anon, authenticated
  USING (false);