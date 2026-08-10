import { supabase } from "./supabaseClient";

export const adminApi = {
  async fetchWithToken(url, options = {}) {
    try {
      const headers = {
        ...options.headers,
        "Content-Type": "application/json",
      };
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (currentUser.role === "admin" && currentUser.token) {
        headers["Authorization"] = `Bearer static_${currentUser.token}`;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          throw new Error("Your session has expired. Please log in again.");
        }
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(url, { ...options, headers });
      if (!res.ok) {
        let errorMsg = `Error ${res.status}`;
        let status = res.status;
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        console.error("[adminApi] API Error:", errorMsg);
        const err = new Error(errorMsg);
        err.status = status;
        throw err;
      }
      const data = await res.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async listUsers() {
    return this.fetchWithToken("/api/admin/users", { method: "GET" });
  },

  async createUser({ email, password, email_confirm }) {
    return this.fetchWithToken("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm }),
    });
  },

  async updateUserById(id, { password }) {
    return this.fetchWithToken("/api/admin/users", {
      method: "PUT",
      body: JSON.stringify({ id, password }),
    });
  },

  async updateProfile(id, payload) {
    return this.fetchWithToken("/api/admin/profiles", {
      method: "PUT",
      body: JSON.stringify({ id, payload }),
    });
  },

  async deleteUser(id) {
    return this.fetchWithToken(`/api/admin/users?id=${id}`, { method: "DELETE" });
  },

  async db(table, action, options = {}) {
    return this.fetchWithToken("/api/admin/db", {
      method: "POST",
      body: JSON.stringify({ table, action, ...options }),
    });
  },

  async batchGenerateAccounts(studentsBatch) {
    return this.fetchWithToken("/api/admin/batch-accounts", {
      method: "POST",
      body: JSON.stringify({ students: studentsBatch }),
    });
  },

  async enrollStudents(payload) {
    const res = await this.fetchWithToken("/api/admin/enrollment", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.error) {
      return res;
    }

    console.warn("[adminApi] /api/admin/enrollment returned error or is unavailable, attempting Supabase client fallback:", res.error?.message || res.error);

    try {
      const { subject_id, student_ids, teacher_id, section } = payload;
      if (!subject_id || !Array.isArray(student_ids) || student_ids.length === 0) {
        return { data: null, error: new Error("Missing subject_id or student_ids array.") };
      }

      let subject = null;
      const rawSubjectId = String(subject_id).trim();

      if (/^[0-9a-fA-F-]{36}$/.test(rawSubjectId)) {
        const { data } = await supabase
          .from("subjects")
          .select("id, capacity, enrolled, name, code, section, grade_level, year_level")
          .eq("id", rawSubjectId)
          .maybeSingle();
        subject = data;
      }

      if (!subject) {
        const { data } = await supabase
          .from("subjects")
          .select("id, capacity, enrolled, name, code, section, grade_level, year_level")
          .ilike("code", rawSubjectId)
          .maybeSingle();
        subject = data;
      }

      if (!subject) {
        return { data: null, error: new Error("Class or subject not found.") };
      }

      const resolvedSubjectId = subject.id;

      const normalizeGrade = (val) => {
        if (!val) return "";
        const m = String(val).match(/\d+/);
        return m ? `Grade ${m[0]}` : String(val).trim();
      };
      const normalizeSec = (val) => {
        if (!val) return "";
        const s = String(val).trim();
        return (s.toLowerCase() === "unassigned" || s.toLowerCase() === "none") ? "" : s.toLowerCase();
      };

      const classGradeNorm = normalizeGrade(subject.grade_level || subject.year_level);
      const classSecNorm = normalizeSec(subject.section || section);

      const { data: studentProfiles } = await supabase
        .from("profiles")
        .select("id, year_level, grade_level, section")
        .in("id", student_ids);

      if (studentProfiles) {
        for (const student of studentProfiles) {
          const studentGradeNorm = normalizeGrade(student.grade_level || student.year_level);
          const studentSecNorm = normalizeSec(student.section);

          if (!studentSecNorm) {
            return { data: null, error: new Error("Student does not belong to this class section.") };
          }
          if (classGradeNorm && studentGradeNorm && studentGradeNorm !== classGradeNorm) {
            return { data: null, error: new Error("Student does not belong to this class section.") };
          }
          if (classSecNorm && studentSecNorm !== classSecNorm) {
            return { data: null, error: new Error("Student does not belong to this class section.") };
          }
        }
      }

      const { data: activeAssignments } = await supabase
        .from("teacher_student_assignments")
        .select("student_id")
        .eq("subject_id", resolvedSubjectId)
        .eq("status", "Active");

      const currentEnrolled = activeAssignments ? activeAssignments.length : 0;
      const existingSet = new Set((activeAssignments || []).map(a => a.student_id));
      const capacity = Number(subject.capacity || 0);
      const availableSlots = capacity > 0 ? Math.max(0, capacity - currentEnrolled) : 999999;

      if (capacity > 0 && availableSlots <= 0) {
        return { data: null, error: new Error(`Cannot enroll student. This class has reached its maximum capacity of ${capacity} students.`) };
      }

      const newStudentIds = student_ids.filter(sid => !existingSet.has(sid));
      if (newStudentIds.length === 0) {
        return { data: null, error: new Error("One or more selected students are already enrolled in this class.") };
      }

      if (capacity > 0 && newStudentIds.length > availableSlots) {
        return { data: null, error: new Error(`Only ${availableSlots} slots are available for this class.`) };
      }

      const insertRows = newStudentIds.map(sid => ({
        teacher_id: teacher_id || null,
        student_id: sid,
        subject_id: resolvedSubjectId,
        section: section || subject.section || null,
        status: "Active"
      }));

      const { error: insertErr } = await supabase
        .from("teacher_student_assignments")
        .insert(insertRows);

      if (insertErr) {
        return { data: null, error: new Error(insertErr.message || "Failed to insert enrollment records.") };
      }

      const newTotal = currentEnrolled + insertRows.length;
      await supabase.from("subjects").update({ enrolled: newTotal }).eq("id", resolvedSubjectId);

      return {
        data: {
          success: true,
          enrolled_count: insertRows.length,
          skipped_capacity: 0,
          already_enrolled_count: student_ids.length - newStudentIds.length,
          new_total_enrolled: newTotal,
          capacity
        },
        error: null
      };
    } catch (fallbackError) {
      return { data: null, error: fallbackError };
    }
  }
};
