ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS setup_status text NOT NULL DEFAULT 'completed'
  CHECK (setup_status IN ('pending','completed'));