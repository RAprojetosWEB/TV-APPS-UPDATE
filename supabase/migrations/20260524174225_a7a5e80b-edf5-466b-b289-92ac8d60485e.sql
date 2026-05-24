UPDATE public.app_versions SET is_latest = false WHERE target = 'launcher';
UPDATE public.app_versions SET is_latest = true WHERE id = (
  SELECT id FROM public.app_versions WHERE target = 'launcher' ORDER BY version_code DESC LIMIT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS app_versions_one_latest_per_target
  ON public.app_versions (target) WHERE is_latest = true;