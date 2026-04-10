
-- Convert existing role assignments
UPDATE public.user_roles SET role = 'admin' WHERE role = 'hospital_admin';
UPDATE public.user_roles SET role = 'doctor' WHERE role = 'medical_responder';

-- Update assign_role_on_signup function
CREATE OR REPLACE FUNCTION public.assign_role_on_signup(_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.user_roles WHERE user_id = auth.uid()) = 1
     AND (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'patient' THEN
    UPDATE public.user_roles
    SET role = _role
    WHERE user_id = auth.uid();
  END IF;
END;
$$;

-- =====================
-- UPDATE RLS POLICIES
-- =====================

-- access_logs
DROP POLICY IF EXISTS "Admins can insert any logs" ON public.access_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON public.access_logs;
CREATE POLICY "Admins can insert any logs" ON public.access_logs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all logs" ON public.access_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- ai_diagnoses
DROP POLICY IF EXISTS "Admins can manage all diagnoses" ON public.ai_diagnoses;
DROP POLICY IF EXISTS "Medical responders can create diagnoses" ON public.ai_diagnoses;
DROP POLICY IF EXISTS "Medical responders can view all diagnoses" ON public.ai_diagnoses;
CREATE POLICY "Admins can manage all diagnoses" ON public.ai_diagnoses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Doctors can create diagnoses" ON public.ai_diagnoses FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Doctors can view all diagnoses" ON public.ai_diagnoses FOR SELECT USING (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- allergies
DROP POLICY IF EXISTS "Medical responders can create allergies" ON public.allergies;
DROP POLICY IF EXISTS "Medical responders can view all allergies" ON public.allergies;
CREATE POLICY "Doctors can create allergies" ON public.allergies FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Doctors can view all allergies" ON public.allergies FOR SELECT USING (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- emergency_contacts
DROP POLICY IF EXISTS "Medical responders can create emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Medical responders can view all contacts" ON public.emergency_contacts;
CREATE POLICY "Doctors can create emergency contacts" ON public.emergency_contacts FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clinical staff can view all contacts" ON public.emergency_contacts FOR SELECT USING (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- medical_history
DROP POLICY IF EXISTS "Admins can manage all history" ON public.medical_history;
DROP POLICY IF EXISTS "Medical responders can create medical history" ON public.medical_history;
DROP POLICY IF EXISTS "Medical responders can view all history" ON public.medical_history;
CREATE POLICY "Admins can manage all history" ON public.medical_history FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Doctors can create medical history" ON public.medical_history FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clinical staff can view all history" ON public.medical_history FOR SELECT USING (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- medications
DROP POLICY IF EXISTS "Admins can manage all medications" ON public.medications;
DROP POLICY IF EXISTS "Medical responders can create medications" ON public.medications;
DROP POLICY IF EXISTS "Medical responders can view all medications" ON public.medications;
CREATE POLICY "Admins can manage all medications" ON public.medications FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Doctors can create medications" ON public.medications FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clinical staff can view all medications" ON public.medications FOR SELECT USING (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- nfc_cards
DROP POLICY IF EXISTS "Admins can manage all cards" ON public.nfc_cards;
DROP POLICY IF EXISTS "Medical responders can create NFC cards" ON public.nfc_cards;
DROP POLICY IF EXISTS "Medical responders can view all cards" ON public.nfc_cards;
CREATE POLICY "Admins can manage all cards" ON public.nfc_cards FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Doctors can create NFC cards" ON public.nfc_cards FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clinical staff can view all cards" ON public.nfc_cards FOR SELECT USING (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- patients
DROP POLICY IF EXISTS "Admins can manage all patient data" ON public.patients;
DROP POLICY IF EXISTS "Medical responders can create patients" ON public.patients;
DROP POLICY IF EXISTS "Medical responders can view all patient data" ON public.patients;
CREATE POLICY "Admins can manage all patient data" ON public.patients FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Doctors can create patients" ON public.patients FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clinical staff can view all patients" ON public.patients FOR SELECT USING (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- profiles
DROP POLICY IF EXISTS "Medical responders can view all profiles" ON public.profiles;
CREATE POLICY "Clinical staff can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
