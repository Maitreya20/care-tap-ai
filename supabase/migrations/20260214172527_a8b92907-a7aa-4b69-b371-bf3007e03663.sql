INSERT INTO public.user_roles (user_id, role)
VALUES ('4fb197de-6cfa-480c-bbd9-0e3e01cb1dcb', 'medical_responder')
ON CONFLICT (user_id, role) DO NOTHING;