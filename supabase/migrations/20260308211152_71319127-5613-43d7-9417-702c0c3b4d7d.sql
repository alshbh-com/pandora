
-- App settings table for accounting password etc.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner can manage settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Add manual financial columns to diary_orders
ALTER TABLE public.diary_orders
  ADD COLUMN IF NOT EXISTS manual_pickup numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_arrived numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_shipping_diff numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_delivery_commission numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_reject_no_ship numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_return_penalty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_return_status text DEFAULT '';
