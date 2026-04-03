
-- Persist financial summary data on diaries
ALTER TABLE public.diaries 
  ADD COLUMN IF NOT EXISTS cash_arrived_entries jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_due numeric DEFAULT 0;

-- Orange sheet manual override fields
ALTER TABLE public.diary_orders 
  ADD COLUMN IF NOT EXISTS manual_total_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manual_shipping_amount numeric DEFAULT NULL;
