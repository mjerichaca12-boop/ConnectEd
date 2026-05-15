import { createClient } from "@supabase/supabase-js";

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const readJsonBody = async (req) => {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  return {};
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const submissionId = String(body.submission_id || "").trim();
    const teacherId = String(body.teacher_id || "").trim();
    const feedbackText = String(body.feedback_text || "").trim();
    const studentId = String(body.student_id || "").trim();
    const assessmentId = String(body.assessment_id || body.assignment_id || "").trim();
    const subjectId = String(body.subject_id || "").trim();
    const providedGrade = typeof body.grade !== "undefined" ? body.grade : body.grade_value;
    const requestedStatus = String(body.status || "").trim();
    const action = String(body.action || "").trim(); // e.g. 'close'|'return'

    if (!teacherId) return res.status(400).json({ error: "teacher_id is required" });

    const supabase = getSupabaseAdmin();
    const timestamp = new Date().toISOString();

    let targetSubmissionId = submissionId;

    // If no submission id provided, try to create/upsert a placeholder submission
    if (!targetSubmissionId) {
      if (!studentId || !assessmentId || !subjectId) {
        return res.status(400).json({ error: "When submission_id is missing, provide student_id, assessment_id, and subject_id." });
      }

      const upsertPayload = {
        teacher_id: teacherId,
        subject_id: subjectId,
        assessment_id: assessmentId,
        student_id: studentId,
        response_text: body.response_text || null,
        file_url: body.file_url || null,
        file_name: body.file_name || null,
        file_path: body.file_path || null,
        submitted_at: body.submitted_at || timestamp,
        created_at: body.created_at || timestamp,
        updated_at: timestamp,
      };

      const { data: subData, error: subError } = await supabase
        .from("teacher_assessment_submissions")
        .upsert(upsertPayload, { onConflict: "teacher_id,subject_id,assessment_id,student_id" })
        .select("id, teacher_id, subject_id, assessment_id, student_id, submitted_at, updated_at, status")
        .maybeSingle();

      if (subError) {
        console.error("[submission-feedback] failed to upsert submission:", subError);
        return res.status(500).json({ error: subError.message || "Failed to create submission." });
      }

      targetSubmissionId = subData?.id;
    }

    // optionally update status based on action or providedStatus
    if (targetSubmissionId && (action === "close" || action === "return" || requestedStatus)) {
      const newStatus = action === "close" ? "closed" : (action === "return" ? "returned" : requestedStatus || "pending");
      await supabase
        .from("teacher_assessment_submissions")
        .update({ status: newStatus, updated_at: timestamp })
        .eq("id", targetSubmissionId);
    }

    // upsert feedback (create or update)
    const { data: existing, error: existingError } = await supabase
      .from("submission_feedback")
      .select("id")
      .eq("submission_id", targetSubmissionId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("submission_feedback")
        .update({ feedback_text: feedbackText, teacher_id: teacherId, updated_at: timestamp })
        .eq("id", existing.id)
        .select("id, submission_id, teacher_id, feedback_text, created_at, updated_at")
        .single();

      if (error) throw error;

      // optionally upsert grade
      if (typeof providedGrade !== "undefined" && providedGrade !== null && String(providedGrade) !== "") {
        await supabase
          .from("teacher_assessment_grades")
          .upsert({
            teacher_id: teacherId,
            subject_id: subjectId,
            assessment_id: assessmentId,
            student_id: studentId,
            grade_value: Number(providedGrade),
            status: "Graded",
            updated_at: timestamp,
          }, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });
      }

      return res.status(200).json({ feedback: data });
    }

    const { data, error } = await supabase
      .from("submission_feedback")
      .insert({
        submission_id: targetSubmissionId,
        teacher_id: teacherId,
        feedback_text: feedbackText,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("id, submission_id, teacher_id, feedback_text, created_at, updated_at")
      .single();

    if (error) throw error;

    // optionally upsert a grade when provided
    if (typeof providedGrade !== "undefined" && providedGrade !== null && String(providedGrade) !== "") {
      // require studentId and assessmentId/subjectId; try to infer if missing
      const sid = studentId || (data && data.submission_id ? null : null);
      await supabase
        .from("teacher_assessment_grades")
        .upsert({
          teacher_id: teacherId,
          subject_id: subjectId,
          assessment_id: assessmentId,
          student_id: studentId,
          grade_value: Number(providedGrade),
          status: "Graded",
          updated_at: timestamp,
        }, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });
    }

    return res.status(201).json({ feedback: data });
  } catch (error) {
    console.error("[submission-feedback]", error);
    return res.status(500).json({ error: error?.message || "Unable to save feedback." });
  }
}
