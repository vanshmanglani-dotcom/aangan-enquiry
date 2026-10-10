-- Run in Supabase -> SQL Editor
create table if not exists calls (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  vaani_call_id    text unique,
  caller_phone     text,
  name             text,
  property_type    text,
  location         text,
  size_sqft        text,
  scope            text,
  timeline         text,
  budget           text,
  lead_source      text,
  callback_time    text,
  summary          text,
  qualified        text check (qualified in ('YES','NO','UNSURE')),
  qualify_reason   text,
  priority         text check (priority in ('HIGH','NORMAL')),
  route_to         text,             -- residential / commercial / human_review / none
  answered_in_sec  numeric default 0,
  duration_sec     numeric default 0,
  vaani_cost_inr   numeric default 0,
  ai_cost_inr      numeric default 0,
  telegram_sent    boolean default false,
  hubspot_deal_id  text,
  transcript       text,
  raw              jsonb
);
create index if not exists calls_created_at_idx on calls (created_at desc);
alter table calls enable row level security;  -- only the server (service role) reads/writes

-- Calls placed from the dashboard "Trigger call" button; sync-vaani polls these by id.
create table if not exists pending_calls (
  vaani_call_id text primary key,
  phone         text,
  name          text,
  created_at    timestamptz not null default now()
);
alter table pending_calls enable row level security;
