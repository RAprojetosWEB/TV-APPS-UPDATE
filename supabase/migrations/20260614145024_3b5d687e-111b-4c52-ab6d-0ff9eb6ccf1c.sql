CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE,
  client_name text,
  status text NOT NULL DEFAULT 'blocked',
  expires_at timestamptz,
  registered_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage devices"
ON public.devices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX devices_status_idx ON public.devices(status);
CREATE INDEX devices_expires_at_idx ON public.devices(expires_at);