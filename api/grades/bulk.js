import { createClient } from "@supabase/supabase-js";

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeGradeRow = (row, timestamp) => {
  const q1 = row.q1 ?? row.quarter1_grade;
  const q2 = row.q2 ?? row.quarter2_grade;
  const q3 = row.q3 ?? row.quarter3_grade;
  const q4 = row.q4 ?? row.quarter4_grade;

  return {
    teacher_id: String(row.teacher_id || "").trim(),
    subject_id: String(row.subject_id || "").trim(),
    student_id: String(row.student_id || "").trim(),
    quarter1_grade: toNumber(q1),
    quarter2_grade: toNumber(q2),
    quarter3_grade: toNumber(q3),
    quarter4_grade: toNumber(q4),
    quiz_average: toNumber(row.quiz_average),
    project_grade: toNumber(row.project_grade),
    activity_grade: toNumber(row.activity_grade),
    overall_grade: toNumber(row.overall_grade),
    updated_at: row.updated_at || timestamp,
  };
};

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "PUT") {
    res.setHeader("Allow", ["POST", "PUT"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const grades = Array.isArray(body.grades) ? body.grades : [];

    if (!grades.length) {
      return res.status(400).json({ error: "No grades provided." });
    }

    const timestamp = new Date().toISOString();
    const normalized = grades.map((row) => normalizeGradeRow(row, timestamp));

    if (normalized.some((row) => !row.teacher_id || !row.subject_id || !row.student_id)) {
      return res.status(400).json({ error: "Each grade needs teacher_id, subject_id, and student_id." });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("teacher_student_grades")
      .upsert(normalized, { onConflict: "teacher_id,subject_id,student_id" })
      .select("id, teacher_id, subject_id, student_id, quarter1_grade, quarter2_grade, quarter3_grade, quarter4_grade, updated_at");

    if (error) {
      console.error("[api/grades/bulk] upsert error:", error);
      return res.status(500).json({ error: error.message || "Failed to upsert grades" });
    }

    return res.status(200).json({ saved: (data || []).length, rows: data });
  } catch (error) {
    console.error("[api/grades/bulk] unexpected:", error);
    return res.status(500).json({ error: error?.message || "Unable to save grades." });
  }
}
