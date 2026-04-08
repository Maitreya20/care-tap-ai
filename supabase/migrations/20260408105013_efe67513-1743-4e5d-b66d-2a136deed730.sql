
-- Add missing INSERT policies for medications and allergies
CREATE POLICY "Medical responders can create medications"
  ON public.medications FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));

CREATE POLICY "Medical responders can create allergies"
  ON public.allergies FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'medical_responder') OR public.has_role(auth.uid(), 'hospital_admin'));
