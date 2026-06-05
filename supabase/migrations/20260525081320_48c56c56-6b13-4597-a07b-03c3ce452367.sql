CREATE OR REPLACE FUNCTION public.count_active_users(since timestamptz)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT user_id)::int FROM (
    SELECT sender_id AS user_id FROM messages WHERE created_at >= since
    UNION
    SELECT viewer_id AS user_id FROM property_views WHERE created_at >= since AND viewer_id IS NOT NULL
    UNION
    SELECT user_id FROM contact_unlocks WHERE created_at >= since
    UNION
    SELECT user_id FROM favorites WHERE created_at >= since
    UNION
    SELECT tenant_id AS user_id FROM visit_bookings WHERE created_at >= since
    UNION
    SELECT user_id FROM token_transactions WHERE created_at >= since
    UNION
    SELECT user_id FROM token_purchase_requests WHERE created_at >= since
    UNION
    SELECT user_id FROM search_alerts WHERE created_at >= since
  ) AS active_users
$function$;