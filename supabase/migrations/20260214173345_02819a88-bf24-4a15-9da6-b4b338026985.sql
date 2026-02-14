INSERT INTO public.user_roles (user_id, role)
VALUES ('7e245029-4a58-4f50-9ace-3db4d34e7c3b', 'medical_responder')
ON CONFLICT (user_id, role) DO NOTHING;