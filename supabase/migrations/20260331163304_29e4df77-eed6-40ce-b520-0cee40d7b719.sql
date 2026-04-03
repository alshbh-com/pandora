-- Fix the broken barcode that was generated as timestamp
UPDATE orders SET barcode = (SELECT last_value + 1 FROM order_barcode_seq)::TEXT, tracking_id = 'TP-' || (SELECT last_value + 1 FROM order_barcode_seq)::TEXT WHERE barcode = '1774958818344';
SELECT setval('order_barcode_seq', (SELECT COALESCE(MAX(barcode::bigint), 0) FROM orders WHERE barcode ~ '^\d+$' AND length(barcode) < 10) + 1);