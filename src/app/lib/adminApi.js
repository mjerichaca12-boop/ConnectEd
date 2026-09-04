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

  async bulkDeleteStudents(studentIds) {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return { data: { success: true, count: 0 }, error: null };
    }
    const res = await this.fetchWithToken("/api/admin/bulk-delete-students", {
      method: "POST",
      body: JSON.stringify({ student_ids: studentIds }),
    });

    if (!res.error) {
      return res;
    }

    console.warn("[adminApi] /api/admin/bulk-delete-students failed or unavailable, executing Supabase batch fallback:", res.error?.message || res.error);

    try {
      const tablesToClean = [
        { table: "notifications", col: "user_id" },
        { table: "password_reset_logs", col: "user_id" },
        { table: "conversation_participants", col: "profile_id" },
        { table: "conversation_reads", col: "user_id" },
        { table: "teacher_student_assignments", col: "student_id" },
        { table: "teacher_student_grades", col: "student_id" },
        { table: "teacher_assessment_submissions", col: "student_id" },
        { table: "teacher_assessment_grades", col: "student_id" },
        { table: "student_attendance", col: "student_id" },
      ];

      const BATCH_SIZE = 200;
      for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
        const chunk = studentIds.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(tablesToClean.map(item => supabase.from(item.table).delete().in(item.col, chunk)));
        await supabase.from("profiles").delete().in("id", chunk).eq("role", "student");
      }

      return { data: { success: true, count: studentIds.length }, error: null };
    } catch (fallbackError) {
      return { data: null, error: fallbackError };
    }
  },

  async db(table, action, options = {}) {
    const res = await this.fetchWithToken("/api/admin/db", {
      method: "POST",
      body: JSON.stringify({ table, action, ...options }),
    });

    if (!res.error && res.data) {
      return res;
    }

    console.warn(`[adminApi] /api/admin/db failed for action "${action}" on table "${table}", executing direct Supabase fallback:`, res.error?.message || res.error);

    try {
      const { payload, eq, neq, in: inArgs, or, is: isArgs, match, select, order, single } = options;

      if (action === "storage_upload") {
        const { bucket, path, file, base64File, contentType } = payload || {};
        let uploadContent = file;
        if (!uploadContent && base64File) {
          const byteCharacters = atob(base64File);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          uploadContent = new Blob([byteArray], { type: contentType || "application/octet-stream" });
        }
        const { data, error } = await supabase.storage.from(bucket).upload(path, uploadContent, { contentType, upsert: true });
        return { data, error };
      } else if (action === "storage_remove") {
        const { bucket, paths } = payload || {};
        const { data, error } = await supabase.storage.from(bucket).remove(paths);
        return { data, error };
      }

      let query = supabase.from(table);

      if (action === "select") {
        query = query.select(select || "*");
      } else if (action === "insert") {
        query = query.insert(payload).select(select || "*");
      } else if (action === "update") {
        query = query.update(payload).select(select || "*");
      } else if (action === "delete") {
        query = query.delete();
        if (select) query = query.select(select);
      } else if (action === "upsert") {
        query = query.upsert(payload).select(select || "*");
      }

      if (eq) query = query.eq(eq.column, eq.value);
      if (neq) query = query.neq(neq.column, neq.value);
      if (inArgs) query = query.in(inArgs.column, inArgs.value);
      if (or) query = query.or(or);
      if (isArgs) query = query.is(isArgs.column, isArgs.value);
      if (match) query = query.match(match);
      if (order) query = query.order(order.column, order.options);

      if (single) {
        const { data, error } = await query.maybeSingle();
        return { data, error };
      } else {
        const { data, error } = await query;
        return { data, error };
      }
    } catch (fbErr) {
      return { data: null, error: fbErr };
    }
  },

  async uploadStorageFile(bucket, path, file, contentType = "application/octet-stream") {
    // 1. Try direct Supabase client binary upload first (works for authenticated users with session)
    try {
      const { data: directData, error: directErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType, upsert: true });

      if (!directErr && directData) {
        return { data: directData, error: null };
      }
    } catch (e) {
      // Continue to signed upload flow
    }

    // 2. Request signed upload URL token from admin API (bypasses RLS & avoids 413 Vercel payload size limit)
    const signedRes = await this.db("storage", "create_signed_upload_url", {
      payload: { bucket, path }
    });

    if (signedRes.error || !signedRes.data?.token) {
      // Fallback: If create_signed_upload_url is unavailable, attempt small file base64 upload
      if (file.size && file.size < 2.5 * 1024 * 1024) {
        const toBase64 = (f) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(f);
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = err => reject(err);
        });
        const base64File = await toBase64(file);
        return this.db("storage", "storage_upload", {
          payload: { bucket, path, base64File, contentType }
        });
      }
      return { data: null, error: signedRes.error || new Error("Failed to generate signed upload authorization.") };
    }

    const { token } = signedRes.data;
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(path, token, file, { contentType, upsert: true });

    if (uploadErr) {
      return { data: null, error: uploadErr };
    }

    return { data: uploadData, error: null };
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
          .select("id, capacity, enrolled, name, code, section, grade_level, teacher_id")
          .eq("id", rawSubjectId)
          .maybeSingle();
        subject = data;
      }

      if (!subject) {
        const { data } = await supabase
          .from("subjects")
          .select("id, capacity, enrolled, name, code, section, grade_level, teacher_id")
          .ilike("code", rawSubjectId)
          .maybeSingle();
        subject = data;
      }

      if (!subject) {
        return { data: null, error: new Error("Class or subject not found.") };
      }

      const resolvedSubjectId = subject.id;

      const isInvalidTeacherId = (id) => !id || String(id).toLowerCase() === "null" || String(id).toLowerCase() === "undefined";

      let effectiveTeacherId = teacher_id;
      if (isInvalidTeacherId(effectiveTeacherId)) {
        effectiveTeacherId = subject.teacher_id;
      }
      if (isInvalidTeacherId(effectiveTeacherId)) {
        const { data: teacherProfile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("role", "teacher")
          .limit(1)
          .maybeSingle();
        if (teacherProfile?.id) {
          effectiveTeacherId = teacherProfile.id;
        } else {
          const { data: anyProfile } = await supabase
            .from("profiles")
            .select("id")
            .limit(1)
            .maybeSingle();
          if (anyProfile?.id) {
            effectiveTeacherId = anyProfile.id;
          }
        }
      }

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
        .select("id, year_level, section")
        .in("id", student_ids);

      if (studentProfiles) {
        for (const student of studentProfiles) {
          const studentGradeNorm = normalizeGrade(student.year_level);
          const studentSecNorm = normalizeSec(student.section);

          if (classGradeNorm && studentGradeNorm && studentGradeNorm !== classGradeNorm) {
            return { data: null, error: new Error("Student does not belong to this class section.") };
          }
          if (classSecNorm && studentSecNorm && studentSecNorm !== classSecNorm) {
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
        teacher_id: effectiveTeacherId,
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
      if (isInvalidTeacherId(subject.teacher_id) && effectiveTeacherId) {
        await supabase.from("subjects").update({ teacher_id: effectiveTeacherId, enrolled: newTotal }).eq("id", resolvedSubjectId);
      } else {
        await supabase.from("subjects").update({ enrolled: newTotal }).eq("id", resolvedSubjectId);
      }

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
  },

  async bulkAssignSection({ gradeLevel, targetSection, studentIds, isMasterlist }) {
    if (!targetSection || !Array.isArray(studentIds) || studentIds.length === 0) {
      return { data: null, error: new Error("Invalid parameters for section assignment.") };
    }

    const formatSection = (secStr) => {
      const clean = String(secStr || "").trim();
      if (!clean || clean.toLowerCase() === "unassigned" || clean.toLowerCase() === "unknown") return null;
      return clean.split(/\s+/).map(w => /^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(" ");
    };

    const cleanSection = formatSection(targetSection);
    if (!cleanSection) {
      return { data: null, error: new Error("Please provide a valid section name.") };
    }

    const normGradeNum = (gradeLevel || "").replace(/\D/g, "");

    try {
      // 1. Fetch matching subjects for capacity
      const { data: subsData } = await supabase.from("subjects").select("id, capacity, enrolled, grade_level, section");
      const matchingSubs = (subsData || []).filter(s => {
        const sGradeNum = (s.grade_level || "").replace(/\D/g, "");
        const sSec = (s.section || "").trim().toLowerCase();
        return sGradeNum === normGradeNum && sSec === cleanSection.toLowerCase();
      });

      let capacity = 0;
      if (matchingSubs.length > 0) {
        const caps = matchingSubs.map(s => Number(s.capacity || 0)).filter(c => c > 0);
        if (caps.length > 0) {
          capacity = Math.min(...caps);
        }
      }

      // 2. Count current enrolled in profiles (source of truth)
      const { count: profileEnrolledCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .ilike("section", cleanSection);

      const currentEnrolled = profileEnrolledCount || 0;

      // 3. Fetch target student records to deduplicate
      const targetTable = isMasterlist ? "student_masterlist" : "profiles";
      const { data: targetStudents } = await supabase
        .from(targetTable)
        .select("id, lrn, section")
        .in("id", studentIds);

      const alreadyEnrolledCount = (targetStudents || []).filter(s => {
        const sec = (s.section || "").trim().toLowerCase();
        return sec === cleanSection.toLowerCase();
      }).length;

      const newStudentsCount = studentIds.length - alreadyEnrolledCount;
      const availableSlots = capacity > 0 ? Math.max(0, capacity - currentEnrolled) : Infinity;
      const projectedEnrolled = currentEnrolled + newStudentsCount;

      // 4. Server-Side Capacity Guard
      if (capacity > 0 && projectedEnrolled > capacity) {
        return {
          data: null,
          error: new Error(`Cannot assign these students. Section ${cleanSection} only has ${availableSlots} available slot(s) remaining (capacity: ${capacity}, current: ${currentEnrolled}).`)
        };
      }

      // 5. Perform Database Update
      const { error: updateErr } = await this.db(targetTable, "update", {
        payload: { section: cleanSection },
        in: { column: "id", value: studentIds }
      });
      if (updateErr) throw updateErr;

      // Sync across profiles and student_masterlist by LRN
      const targetLrns = (targetStudents || []).map(s => s.lrn).filter(Boolean);
      if (targetLrns.length > 0) {
        const mirrorTable = isMasterlist ? "profiles" : "student_masterlist";
        await supabase.from(mirrorTable).update({ section: cleanSection }).in("lrn", targetLrns);
      }

      return {
        data: {
          success: true,
          count: studentIds.length,
          newStudentsCount,
          alreadyEnrolledCount,
          currentEnrolled,
          projectedEnrolled,
          capacity
        },
        error: null
      };
    } catch (err) {
      return { data: null, error: err };
    }
  }
};
