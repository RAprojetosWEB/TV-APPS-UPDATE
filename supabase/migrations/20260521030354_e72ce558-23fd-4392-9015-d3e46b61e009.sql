DROP POLICY IF EXISTS "Public read tvapps-updates" ON storage.objects;

CREATE POLICY "Public read tvapps-updates files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'tvapps-updates'
  AND name IN ('tvapps-latest.apk', 'update.json')
);