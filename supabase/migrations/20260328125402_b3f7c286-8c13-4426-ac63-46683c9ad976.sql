
-- Reset the barcode sequence to start from 2 (since we'll manually set order 1)
ALTER SEQUENCE public.order_barcode_seq RESTART WITH 2;

-- Add unique constraint on barcode to prevent duplicates
ALTER TABLE public.orders ADD CONSTRAINT orders_barcode_unique UNIQUE (barcode);

-- Update existing order barcode from 1000 to 1
UPDATE orders SET barcode = '1', tracking_id = 'TP-1' WHERE barcode = '1000';
