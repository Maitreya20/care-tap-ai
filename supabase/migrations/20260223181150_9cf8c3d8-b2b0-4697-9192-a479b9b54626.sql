-- Allow hospital admins to update and delete AI diagnoses
CREATE POLICY "Admins can manage all diagnoses"
ON public.ai_diagnoses
FOR ALL
USING (has_role(auth.uid(), 'hospital_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'hospital_admin'::app_role));