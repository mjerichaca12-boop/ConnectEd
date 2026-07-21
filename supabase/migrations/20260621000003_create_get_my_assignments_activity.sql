-- Create RPC function get_my_assignments_activity to join assignments and lessons
create or replace function public.get_my_assignments_activity()
returns table (
  id uuid,
  course_id uuid,
  title text,
  description text,
  due_date timestamptz,
  deadline timestamptz,
  dueDate timestamptz,
  file_url text,
  file_name text,
  file_path text,
  assessment_type text,
  type text,
  created_at timestamptz
)
language sql
security definer
as $$
  select 
    a.id,
    l.subject_id as course_id,
    a.title,
    a.description,
    a.due_date,
    a.due_date as deadline,
    a.due_date as dueDate,
    a.attachment_url as file_url,
    a.attachment_name as file_name,
    null::text as file_path,
    a.assignment_type as assessment_type,
    a.assignment_type as type,
    a.created_at
  from public.assignments a
  join public.lessons l on a.lesson_id = l.id;
$$;

grant execute on function public.get_my_assignments_activity() to authenticated, anon;
