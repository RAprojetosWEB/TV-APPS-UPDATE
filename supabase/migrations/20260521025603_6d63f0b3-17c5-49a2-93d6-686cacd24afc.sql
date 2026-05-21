-- Create apps table
CREATE TABLE public.apps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  package_name TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app_versions table
CREATE TABLE public.app_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL, -- e.g. "1.0.5"
  version_code INTEGER NOT NULL, -- e.g. 5
  apk_url TEXT NOT NULL,
  apk_size_mb NUMERIC,
  changelog TEXT,
  is_latest BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for public reading
CREATE POLICY "Apps are viewable by everyone" ON public.apps FOR SELECT USING (true);
CREATE POLICY "App versions are viewable by everyone" ON public.app_versions FOR SELECT USING (true);

-- Create function to handle updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_apps_updated_at
    BEFORE UPDATE ON public.apps
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

-- Insert initial data based on existing apps in code
INSERT INTO public.apps (name, package_name, description) VALUES 
('UniTV', 'com.unitv.app', 'Mais de 400 canais, filmes e séries'),
('Nexa TV', 'com.nexatv.app', 'Mais de 300 canais'),
('AlphaPlay', 'com.alphaplay.app', 'Mais de 300 canais, filmes e séries');

-- Insert initial versions for each app
-- UniTV
INSERT INTO public.app_versions (app_id, version_name, version_code, apk_url, apk_size_mb, changelog)
SELECT id, '1.0.0', 1, 'https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/unitv.apk', 25.5, 'Versão inicial'
FROM public.apps WHERE package_name = 'com.unitv.app';

-- Nexa TV
INSERT INTO public.app_versions (app_id, version_name, version_code, apk_url, apk_size_mb, changelog)
SELECT id, '1.2.0', 12, 'https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/nexatv.apk', 18.2, 'Versão inicial'
FROM public.apps WHERE package_name = 'com.nexatv.app';

-- AlphaPlay
INSERT INTO public.app_versions (app_id, version_name, version_code, apk_url, apk_size_mb, changelog)
SELECT id, '2.1.0', 21, 'https://firebasestorage.googleapis.com/v0/b/update-41ccf.appspot.com/o/alphaplay.apk?alt=media&token=cdbe4055-ea90-4f2c-a540-1b458159ade6', 30.1, 'Versão inicial'
FROM public.apps WHERE package_name = 'com.alphaplay.app';
