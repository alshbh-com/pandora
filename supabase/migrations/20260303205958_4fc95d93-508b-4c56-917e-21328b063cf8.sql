
-- Create trigger to auto-generate barcode on insert (prevents sequence waste)
CREATE OR REPLACE FUNCTION public.generate_barcode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := nextval('public.barcode_numeric_seq')::TEXT;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_barcode_on_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_barcode();

-- Reset barcode sequence to match actual max
SELECT setval('public.barcode_numeric_seq', GREATEST(
  (SELECT COALESCE(MAX(barcode::bigint), 0) FROM orders WHERE barcode ~ '^\d+$'),
  1
));
