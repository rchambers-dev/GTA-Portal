REVOKE ALL ON FUNCTION public.create_employer_with_site(text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employer_with_site(text, text, text) TO authenticated, service_role;
