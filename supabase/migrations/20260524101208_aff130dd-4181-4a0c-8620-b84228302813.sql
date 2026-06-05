-- 1) Defense-in-depth on properties update: forbid non-admin owners from changing premium/verified fields via RLS WITH CHECK
DROP POLICY IF EXISTS "Properties: owner update" ON public.properties;

CREATE POLICY "Properties: owner update"
ON public.properties
FOR UPDATE
USING ((auth.uid() = owner_id) OR public.is_admin(auth.uid()))
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    auth.uid() = owner_id
    AND is_premium    = (SELECT p.is_premium    FROM public.properties p WHERE p.id = properties.id)
    AND is_verified   = (SELECT p.is_verified   FROM public.properties p WHERE p.id = properties.id)
    AND premium_until IS NOT DISTINCT FROM (SELECT p.premium_until FROM public.properties p WHERE p.id = properties.id)
  )
);

-- 2) Realtime channel authorization: restrict messages topic subscriptions to participants
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Realtime: messages participants only" ON realtime.messages;

CREATE POLICY "Realtime: messages participants only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- topic format used by NotificationsListener: "notif-msg-<user_id>"
  realtime.topic() = ('notif-msg-' || auth.uid()::text)
);
