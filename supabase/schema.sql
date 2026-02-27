-- Teacher Assistant schema, RLS, and onboarding trigger.
-- Run this in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('school_admin', 'teacher');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.question_difficulty as enum ('easy', 'medium', 'hard');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  logo_url text,
  region text,
  district text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.schools
  add column if not exists logo_url text;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  role public.user_role not null,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 1),
  year int,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 1),
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  form_level int not null check (form_level between 1 and 6),
  title text not null check (char_length(trim(title)) >= 1),
  syllabus_ref text,
  created_at timestamptz not null default now(),
  unique (school_id, subject_id, form_level, title)
);

create table if not exists public.teacher_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (school_id, teacher_id, subject_id, class_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  admission_no text,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  sex text check (sex in ('M', 'F')),
  created_at timestamptz not null default now()
);

create unique index if not exists students_school_admission_unique
  on public.students (school_id, admission_no)
  where admission_no is not null;

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  week_no int check (week_no is null or week_no >= 1),
  executed_at date,
  generator_fields jsonb not null default '{}'::jsonb,
  objectives text,
  introduction text,
  activities text,
  resources text,
  assessment text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid references public.users(id) on delete set null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  type text not null default 'mcq',
  difficulty public.question_difficulty not null default 'medium',
  question_text text not null check (char_length(trim(question_text)) >= 5),
  choices jsonb not null default '{}'::jsonb,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  marks int not null default 1 check (marks >= 1),
  created_at timestamptz not null default now()
);

alter table public.lesson_plans
  add column if not exists executed_at date;

alter table public.lesson_plans
  add column if not exists generator_fields jsonb not null default '{}'::jsonb;

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  term text,
  date date,
  ai_draft_json jsonb,
  total_marks int not null default 0 check (total_marks >= 0),
  created_at timestamptz not null default now()
);

alter table public.tests
  add column if not exists ai_draft_json jsonb;

create table if not exists public.exam_timetable (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  test_id uuid references public.tests(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  term text,
  exam_date date,
  starts_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes >= 1 and duration_minutes <= 600),
  venue text,
  notes text,
  created_at timestamptz not null default now(),
  unique (test_id)
);

alter table public.exam_timetable
  alter column test_id drop not null;

create table if not exists public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  order_no int,
  marks int not null default 1 check (marks >= 1),
  unique (test_id, question_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  total_score numeric(10, 2) not null default 0,
  unique (test_id, student_id)
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_text text,
  is_correct boolean,
  score numeric(10, 2) not null default 0,
  unique (attempt_id, question_id)
);

create index if not exists idx_users_school_id on public.users (school_id);
create index if not exists idx_classes_school_id on public.classes (school_id);
create index if not exists idx_subjects_school_id on public.subjects (school_id);
create index if not exists idx_topics_school_id on public.topics (school_id);
create index if not exists idx_topics_subject_id on public.topics (subject_id);
create index if not exists idx_teacher_subjects_school_id on public.teacher_subjects (school_id);
create index if not exists idx_students_school_id on public.students (school_id);
create index if not exists idx_lesson_plans_school_id on public.lesson_plans (school_id);
create index if not exists idx_lesson_plans_execution_lookup on public.lesson_plans (school_id, class_id, subject_id, executed_at);
create index if not exists idx_questions_school_id on public.questions (school_id);
create index if not exists idx_tests_school_id on public.tests (school_id);
create index if not exists idx_exam_timetable_school_id on public.exam_timetable (school_id);
create index if not exists idx_exam_timetable_starts_at on public.exam_timetable (starts_at);
create index if not exists idx_exam_timetable_teacher_id on public.exam_timetable (teacher_id);
create index if not exists idx_test_questions_test_id on public.test_questions (test_id);
create index if not exists idx_attempts_test_id on public.attempts (test_id);
create index if not exists idx_attempt_answers_attempt_id on public.attempt_answers (attempt_id);

alter table public.schools enable row level security;
alter table public.users enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.teacher_subjects enable row level security;
alter table public.students enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.questions enable row level security;
alter table public.tests enable row level security;
alter table public.exam_timetable enable row level security;
alter table public.test_questions enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.school_id
  from public.users u
  where u.id = auth.uid()
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
$$;

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'school_admin'::public.user_role
$$;

create or replace function public.can_access_test(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tests t
    where t.id = p_test_id
      and t.school_id = public.current_school_id()
      and (public.is_school_admin() or t.teacher_id = auth.uid())
  )
