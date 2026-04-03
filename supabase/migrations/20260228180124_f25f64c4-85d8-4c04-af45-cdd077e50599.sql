-- Allow office users to insert orders for their own office
CREATE POLICY "Office user can insert orders for own office"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'office'::app_role)
  AND office_id = (SELECT profiles.office_id FROM profiles WHERE profiles.id = auth.uid())
);
