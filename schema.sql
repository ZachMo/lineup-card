-- Lineup Card: tables and access rules.
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- Running it a second time is safe.

create extension if not exists pgcrypto;

-- One row per team. The roster and the current game live in JSON, which matches
-- the shape the page already keeps in the browser.
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default 'My team',
  players    jsonb not null default '[]'::jsonb,
  settings   jsonb not null default '{}'::jsonb,
  lineup     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teams_owner_idx on public.teams (owner, updated_at desc);

-- Saved games, one row per printed card. The page writes these in a later step.
-- The table is here so you only ever run one migration.
create table if not exists public.lineups (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  game_date  date,
  opponent   text,
  innings    int not null default 6,
  grid       jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lineups_team_idx on public.lineups (team_id, game_date desc);

-- Row level security is the whole protection. Without these two lines, the anon
-- key in the page would read every coach's roster.
alter table public.teams   enable row level security;
alter table public.lineups enable row level security;

-- A coach reads and writes only their own rows. `using` covers reads, updates and
-- deletes. `with check` stops anyone writing a row owned by someone else.
drop policy if exists "teams are private" on public.teams;
create policy "teams are private" on public.teams
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "lineups are private" on public.lineups;
create policy "lineups are private" on public.lineups
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());
