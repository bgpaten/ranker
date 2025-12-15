-- Table: app_config
create table public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default now()
);

-- Initial State
insert into public.app_config (key, value) values ('status', 'ongoing');

-- Realtime
alter publication supabase_realtime add table app_config;
