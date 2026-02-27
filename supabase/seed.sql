-- Optional starter seed data.
-- Run this after schema.sql.

do $$
declare
  v_admin_email text := 'admin@school.tz'; -- Change this before running.
  v_teacher_email text := 'teacher@school.tz'; -- Optional teacher auth user.

  v_admin_id uuid;
  v_teacher_id uuid;
  v_school_id uuid;

  v_class_1a uuid;
  v_class_2a uuid;
  v_sub_math uuid;
  v_sub_english uuid;
begin
  select id into v_admin_id
  from auth.users
  where email = v_admin_email
  limit 1;

  if v_admin_id is null then
    raise exception 'Auth user % not found. Create this auth user first.', v_admin_email;
  end if;

  select school_id into v_school_id
  from public.users
  where id = v_admin_id;

  if v_school_id is null then
    insert into public.schools (name, region, district, phone)
    values ('Wazo Secondary School', 'Dar es Salaam', 'Kinondoni', '+255700000000')
    returning id into v_school_id;

    insert into public.users (id, school_id, role, full_name, phone)
    values (v_admin_id, v_school_id, 'school_admin', 'School Admin', null)
    on conflict (id) do update
      set school_id = excluded.school_id,
          role = excluded.role,
          full_name = excluded.full_name,
          phone = excluded.phone;
  end if;

  insert into public.classes (school_id, name, year)
  values (v_school_id, 'Form 1A', 1)
  on conflict (school_id, name) do update set year = excluded.year
  returning id into v_class_1a;

  insert into public.classes (school_id, name, year)
  values (v_school_id, 'Form 2A', 2)
  on conflict (school_id, name) do update set year = excluded.year
  returning id into v_class_2a;

  insert into public.subjects (school_id, name)
  values (v_school_id, 'Mathematics')
  on conflict (school_id, name) do update set name = excluded.name
  returning id into v_sub_math;

  insert into public.subjects (school_id, name)
  values (v_school_id, 'English')
  on conflict (school_id, name) do update set name = excluded.name
  returning id into v_sub_english;

  insert into public.topics (school_id, subject_id, form_level, title, syllabus_ref)
  values (v_school_id, v_sub_math, 1, 'Numbers and Operations', 'MATH-F1-01')
  on conflict (school_id, subject_id, form_level, title) do update
    set syllabus_ref = excluded.syllabus_ref;

  insert into public.topics (school_id, subject_id, form_level, title, syllabus_ref)
  values (v_school_id, v_sub_english, 1, 'Grammar Basics', 'ENG-F1-01')
  on conflict (school_id, subject_id, form_level, title) do update
    set syllabus_ref = excluded.syllabus_ref;

  insert into public.students (school_id, class_id, admission_no, full_name, sex)
  values
    (v_school_id, v_class_1a, 'S001', 'Asha Mollel', 'F'),
    (v_school_id, v_class_1a, 'S002', 'Juma Ally', 'M'),
    (v_school_id, v_class_2a, 'S003', 'Neema Said', 'F')
  on conflict (school_id, admission_no) where admission_no is not null do update
    set class_id = excluded.class_id,
        full_name = excluded.full_name,
        sex = excluded.sex;

  select id into v_teacher_id
  from auth.users
  where email = v_teacher_email
  limit 1;

  if v_teacher_id is not null then
    insert into public.users (id, school_id, role, full_name, phone)
    values (v_teacher_id, v_school_id, 'teacher', 'Teacher User', null)
    on conflict (id) do nothing;

    if exists (
      select 1
      from public.users
      where id = v_teacher_id
        and school_id = v_school_id
        and role = 'teacher'
    ) then
      insert into public.teacher_subjects (school_id, teacher_id, subject_id, class_id)
      values (v_school_id, v_teacher_id, v_sub_math, v_class_1a)
      on conflict (school_id, teacher_id, subject_id, class_id) do nothing;
    end if;
  end if;
end $$;
