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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const grades = Array.isArray(body.grades) ? body.grades : (body.grade ? [body.grade] : []);

    // Basic validation
    if (!grades.length) return res.status(400).json({ error: "No grades provided." });

    const supabase = getSupabaseAdmin();
    const timestamp = new Date().toISOString();

    // Ensure each grade has the required keys and normalized values
    const normalized = grades.map((g) => ({
      teacher_id: String(g.teacher_id || "").trim(),
      subject_id: String(g.subject_id || "").trim(),
      student_id: String(g.student_id || "").trim(),
      quarter1_grade: typeof g.quarter1_grade !== "undefined" ? g.quarter1_grade : 0,
      quarter2_grade: typeof g.quarter2_grade !== "undefined" ? g.quarter2_grade : 0,
      quarter3_grade: typeof g.quarter3_grade !== "undefined" ? g.quarter3_grade : 0,
      quarter4_grade: typeof g.quarter4_grade !== "undefined" ? g.quarter4_grade : 0,
      quiz_average: typeof g.quiz_average !== "undefined" ? g.quiz_average : 0,
      project_grade: typeof g.project_grade !== "undefined" ? g.project_grade : 0,
      activity_grade: typeof g.activity_grade !== "undefined" ? g.activity_grade : 0,
      overall_grade: typeof g.overall_grade !== "undefined" ? g.overall_grade : 0,
      updated_at: g.updated_at || timestamp,
    }));

    // Log request for debugging
    console.log("[api/grades] upserting", normalized.length, "rows");

    const { data, error } = await supabase
      .from("teacher_student_grades")
      .upsert(normalized, { onConflict: "teacher_id,subject_id,student_id" })
      .select("id, teacher_id, subject_id, student_id, quarter1_grade, quarter2_grade, quarter3_grade, quarter4_grade, updated_at");

    if (error) {
      console.error("[api/grades] upsert error:", error);
      return res.status(500).json({ error: error.message || "Failed to upsert grades" });
    }

    return res.status(200).json({ saved: (data || []).length, rows: data });
  } catch (error) {
    console.error("[api/grades] unexpected:", error);
    return res.status(500).json({ error: error?.message || "Unable to save grades." });
  }
}
