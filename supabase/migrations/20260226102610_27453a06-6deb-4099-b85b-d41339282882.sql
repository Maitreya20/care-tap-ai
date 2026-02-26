-- Allow medical responders to insert patients
CREATE POLICY "Medical responders can create patients"
ON public.patients
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'medical_responder'::app_role) OR has_role(auth.uid(), 'hospital_admin'::app_role));

-- Allow medical responders to insert NFC cards
CREATE POLICY "Medical responders can create NFC cards"
ON public.nfc_cards
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'medical_responder'::app_role) OR has_role(auth.uid(), 'hospital_admin'::app_role));

-- Allow medical responders to insert emergency contacts
CREATE POLICY "Medical responders can create emergency contacts"
ON public.emergency_contacts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'medical_responder'::app_role) OR has_role(auth.uid(), 'hospital_admin'::app_role));

-- Allow medical responders to insert medical history
CREATE POLICY "Medical responders can create medical history"
ON public.medical_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'medical_responder'::app_role) OR has_role(auth.uid(), 'hospital_admin'::app_role));
