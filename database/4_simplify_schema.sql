-- 4_simplify_schema.sql
-- Run this to switch to the "No Departments" schema.

-- WIPE old tables
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.agent_assignments CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.faculties CASCADE;

-- Re-create FACULTIES with Prefix
create table public.faculties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique,
  prefix text not null
);

-- Re-create TICKETS with Faculty ID
create table public.tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_number text not null,
  faculty_id uuid references public.faculties(id) on delete cascade not null,
  status public.ticket_status not null default 'waiting',
  created_at timestamptz default now() not null,
  served_by uuid references public.profiles(id),
  metadata jsonb default '{}'::jsonb
);

-- Re-create ASSIGNMENTS with Faculty ID
create table public.agent_assignments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  faculty_id uuid references public.faculties(id) on delete cascade not null,
  unique(user_id, faculty_id)
);

-- Enable RLS
alter table public.faculties enable row level security;
alter table public.tickets enable row level security;
alter table public.agent_assignments enable row level security;

-- Policies (Using safe is_admin function)
create policy "Public Read Faculties" on public.faculties for select using (true);
create policy "Admin Write Faculties" on public.faculties for all using (public.is_admin());

create policy "Agents view own assignments" on public.agent_assignments for select using (user_id = auth.uid());
create policy "Admins manage assignments" on public.agent_assignments for all using (public.is_admin());

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

-- Update RPC Function
DROP FUNCTION IF EXISTS public.call_next_ticket(uuid);
create or replace function public.call_next_ticket(p_faculty_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from public.agent_assignments where user_id = auth.uid() and faculty_id = p_faculty_id
  ) and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'User not assigned to this faculty';
  end if;

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

-- Seed Data
insert into public.faculties (name, code, prefix) values
  ('Faculty of Engineering', 'SCITECH', 'ENG'),
  ('Faculty of Business', 'BUS', 'BUS'),
  ('Faculty of Arts', 'ART', 'ART');

-- Re-enable Realtime
alter publication supabase_realtime add table public.tickets;
