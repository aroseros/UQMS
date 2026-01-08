-- 👑 promote_admin.sql
-- Run this script in your Supabase SQL Editor to make a user an Admin.

-- 1. Replace 'admin@example.com' with the actual email of the user you want to promote.
--    NOTE: The user must already have signed up (exist in auth.users).

UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'admin@example.com' -- <--- CHANGE THIS EMAIL
);

-- Verify the change
SELECT * FROM public.profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
