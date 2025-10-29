-- Create enum types
CREATE TYPE public.app_role AS ENUM ('patient', 'medical_responder', 'hospital_admin');
CREATE TYPE public.blood_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
CREATE TYPE public.triage_level AS ENUM ('critical', 'urgent', 'stable');
CREATE TYPE public.gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  gender public.gender,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Patients table (medical records)
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  blood_type public.blood_type,
  height_cm DECIMAL(5,2),
  weight_kg DECIMAL(5,2),
  medical_notes TEXT,
  encrypted_ssn TEXT,
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  primary_physician TEXT,
  primary_physician_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NFC Cards registry
CREATE TABLE public.nfc_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  encrypted_card_id TEXT NOT NULL UNIQUE,
  card_type TEXT NOT NULL DEFAULT 'NTAG215',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  scan_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emergency contacts
CREATE TABLE public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Medical history entries
CREATE TABLE public.medical_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  condition TEXT NOT NULL,
  diagnosed_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Current medications
CREATE TABLE public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  prescribing_doctor TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allergies
CREATE TABLE public.allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  allergen TEXT NOT NULL,
  severity TEXT NOT NULL,
  reaction TEXT,
  diagnosed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI diagnosis logs (for audit and learning)
CREATE TABLE public.ai_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  scanned_by UUID REFERENCES auth.users(id) NOT NULL,
  triage_level public.triage_level NOT NULL,
  probable_conditions JSONB NOT NULL,
  confidence_scores JSONB NOT NULL,
  immediate_actions JSONB NOT NULL,
  medication_recommendations JSONB,
  ai_explanation TEXT,
  scan_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Access logs (compliance and audit trail)
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get patient_id from user_id
CREATE OR REPLACE FUNCTION public.get_patient_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.patients WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Medical responders can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'hospital_admin'));

-- RLS Policies for patients
CREATE POLICY "Patients can view their own data"
  ON public.patients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Patients can update their own data"
  ON public.patients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Medical responders can view all patient data"
  ON public.patients FOR SELECT
  USING (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

CREATE POLICY "Admins can manage all patient data"
  ON public.patients FOR ALL
  USING (public.has_role(auth.uid(), 'hospital_admin'));

-- RLS Policies for nfc_cards
CREATE POLICY "Patients can view their own cards"
  ON public.nfc_cards FOR SELECT
  USING (patient_id = public.get_patient_id(auth.uid()));

CREATE POLICY "Medical responders can view all cards"
  ON public.nfc_cards FOR SELECT
  USING (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

CREATE POLICY "Admins can manage all cards"
  ON public.nfc_cards FOR ALL
  USING (public.has_role(auth.uid(), 'hospital_admin'));

-- RLS Policies for emergency_contacts
CREATE POLICY "Patients can manage their own contacts"
  ON public.emergency_contacts FOR ALL
  USING (patient_id = public.get_patient_id(auth.uid()));

CREATE POLICY "Medical responders can view all contacts"
  ON public.emergency_contacts FOR SELECT
  USING (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

-- RLS Policies for medical_history
CREATE POLICY "Patients can view their own history"
  ON public.medical_history FOR SELECT
  USING (patient_id = public.get_patient_id(auth.uid()));

CREATE POLICY "Medical responders can view all history"
  ON public.medical_history FOR SELECT
  USING (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

CREATE POLICY "Admins can manage all history"
  ON public.medical_history FOR ALL
  USING (public.has_role(auth.uid(), 'hospital_admin'));

-- RLS Policies for medications
CREATE POLICY "Patients can view their own medications"
  ON public.medications FOR SELECT
  USING (patient_id = public.get_patient_id(auth.uid()));

CREATE POLICY "Medical responders can view all medications"
  ON public.medications FOR SELECT
  USING (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

CREATE POLICY "Admins can manage all medications"
  ON public.medications FOR ALL
  USING (public.has_role(auth.uid(), 'hospital_admin'));

-- RLS Policies for allergies
CREATE POLICY "Patients can manage their own allergies"
  ON public.allergies FOR ALL
  USING (patient_id = public.get_patient_id(auth.uid()));

CREATE POLICY "Medical responders can view all allergies"
  ON public.allergies FOR SELECT
  USING (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

-- RLS Policies for ai_diagnoses
CREATE POLICY "Medical responders can create diagnoses"
  ON public.ai_diagnoses FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

CREATE POLICY "Medical responders can view all diagnoses"
  ON public.ai_diagnoses FOR SELECT
  USING (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

CREATE POLICY "Patients can view their own diagnoses"
  ON public.ai_diagnoses FOR SELECT
  USING (patient_id = public.get_patient_id(auth.uid()));

-- RLS Policies for access_logs
CREATE POLICY "Admins can view all logs"
  ON public.access_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'hospital_admin'));

CREATE POLICY "System can insert logs"
  ON public.access_logs FOR INSERT
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medical_history_updated_at BEFORE UPDATE ON public.medical_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_allergies_updated_at BEFORE UPDATE ON public.allergies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_patients_user_id ON public.patients(user_id);
CREATE INDEX idx_nfc_cards_patient_id ON public.nfc_cards(patient_id);
CREATE INDEX idx_nfc_cards_encrypted_card_id ON public.nfc_cards(encrypted_card_id);
CREATE INDEX idx_emergency_contacts_patient_id ON public.emergency_contacts(patient_id);
CREATE INDEX idx_medical_history_patient_id ON public.medical_history(patient_id);
CREATE INDEX idx_medications_patient_id ON public.medications(patient_id);
CREATE INDEX idx_allergies_patient_id ON public.allergies(patient_id);
CREATE INDEX idx_ai_diagnoses_patient_id ON public.ai_diagnoses(patient_id);
CREATE INDEX idx_ai_diagnoses_scanned_by ON public.ai_diagnoses(scanned_by);
CREATE INDEX idx_access_logs_user_id ON public.access_logs(user_id);
CREATE INDEX idx_access_logs_patient_id ON public.access_logs(patient_id);
CREATE INDEX idx_access_logs_created_at ON public.access_logs(created_at);