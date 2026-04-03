-- Allow owner and admin to read activity logs
DROP POLICY IF EXISTS "Owner can read logs" ON public.activity_logs;

CREATE POLICY "Owner/Admin can read logs"
ON public.activity_logs
FOR SELECT
USING (public.is_owner_or_admin(auth.uid()));