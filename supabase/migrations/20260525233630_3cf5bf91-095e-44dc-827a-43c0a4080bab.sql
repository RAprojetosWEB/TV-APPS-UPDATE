DROP INDEX IF EXISTS public.app_versions_one_latest_per_target;

CREATE UNIQUE INDEX app_versions_one_latest_launcher
  ON public.app_versions (target)
  WHERE is_latest = true AND target = 'launcher';

CREATE UNIQUE INDEX app_versions_one_latest_per_app
  ON public.app_versions (app_id)
  WHERE is_latest = true AND target = 'app';