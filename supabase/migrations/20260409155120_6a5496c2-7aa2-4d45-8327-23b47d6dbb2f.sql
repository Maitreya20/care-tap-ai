
CREATE OR REPLACE FUNCTION public.assign_role_on_signup(_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow updating if user has exactly the default 'patient' role
  -- This prevents abuse after initial signup
  IF (SELECT COUNT(*) FROM public.user_roles WHERE user_id = auth.uid()) = 1
     AND (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'patient' THEN
    UPDATE public.user_roles
    SET role = _role
    WHERE user_id = auth.uid();
  END IF;
END;
$$;
