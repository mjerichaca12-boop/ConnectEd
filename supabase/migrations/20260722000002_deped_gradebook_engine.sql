-- DepEd Gradebook Engine for JHS (Grades 7-10)
-- Adds subject categories, admin grading settings, and automatic quarterly recomputation.

alter table if exists public.subjects
add column if not exists subject_category text not null default 'Languages / AP / EsP';

update public.subjects
set subject_category = case
  when lower(coalesce(name, '')) ~ '^(english|filipino|araling panlipunan|esp|values|language)' then 'Languages / AP / EsP'
  when lower(coalesce(name, '')) ~ '^(science|mathematics|math)' then 'Science / Mathematics'
  when lower(coalesce(name, '')) ~ '^(mapeh|music|arts|physical education|health|epp|tle)' then 'MAPEH / EPP / TLE'
  else coalesce(subject_category, 'Languages / AP / EsP')
end
where coalesce(subject_category, '') = '' or subject_category not in ('Languages / AP / EsP', 'Science / Mathematics', 'MAPEH / EPP / TLE');

comment on column public.subjects.subject_category is 'DepEd subject category used to resolve grading weights automatically.';

create table if not exists public.grading_settings (
  subject_category text primary key,
  written_works_weight numeric(5,2) not null,
  performance_tasks_weight numeric(5,2) not null,
  written_works_enabled boolean not null default true,
  performance_tasks_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint grading_settings_weights_check check (
    written_works_weight >= 0 and
    performance_tasks_weight >= 0 and
    written_works_weight <= 100 and
    performance_tasks_weight <= 100 and
    round((written_works_weight + performance_tasks_weight)::numeric, 2) = 100
  )
);

insert into public.grading_settings (subject_category, written_works_weight, performance_tasks_weight, written_works_enabled, performance_tasks_enabled)
values
  ('Languages / AP / EsP', 40, 60, true, true),
  ('Science / Mathematics', 50, 50, true, true),
  ('MAPEH / EPP / TLE', 30, 70, true, true)
on conflict (subject_category) do update set
  written_works_weight = excluded.written_works_weight,
  performance_tasks_weight = excluded.performance_tasks_weight,
  written_works_enabled = excluded.written_works_enabled,
  performance_tasks_enabled = excluded.performance_tasks_enabled,
  updated_at = now();

alter table if exists public.teacher_assessment_grades
add column if not exists grading_component text,
add column if not exists grading_term text;

alter table if exists public.teacher_student_grades
add column if not exists grade_computation jsonb not null default '{}'::jsonb,
add column if not exists subject_category text;

