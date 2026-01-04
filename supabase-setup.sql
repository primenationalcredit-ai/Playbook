-- ASAP Playbook Database Setup
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table
create table public.users (
  id uuid default uuid_generate_v4() primary key,
  auth_id uuid references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  department text not null,
  role text default 'user' check (role in ('user', 'admin')),
  avatar text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Task templates (the master list of tasks)
create table public.task_templates (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  time_slot text not null check (time_slot in ('morning', 'am_timed', 'afternoon', 'pm_timed', 'eod', 'evening')),
  specific_time time,
  assigned_to text not null, -- 'everyone', department name, or user id
  link text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Task completions (tracks who completed what each day)
create table public.task_completions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  task_id uuid not null, -- can be task_template id or personal_task id
  completion_date date not null,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, task_id, completion_date)
);

-- Personal tasks (tasks users create for themselves)
create table public.personal_tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  time_slot text not null check (time_slot in ('morning', 'am_timed', 'afternoon', 'pm_timed', 'eod', 'evening')),
  specific_time time,
  link text,
  is_recurring boolean default false,
  created_date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Updates/Announcements
create table public.updates (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  content text not null,
  priority text default 'normal' check (priority in ('normal', 'medium', 'high')),
  assigned_to text[] not null, -- array of department names or 'everyone'
  created_by uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Update acknowledgements
create table public.update_acknowledgements (
  id uuid default uuid_generate_v4() primary key,
  update_id uuid references public.updates(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  acknowledged_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(update_id, user_id)
);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_completions enable row level security;
alter table public.personal_tasks enable row level security;
alter table public.updates enable row level security;
alter table public.update_acknowledgements enable row level security;

-- Policies for users table
create policy "Users can view all users" on public.users for select using (true);
create policy "Admins can insert users" on public.users for insert with check (true);
create policy "Admins can update users" on public.users for update using (true);
create policy "Admins can delete users" on public.users for delete using (true);

-- Policies for task_templates
create policy "Anyone can view task templates" on public.task_templates for select using (true);
create policy "Admins can manage task templates" on public.task_templates for all using (true);

-- Policies for task_completions
create policy "Users can view all completions" on public.task_completions for select using (true);
create policy "Users can insert own completions" on public.task_completions for insert with check (true);
create policy "Users can delete own completions" on public.task_completions for delete using (true);

-- Policies for personal_tasks
create policy "Users can view own personal tasks" on public.personal_tasks for select using (true);
create policy "Users can manage own personal tasks" on public.personal_tasks for all using (true);

-- Policies for updates
create policy "Anyone can view updates" on public.updates for select using (true);
create policy "Admins can manage updates" on public.updates for all using (true);

-- Policies for update_acknowledgements
create policy "Anyone can view acknowledgements" on public.update_acknowledgements for select using (true);
create policy "Users can acknowledge updates" on public.update_acknowledgements for insert with check (true);

-- Create indexes for better performance
create index idx_task_completions_date on public.task_completions(completion_date);
create index idx_task_completions_user on public.task_completions(user_id);
create index idx_personal_tasks_user on public.personal_tasks(user_id);
create index idx_users_email on public.users(email);
create index idx_users_auth_id on public.users(auth_id);

-- Insert initial admin users (Joe and Astrid)
-- Note: You'll need to create auth accounts for these users first via Supabase Auth
-- Then update the auth_id values

-- Insert sample task templates
insert into public.task_templates (title, time_slot, assigned_to) values
  ('Clock In', 'morning', 'everyone'),
  ('Computers around you working?', 'morning', 'everyone'),
  ('Goal Sheet completed / Daily Todos Filled out', 'morning', 'everyone'),
  ('Personal Focal Point - What is ONE thing you want to accomplish today?', 'morning', 'everyone'),
  ('Clear Desk of Clutter', 'morning', 'everyone'),
  ('Check Email Spam Box (includes Team Email)', 'morning', 'everyone'),
  ('Post on Facebook #1', 'morning', 'everyone');

insert into public.task_templates (title, time_slot, specific_time, assigned_to) values
  ('Check Missed Calls', 'am_timed', '09:00', 'everyone'),
  ('Clear Glip Tasks #1', 'am_timed', '09:30', 'everyone'),
  ('Check Voicemails', 'am_timed', '10:00', 'everyone'),
  ('Check Consultations / Notes #1', 'am_timed', '10:30', 'credit_consultants'),
  ('Clear Personal RC', 'am_timed', '11:00', 'everyone'),
  ('Clear Personal Email', 'am_timed', '11:30', 'everyone');

insert into public.task_templates (title, time_slot, assigned_to) values
  ('Clear Glip Tasks #2', 'afternoon', 'everyone'),
  ('Check Missed Calls #2', 'afternoon', 'everyone'),
  ('Post on Facebook #2', 'afternoon', 'everyone');

insert into public.task_templates (title, time_slot, specific_time, assigned_to, link) values
  ('1 Week Follow-up Filter', 'pm_timed', '13:00', 'credit_consultants', 'https://asapcreditrepair.pipedrive.com/'),
  ('2 Week Follow-up Filter', 'pm_timed', '14:00', 'credit_consultants', 'https://asapcreditrepair.pipedrive.com/'),
  ('CRS Results Calls', 'pm_timed', '15:00', 'account_managers', 'https://asapcreditrepair.pipedrive.com/'),
  ('Logins Not Ready Follow-up', 'pm_timed', '15:30', 'account_managers', 'https://asapcreditrepair.pipedrive.com/');

insert into public.task_templates (title, time_slot, assigned_to) values
  ('Clear Glip Tasks #3', 'eod', 'everyone'),
  ('Make sure ALL Sold and CRS is Complete', 'eod', 'credit_consultants'),
  ('Goal Sheet for Next Working Day', 'eod', 'everyone');

insert into public.task_templates (title, time_slot, specific_time, assigned_to) values
  ('Final Email Check', 'evening', '17:00', 'everyone'),
  ('Clock Out', 'evening', '19:00', 'everyone');
