-- 1) Create app_settings table and set DEFAULT_ORG_ID
create table if not exists public.app_settings(
  key text primary key,
  value text not null
);

insert into public.app_settings(key,value)
values ('DEFAULT_ORG_ID','e7b6515e-df1e-4cbf-a909-cfde5c5423d5')
on conflict (key) do nothing;

-- 2) Create ensure_default_membership function
create or replace function public.ensure_default_membership(p_user uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := (select value::uuid from public.app_settings where key='DEFAULT_ORG_ID');
begin
  if v_org is null then
    raise exception 'DEFAULT_ORG_ID not configured';
  end if;

  if not exists (
    select 1 from public.organization_members where org_id=v_org and user_id=p_user
  ) then
    insert into public.organization_members(org_id, user_id, role, status, joined_at)
    values (v_org, p_user, 'worker', 'active', now());
  end if;
end;
$$;

-- 3) Create profile creation function for new users
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, created_at)
  values (NEW.id, coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email), now())
  on conflict (id) do nothing;

  perform public.ensure_default_membership(NEW.id);
  return NEW;
end;
$$;

-- 4) Create trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

-- 5) Backfill existing users (safe to re-run)
insert into public.profiles (id, full_name, created_at)
select u.id, u.email, now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

select public.ensure_default_membership(u.id)
from auth.users u
left join public.organization_members m
  on m.user_id = u.id
  and m.org_id = (select value::uuid from public.app_settings where key='DEFAULT_ORG_ID')
where m.user_id is null;

-- 6) Create view for user organizations
create or replace view public.my_organizations as
select o.*
from public.organizations o
where exists (
  select 1 from public.organization_members m
  where m.org_id = o.id and m.user_id = auth.uid() and m.status='active'
);

-- 7) Set up RLS policies for organizations
alter table public.organizations enable row level security;
drop policy if exists orgs_read_mine on public.organizations;
create policy orgs_read_mine
on public.organizations for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.org_id = organizations.id
    and m.user_id = auth.uid()
    and m.status='active'
));

-- 8) Set up RLS policies for organization_members
alter table public.organization_members enable row level security;
drop policy if exists members_read_self on public.organization_members;
create policy members_read_self
on public.organization_members for select to authenticated
using (user_id = auth.uid());

-- 9) Create backward compatibility function (for existing useUserSetup hook)
create or replace function public.create_user_profile(user_id uuid, user_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, created_at)
  values (user_id, user_email, now())
  on conflict (id) do nothing;

  perform public.ensure_default_membership(user_id);
end;
$$;