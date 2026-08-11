import { supabase } from "../lib/supabaseClient.js";

/**
 * ConnectEd Teacher AI — Authorized Live Data Retrieval Tools
 * 
 * SECURITY & PRIVACY RULE:
 * Every tool MUST require and enforce the currently authenticated teacher's ID.
 * Data belonging to other teachers or unauthorized students is strictly filtered out.
 */

/**
 * Get all assigned classes for the authenticated teacher
 */
export async function getTeacherClasses(teacherId) {
  if (!supabase || !teacherId) return { success: false, data: [], error: "Unauthorized or unconfigured" };

  try {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, code, name, grade_level, section, capacity, enrolled")
      .eq("teacher_id", teacherId)
      .order("code", { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        gradeLevel: s.grade_level,
        section: s.section,
        capacity: s.capacity || 0,
        enrolled: s.enrolled || 0
      }))
    };
  } catch (err) {
    console.error("[teacherAiTools] getTeacherClasses error:", err);
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Get students enrolled in a specific class for the authenticated teacher
 */
export async function getClassStudents(teacherId, classQuery) {
  if (!supabase || !teacherId) return { success: false, data: [], error: "Unauthorized" };

  try {
    // 1. Resolve subject owned by this teacher
    let subjectQuery = supabase
      .from("subjects")
      .select("id, name, grade_level, section, code")
      .eq("teacher_id", teacherId);

    if (classQuery) {
      const q = String(classQuery).trim().toLowerCase();
      subjectQuery = subjectQuery.or(`code.ilike.%${q}%,name.ilike.%${q}%,section.ilike.%${q}%`);
    }

    const { data: subjects, error: subjErr } = await subjectQuery;
    if (subjErr) throw subjErr;

    if (!subjects || subjects.length === 0) {
      return { success: true, data: [], message: "No matching classes found for this teacher." };
    }

    const subjectIds = subjects.map(s => s.id);

    // 2. Fetch student assignments for these subjects
    const { data: assignments, error: assignErr } = await supabase
      .from("teacher_student_assignments")
      .select("subject_id, student_id")
      .in("subject_id", subjectIds);

    if (assignErr) throw assignErr;

    const studentIds = Array.from(new Set((assignments || []).map(a => a.student_id)));

    if (studentIds.length === 0) {
      return { success: true, data: [], totalStudents: 0 };
    }

    // 3. Fetch student profile details (no sensitive credentials exposed)
    const { data: students, error: stuErr } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, lrn, year_level, section, status")
      .eq("role", "student")
      .in("id", studentIds);

    if (stuErr) throw stuErr;

    const formattedStudents = (students || []).map(s => ({
      id: s.id,
      fullName: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" "),
      lrn: s.lrn || "N/A",
      gradeLevel: s.year_level || "N/A",
      section: s.section || "N/A",
      status: s.status || "Active"
    }));

    return {
      success: true,
      data: formattedStudents,
      totalStudents: formattedStudents.length,
      classInfo: subjects[0]
    };
  } catch (err) {
    console.error("[teacherAiTools] getClassStudents error:", err);
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Get submissions that need grading for the authenticated teacher
 */
export async function getNeedsGrading(teacherId) {
  if (!supabase || !teacherId) return { success: false, data: [], error: "Unauthorized" };

  try {
    const { data: submissions, error } = await supabase
      .from("teacher_assessment_submissions")
      .select("id, assessment_id, student_id, subject_id, status, submission_date")
      .eq("teacher_id", teacherId)
      .or("status.eq.submitted,status.eq.Needs Grading,status.eq.Pending");

    if (error) throw error;

    const pendingList = submissions || [];

    return {
      success: true,
      pendingCount: pendingList.length,
      data: pendingList.map(s => ({
        id: s.id,
        assessmentId: s.assessment_id,
        subjectId: s.subject_id,
        submittedAt: s.submission_date,
        status: s.status
      }))
    };
  } catch (err) {
    console.error("[teacherAiTools] getNeedsGrading error:", err);
    return { success: false, data: [], pendingCount: 0, error: err.message };
  }
}

/**
 * Get upcoming assignments/tasks for the authenticated teacher's subjects
 */
export async function getUpcomingTasks(teacherId) {
  if (!supabase || !teacherId) return { success: false, data: [], error: "Unauthorized" };

  try {
    // 1. Get teacher subjects
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name, code")
      .eq("teacher_id", teacherId);

    const subjectIds = (subjects || []).map(s => s.id);
    if (subjectIds.length === 0) return { success: true, data: [], count: 0 };

    // 2. Get lessons for these subjects
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, subject_id")
      .in("subject_id", subjectIds);

    const lessonIds = (lessons || []).map(l => l.id);
    if (lessonIds.length === 0) return { success: true, data: [], count: 0 };

    const todayStr = new Date().toISOString();

    // 3. Fetch upcoming assignments & quizzes
    const [{ data: assignments }, { data: quizzes }] = await Promise.all([
      supabase.from("assignments").select("id, title, due_date, lesson_id").in("lesson_id", lessonIds).gte("due_date", todayStr),
      supabase.from("quizzes").select("id, title, due_date, lesson_id").in("lesson_id", lessonIds).gte("due_date", todayStr)
    ]);

    const taskList = [
      ...(assignments || []).map(a => ({ id: a.id, title: a.title, dueDate: a.due_date, type: "Assignment" })),
      ...(quizzes || []).map(q => ({ id: q.id, title: q.title, dueDate: q.due_date, type: "Quiz" }))
    ].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return {
      success: true,
      data: taskList,
      count: taskList.length
    };
  } catch (err) {
    console.error("[teacherAiTools] getUpcomingTasks error:", err);
    return { success: false, data: [], count: 0, error: err.message };
  }
}

/**
 * Get recently updated grades recorded by the authenticated teacher
 */
export async function getRecentlyUpdatedGrades(teacherId) {
  if (!supabase || !teacherId) return { success: false, data: [], error: "Unauthorized" };

  try {
    const { data: grades, error } = await supabase
      .from("teacher_assessment_grades")
      .select("id, assessment_id, student_id, score, total_points, updated_at")
      .eq("teacher_id", teacherId)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    return {
      success: true,
      data: (grades || []).map(g => ({
        id: g.id,
        score: g.score,
        totalPoints: g.total_points,
        displayGrade: `${g.score}/${g.total_points}`,
        updatedAt: g.updated_at
      }))
    };
  } catch (err) {
    console.error("[teacherAiTools] getRecentlyUpdatedGrades error:", err);
    return { success: false, data: [], error: err.message };
  }
}
