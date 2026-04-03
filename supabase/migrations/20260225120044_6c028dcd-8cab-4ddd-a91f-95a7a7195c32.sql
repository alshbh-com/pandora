
-- Add more fields to offices
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS owner_name text DEFAULT '';
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS owner_phone text DEFAULT '';
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS address text DEFAULT '';
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- Add more fields to profiles (for couriers)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- Create delivery_prices table for office-specific delivery prices
CREATE TABLE IF NOT EXISTS public.delivery_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  governorate text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read delivery_prices" ON public.delivery_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner/Admin can insert delivery_prices" ON public.delivery_prices FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update delivery_prices" ON public.delivery_prices FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete delivery_prices" ON public.delivery_prices FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Add partial_amount field to orders for partial delivery
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS partial_amount numeric DEFAULT 0;

-- Insert partial delivery status if not exists
INSERT INTO public.order_statuses (name, color, sort_order)
SELECT 'تسليم جزئي', '#f59e0b', 15
WHERE NOT EXISTS (SELECT 1 FROM public.order_statuses WHERE name = 'تسليم جزئي');
