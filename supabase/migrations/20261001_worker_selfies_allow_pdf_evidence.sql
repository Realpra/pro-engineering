-- E7-iii (WorkersTable_Review workbook, 1 Oct 2026): staff completing a returned
-- worker's missing data from a phone/WhatsApp/email intake need to upload evidence as
-- either a photo OR a PDF (e.g. a scanned BOCW card, bank passbook page) -- the bucket's
-- original allowed_mime_types (image formats only) would reject a PDF outright.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
WHERE id = 'worker-selfies';
