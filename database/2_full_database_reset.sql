-- 💥 2_full_database_reset.sql (UPDATED V2 - NO DEPARTMENTS)
-- WARNING: This will DELETE ALL DATA.

-- ============================================================================
-- 0. CLEANUP
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.call_next_ticket(uuid);
-- Drop old helper if exists
DROP FUNCTION IF EXISTS public.is_admin(); 

DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.agent_assignments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE; -- Gone
DROP TABLE IF EXISTS public.faculties CASCADE;

DROP TYPE IF EXISTS public.user_role;
DROP TYPE IF EXISTS public.ticket_status;

-- ============================================================================
-- 1. SCHEMA SETUP
-- ============================================================================
create extension if not exists "uuid-ossp";

-- Enums
create type public.user_role as enum ('admin', 'agent');
create type public.ticket_status as enum ('waiting', 'serving', 'completed', 'cancelled');

-- Faculties (Now includes Prefix)
create table public.faculties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique,
  prefix text not null -- Moved from Departments
);

-- Profiles
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role public.user_role not null default 'agent',
  is_active boolean default true,
  full_name text,
  created_at timestamptz default now()
);

-- Agent Assignments (Link Agent -> Faculty)
create table public.agent_assignments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  faculty_id uuid references public.faculties(id) on delete cascade not null,
  unique(user_id, faculty_id)
);

-- Tickets (Link Ticket -> Faculty)
create table public.tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_number text not null,
  faculty_id uuid references public.faculties(id) on delete cascade not null,
  status public.ticket_status not null default 'waiting',
  created_at timestamptz default now() not null,
  served_by uuid references public.profiles(id),
  metadata jsonb default '{}'::jsonb
);

-- Indexes
create index idx_tickets_faculty_status on public.tickets(faculty_id, status);
create index idx_agent_assignments_user on public.agent_assignments(user_id);

-- ============================================================================
-- 2. SECURITY & PERMISSIONS (RLS)
-- ============================================================================
alter table public.faculties enable row level security;
alter table public.profiles enable row level security;
alter table public.agent_assignments enable row level security;
alter table public.tickets enable row level security;

-- Safe Admin Check Function (Recursion Fix Built-in)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $$;

-- Faculties
create policy "Public Read Faculties" on public.faculties for select using (true);
create policy "Admin Write Faculties" on public.faculties for all using (public.is_admin());

-- Profiles
create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Admins view all profiles" on public.profiles for select using (public.is_admin());
create policy "Admins modify profiles" on public.profiles for update using (public.is_admin());

-- Agent Assignments
create policy "Agents view own assignments" on public.agent_assignments for select using (user_id = auth.uid());
create policy "Admins manage assignments" on public.agent_assignments for all using (public.is_admin());

-- Tickets
create policy "Public create tickets" on public.tickets for insert with check (true);
create policy "Public view serving" on public.tickets for select using (status = 'serving');
create policy "Agents view faculty tickets" on public.tickets for select using (
  exists (select 1 from public.agent_assignments aa where aa.user_id = auth.uid() and aa.faculty_id = public.tickets.faculty_id)
  or public.is_admin()
);
create policy "Agents update faculty tickets" on public.tickets for update using (
  exists (select 1 from public.agent_assignments aa where aa.user_id = auth.uid() and aa.faculty_id = public.tickets.faculty_id)
  or public.is_admin()
);

-- Enable Realtime
alter publication supabase_realtime add table public.tickets;

-- ============================================================================
-- 3. AUTOMATION (TRIGGERS & FUNCTIONS)
-- ============================================================================

-- Auto-create Profile
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

-- Backfill Profiles
insert into public.profiles (id, role)
select id, 'agent' from auth.users
on conflict (id) do nothing;

-- Function to Call Next Ticket (By Faculty ID now, not Dept ID)
create or replace function public.call_next_ticket(p_faculty_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  -- Check permission
  if not exists (
    select 1 from public.agent_assignments where user_id = auth.uid() and faculty_id = p_faculty_id
  ) and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'User not assigned to this faculty';
  end if;

  -- Lock and Update next ticket
  with next_ticket as (
    select id
    from public.tickets
    where faculty_id = p_faculty_id
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
-- 4. SEED DATA
-- ============================================================================
-- Using simplified prefixes directly on Faculties
insert into public.faculties (name, code, prefix) values
  ('Faculty of Engineering', 'SCITECH', 'ENG'),
  ('Faculty of Business', 'BUS', 'BUS'),
  ('Faculty of Arts', 'ART', 'ART'),
  ('Faculty of Medicine', 'MED', 'MED');
