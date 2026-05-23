ALTER TABLE public.app_versions ALTER COLUMN app_id DROP NOT NULL;
ALTER TABLE public.app_versions ADD COLUMN IF NOT EXISTS target text NOT NULL DEFAULT 'launcher';

CREATE POLICY "Admins manage versions"
ON public.app_versions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));