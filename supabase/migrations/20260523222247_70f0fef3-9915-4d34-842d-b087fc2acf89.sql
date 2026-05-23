DROP POLICY IF EXISTS "Public read tvapps-updates files" ON storage.objects;

CREATE POLICY "Public read tvapps-updates"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'tvapps-updates');

CREATE POLICY "Admins upload tvapps-updates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tvapps-updates' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update tvapps-updates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'tvapps-updates' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'tvapps-updates' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete tvapps-updates"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'tvapps-updates' AND public.has_role(auth.uid(), 'admin'::app_role));