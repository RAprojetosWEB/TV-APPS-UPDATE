CREATE TABLE public.app_settings (
  id text PRIMARY KEY,
  login_password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Sem policies: nenhum cliente lê ou escreve. Apenas service role (servidor) acessa.

INSERT INTO public.app_settings (id, login_password) VALUES ('main', '1555');

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();