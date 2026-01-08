-- 🛠️ fix_admin_permissions.sql
-- Run this script in Supabase SQL Editor to fix Admin Panel access.

-- 1. ADMISSION: Allow Admins to see ALL profiles (so they can assign agents)
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. ASSIGNMENT: Allow Admins to View, Insert, Update, Delete assignments
DROP POLICY IF EXISTS "Admins manage assignments" ON public.agent_assignments;
CREATE POLICY "Admins manage assignments" ON public.agent_assignments 
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. REALTIME: Ensure tickets update on the Screen
-- (Only works if Publication exists, which is default in Supabase)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. VERIFY: Check if your user is actually an admin
-- Replace 'admin@example.com' with your email to check
-- SELECT * FROM public.profiles WHERE role = 'admin';
