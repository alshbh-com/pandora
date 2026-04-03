
-- Add notes column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- Add pickup_price column to delivery_prices table  
ALTER TABLE public.delivery_prices ADD COLUMN IF NOT EXISTS pickup_price numeric NOT NULL DEFAULT 0;

-- Add coverage_areas column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coverage_areas text DEFAULT '';

-- Add shipping_paid column to orders for "رفض ودفع شحن" tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_paid numeric DEFAULT 0;

-- Remove foreign key constraint on orders.office_id to allow keeping orders when office is deleted
-- First drop the existing foreign key
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_office_id_fkey;

-- Re-add with SET NULL on delete
ALTER TABLE public.orders ADD CONSTRAINT orders_office_id_fkey 
  FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;

-- Same for delivery_prices
ALTER TABLE public.delivery_prices DROP CONSTRAINT IF EXISTS delivery_prices_office_id_fkey;
ALTER TABLE public.delivery_prices ADD CONSTRAINT delivery_prices_office_id_fkey 
  FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;

-- Make delivery_prices.office_id nullable
ALTER TABLE public.delivery_prices ALTER COLUMN office_id DROP NOT NULL;

-- Same for office_payments
ALTER TABLE public.office_payments DROP CONSTRAINT IF EXISTS office_payments_office_id_fkey;
ALTER TABLE public.office_payments ADD CONSTRAINT office_payments_office_id_fkey 
  FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;

-- Make office_payments.office_id nullable
ALTER TABLE public.office_payments ALTER COLUMN office_id DROP NOT NULL;

-- Remove company foreign key constraints (set null on delete)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_company_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;
