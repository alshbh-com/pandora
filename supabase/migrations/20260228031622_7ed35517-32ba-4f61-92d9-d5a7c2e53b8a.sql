
-- Add office_id to profiles for linking office users to their office
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL;

-- Allow office users to read their own office's non-closed orders
CREATE POLICY "Office user can read own office orders"
ON public.orders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'office'::app_role) AND
  office_id = (SELECT office_id FROM public.profiles WHERE id = auth.uid())
  AND is_closed = false
);

-- Allow office users to read their own office payments (read-only)
CREATE POLICY "Office user can read own office payments"
ON public.office_payments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'office'::app_role) AND
  office_id = (SELECT office_id FROM public.profiles WHERE id = auth.uid())
);
