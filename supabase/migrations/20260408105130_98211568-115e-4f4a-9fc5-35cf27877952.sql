
-- Add identity columns to patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender public.gender,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Backfill existing patients from profiles
UPDATE public.patients p
SET 
  full_name = pr.full_name,
  email = pr.email,
  date_of_birth = pr.date_of_birth,
  gender = pr.gender,
  phone = pr.phone
FROM public.profiles pr
WHERE p.user_id = pr.id AND p.full_name IS NULL;
