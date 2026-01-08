-- 🚑 3_fix_recursion.sql
-- Run this to fix the "infinite recursion" error on the dashboard.

-- 1. Create a Secure Function to check Admin Status (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER -- <--- This is key. It runs with owner permissions, ignoring RLS.
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- 2. Update Policies to use the Safe Function (Instead of querying table directly)

-- PROFILES
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles 
FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins modify profiles" ON public.profiles;
CREATE POLICY "Admins modify profiles" ON public.profiles 
FOR UPDATE USING (public.is_admin());

-- FACULTIES
DROP POLICY IF EXISTS "Admin Write Faculties" ON public.faculties;
CREATE POLICY "Admin Write Faculties" ON public.faculties 
FOR ALL USING (public.is_admin());

-- DEPARTMENTS
DROP POLICY IF EXISTS "Admin Write Departments" ON public.departments;
CREATE POLICY "Admin Write Departments" ON public.departments 
FOR ALL USING (public.is_admin());

-- AGENT ASSIGNMENTS
DROP POLICY IF EXISTS "Admins manage assignments" ON public.agent_assignments;
CREATE POLICY "Admins manage assignments" ON public.agent_assignments 
FOR ALL USING (public.is_admin());

-- TICKETS
DROP POLICY IF EXISTS "Agents view dept tickets" ON public.tickets;
CREATE POLICY "Agents view dept tickets" ON public.tickets FOR SELECT USING (
  EXISTS (select 1 from public.agent_assignments aa where aa.user_id = auth.uid() and aa.department_id = public.tickets.department_id)
  OR
  public.is_admin() -- Use Safe Function
);

DROP POLICY IF EXISTS "Agents update dept tickets" ON public.tickets;
CREATE POLICY "Agents update dept tickets" ON public.tickets FOR UPDATE USING (
  EXISTS (select 1 from public.agent_assignments aa where aa.user_id = auth.uid() and aa.department_id = public.tickets.department_id)
  OR
  public.is_admin() -- Use Safe Function
);
