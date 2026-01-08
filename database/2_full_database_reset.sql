-- 💥 2_full_database_reset.sql
-- WARNING: This will DELETE ALL DATA in your 'public' tables (Tickets, Departments, Faculties).
-- It does NOT delete Users (because they live in the protected 'auth' schema), but it disconnects them.

-- ============================================================================
-- 0. CLEANUP (WIPE EVERYTHING)
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.call_next_ticket(uuid);

DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.agent_assignments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.faculties CASCADE;

DROP TYPE IF EXISTS public.user_role;
DROP TYPE IF EXISTS public.ticket_status;

-- ============================================================================
-- 1. SCHEMA SETUP
-- ============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enums
create type public.user_role as enum ('admin', 'agent');
create type public.ticket_status as enum ('waiting', 'serving', 'completed', 'cancelled');

-- Faculties
create table public.faculties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique
);

-- Departments
create table public.departments (
  id uuid primary key default uuid_generate_v4(),
  faculty_id uuid references public.faculties(id) on delete cascade not null,
  name text not null,
  prefix text not null
);

-- Profiles (Linked to auth.users)
-- NOTE: We do NOT store passwords here. Supabase stores them securely in 'auth.users'.
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role public.user_role not null default 'agent',
  is_active boolean default true,
  full_name text,
  created_at timestamptz default now()
);

-- Agent Assignments
create table public.agent_assignments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  department_id uuid references public.departments(id) on delete cascade not null,
  unique(user_id, department_id)
);

-- Tickets
create table public.tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_number text not null,
  department_id uuid references public.departments(id) on delete cascade not null,
  status public.ticket_status not null default 'waiting',
  created_at timestamptz default now() not null,
  served_by uuid references public.profiles(id),
  metadata jsonb default '{}'::jsonb
);

-- Indexes
create index idx_tickets_department_status on public.tickets(department_id, status);
create index idx_agent_assignments_user on public.agent_assignments(user_id);

-- ============================================================================
-- 2. SECURITY & PERMISSIONS (RLS)
-- ============================================================================
alter table public.faculties enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.agent_assignments enable row level security;
alter table public.tickets enable row level security;

-- Faculties & Departments (Public Read, Admin Write)
create policy "Public Read Faculties" on public.faculties for select using (true);
create policy "Admin Write Faculties" on public.faculties for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create policy "Public Read Departments" on public.departments for select using (true);
create policy "Admin Write Departments" on public.departments for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Profiles (Everyone see own, Admin see all)
create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Admins view all profiles" on public.profiles for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins modify profiles" on public.profiles for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Agent Assignments (Admin Manage, Agent View Own)
create policy "Agents view own assignments" on public.agent_assignments for select using (user_id = auth.uid());
create policy "Admins manage assignments" on public.agent_assignments for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Tickets (Public Create, Agents/Admin View & Update)
create policy "Public create tickets" on public.tickets for insert with check (true);
create policy "Public view serving" on public.tickets for select using (status = 'serving');
create policy "Agents view dept tickets" on public.tickets for select using (
  exists (select 1 from public.agent_assignments aa where aa.user_id = auth.uid() and aa.department_id = public.tickets.department_id)
  or
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Agents update dept tickets" on public.tickets for update using (
  exists (select 1 from public.agent_assignments aa where aa.user_id = auth.uid() and aa.department_id = public.tickets.department_id)
  or
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Enable Realtime
alter publication supabase_realtime add table public.tickets;

-- ============================================================================
-- 3. AUTOMATION (TRIGGERS & FUNCTIONS)
-- ============================================================================

-- Auto-create Profile when User signs up
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'agent');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Ensure profiles exist for existing users (Backfill)
insert into public.profiles (id, role)
select id, 'agent' from auth.users
on conflict (id) do nothing;

-- Function to Call Next Ticket
create or replace function public.call_next_ticket(p_department_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ticket_id uuid;
  v_result jsonb;
begin
  -- Check permission
  if not exists (
    select 1 from public.agent_assignments where user_id = auth.uid() and department_id = p_department_id
  ) and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'User not assigned to this department';
  end if;

  -- Lock and Update next ticket
  with next_ticket as (
    select id
    from public.tickets
    where department_id = p_department_id
      and status = 'waiting'
    order by created_at asc
    limit 1
    for update skip locked
  )
  update public.tickets
  set 
    status = 'serving',
    served_by = auth.uid(),
    metadata = jsonb_set(metadata, '{called_at}', to_jsonb(now()))
  from next_ticket
  where public.tickets.id = next_ticket.id
  returning to_jsonb(public.tickets.*) into v_result;

  return v_result;
end;
$$;

-- ============================================================================
-- 4. SEED DATA (INITIAL FACULTIES)
-- ============================================================================
insert into public.faculties (name, code) values
  ('Faculty of Engineering', 'SCITECH'),
  ('Faculty of Business', 'BUS'),
  ('Faculty of Arts', 'ART');

-- Insert Departments (we need the IDs from above, so we use subqueries)
insert into public.departments (faculty_id, name, prefix) values
  ((select id from public.faculties where code = 'SCITECH'), 'Computer Science', 'CS'),
  ((select id from public.faculties where code = 'SCITECH'), 'Mechanical Eng', 'ME'),
  ((select id from public.faculties where code = 'BUS'), 'Accounting', 'ACC'),
  ((select id from public.faculties where code = 'BUS'), 'Marketing', 'MKT');
