
-- Step 1: Add new enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
