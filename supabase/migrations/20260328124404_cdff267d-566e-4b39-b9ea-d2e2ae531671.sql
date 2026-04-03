
-- Add missing columns
ALTER TABLE public.diaries ADD COLUMN IF NOT EXISTS prevent_new_orders BOOLEAN DEFAULT false;
ALTER TABLE public.diaries ADD COLUMN IF NOT EXISTS diary_number SERIAL;

ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS owner_name TEXT DEFAULT '';
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS owner_phone TEXT DEFAULT '';
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT '';
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
