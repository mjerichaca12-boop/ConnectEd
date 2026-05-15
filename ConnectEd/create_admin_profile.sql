-- Insert hardcoded admin profile to satisfy foreign key constraints
-- This creates the admin profile that matches the hardcoded UUID in AdminMessages.jsx

INSERT INTO public.profiles (
  id,
  first_name,
  last_name,
  email,
  role,
  is_verified,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'System',
  'Administrator',
  'admin.connected.local',
  'admin',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified,
  updated_at = NOW();
