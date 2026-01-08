-- RESET DATABASE SCRIPT
-- RUN THIS IF YOU HAVE PARTIAL DATA OR DUPLICATE ERRORS
-- WARNING: DELETES ALL DATA IN UQMS TABLES

BEGIN;

-- 1. Truncate all tables (Cascade to handle foreign keys)
truncate table public.tickets cascade;
truncate table public.agent_assignments cascade;
truncate table public.departments cascade;
truncate table public.faculties cascade;
-- profiles connects to auth.users, let's keep profiles but maybe reset them? 
-- Actually, truncating profiles is risky if it cascades to auth users? No, usually profiles references auth.users.
-- Truncating profiles -> deletes app data. Auth users remain. 
-- BUT, if we truncate profiles, the users (in auth.users) will effectively lose their role info.
-- Let's just truncate the core business data.
-- truncate table public.profiles cascade; 

-- 2. Re-insert Seed Data

-- Faculties
insert into public.faculties (id, name, code) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Faculty of Engineering', 'SCITECH'), -- Changed CODE slightly just in case
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Faculty of Business', 'BUS'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Faculty of Arts', 'ART');

-- Departments
insert into public.departments (faculty_id, name, prefix) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Computer Science', 'CS'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mechanical Eng', 'ME'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Accounting', 'ACC'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Marketing', 'MKT');

COMMIT;
