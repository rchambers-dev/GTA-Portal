DROP FUNCTION public.create_employer_with_site(text, text, text, text);

CREATE FUNCTION public.create_employer_with_site(
  p_company_name text,
  p_postcode text,
  p_area_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  new_id text;
BEGIN
  IF NOT public.has_portal_role('Administrator', 'Management') THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO public.employers (company_name)
    VALUES (btrim(p_company_name))
    RETURNING employer_id INTO new_id;
  INSERT INTO public.employer_sites (employer_id, postcode, area_name)
    VALUES (new_id, p_postcode, p_area_name);
  RETURN new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_employer_with_site(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employer_with_site(text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.employer_sites_normalise_postcode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  NEW.postcode := public.normalise_uk_postcode(btrim(NEW.postcode));
  NEW.area_name := btrim(NEW.area_name);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.employer_sites_normalise_postcode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employer_sites_normalise_postcode() TO service_role;

ALTER TABLE public.employer_sites DROP COLUMN site_name;
