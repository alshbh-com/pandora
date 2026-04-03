-- Update RLS policy for office insert to also check can_add_orders
DROP POLICY IF EXISTS "Office user can insert orders for own office" ON public.orders;

CREATE POLICY "Office user can insert orders for own office"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'office'::app_role)
  AND office_id = (SELECT profiles.office_id FROM profiles WHERE profiles.id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM offices
    WHERE offices.id = office_id
    AND offices.can_add_orders = true
  )
);