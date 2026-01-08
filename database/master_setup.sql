-- MASTER SETUP SCRIPT for UQMS
-- Copy and paste this entire file into your Supabase SQL Editor to set up the database.

-- ============================================================================
-- 1. SCHEMA SETUP
-- ============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Faculties
create table if not exists public.faculties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique
);

-- Departments
create table if not exists public.departments (
  id uuid primary key default uuid_generate_v4(),
  faculty_id uuid references public.faculties(id) on delete cascade not null,
  name text not null,
  prefix text not null
);

-- Profiles (Extends Auth Users)
do $$ begin
    create type public.user_role as enum ('admin', 'agent');
exception
    when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role public.user_role not null default 'agent',
  is_active boolean default true,
  full_name text,
  created_at timestamptz default now()
);

-- Agent Assignments
create table if not exists public.agent_assignments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  department_id uuid references public.departments(id) on delete cascade not null,
  unique(user_id, department_id)
);

-- Tickets
do $$ begin
    create type public.ticket_status as enum ('waiting', 'serving', 'completed', 'cancelled');
exception
    when duplicate_object then null;
end $$;

create table if not exists public.tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_number text not null,
  department_id uuid references public.departments(id) on delete cascade not null,
  status public.ticket_status not null default 'waiting',
  created_at timestamptz default now() not null,
  served_by uuid references public.profiles(id),
  metadata jsonb default '{}'::jsonb
);

-- Indexes
create index if not exists idx_tickets_department_status on public.tickets(department_id, status);
create index if not exists idx_agent_assignments_user on public.agent_assignments(user_id);

-- RLS POLICIES
alter table public.faculties enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.agent_assignments enable row level security;
alter table public.tickets enable row level security;

-- (Policies - using "create policy if not exists" logic is complex in pure SQL, dropping to ensure clean state or ignoring errors)
-- For simplicity in a master script, we drop existing policies to re-create them ensures updates.
drop policy if exists "Admins have full control" on public.faculties;
create policy "Admins have full control" on public.faculties for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Public read faculties" on public.faculties;
create policy "Public read faculties" on public.faculties for select using (true);

drop policy if exists "Public read departments" on public.departments;
create policy "Public read departments" on public.departments for select using (true);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Agents view own assignments" on public.agent_assignments;
create policy "Agents view own assignments" on public.agent_assignments for select using (user_id = auth.uid());

drop policy if exists "Public can create tickets" on public.tickets;
create policy "Public can create tickets" on public.tickets for insert with check (true);

drop policy if exists "Agents view assigned dept tickets" on public.tickets;
create policy "Agents view assigned dept tickets" on public.tickets for select using (
  exists (
    select 1 from public.agent_assignments aa
    where aa.user_id = auth.uid()
    and aa.department_id = public.tickets.department_id
  )
  or
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Agents update assigned dept tickets" on public.tickets;
create policy "Agents update assigned dept tickets" on public.tickets for update using (
  exists (
    select 1 from public.agent_assignments aa
    where aa.user_id = auth.uid()
    and aa.department_id = public.tickets.department_id
  )
  or
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Public read serving tickets" on public.tickets;
create policy "Public read serving tickets" on public.tickets for select using (status = 'serving');


-- ============================================================================
-- 2. RPC FUNCTIONS
-- ============================================================================

create or replace function public.call_next_ticket(p_department_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ticket_id uuid;
  v_result jsonb;
begin
  if not exists (
    select 1 from public.agent_assignments 
    where user_id = auth.uid() and department_id = p_department_id
  ) and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'User not assigned to this department';
  end if;

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

exception when others then
  raise;
end;
$$;


-- ============================================================================
-- 3. SEED DATA
-- ============================================================================

-- Insert Faculties (upsert to avoid duplicates)
insert into public.faculties (id, name, code) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Faculty of Engineering', 'ENG'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Faculty of Business', 'BUS'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Faculty of Arts', 'ART')
on conflict (id) donothing;

-- Insert Departments
insert into public.departments (faculty_id, name, prefix) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Computer Science', 'CS'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mechanical Eng', 'ME'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Accounting', 'ACC'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Marketing', 'MKT')
on conflict do nothing; 
-- (Note: Departments didn't have specific IDs in original seed, so conflict check is weak unless name/faculty is unique. 
-- For this master script, just letting it run is fine for clean DBs).
