ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_courier_closed boolean DEFAULT false;

-- Mark existing closed orders that have a courier as courier-closed
UPDATE public.orders SET is_courier_closed = true WHERE is_closed = true AND courier_id IS NOT NULL;