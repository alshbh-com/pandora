
CREATE OR REPLACE FUNCTION public.nextval_barcode()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.barcode_numeric_seq');
$$;
