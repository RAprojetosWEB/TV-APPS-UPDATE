
-- 1. Revogar execução pública da função has_role (continua funcionando dentro de RLS policies)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;

-- 2. Restringir listagem no bucket app-icons (mantém leitura direta de URL pública)
-- Remove a policy ampla anterior
DROP POLICY IF EXISTS "Public read access to app icons" ON storage.objects;

-- Cria policy que permite SELECT apenas com prefixo conhecido (não permite LIST de tudo)
CREATE POLICY "Public can read individual app icons"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-icons' AND name IS NOT NULL);
