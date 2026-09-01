-- Migration: Add assessment_term compatibility column for DepEd grade triggers
-- Date: 2026-07-23

alter table if exists public.teacher_assessment_grades
add column if not exists assessment_term text;



create or replace function public.recalculate_student_grades()
returns trigger
language plpgsql
security definer
as $$
declare
  v_student_id uuid;
  v_subject_id uuid;
  v_teacher_id uuid;

  v_quiz_avg numeric(5,2) := 0;
  v_assignment_avg numeric(5,2) := 0;
  v_activity_avg numeric(5,2) := 0;
  v_overall numeric(5,2) := 0;
begin
  if TG_OP = 'DELETE' then
    v_student_id := OLD.student_id;
    v_subject_id := OLD.subject_id;
    v_teacher_id := OLD.teacher_id;
  else
    v_student_id := NEW.student_id;
    v_subject_id := NEW.subject_id;
    v_teacher_id := NEW.teacher_id;
  end if;

  select coalesce(avg(grade_value / nullif(max_points, 0) * 100), 0)
  into v_quiz_avg
  from public.teacher_assessment_grades
  where student_id = v_student_id and subject_id = v_subject_id and assessment_type = 'quiz' and status in ('Graded', 'Returned');

  select coalesce(avg(grade_value / nullif(max_points, 0) * 100), 0)
  into v_assignment_avg
  from public.teacher_assessment_grades
  where student_id = v_student_id and subject_id = v_subject_id and assessment_type = 'assignment' and status in ('Graded', 'Returned');

  select coalesce(avg(grade_value / nullif(max_points, 0) * 100), 0)
  into v_activity_avg
  from public.teacher_assessment_grades
  where student_id = v_student_id and subject_id = v_subject_id and assessment_type = 'activity' and status in ('Graded', 'Returned');

  v_overall := (v_quiz_avg + v_assignment_avg + v_activity_avg) / 3;

  insert into public.teacher_student_grades (
    teacher_id, subject_id, student_id, quiz_average, assignment_grade, activity_grade, overall_grade, updated_at
  ) values (
    v_teacher_id, v_subject_id, v_student_id, v_quiz_avg, v_assignment_avg, v_activity_avg, v_overall, now()
  )
  on conflict (teacher_id, subject_id, student_id)
  do update set
    quiz_average = excluded.quiz_average,
    assignment_grade = excluded.assignment_grade,
    activity_grade = excluded.activity_grade,
    overall_grade = excluded.overall_grade,
    updated_at = excluded.updated_at;

  if (TG_OP = 'INSERT' and NEW.status in ('Graded', 'Returned')) or
     (TG_OP = 'UPDATE' and NEW.status in ('Graded', 'Returned') and OLD.status not in ('Graded', 'Returned')) then
    insert into public.notifications (user_id, title, body, type, created_at)
    values (
      NEW.student_id,
      'Grade Posted: ' || coalesce(NEW.assessment_title, 'Assessment'),
      'You received a ' || NEW.grade_value || '/' || NEW.max_points || '.',
      'grade',
      now()
    );
  end if;

  return null;
end;
$$;

notify pgrst, 'reload schema';