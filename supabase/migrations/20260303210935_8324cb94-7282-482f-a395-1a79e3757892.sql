-- Fix wrong barcodes
UPDATE orders SET barcode = '175' WHERE barcode = '2020';
UPDATE orders SET barcode = '176' WHERE barcode = '2021';

-- Reset sequence so next barcode will be 178
SELECT setval('public.barcode_numeric_seq', 177);