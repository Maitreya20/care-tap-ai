-- Fix: Remove permissive INSERT policy and add proper authentication-based logging

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert logs" ON public.access_logs;

-- Create a proper policy that requires authenticated users and validates user_id matches
CREATE POLICY "Authenticated users can log their own actions" 
ON public.access_logs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also allow admins to insert logs on behalf of any user (for system logging)
CREATE POLICY "Admins can insert any logs" 
ON public.access_logs 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'hospital_admin'::app_role));

-- Create trigger to insert profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow users to insert their own profile (needed for signup flow)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);