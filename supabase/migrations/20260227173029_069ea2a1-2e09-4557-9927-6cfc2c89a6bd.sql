-- Insert patient record
INSERT INTO public.patients (user_id, blood_type, height_cm, weight_kg, medical_notes, insurance_provider, insurance_policy_number, primary_physician, primary_physician_phone)
VALUES (
  '7e245029-4a58-4f50-9ace-3db4d34e7c3b',
  'B+',
  172,
  68,
  'No significant surgical history. Regular checkups recommended.',
  'Star Health Insurance',
  'SHI-2024-88321',
  'Dr. Priya Sharma',
  '+91 98765 43210'
);

-- Get the patient ID and insert related records
DO $$
DECLARE
  _patient_id uuid;
BEGIN
  SELECT id INTO _patient_id FROM public.patients 
  WHERE user_id = '7e245029-4a58-4f50-9ace-3db4d34e7c3b' 
  ORDER BY created_at DESC LIMIT 1;

  -- NFC card with UUID number
  INSERT INTO public.nfc_cards (patient_id, encrypted_card_id, card_type)
  VALUES (_patient_id, '0009040961', 'UUID_CARD');

  -- Allergies
  INSERT INTO public.allergies (patient_id, allergen, severity, reaction) VALUES
    (_patient_id, 'Dust Mites', 'moderate', 'Sneezing, nasal congestion'),
    (_patient_id, 'Sulfa Drugs', 'severe', 'Skin rash, hives');

  -- Medications
  INSERT INTO public.medications (patient_id, medication_name, dosage, frequency) VALUES
    (_patient_id, 'Cetirizine', '10mg', 'Once daily'),
    (_patient_id, 'Vitamin D3', '1000 IU', 'Once daily');

  -- Medical history
  INSERT INTO public.medical_history (patient_id, condition, status) VALUES
    (_patient_id, 'Seasonal Allergic Rhinitis', 'active'),
    (_patient_id, 'Vitamin D Deficiency', 'active'),
    (_patient_id, 'Chickenpox (childhood)', 'resolved');

  -- Emergency contact
  INSERT INTO public.emergency_contacts (patient_id, name, phone, relationship, email) VALUES
    (_patient_id, 'Rahul Gupta', '+91 99887 76655', 'Brother', 'rahul.g@gmail.com');
END $$;
