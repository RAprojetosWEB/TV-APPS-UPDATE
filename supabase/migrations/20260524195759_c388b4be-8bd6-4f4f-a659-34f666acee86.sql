
CREATE TABLE public.build_counter (
  id TEXT PRIMARY KEY,
  version_base INTEGER NOT NULL DEFAULT 2,
  build_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.build_counter ENABLE ROW LEVEL SECURITY;

-- No public policies: only service role (admin client) can access.

INSERT INTO public.build_counter (id, version_base, build_number)
VALUES ('launcher', 2, 0);

CREATE OR REPLACE FUNCTION public.bump_build_counter(_id TEXT)
RETURNS TABLE(version_name TEXT, version_code INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base INTEGER;
  v_num INTEGER;
BEGIN
  UPDATE public.build_counter
  SET build_number = build_number + 1,
      updated_at = now()
  WHERE id = _id
  RETURNING version_base, build_number INTO v_base, v_num;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'build_counter id % not found', _id;
  END IF;

  version_name := v_base || '.' || v_num;
  version_code := v_num;
  RETURN NEXT;
END;
$$;
