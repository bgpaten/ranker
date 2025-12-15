-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: teams
create table public.teams (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamp with time zone default now()
);

-- Table: aspects
create table public.aspects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  order_index int default 0,
  created_at timestamp with time zone default now()
);

-- Table: criteria
create table public.criteria (
  id uuid primary key default uuid_generate_v4(),
  aspect_id uuid references public.aspects(id) on delete cascade not null,
  name text not null,
  max_score int not null,
  order_index int default 0,
  created_at timestamp with time zone default now()
);

-- Table: scores
create table public.scores (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references public.teams(id) on delete cascade not null,
  criteria_id uuid references public.criteria(id) on delete cascade not null,
  judge_id text default 'default',
  score int not null check (score >= 0),
  updated_at timestamp with time zone default now(),
  constraint scores_team_criteria_judge_unique unique (team_id, criteria_id, judge_id)
);

-- Function to handle updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for scores
create trigger scores_updated_at
before update on scores
for each row
execute procedure handle_updated_at();

-- Allow Realtime
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table aspects;
alter publication supabase_realtime add table criteria;