$$;

create or replace function public.can_manage_test(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tests t
    where t.id = p_test_id
      and t.school_id = public.current_school_id()
      and (public.is_school_admin() or t.teacher_id = auth.uid())
  )
$$;

create or replace function public.can_access_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts a
    join public.tests t on t.id = a.test_id
    where a.id = p_attempt_id
      and t.school_id = public.current_school_id()
      and (public.is_school_admin() or t.teacher_id = auth.uid())
  )
$$;

create or replace function public.can_manage_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts a
    join public.tests t on t.id = a.test_id
    where a.id = p_attempt_id
      and t.school_id = public.current_school_id()
      and (public.is_school_admin() or t.teacher_id = auth.uid())
  )
$$;

grant execute on function public.current_school_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_school_admin() to authenticated;
grant execute on function public.can_access_test(uuid) to authenticated;
grant execute on function public.can_manage_test(uuid) to authenticated;
grant execute on function public.can_access_attempt(uuid) to authenticated;
grant execute on function public.can_manage_attempt(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('school-assets', 'school-assets', true)
on conflict (id) do update
  set public = excluded.public;

drop policy if exists school_assets_select_authenticated on storage.objects;
create policy school_assets_select_authenticated
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'school-assets');

drop policy if exists school_assets_insert_admin on storage.objects;
create policy school_assets_insert_admin
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'school-assets'
    and split_part(name, '/', 1) = public.current_school_id()::text
    and public.is_school_admin()
  );

drop policy if exists school_assets_update_admin on storage.objects;
create policy school_assets_update_admin
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'school-assets'
    and split_part(name, '/', 1) = public.current_school_id()::text
    and public.is_school_admin()
  )
  with check (
    bucket_id = 'school-assets'
    and split_part(name, '/', 1) = public.current_school_id()::text
    and public.is_school_admin()
  );

drop policy if exists school_assets_delete_admin on storage.objects;
create policy school_assets_delete_admin
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'school-assets'
    and split_part(name, '/', 1) = public.current_school_id()::text
    and public.is_school_admin()
  );

drop policy if exists schools_select_own on public.schools;
create policy schools_select_own
  on public.schools
  for select
  to authenticated
  using (id = public.current_school_id());

drop policy if exists schools_update_admin on public.schools;
create policy schools_update_admin
  on public.schools
  for update
  to authenticated
  using (id = public.current_school_id() and public.is_school_admin())
  with check (id = public.current_school_id() and public.is_school_admin());

drop policy if exists users_select_school on public.users;
create policy users_select_school
  on public.users
  for select
  to authenticated
  using (id = auth.uid() or school_id = public.current_school_id());

drop policy if exists users_insert_admin on public.users;
create policy users_insert_admin
  on public.users
  for insert
  to authenticated
  with check (
    school_id = public.current_school_id()
    and public.is_school_admin()
    and role in ('school_admin'::public.user_role, 'teacher'::public.user_role)
  );

drop policy if exists users_update_self_or_admin on public.users;
create policy users_update_self_or_admin
  on public.users
  for update
  to authenticated
  using (
    id = auth.uid()
    or (school_id = public.current_school_id() and public.is_school_admin())
  )
  with check (
    (
      id = auth.uid()
      and school_id = public.current_school_id()
      and role = public.current_user_role()
    )
    or (school_id = public.current_school_id() and public.is_school_admin())
  );

drop policy if exists classes_select_school on public.classes;
create policy classes_select_school
  on public.classes
  for select
  to authenticated
  using (school_id = public.current_school_id());

drop policy if exists classes_write_admin on public.classes;
create policy classes_write_admin
  on public.classes
  for all
  to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

drop policy if exists subjects_select_school on public.subjects;
create policy subjects_select_school
  on public.subjects
  for select
  to authenticated
  using (school_id = public.current_school_id());

drop policy if exists subjects_write_admin on public.subjects;
create policy subjects_write_admin
  on public.subjects
  for all
  to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

drop policy if exists topics_select_school on public.topics;
create policy topics_select_school
  on public.topics
  for select
  to authenticated
  using (school_id = public.current_school_id());

drop policy if exists topics_write_admin on public.topics;
create policy topics_write_admin
  on public.topics
  for all
  to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