create or replace function public.resolve_deped_subject_category(p_subject_name text, p_current_category text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text := lower(trim(coalesce(p_subject_name, '')));
  v_category text := trim(coalesce(p_current_category, ''));
begin
  if v_category in ('Languages / AP / EsP', 'Science / Mathematics', 'MAPEH / EPP / TLE') then
    return v_category;
  end if;

  if v_name ~ '^(english|filipino|araling panlipunan|esp|values|language)' then
    return 'Languages / AP / EsP';
  elsif v_name ~ '^(science|mathematics|math)' then
    return 'Science / Mathematics';
  elsif v_name ~ '^(mapeh|music|arts|physical education|health|epp|tle)' then
    return 'MAPEH / EPP / TLE';
  end if;

  return 'Languages / AP / EsP';
end;
$$;

create or replace function public.resolve_deped_assessment_component(p_component text, p_assessment_type text, p_title text)
returns text
language plpgsql
immutable
as $$
declare
  v_component text := lower(trim(coalesce(p_component, '')));
  v_text text := lower(trim(coalesce(p_assessment_type, '') || ' ' || coalesce(p_title, '')));
begin
  if v_component in ('written works', 'written_work', 'writtenworks', 'written') then
    return 'writtenWorks';
  end if;

  if v_component in ('performance tasks', 'performance_task', 'performancetasks', 'performance') then
    return 'performanceTasks';
  end if;

  if v_text like '%quiz%' or v_text like '%test%' or v_text like '%exam%' or v_text like '%assignment%' or v_text like '%seatwork%' or v_text like '%written%' then
    return 'writtenWorks';
  end if;

  return 'performanceTasks';
end;
$$;

create or replace function public.resolve_deped_assessment_quarter(p_term text)
returns integer
language plpgsql
immutable
as $$
declare
  v_term text := lower(trim(coalesce(p_term, '')));
begin
  if v_term like '%q1%' or v_term like '%quarter 1%' or v_term like '%1st quarter%' or v_term like '%first quarter%' or v_term like '%term 1%' then
    return 1;
  elsif v_term like '%q2%' or v_term like '%quarter 2%' or v_term like '%2nd quarter%' or v_term like '%second quarter%' or v_term like '%term 2%' then
    return 2;
  elsif v_term like '%q3%' or v_term like '%quarter 3%' or v_term like '%3rd quarter%' or v_term like '%third quarter%' or v_term like '%term 3%' then
    return 3;
  elsif v_term like '%q4%' or v_term like '%quarter 4%' or v_term like '%4th quarter%' or v_term like '%fourth quarter%' or v_term like '%term 4%' then
    return 4;
  end if;

  return 1;
end;
$$;

create or replace function public.transmute_deped_quarter_grade(p_initial_grade numeric)
returns numeric
language plpgsql
immutable
as $$
declare
  v_initial numeric := coalesce(p_initial_grade, 0);
begin
  if v_initial <= 0 then
    return 0;
  end if;

  return greatest(0, least(100, round((37.5 + (v_initial * 0.625))::numeric, 0)));
end;
$$;

create or replace function public.recalculate_student_grades()
returns trigger
language plpgsql
security definer
as $$
declare
  v_student_id uuid;
  v_subject_id uuid;
  v_teacher_id uuid;
  v_subject_category text;
  v_written_weight numeric(5,2);
  v_performance_weight numeric(5,2);
  v_written_enabled boolean;
  v_performance_enabled boolean;
  v_quarter integer;
  v_written_raw numeric(12,2);
  v_written_highest numeric(12,2);
  v_written_percentage numeric(12,2);
  v_written_weighted numeric(12,2);
  v_performance_raw numeric(12,2);
  v_performance_highest numeric(12,2);
  v_performance_percentage numeric(12,2);
  v_performance_weighted numeric(12,2);
  v_initial_grade numeric(12,2);
  v_quarter_grade numeric(12,2);
  v_quarter_grades numeric[] := array[]::numeric[];
  v_quarter_json jsonb := '{}'::jsonb;
  v_component_json jsonb;
  v_overall_grade numeric(12,2);
begin
  if tg_op = 'DELETE' then
    v_student_id := old.student_id;
    v_subject_id := old.subject_id;
    v_teacher_id := old.teacher_id;
  else
    v_student_id := new.student_id;
    v_subject_id := new.subject_id;
    v_teacher_id := new.teacher_id;
  end if;

  select resolve_deped_subject_category(name, subject_category)
  into v_subject_category
  from public.subjects
  where id = v_subject_id
  limit 1;

  if v_subject_category is null then
    v_subject_category := 'Languages / AP / EsP';
  end if;

  select
    written_works_weight,
    performance_tasks_weight,
    written_works_enabled,
    performance_tasks_enabled
  into
    v_written_weight,
    v_performance_weight,
    v_written_enabled,
    v_performance_enabled
  from public.grading_settings
  where subject_category = v_subject_category
  limit 1;

  if v_written_weight is null then v_written_weight := 40; end if;
  if v_performance_weight is null then v_performance_weight := 60; end if;
  if v_written_enabled is null then v_written_enabled := true; end if;
  if v_performance_enabled is null then v_performance_enabled := true; end if;

  for v_quarter in 1..4 loop
    select
      coalesce(sum(case when resolve_deped_assessment_component(coalesce(grading_component, ''), assessment_type, assessment_title) = 'writtenWorks' then grade_value else 0 end), 0),
      coalesce(sum(case when resolve_deped_assessment_component(coalesce(grading_component, ''), assessment_type, assessment_title) = 'writtenWorks' then max_points else 0 end), 0),
      coalesce(sum(case when resolve_deped_assessment_component(coalesce(grading_component, ''), assessment_type, assessment_title) = 'performanceTasks' then grade_value else 0 end), 0),
      coalesce(sum(case when resolve_deped_assessment_component(coalesce(grading_component, ''), assessment_type, assessment_title) = 'performanceTasks' then max_points else 0 end), 0)
    into
      v_written_raw,
      v_written_highest,
      v_performance_raw,
      v_performance_highest
    from public.teacher_assessment_grades
    where teacher_id = v_teacher_id
      and subject_id = v_subject_id
      and student_id = v_student_id
      and lower(coalesce(status, '')) in ('graded', 'returned')
      and resolve_deped_assessment_quarter(coalesce(grading_term, term)) = v_quarter;

    if v_written_highest > 0 and v_written_enabled then
      v_written_percentage := round((v_written_raw / nullif(v_written_highest, 0)) * 100, 2);
      v_written_weighted := round((v_written_percentage * v_written_weight) / 100, 2);
    else
      v_written_percentage := 0;
      v_written_weighted := 0;
    end if;

    if v_performance_highest > 0 and v_performance_enabled then
      v_performance_percentage := round((v_performance_raw / nullif(v_performance_highest, 0)) * 100, 2);
      v_performance_weighted := round((v_performance_percentage * v_performance_weight) / 100, 2);
    else
      v_performance_percentage := 0;
      v_performance_weighted := 0;
    end if;

    v_initial_grade := round(coalesce(v_written_weighted, 0) + coalesce(v_performance_weighted, 0), 2);
    v_quarter_grade := transmute_deped_quarter_grade(v_initial_grade);
    v_quarter_grades := array_append(v_quarter_grades, v_quarter_grade);

    v_component_json := jsonb_build_object(
      'writtenWorks', jsonb_build_object(
        'rawScore', round(coalesce(v_written_raw, 0), 2),
        'highestScore', round(coalesce(v_written_highest, 0), 2),
        'percentageScore', coalesce(v_written_percentage, 0),
        'weightedScore', coalesce(v_written_weighted, 0),
        'weight', v_written_weight,
        'enabled', v_written_enabled
      ),
      'performanceTasks', jsonb_build_object(
        'rawScore', round(coalesce(v_performance_raw, 0), 2),
        'highestScore', round(coalesce(v_performance_highest, 0), 2),
        'percentageScore', coalesce(v_performance_percentage, 0),
        'weightedScore', coalesce(v_performance_weighted, 0),
        'weight', v_performance_weight,
        'enabled', v_performance_enabled
      ),
      'initialGrade', coalesce(v_initial_grade, 0),
      'quarterlyGrade', coalesce(v_quarter_grade, 0)
    );

    v_quarter_json := jsonb_set(v_quarter_json, array[('quarter' || v_quarter)::text], v_component_json, true);

    if v_quarter = 1 then
      continue;
    end if;
  end loop;

  v_overall_grade := case
    when cardinality(v_quarter_grades) > 0 then round((select avg(value) from unnest(v_quarter_grades) as value), 2)
    else 0
  end;

  insert into public.teacher_student_grades (
    teacher_id,
    subject_id,
    student_id,
    quarter1_grade,
    quarter2_grade,
    quarter3_grade,
    quarter4_grade,
    overall_grade,
    grade_computation,
    subject_category,
    updated_at
  ) values (
    v_teacher_id,
    v_subject_id,
    v_student_id,
    coalesce(v_quarter_grades[1], 0),
    coalesce(v_quarter_grades[2], 0),
    coalesce(v_quarter_grades[3], 0),
    coalesce(v_quarter_grades[4], 0),
    coalesce(v_overall_grade, 0),
    jsonb_build_object(
      'subjectCategory', v_subject_category,
      'weights', jsonb_build_object(
        'writtenWorks', v_written_weight,
        'performanceTasks', v_performance_weight
      ),
      'quarters', v_quarter_json,
      'overallGrade', coalesce(v_overall_grade, 0)
    ),
    v_subject_category,
    now()
  )
  on conflict (teacher_id, subject_id, student_id)
  do update set
    quarter1_grade = excluded.quarter1_grade,
    quarter2_grade = excluded.quarter2_grade,
    quarter3_grade = excluded.quarter3_grade,
    quarter4_grade = excluded.quarter4_grade,
    overall_grade = excluded.overall_grade,
    grade_computation = excluded.grade_computation,
    subject_category = excluded.subject_category,
    updated_at = excluded.updated_at;

  return null;
end;
$$;

drop trigger if exists trg_recalculate_student_grades on public.teacher_assessment_grades;
create trigger trg_recalculate_student_grades
  after insert or update or delete on public.teacher_assessment_grades
  for each row
  execute function public.recalculate_student_grades();

notify pgrst, 'reload schema';