-- Run once in a dedicated Supabase project, then provision the owner separately.
begin;
create table public.cockpit_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.cockpit_owners enable row level security;
revoke all on public.cockpit_owners from anon, authenticated;
grant select on public.cockpit_owners to authenticated;
create policy owner_identity on public.cockpit_owners for select to authenticated
  using (user_id = (select auth.uid()));

create table public.cockpit_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and data ?& array['projects','tasks','days']
    and jsonb_typeof(data->'projects') = 'array'
    and jsonb_typeof(data->'tasks') = 'array'
    and jsonb_typeof(data->'days') = 'object'
    and octet_length(data::text) <= 1000000
  ),
  revision integer not null default 1 check (revision > 0)
);
alter table public.cockpit_workspaces enable row level security;
revoke all on public.cockpit_workspaces from anon, authenticated;
grant select on public.cockpit_workspaces to authenticated;
create policy workspace_owner on public.cockpit_workspaces for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.cockpit_owners where user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.cockpit_owners where user_id = (select auth.uid())));

create function public.save_cockpit_workspace(p_data jsonb, p_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare new_revision integer;
begin
  if auth.uid() is null or not exists (select 1 from public.cockpit_owners where user_id = auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_revision is null or p_revision < 0 or p_revision >= 2147483647 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  if p_revision = 0 then
    insert into public.cockpit_workspaces (user_id, data, revision)
    values (auth.uid(), p_data, 1)
    on conflict (user_id) do nothing returning revision into new_revision;
  else
    update public.cockpit_workspaces set data = p_data, revision = revision + 1
    where user_id = auth.uid() and revision = p_revision
    returning revision into new_revision;
  end if;
  return new_revision;
end; $$;
revoke all on function public.save_cockpit_workspace(jsonb,integer) from public, anon;
grant execute on function public.save_cockpit_workspace(jsonb,integer) to authenticated;

create schema if not exists cockpit_private;
revoke all on schema cockpit_private from public, anon, authenticated;
create table cockpit_private.request_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  hits integer not null
);
-- Definer functions verify the authenticated owner and use qualified table names.
create function public.consume_cockpit_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare hit_count integer; current_window timestamptz := date_trunc('minute', clock_timestamp());
begin
  if auth.uid() is null or not exists (select 1 from public.cockpit_owners where user_id = auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into cockpit_private.request_limits(user_id, window_start, hits)
  values (auth.uid(), current_window, 1)
  on conflict(user_id) do update set window_start = excluded.window_start,
    hits = case when request_limits.window_start = excluded.window_start then least(request_limits.hits + 1, 121) else 1 end
  returning hits into hit_count;
  return hit_count <= 120;
end; $$;
revoke all on function public.consume_cockpit_request() from public, anon;
grant execute on function public.consume_cockpit_request() to authenticated;
commit;
