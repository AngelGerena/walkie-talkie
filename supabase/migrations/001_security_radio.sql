-- Security Detail Radio: foundation migration
-- Run once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  church_name text not null,
  team_name text not null default 'Security Detail',
  code text not null unique check (code ~ '^[A-Z0-9-]{4,16}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  callsign text not null check (char_length(callsign) between 1 and 24),
  role text not null default 'member' check (role in ('lead', 'member')),
  post text,
  language text not null default 'en' check (language in ('en', 'es')),
  theme text not null default 'woodland' check (theme in ('woodland', 'desert', 'urban')),
  push_enabled boolean not null default false,
  invite_hash text,
  invite_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists members_team_callsign_idx on public.members (team_id, lower(callsign));

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name_en text not null,
  name_es text not null,
  sort int not null default 0,
  leads_only boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists channels_team_idx on public.channels (team_id, sort);

create table if not exists public.transmissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  callsign text not null,
  started_at timestamptz not null default now(),
  duration_ms int not null default 0,
  audio_path text,
  mime_type text,
  transcript text,
  transcript_lang text check (transcript_lang in ('en', 'es')),
  translation text,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed', 'skipped'))
);
create index if not exists transmissions_team_time_idx on public.transmissions (team_id, started_at desc);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  callsign text not null,
  kind text not null check (kind in ('medical', 'suspicious', 'lost_child', 'disturbance', 'fire', 'other', 'broadcast')),
  post text,
  message text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.members(id) on delete set null
);
create index if not exists alerts_team_time_idx on public.alerts (team_id, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- Helpers (SECURITY DEFINER so policies never recurse) ----------

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid() limit 1
$$;

create or replace function public.my_team_id() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from public.members where user_id = auth.uid() limit 1
$$;

create or replace function public.is_lead() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'lead')
$$;

create or replace function public.can_hear(ch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.channels c
    where c.id = ch
      and c.team_id = public.my_team_id()
      and (not c.leads_only or public.is_lead())
  )
$$;

-- ---------- Row level security ----------

alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.channels enable row level security;
alter table public.transmissions enable row level security;
alter table public.alerts enable row level security;
alter table public.push_subscriptions enable row level security;

-- teams
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated
  using (id = public.my_team_id());
drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams for update to authenticated
  using (id = public.my_team_id() and public.is_lead())
  with check (id = public.my_team_id());
revoke update on public.teams from authenticated;
grant update (church_name, team_name) on public.teams to authenticated;

-- members: activation codes are never readable from the browser
revoke select, insert, update, delete on public.members from anon, authenticated;
grant select (id, team_id, user_id, callsign, role, post, language, theme, push_enabled, invite_expires_at, created_at)
  on public.members to authenticated;
grant update (post, language, theme, push_enabled) on public.members to authenticated;

drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (team_id = public.my_team_id());
drop policy if exists members_update on public.members;
create policy members_update on public.members for update to authenticated
  using (team_id = public.my_team_id() and (user_id = auth.uid() or public.is_lead()))
  with check (team_id = public.my_team_id());

-- channels
drop policy if exists channels_select on public.channels;
create policy channels_select on public.channels for select to authenticated
  using (team_id = public.my_team_id() and (not leads_only or public.is_lead()));
drop policy if exists channels_insert on public.channels;
create policy channels_insert on public.channels for insert to authenticated
  with check (team_id = public.my_team_id() and public.is_lead());
drop policy if exists channels_update on public.channels;
create policy channels_update on public.channels for update to authenticated
  using (team_id = public.my_team_id() and public.is_lead())
  with check (team_id = public.my_team_id());
drop policy if exists channels_delete on public.channels;
create policy channels_delete on public.channels for delete to authenticated
  using (team_id = public.my_team_id() and public.is_lead());

-- transmissions
drop policy if exists transmissions_select on public.transmissions;
create policy transmissions_select on public.transmissions for select to authenticated
  using (team_id = public.my_team_id() and public.can_hear(channel_id));
drop policy if exists transmissions_insert on public.transmissions;
create policy transmissions_insert on public.transmissions for insert to authenticated
  with check (team_id = public.my_team_id() and member_id = public.my_member_id() and public.can_hear(channel_id));

-- alerts
drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts for select to authenticated
  using (team_id = public.my_team_id());
drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts for insert to authenticated
  with check (
    team_id = public.my_team_id()
    and member_id = public.my_member_id()
    and (kind <> 'broadcast' or public.is_lead())
  );
drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts for update to authenticated
  using (team_id = public.my_team_id() and public.is_lead())
  with check (team_id = public.my_team_id());

-- push subscriptions: each person manages only their own
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id() and team_id = public.my_team_id());

-- ---------- Storage: recorded transmissions ----------

insert into storage.buckets (id, name, public)
values ('transmissions', 'transmissions', false)
on conflict (id) do nothing;

drop policy if exists transmissions_audio_read on storage.objects;
create policy transmissions_audio_read on storage.objects for select to authenticated
  using (
    bucket_id = 'transmissions'
    and (storage.foldername(name))[1] = public.my_team_id()::text
    and public.can_hear(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists transmissions_audio_write on storage.objects;
create policy transmissions_audio_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'transmissions'
    and (storage.foldername(name))[1] = public.my_team_id()::text
    and public.can_hear(((storage.foldername(name))[2])::uuid)
  );

-- ---------- Realtime ----------

do $$
begin
  begin
    alter publication supabase_realtime add table public.transmissions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.alerts;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
