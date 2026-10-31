-- Supabase schema for the CIT Campus Scheduling & Venue Management app.
-- Apply once in the Supabase SQL Editor. Dataset and schedule payload columns
-- preserve the original JSON while the related tables support relational queries.

create table public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  institute_id uuid references public.institutes (id) on delete set null,
  email text not null,
  full_name text not null,
  role text not null default 'faculty'
    check (role in ('admin', 'department_coordinator', 'faculty', 'club')),
  department text,
  faculty_id text,
  badge text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_institute_role_idx on public.profiles (institute_id, role);

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  source_dataset_id text not null,
  institute_name text not null,
  is_active boolean not null default false,
  calendar jsonb not null default '{}'::jsonb,
  priority_order text[] not null default '{}',
  role_category_cap jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index datasets_one_active_per_institute_idx
  on public.datasets (institute_id) where is_active;
create index datasets_institute_created_idx
  on public.datasets (institute_id, created_at desc);

create table public.rooms (
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  id text not null,
  name text not null,
  building text not null,
  type text not null,
  capacity integer not null check (capacity >= 0),
  features text[] not null default '{}',
  accessible boolean not null default false,
  allowed_uses text[] not null default '{}',
  primary key (dataset_id, id)
);

create table public.room_unavailability (
  id bigint generated always as identity primary key,
  dataset_id uuid not null,
  room_id text not null,
  day text not null check (day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  periods integer[] not null default '{}',
  reason text not null default '',
  foreign key (dataset_id, room_id)
    references public.rooms (dataset_id, id) on delete cascade
);

create table public.faculty (
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  id text not null,
  name text not null,
  department text not null,
  max_hours_per_day integer not null check (max_hours_per_day >= 0),
  needs_accessible boolean not null default false,
  preferences jsonb not null default '[]'::jsonb,
  primary key (dataset_id, id)
);

create table public.faculty_unavailability (
  id bigint generated always as identity primary key,
  dataset_id uuid not null,
  faculty_id text not null,
  day text not null check (day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  periods integer[] not null default '{}',
  reason text not null default '',
  foreign key (dataset_id, faculty_id)
    references public.faculty (dataset_id, id) on delete cascade
);

create table public.student_groups (
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  id text not null,
  name text not null,
  year integer not null check (year > 0),
  department text not null,
  size integer not null check (size >= 0),
  needs_accessible boolean not null default false,
  primary key (dataset_id, id)
);

create table public.courses (
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  id text not null,
  title text not null,
  department text not null,
  year integer not null check (year > 0),
  lecture_hours integer not null default 0 check (lecture_hours >= 0),
  tutorial_hours integer not null default 0 check (tutorial_hours >= 0),
  lab_blocks integer not null default 0 check (lab_blocks >= 0),
  primary key (dataset_id, id)
);

create table public.sessions (
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  id text not null,
  course_id text not null,
  kind text not null check (kind in ('lecture', 'tutorial', 'lab')),
  faculty_id text not null,
  size integer not null check (size >= 0),
  duration integer not null check (duration > 0),
  room_types text[] not null default '{}',
  needs_accessible boolean not null default false,
  basket_slot text,
  fixed_day text check (fixed_day is null or fixed_day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  fixed_start_period integer check (fixed_start_period is null or fixed_start_period > 0),
  primary key (dataset_id, id),
  foreign key (dataset_id, course_id)
    references public.courses (dataset_id, id) on delete cascade,
  foreign key (dataset_id, faculty_id)
    references public.faculty (dataset_id, id) on delete restrict,
  check ((fixed_day is null) = (fixed_start_period is null))
);

create table public.session_groups (
  dataset_id uuid not null,
  session_id text not null,
  group_id text not null,
  primary key (dataset_id, session_id, group_id),
  foreign key (dataset_id, session_id)
    references public.sessions (dataset_id, id) on delete cascade,
  foreign key (dataset_id, group_id)
    references public.student_groups (dataset_id, id) on delete cascade
);

create table public.exams (
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  id text not null,
  size integer not null check (size >= 0),
  duration_hours integer not null check (duration_hours > 0),
  primary key (dataset_id, id)
);

create table public.exam_courses (
  dataset_id uuid not null,
  exam_id text not null,
  course_id text not null,
  primary key (dataset_id, exam_id, course_id),
  foreign key (dataset_id, exam_id)
    references public.exams (dataset_id, id) on delete cascade,
  foreign key (dataset_id, course_id)
    references public.courses (dataset_id, id) on delete cascade
);

create table public.exam_groups (
  dataset_id uuid not null,
  exam_id text not null,
  group_id text not null,
  primary key (dataset_id, exam_id, group_id),
  foreign key (dataset_id, exam_id)
    references public.exams (dataset_id, id) on delete cascade,
  foreign key (dataset_id, group_id)
    references public.student_groups (dataset_id, id) on delete cascade
);

create table public.booking_requests (
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  id text not null,
  requester_user_id uuid references public.profiles (user_id) on delete set null,
  requester_name text not null,
  requester_role text not null
    check (requester_role in ('admin', 'department_coordinator', 'faculty', 'club')),
  department text,
  requested_category text not null,
  title text not null,
  attendance integer not null check (attendance >= 0),
  duration_periods integer not null check (duration_periods > 0),
  room_types text[] not null default '{}',
  needs text[] not null default '{}',
  requested_room text,
  mandatory_for_groups text[] not null default '{}',
  series_id text,
  raw_text text,
  submitted_at timestamptz not null default now(),
  primary key (dataset_id, id),
  foreign key (dataset_id, requested_room)
    references public.rooms (dataset_id, id) on delete set null (requested_room)
);

create index booking_requests_submitter_idx
  on public.booking_requests (dataset_id, requester_user_id, submitted_at desc);
create index booking_requests_category_idx
  on public.booking_requests (dataset_id, requested_category, submitted_at);

create table public.booking_windows (
  id bigint generated always as identity primary key,
  dataset_id uuid not null,
  request_id text not null,
  day text not null check (day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  from_period integer not null check (from_period > 0),
  to_period integer not null check (to_period >= from_period),
  foreign key (dataset_id, request_id)
    references public.booking_requests (dataset_id, id) on delete cascade
);

create table public.cancellations (
  id bigint generated always as identity primary key,
  dataset_id uuid not null,
  request_id text not null,
  cancelled_by uuid references public.profiles (user_id) on delete set null,
  cancelled_by_name text not null,
  cancelled_at timestamptz not null default now(),
  note text not null default '',
  foreign key (dataset_id, request_id)
    references public.booking_requests (dataset_id, id) on delete cascade
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  status text not null default 'archived'
    check (status in ('active', 'proposed', 'archived')),
  source_kind text not null check (source_kind in ('baseline', 'disruption')),
  team text not null default '',
  payload jsonb not null default '{}'::jsonb,
  validator_report jsonb,
  generated_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index schedules_one_active_per_dataset_idx
  on public.schedules (dataset_id) where status = 'active';
create unique index schedules_one_proposal_per_dataset_idx
  on public.schedules (dataset_id) where status = 'proposed';
create index schedules_dataset_created_idx
  on public.schedules (dataset_id, created_at desc);

create table public.scheduled_sessions (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  session_id text not null,
  day text not null check (day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  start_period integer not null check (start_period > 0),
  room_id text not null,
  primary key (schedule_id, session_id)
);

create table public.schedule_bookings (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  request_id text not null,
  status text not null check (status in ('approved', 'rejected', 'alternative_offered')),
  day text check (day is null or day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  start_period integer check (start_period is null or start_period > 0),
  end_period integer check (
    end_period is null or (start_period is not null and end_period >= start_period)
  ),
  room_id text,
  reason text not null default '',
  decided_by uuid references public.profiles (user_id) on delete set null,
  primary key (schedule_id, request_id)
);

create table public.session_overrides (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  session_id text not null,
  day text not null check (day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  start_period integer not null check (start_period > 0),
  room_id text not null,
  displaced_by text not null,
  primary key (schedule_id, session_id)
);

create table public.scheduled_exams (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  exam_id text not null,
  day text not null check (day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  exam_session text not null check (exam_session in ('AM', 'PM')),
  primary key (schedule_id, exam_id)
);

create table public.scheduled_exam_rooms (
  schedule_id uuid not null,
  exam_id text not null,
  room_id text not null,
  primary key (schedule_id, exam_id, room_id),
  foreign key (schedule_id, exam_id)
    references public.scheduled_exams (schedule_id, exam_id) on delete cascade
);

create table public.disruptions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  proposed_schedule_id uuid references public.schedules (id) on delete set null,
  source_disruption_id text,
  description text not null default '',
  changes jsonb not null default '[]'::jsonb,
  diff jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references public.profiles (user_id) on delete set null,
  reviewed_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index disruptions_one_pending_per_dataset_idx
  on public.disruptions (dataset_id) where status = 'pending';

create table public.audit_logs (
  id bigint generated always as identity primary key,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  actor_user_id uuid references public.profiles (user_id) on delete set null,
  actor_name text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_institute_created_idx
  on public.audit_logs (institute_id, created_at desc);

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email, 'New user')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.user_id = (select auth.uid())
$$;

create function public.can_view_dataset(target_dataset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.datasets d
    join public.profiles p on p.institute_id = d.institute_id
    where d.id = target_dataset_id
      and p.user_id = (select auth.uid())
      and (d.is_active or p.role = 'admin')
  )
$$;

create function public.can_manage_dataset(target_dataset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.datasets d
    join public.profiles p on p.institute_id = d.institute_id
    where d.id = target_dataset_id
      and p.user_id = (select auth.uid())
      and p.role = 'admin'
  )
$$;

create function public.can_manage_institute(target_institute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.institute_id = target_institute_id
      and p.user_id = (select auth.uid())
      and p.role = 'admin'
  )
$$;

create function public.can_decide_booking(target_schedule_id uuid, target_request_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedules s
    join public.profiles p on p.institute_id = (
      select d.institute_id from public.datasets d where d.id = s.dataset_id
    )
    join public.booking_requests b
      on b.dataset_id = s.dataset_id and b.id = target_request_id
    where s.id = target_schedule_id
      and public.can_view_dataset(s.dataset_id)
      and p.user_id = (select auth.uid())
      and p.role in ('admin', 'department_coordinator')
      and b.requester_user_id is not null
      and b.requester_user_id <> p.user_id
  )
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.institutes,
  public.profiles,
  public.datasets,
  public.rooms,
  public.room_unavailability,
  public.faculty,
  public.faculty_unavailability,
  public.student_groups,
  public.courses,
  public.sessions,
  public.session_groups,
  public.exams,
  public.exam_courses,
  public.exam_groups,
  public.booking_requests,
  public.booking_windows,
  public.cancellations,
  public.schedules,
  public.scheduled_sessions,
  public.schedule_bookings,
  public.session_overrides,
  public.scheduled_exams,
  public.scheduled_exam_rooms,
  public.disruptions,
  public.audit_logs
to authenticated;
grant usage, select on sequence
  public.room_unavailability_id_seq,
  public.faculty_unavailability_id_seq,
  public.booking_windows_id_seq,
  public.cancellations_id_seq,
  public.audit_logs_id_seq
to authenticated;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.current_profile_role() from public, anon;
revoke all on function public.can_view_dataset(uuid) from public, anon;
revoke all on function public.can_manage_dataset(uuid) from public, anon;
revoke all on function public.can_manage_institute(uuid) from public, anon;
revoke all on function public.can_decide_booking(uuid, text) from public, anon;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.can_view_dataset(uuid) to authenticated;
grant execute on function public.can_manage_dataset(uuid) to authenticated;
grant execute on function public.can_manage_institute(uuid) to authenticated;
grant execute on function public.can_decide_booking(uuid, text) to authenticated;

alter table public.institutes enable row level security;
alter table public.profiles enable row level security;
alter table public.datasets enable row level security;
alter table public.rooms enable row level security;
alter table public.room_unavailability enable row level security;
alter table public.faculty enable row level security;
alter table public.faculty_unavailability enable row level security;
alter table public.student_groups enable row level security;
alter table public.courses enable row level security;
alter table public.sessions enable row level security;
alter table public.session_groups enable row level security;
alter table public.exams enable row level security;
alter table public.exam_courses enable row level security;
alter table public.exam_groups enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_windows enable row level security;
alter table public.cancellations enable row level security;
alter table public.schedules enable row level security;
alter table public.scheduled_sessions enable row level security;
alter table public.schedule_bookings enable row level security;
alter table public.session_overrides enable row level security;
alter table public.scheduled_exams enable row level security;
alter table public.scheduled_exam_rooms enable row level security;
alter table public.disruptions enable row level security;
alter table public.audit_logs enable row level security;

create policy "institute members can read their institute"
  on public.institutes for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.institute_id = institutes.id and p.user_id = (select auth.uid())
  ));

create policy "users can read their own profile"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "dataset members can read active datasets"
  on public.datasets for select to authenticated
  using (public.can_view_dataset(id));
create policy "admins can manage datasets"
  on public.datasets for all to authenticated
  using (public.can_manage_dataset(id))
  with check (public.can_manage_institute(institute_id));

create policy "dataset members can read rooms"
  on public.rooms for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage rooms"
  on public.rooms for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read room unavailability"
  on public.room_unavailability for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage room unavailability"
  on public.room_unavailability for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read faculty"
  on public.faculty for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage faculty"
  on public.faculty for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read faculty unavailability"
  on public.faculty_unavailability for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage faculty unavailability"
  on public.faculty_unavailability for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read student groups"
  on public.student_groups for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage student groups"
  on public.student_groups for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read courses"
  on public.courses for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage courses"
  on public.courses for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read sessions"
  on public.sessions for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage sessions"
  on public.sessions for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read session groups"
  on public.session_groups for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage session groups"
  on public.session_groups for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read exams"
  on public.exams for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage exams"
  on public.exams for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read exam courses"
  on public.exam_courses for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage exam courses"
  on public.exam_courses for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read exam groups"
  on public.exam_groups for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage exam groups"
  on public.exam_groups for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read booking requests"
  on public.booking_requests for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "users can submit booking requests"
  on public.booking_requests for insert to authenticated
  with check (
    public.can_view_dataset(dataset_id)
    and requester_user_id = (select auth.uid())
    and requester_role = public.current_profile_role()
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and booking_requests.requester_name = p.full_name
        and booking_requests.department is not distinct from p.department
    )
  );
create policy "admins can manage booking requests"
  on public.booking_requests for all to authenticated
  using (public.can_manage_dataset(dataset_id))
  with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read booking windows"
  on public.booking_windows for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "requesters can add booking windows"
  on public.booking_windows for insert to authenticated
  with check (
    public.can_view_dataset(dataset_id)
    and exists (
      select 1 from public.booking_requests b
      where b.dataset_id = booking_windows.dataset_id
        and b.id = booking_windows.request_id
        and b.requester_user_id = (select auth.uid())
    )
  );
create policy "admins can manage booking windows"
  on public.booking_windows for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read cancellations"
  on public.cancellations for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "requesters can cancel their booking"
  on public.cancellations for insert to authenticated
  with check (
    public.can_view_dataset(dataset_id)
    and cancelled_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and cancelled_by_name = p.full_name
    )
    and exists (
      select 1 from public.booking_requests b
      where b.dataset_id = cancellations.dataset_id
        and b.id = cancellations.request_id
        and b.requester_user_id = (select auth.uid())
    )
  );
create policy "admins can manage cancellations"
  on public.cancellations for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read schedules"
  on public.schedules for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage schedules"
  on public.schedules for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "dataset members can read scheduled sessions"
  on public.scheduled_sessions for select to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_view_dataset(s.dataset_id)));
create policy "admins can manage scheduled sessions"
  on public.scheduled_sessions for all to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_manage_dataset(s.dataset_id)))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_manage_dataset(s.dataset_id)));

