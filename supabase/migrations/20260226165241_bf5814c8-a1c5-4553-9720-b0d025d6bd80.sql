
-- Create a function to look up patient_id by card number (UUID card or NFC encrypted_card_id)
CREATE OR REPLACE FUNCTION public.get_patient_by_card_number(_card_number text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT patient_id 
  FROM public.nfc_cards 
  WHERE encrypted_card_id = _card_number 
    AND is_active = true 
  LIMIT 1
$$;
