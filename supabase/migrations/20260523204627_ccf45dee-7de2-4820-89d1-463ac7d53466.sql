
-- 1. Adicionar colunas pra bloqueio e gestão remota na tabela apps existente
ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS icon_url text,
  ADD COLUMN IF NOT EXISTS apk_url text,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Criar enum de roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Tabela user_roles (separada pra evitar escalação de privilégio)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Função security definer pra checar role (evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Policies pra user_roles: cada usuário vê seus próprios roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 6. Policies de UPDATE/INSERT/DELETE na tabela apps: só admins
CREATE POLICY "Admins can insert apps"
ON public.apps
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update apps"
ON public.apps
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete apps"
ON public.apps
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 7. Trigger pra updated_at automático em apps (já tem coluna)
DROP TRIGGER IF EXISTS update_apps_updated_at ON public.apps;
CREATE TRIGGER update_apps_updated_at
BEFORE UPDATE ON public.apps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Bucket público pra ícones dos apps
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-icons', 'app-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: qualquer um pode ler ícones (são públicos)
CREATE POLICY "Public read access to app icons"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-icons');

-- Policy: só admins podem upload/update/delete ícones
CREATE POLICY "Admins can upload app icons"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app icons"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'app-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app icons"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'app-icons' AND public.has_role(auth.uid(), 'admin'));

-- 9. Migrar dados hardcoded dos 3 apps pro banco (se ainda não existem)
INSERT INTO public.apps (name, package_name, description, apk_url, display_order, is_active)
VALUES
  ('UniTV', 'com.unitv.app', 'Mais de 400 canais, filmes e séries',
   'https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/unitv.apk',
   1, true),
  ('Nexa TV', 'com.nexa.tv', 'Mais de 300 canais',
   'https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/Nexa_TV.apk',
   2, true),
  ('AlphaPlay', 'com.alphaplay.app', 'Mais de 300 canais, filmes e séries',
   'https://firebasestorage.googleapis.com/v0/b/update-41ccf.appspot.com/o/alphaplay.apk?alt=media&token=cdbe4055-ea90-4f2c-a540-1b458159ade6',
   3, true)
ON CONFLICT (package_name) DO UPDATE SET
  description = EXCLUDED.description,
  apk_url = COALESCE(public.apps.apk_url, EXCLUDED.apk_url),
  display_order = EXCLUDED.display_order;

-- 10. Adicionar constraint UNIQUE em package_name se não existir
DO $$ BEGIN
  ALTER TABLE public.apps ADD CONSTRAINT apps_package_name_key UNIQUE (package_name);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;
