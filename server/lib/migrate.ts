import { Client } from 'pg'

const SCHEMA_SQL = `
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  disciplines text[] not null default '{}',
  training_phase text not null default 'build',
  preferences jsonb not null default '{}',
  injury_notes text,
  coach_notes_freetext text,
  preferred_training_days jsonb,
  training_style text not null default 'moderate',
  ftp integer,
  swim_pool_or_open text default 'pool',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  discipline text,
  event_type text,
  target_date date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  goal_id uuid references goals(id),
  start_date date not null,
  end_date date not null,
  total_weeks integer not null default 12,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references training_plans(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  week_number integer not null,
  day_of_week integer not null,
  scheduled_date date not null,
  discipline text not null,
  session_type text not null,
  title text not null,
  description text,
  duration_minutes integer,
  distance_km numeric,
  target_pace text,
  target_power text,
  effort_zone text,
  session_structure jsonb,
  coaching_rationale text,
  status text not null default 'planned',
  original_data jsonb,
  modification_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  user_id uuid not null references users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  actual_distance_km numeric,
  actual_duration_minutes integer,
  actual_pace text,
  actual_power_watts integer,
  rpe integer check (rpe >= 1 and rpe <= 10),
  user_note text,
  coach_response text,
  source text not null default 'manual',
  external_id text,
  average_hr integer,
  average_pace_per_km text,
  average_power_watts integer,
  hrv numeric,
  sleep_score numeric,
  raw_data jsonb,
  injury_flag boolean not null default false,
  conditions_notes text,
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid references sessions(id),
  checkin_date date not null,
  feeling integer check (feeling >= 1 and feeling <= 5),
  soreness_notes text,
  coach_response text,
  plan_adjusted boolean not null default false,
  adjustment_details text,
  created_at timestamptz not null default now()
);

create table if not exists coach_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plan_id uuid references training_plans(id),
  week_number integer not null,
  week_start date not null,
  week_end date not null,
  metric_pills jsonb,
  headline text,
  swim_observations text,
  ride_observations text,
  run_observations text,
  recovery_assessment text,
  looking_ahead text,
  closing_prompt text,
  user_reply text,
  user_reply_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_number)
);

-- strava_connections table commented out — Strava integration removed, add back when re-integrating
-- create table if not exists strava_connections (
--   id             uuid primary key default gen_random_uuid(),
--   user_id        uuid not null references users(id) on delete cascade,
--   athlete_id     bigint not null,
--   athlete_name   text,
--   athlete_photo_url text,
--   access_token   text not null,
--   refresh_token  text not null,
--   expires_at     timestamptz not null,
--   scope          text,
--   created_at     timestamptz not null default now(),
--   updated_at     timestamptz not null default now(),
--   unique (user_id),
--   unique (athlete_id)
-- );

create unique index if not exists workout_logs_external_id_idx
  on workout_logs (user_id, external_id)
  where external_id is not null;

alter table users               disable row level security;
alter table goals               disable row level security;
alter table training_plans      disable row level security;
alter table sessions            disable row level security;
alter table workout_logs        disable row level security;
alter table checkins            disable row level security;
alter table coach_notes         disable row level security;
-- alter table strava_connections  disable row level security;

grant all on all tables in schema public to anon;
grant all on all sequences in schema public to anon;
grant all on all routines in schema public to anon;
`

export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('[migrate] DATABASE_URL not set — skipping auto-migration')
    return
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query(SCHEMA_SQL)
    console.log('[migrate] ✓ Schema applied successfully')
  } catch (err: any) {
    console.error('[migrate] ✗ Migration failed:', err.message)
  } finally {
    await client.end()
  }
}
