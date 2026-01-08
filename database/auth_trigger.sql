-- Trigger to create profile on signup
-- Run this in Supabase SQL Editor to ensure new users appear in the Admin Panel

create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'agent');
  return new;
end;
$$ language plpgsql security definer;

-- Drop check to avoid duplicate trigger error if re-run
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Ensure profiles exist for current users (backfill)
insert into public.profiles (id, role)
select id, 'agent' from auth.users
on conflict (id) do nothing;