drop policy if exists teacher_subjects_select_school on public.teacher_subjects;
create policy teacher_subjects_select_school
  on public.teacher_subjects
  for select
  to authenticated
  using (school_id = public.current_school_id());

drop policy if exists teacher_subjects_write_admin on public.teacher_subjects;
create policy teacher_subjects_write_admin
  on public.teacher_subjects
  for all
  to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

drop policy if exists students_select_school on public.students;
create policy students_select_school
  on public.students
  for select
  to authenticated
  using (school_id = public.current_school_id());

drop policy if exists students_write_admin on public.students;
create policy students_write_admin
  on public.students
  for all
  to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

drop policy if exists lesson_plans_select_school on public.lesson_plans;
drop policy if exists lesson_plans_select_owner_or_admin on public.lesson_plans;
create policy lesson_plans_select_owner_or_admin
  on public.lesson_plans
  for select
  to authenticated
  using (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists lesson_plans_insert_owner_or_admin on public.lesson_plans;
create policy lesson_plans_insert_owner_or_admin
  on public.lesson_plans
  for insert
  to authenticated
  with check (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists lesson_plans_update_owner_or_admin on public.lesson_plans;
create policy lesson_plans_update_owner_or_admin
  on public.lesson_plans
  for update
  to authenticated
  using (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  )
  with check (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists lesson_plans_delete_owner_or_admin on public.lesson_plans;
create policy lesson_plans_delete_owner_or_admin
  on public.lesson_plans
  for delete
  to authenticated
  using (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists questions_select_school on public.questions;
drop policy if exists questions_select_owner_admin_or_linked_test_access on public.questions;
create policy questions_select_owner_admin_or_linked_test_access
  on public.questions
  for select
  to authenticated
  using (
    school_id = public.current_school_id()
    and (
      public.is_school_admin()
      or teacher_id = auth.uid()
      or exists (
        select 1
        from public.test_questions tq
        where tq.question_id = questions.id
          and public.can_access_test(tq.test_id)
      )
    )
  );

drop policy if exists questions_insert_owner_or_admin on public.questions;
create policy questions_insert_owner_or_admin
  on public.questions
  for insert
  to authenticated
  with check (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists questions_update_owner_or_admin on public.questions;
create policy questions_update_owner_or_admin
  on public.questions
  for update
  to authenticated
  using (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  )
  with check (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists questions_delete_owner_or_admin on public.questions;
create policy questions_delete_owner_or_admin
  on public.questions
  for delete
  to authenticated
  using (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists tests_select_school on public.tests;
drop policy if exists tests_select_owner_or_admin on public.tests;
create policy tests_select_owner_or_admin
  on public.tests
  for select
  to authenticated
  using (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists tests_insert_owner_or_admin on public.tests;
create policy tests_insert_owner_or_admin
  on public.tests
  for insert
  to authenticated
  with check (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists tests_update_owner_or_admin on public.tests;
create policy tests_update_owner_or_admin
  on public.tests
  for update
  to authenticated
  using (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  )
  with check (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists tests_delete_owner_or_admin on public.tests;
create policy tests_delete_owner_or_admin
  on public.tests
  for delete
  to authenticated
  using (
    school_id = public.current_school_id()
    and (public.is_school_admin() or teacher_id = auth.uid())
  );

drop policy if exists exam_timetable_select_school on public.exam_timetable;
drop policy if exists exam_timetable_select_class_assigned_or_admin on public.exam_timetable;
create policy exam_timetable_select_class_assigned_or_admin
  on public.exam_timetable
  for select
  to authenticated
  using (
    school_id = public.current_school_id()
    and (
      public.is_school_admin()
      or exists (
        select 1
        from public.teacher_subjects ts
        where ts.school_id = public.current_school_id()
          and ts.teacher_id = auth.uid()
          and ts.class_id = exam_timetable.class_id
      )
    )
  );

drop policy if exists exam_timetable_insert_by_test_owner_or_admin on public.exam_timetable;
drop policy if exists exam_timetable_insert_admin on public.exam_timetable;
create policy exam_timetable_insert_admin
  on public.exam_timetable
  for insert
  to authenticated
  with check (
    school_id = public.current_school_id()
    and public.is_school_admin()
  );

drop policy if exists exam_timetable_update_by_test_owner_or_admin on public.exam_timetable;
drop policy if exists exam_timetable_update_admin on public.exam_timetable;
create policy exam_timetable_update_admin
  on public.exam_timetable
  for update
  to authenticated
  using (
    school_id = public.current_school_id()
    and public.is_school_admin()
  )
  with check (
    school_id = public.current_school_id()
    and public.is_school_admin()
  );

drop policy if exists exam_timetable_delete_by_test_owner_or_admin on public.exam_timetable;
drop policy if exists exam_timetable_delete_admin on public.exam_timetable;
create policy exam_timetable_delete_admin
  on public.exam_timetable
  for delete
  to authenticated
  using (
    school_id = public.current_school_id()
    and public.is_school_admin()
  );

drop policy if exists test_questions_select_by_test on public.test_questions;
create policy test_questions_select_by_test
  on public.test_questions
  for select
  to authenticated
  using (public.can_access_test(test_id));

drop policy if exists test_questions_insert_by_test on public.test_questions;
create policy test_questions_insert_by_test
  on public.test_questions
  for insert
  to authenticated
  with check (public.can_manage_test(test_id));

drop policy if exists test_questions_update_by_test on public.test_questions;
create policy test_questions_update_by_test
  on public.test_questions
  for update
  to authenticated
  using (public.can_manage_test(test_id))
  with check (public.can_manage_test(test_id));

drop policy if exists test_questions_delete_by_test on public.test_questions;
create policy test_questions_delete_by_test
  on public.test_questions
  for delete
  to authenticated
  using (public.can_manage_test(test_id));

drop policy if exists attempts_select_by_test on public.attempts;
create policy attempts_select_by_test
  on public.attempts
  for select
  to authenticated
  using (public.can_access_test(test_id));

drop policy if exists attempts_insert_by_test on public.attempts;
create policy attempts_insert_by_test
  on public.attempts
  for insert
  to authenticated
  with check (public.can_manage_test(test_id));

drop policy if exists attempts_update_by_test on public.attempts;
create policy attempts_update_by_test
  on public.attempts
  for update
  to authenticated
  using (public.can_manage_test(test_id))
  with check (public.can_manage_test(test_id));

drop policy if exists attempts_delete_by_test on public.attempts;
create policy attempts_delete_by_test
  on public.attempts
  for delete
  to authenticated
  using (public.can_manage_test(test_id));

drop policy if exists attempt_answers_select_by_attempt on public.attempt_answers;
create policy attempt_answers_select_by_attempt
  on public.attempt_answers
  for select
  to authenticated
  using (public.can_access_attempt(attempt_id));

drop policy if exists attempt_answers_insert_by_attempt on public.attempt_answers;
create policy attempt_answers_insert_by_attempt
  on public.attempt_answers
  for insert
  to authenticated
  with check (public.can_manage_attempt(attempt_id));

drop policy if exists attempt_answers_update_by_attempt on public.attempt_answers;
create policy attempt_answers_update_by_attempt
  on public.attempt_answers
  for update
  to authenticated
  using (public.can_manage_attempt(attempt_id))
  with check (public.can_manage_attempt(attempt_id));

drop policy if exists attempt_answers_delete_by_attempt on public.attempt_answers;
create policy attempt_answers_delete_by_attempt
  on public.attempt_answers
  for delete
  to authenticated
  using (public.can_manage_attempt(attempt_id));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_school_name text;
  v_role public.user_role;
  v_school_id uuid;
begin
  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  if v_full_name is null then
    v_full_name := split_part(coalesce(new.email, 'User'), '@', 1);
  end if;

  v_school_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'school_name', '')), '');
  if v_school_name is null then
    v_school_name := 'My School';
  end if;

  begin
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'school_admin');
  exception
    when others then
      v_role := 'school_admin';
  end;

  -- Only server-side admin provisioning may create teacher profiles on signup.
  if v_role = 'teacher'
     and coalesce(new.raw_app_meta_data ->> 'provisioning_source', '') <> 'admin_create_teacher' then
    v_role := 'school_admin';
  end if;

  if v_role = 'teacher' and (new.raw_user_meta_data ? 'school_id') then
    v_school_id := (new.raw_user_meta_data ->> 'school_id')::uuid;
  else
    insert into public.schools (name)
    values (v_school_name)
    returning id into v_school_id;
  end if;

  insert into public.users (id, school_id, role, full_name, phone)
  values (
    new.id,
    v_school_id,
    v_role,
    v_full_name,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

commit;
