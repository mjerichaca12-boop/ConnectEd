-- Remove Attendance and Video Conference features from schema.

-- Drop attendance table and policies (if they still exist).
drop table if exists public.teacher_student_attendance cascade;

-- Drop video-conference related tables (if they exist).
drop table if exists public.meeting_participants cascade;
drop table if exists public.online_class_meetings cascade;

-- Remove legacy attendance columns from enrollment/assignment structures.
alter table if exists public.enrollments
  drop column if exists attendance;

alter table if exists public.teacher_student_assignments
  drop column if exists attendance;

-- Recreate enrollments view without attendance projection where needed.
do $$
begin
  if exists (
    select 1
    from information_schema.views
    where table_schema = 'public' and table_name = 'enrollments'
  ) then
    execute $view$
      create or replace view public.enrollments as
      select
        id,
        subject_id,
        student_id,
        case
          when lower(status) = 'active' then 'accepted'
          else lower(status)
        end as status,
        created_at,
        grades as grade
      from public.teacher_student_assignments
    $view$;

    grant select, update on public.enrollments to authenticated, anon, service_role;
  end if;
end
$$;

notify pgrst, 'reload schema';
