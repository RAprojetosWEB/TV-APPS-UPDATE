INSERT INTO storage.buckets (id, name, public) VALUES ('tvapps-updates', 'tvapps-updates', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public read tvapps-updates"
ON storage.objects FOR SELECT
USING (bucket_id = 'tvapps-updates');