create policy "dataset members can read schedule bookings"
  on public.schedule_bookings for select to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_view_dataset(s.dataset_id)));
create policy "authorized users can decide bookings"
  on public.schedule_bookings for insert to authenticated
  with check (public.can_decide_booking(schedule_id, request_id) and decided_by = (select auth.uid()));
create policy "authorized users can update booking decisions"
  on public.schedule_bookings for update to authenticated
  using (public.can_decide_booking(schedule_id, request_id))
  with check (public.can_decide_booking(schedule_id, request_id) and decided_by = (select auth.uid()));
create policy "admins can delete schedule bookings"
  on public.schedule_bookings for delete to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_manage_dataset(s.dataset_id)));

create policy "dataset members can read session overrides"
  on public.session_overrides for select to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_view_dataset(s.dataset_id)));
create policy "admins can manage session overrides"
  on public.session_overrides for all to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_manage_dataset(s.dataset_id)))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_manage_dataset(s.dataset_id)));

create policy "dataset members can read scheduled exams"
  on public.scheduled_exams for select to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_view_dataset(s.dataset_id)));
create policy "admins can manage scheduled exams"
  on public.scheduled_exams for all to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_manage_dataset(s.dataset_id)))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_manage_dataset(s.dataset_id)));

create policy "dataset members can read scheduled exam rooms"
  on public.scheduled_exam_rooms for select to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_view_dataset(s.dataset_id)));
create policy "admins can manage scheduled exam rooms"
  on public.scheduled_exam_rooms for all to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_manage_dataset(s.dataset_id)))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_manage_dataset(s.dataset_id)));

create policy "dataset members can read disruptions"
  on public.disruptions for select to authenticated using (public.can_view_dataset(dataset_id));
create policy "admins can manage disruptions"
  on public.disruptions for all to authenticated
  using (public.can_manage_dataset(dataset_id)) with check (public.can_manage_dataset(dataset_id));

create policy "admins can read audit logs"
  on public.audit_logs for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.institute_id = audit_logs.institute_id
      and p.user_id = (select auth.uid())
      and p.role = 'admin'
  ));
create policy "admins can add audit logs"
  on public.audit_logs for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.institute_id = audit_logs.institute_id
      and p.user_id = (select auth.uid())
      and p.role = 'admin'
  ));
