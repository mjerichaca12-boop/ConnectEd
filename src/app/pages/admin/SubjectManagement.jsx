import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { SectionDropdown } from "../../components/admin/SectionDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { supabase } from "../../lib/supabaseClient";
import { adminApi } from "@/app/lib/adminApi";
import { DEPED_SUBJECT_CATEGORIES, normalizeSubjectCategory } from "../../lib/depedGrading";
import { toast } from "sonner";
import { useCallback } from "react";
import { useActivity } from "../../lib/ActivityContext";
import { useCachedFetch } from "@/app/hooks/useCachedFetch";
import { Search, Plus, Eye, Edit, Trash2, Download, User, X, BookOpen, Users, AlertTriangle, Award, Loader2, UserPlus, CheckSquare, Square } from "lucide-react";

const emptyForm = {
  code: "",
  name: "",
  description: "",
  teacher: "",
  capacity: "",
  grade_level: "",
  section: "",
  subject_category: DEPED_SUBJECT_CATEGORIES[0]
};

const subjectSelectColumns = "id, code, name, description, teacher_id, capacity, enrolled, grade_level, section, subject_category, created_at, updated_at";
const subjectTableCandidates = ["subjects"];

function SubjectManagement() {
  const navigate = useNavigate();
  const { logActivity } = useActivity();

  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedSubjectForEnroll, setSelectedSubjectForEnroll] = useState(null);
  const [subjectToDelete, setSubjectToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [subjectFormData, setSubjectFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [editFormData, setEditFormData] = useState(emptyForm);
  const [editFormErrors, setEditFormErrors] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [enrollmentSearchQuery, setEnrollmentSearchQuery] = useState("");
  const [subjectTable, setSubjectTable] = useState("subjects");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const getCapacityStatus = (enrolled, capacity) => {
    if (!capacity || capacity === 0) return { label: "Available", color: "text-green-600", dot: "bg-green-500", bar: "bg-green-500", raw: "Available" };
    const percentage = enrolled / capacity;
    if (percentage >= 1) return { label: "Full", color: "text-red-600", dot: "bg-red-500", bar: "bg-red-500", raw: "Full" };
    if (percentage >= 0.9) return { label: "Nearly Full", color: "text-amber-500", dot: "bg-amber-500", bar: "bg-amber-500", raw: "Nearly Full" };
    return { label: "Available", color: "text-green-600", dot: "bg-green-500", bar: "bg-green-500", raw: "Available" };
  };

  useEffect(() => {
    if (showAddModal || showViewModal || showEditModal || showDeleteConfirm || showEnrollModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAddModal, showViewModal, showEditModal, showDeleteConfirm, showEnrollModal]);

  const resolveSubjectTable = async () => "subjects";
  const getSubjectTableName = async () => "subjects";


  const normalizePositiveInteger = (value) => value.replace(/\D/g, "");
  const normalizeCode = (value) => value.toUpperCase().replace(/\s+/g, "");

  const getTeacherNameById = (teacherId) => {
    if (!teacherId) return "Unassigned";
    const teacher = teachers.find((item) => item.id === teacherId);
    return teacher?.name || "Unknown teacher";
  };

  const formatTeacherName = (teacherRow) => {
    const parts = [teacherRow.first_name, teacherRow.middle_name, teacherRow.last_name].filter(Boolean);
    const combined = parts.join(" ").trim();
    return combined || teacherRow.first_name || teacherRow.email || "Unknown teacher";
  };

  const formatSubject = (subjectRow) => ({
    ...subjectRow,
    capacity: Number(subjectRow.capacity ?? 0),
    enrolled: Number(subjectRow.enrolled ?? 0),
    section: String(subjectRow.section || "").trim(),
    teacher_id: (() => {
      const t = String(subjectRow.teacher_id || "").trim();
      return (!t || t.toLowerCase() === "null" || t.toLowerCase() === "undefined") ? null : t;
    })(),
    grade_level: String(subjectRow.grade_level || "").trim(),
    subject_category: normalizeSubjectCategory(subjectRow.subject_category || "", subjectRow.name || subjectRow.code || "")
  });

  const buildSubjectDedupKey = (subjectRow) => {
    const t = String(subjectRow?.teacher_id || "").trim();
    const teacherId = (!t || t.toLowerCase() === "null" || t.toLowerCase() === "undefined") ? "" : t;
    const code = String(subjectRow?.code || "").trim().toLowerCase();
    const name = String(subjectRow?.name || "").trim().toLowerCase();
    const section = String(subjectRow?.section || "").trim().toLowerCase();
    return [teacherId, code, name, section].join("|");
  };

  const fetchTeachers = async () => {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, email, role")
      .eq("role", "teacher")
      .order("first_name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const mapped = (data ?? []).map((teacher) => ({
      id: teacher.id,
      name: formatTeacherName(teacher),
      email: teacher.email ?? ""
    }));

    setTeachers(mapped);
  };

  const fetchSubjects = async () => {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const tableName = await getSubjectTableName();

    const { data, error } = await supabase
      .from(tableName)
      .select(subjectSelectColumns)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Dynamically calculate enrollment counts
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("teacher_student_assignments")
      .select("subject_id");
    
    let enrollmentCounts = {};
    if (!enrollmentError && enrollmentData) {
      enrollmentData.forEach(row => {
        enrollmentCounts[row.subject_id] = (enrollmentCounts[row.subject_id] || 0) + 1;
      });
    }

    const normalizedSubjects = (data ?? []).map(subjectRow => ({
      ...formatSubject(subjectRow),
      enrolled: enrollmentCounts[subjectRow.id] || 0
    }));
    const seen = new Set();
    const dedupedSubjects = normalizedSubjects.filter((subjectRow) => {
      const key = buildSubjectDedupKey(subjectRow);
      if (!key.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (dedupedSubjects.length !== normalizedSubjects.length) {
      console.warn("[SubjectManagement] duplicate subject rows detected during fetch", {
        fetched: normalizedSubjects.length,
        unique: dedupedSubjects.length
      });
    }

    setSubjects(dedupedSubjects);
  };

  const fetchAvailableStudents = async (subjectId) => {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const normalizeGradeLevel = (value) => {
      const v = String(value || "").trim();
      if (!v) return "";
      const digits = v.match(/\d+/);
      if (digits) return String(digits[0]);
      return v.toLowerCase().replace(/grade|year|level|\s+/g, "").trim();
    };

    const normalizeSection = (value) =>
      String(value || "").trim().toLowerCase().replace(/\s+/g, "");

    // Get subject details including grade_level and section
    const { data: subjectRow } = await supabase
      .from("subjects")
      .select("id, teacher_id, grade_level, section")
      .eq("id", subjectId)
      .maybeSingle();

    const tIdRaw = String(subjectRow?.teacher_id || "").trim();
    const teacherId = (!tIdRaw || tIdRaw.toLowerCase() === "null" || tIdRaw.toLowerCase() === "undefined") ? null : tIdRaw;
    const subjectGradeRaw = String(subjectRow?.grade_level || "").trim();
    const subjectSectionRaw = String(subjectRow?.section || "").trim();
    const subjectGrade = normalizeGradeLevel(subjectGradeRaw);
    const subjectSection = normalizeSection(subjectSectionRaw);

    // Get all students (include grade and section columns)
    const { data: allStudents, error: studentsError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, email, role, year_level, section")
      .eq("role", "student")
      .order("first_name", { ascending: true });

    if (studentsError) {
      throw new Error(studentsError.message);
    }

    // Get students already enrolled in this subject
    const { data: enrolledAssignments, error: enrolledError } = await supabase
      .from("teacher_student_assignments")
      .select("student_id")
      .eq("subject_id", subjectId);

    if (enrolledError) {
      throw new Error(enrolledError.message);
    }

    const enrolledStudentIds = new Set(
      (enrolledAssignments ?? []).map((assignment) => assignment.student_id)
    );

    // Filter out already enrolled students and map to display objects
    let available = (allStudents ?? [])
      .filter((student) => !enrolledStudentIds.has(student.id))
      .map((student) => ({
        id: student.id,
        name: [student.first_name, student.middle_name, student.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || student.email || "Unknown",
        email: student.email || "",
        grade_level: String(student?.year_level || "").trim(),
        section: String(student?.section || "").trim()
      }));

    // Filter by subject's grade level (strict) — only show matching grade students
    if (subjectGrade) {
      available = available.filter(
        (s) => normalizeGradeLevel(s.grade_level) === subjectGrade
      );
    }

    // Filter by subject's section (strict) — only show matching section students
    if (subjectSection) {
      available = available.filter(
        (s) => normalizeSection(s.section) === subjectSection
      );
    }

    setAvailableStudents(available);
  };

  const refreshTeacherSubjectsFromDatabase = async (teacherIds) => {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const uniqueTeacherIds = [...new Set((teacherIds || [])
      .map((val) => {
        const s = String(val || "").trim();
        return (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") ? "" : s;
      })
      .filter(Boolean)
    )];
    if (uniqueTeacherIds.length === 0) {
      return;
    }

    const { data: subjectRows, error: subjectError } = await supabase
      .from("subjects")
      .select("id, teacher_id")
      .in("teacher_id", uniqueTeacherIds);

    if (subjectError) {
      throw new Error(subjectError.message);
    }

    await Promise.all(uniqueTeacherIds.map(async (teacherId) => {
      const assignedSubjectIds = (subjectRows ?? [])
        .filter((subject) => String(subject.teacher_id) === String(teacherId))
        .map((subject) => subject.id);

      const { error: updateError } = await adminApi.updateProfile(teacherId, { subjects: assignedSubjectIds });

      if (updateError) {
        throw new Error(updateError.message);
      }
    }));
  };

  const fetchSubjectsData = useCallback(async () => {
    if (!supabase) return null;
    const tableName = await getSubjectTableName();
    const [teachersRes, subjectsRes, enrollmentRes] = await Promise.all([
      supabase.from("profiles").select("id, first_name, middle_name, last_name, email, role").eq("role", "teacher").order("first_name", { ascending: true }),
      supabase.from(tableName).select(subjectSelectColumns).order("created_at", { ascending: false }),
      supabase.from("teacher_student_assignments").select("subject_id")
    ]);

    if (subjectsRes.error) throw new Error(subjectsRes.error.message);

    const enrollmentCounts = {};
    if (!enrollmentRes.error && enrollmentRes.data) {
      enrollmentRes.data.forEach((row) => {
        enrollmentCounts[row.subject_id] = (enrollmentCounts[row.subject_id] || 0) + 1;
      });
    }

    const normalizedSubjects = (subjectsRes.data ?? []).map((s) => ({
      ...formatSubject(s),
      enrolled: enrollmentCounts[s.id] || 0
    }));

    const seen = new Set();
    const dedupedSubjects = normalizedSubjects.filter((s) => {
      const key = buildSubjectDedupKey(s);
      if (!key.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const mappedTeachers = (teachersRes.data ?? []).map((t) => ({
      id: t.id,
      name: formatTeacherName(t),
      email: t.email ?? ""
    }));

    return {
      subjects: dedupedSubjects,
      teachers: mappedTeachers
    };
  }, []);

  const { data: cachedSubjectsData, loading: isCachedSubjectsLoading } = useCachedFetch("admin_subjects_data", fetchSubjectsData);

  useEffect(() => {
    let isMounted = true;
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== "admin") {
      navigate("/login");
      return;
    }

    setAdminName(user.name);
    setNotificationList(adminNotifications);

    if (cachedSubjectsData) {
      setSubjects(cachedSubjectsData.subjects || []);
      setTeachers(cachedSubjectsData.teachers || []);
      setLoading(false);
    } else {
      setLoading(isCachedSubjectsLoading);
    }

    const subjectChannel = supabase
      ? supabase
          .channel(`admin-subject-table-${Math.random().toString(36).substring(7)}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, async () => {
            try {
              await fetchSubjects();
            } catch {
              // Keep local state and show current error banner only.
            }
          })
          .subscribe()
      : null;

    const teacherChannel = supabase
      ? supabase
          .channel(`admin-subject-teachers-${Math.random().toString(36).substring(7)}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async (payload) => {
            if (payload.new?.role !== "teacher" && payload.old?.role !== "teacher") return;

            try {
              await fetchTeachers();
            } catch {
              // Keep local state and show current error banner only.
            }
          })
          .subscribe()
      : null;

    return () => {
      isMounted = false;
      if (subjectChannel) supabase.removeChannel(subjectChannel);
      if (teacherChannel) supabase.removeChannel(teacherChannel);
    };
  }, [navigate, cachedSubjectsData, isCachedSubjectsLoading]);

  const validateSubjectForm = async (formData, excludeId = null, setErrors = setFormErrors) => {
    const errors = {};

    const code = normalizeCode(formData.code || "").trim();
    const name = (formData.name || "").trim();
    const credits = normalizePositiveInteger(String(formData.credits || ""));
    const teacherId = (formData.teacher || "").trim();
    const capacity = normalizePositiveInteger(String(formData.capacity || ""));

    if (!code) {
      errors.code = "Subject code is required";
    } else if (!/^[A-Za-z0-9]+$/.test(code)) {
      errors.code = "Subject code must be alphanumeric only";
    }

    if (!name) {
      errors.name = "Subject name is required";
    }

    if (teacherId && !teachers.some((item) => item.id === teacherId)) {
      errors.teacher = "Selected teacher is invalid";
    }

    const rawCap = String(formData.capacity || "").trim();
    const parsedCap = Number(rawCap);
    if (!rawCap || isNaN(parsedCap) || !Number.isInteger(parsedCap) || parsedCap <= 0) {
      errors.capacity = "Capacity must be a positive integer (greater than 0)";
    }

    const gradeLevel = (formData.grade_level || '').trim();
    if (!gradeLevel) {
      errors.grade_level = "Grade level is required";
    }

    const subjectCategory = normalizeSubjectCategory(formData.subject_category || "", formData.name || formData.code || "");
    if (!DEPED_SUBJECT_CATEGORIES.includes(subjectCategory)) {
      errors.subject_category = "Subject category is required";
    }

    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return false;
    }

    if (!supabase) {
      setErrors({ form: "Supabase client is not configured." });
      return false;
    }

    const tableName = await getSubjectTableName();
    const codeQuery = supabase.from(tableName).select("id").eq("code", code).limit(1);
    const codeResult = await (excludeId ? codeQuery.neq("id", excludeId) : codeQuery);

    if (codeResult.error) {
      setErrors({ form: codeResult.error.message });
      return false;
    }

    if ((codeResult.data ?? []).length > 0) {
      setErrors({ code: "Subject code already exists" });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const filteredSubjects = subjects.filter((subject) => {
    const search = searchQuery.toLowerCase();
    return (
      String(subject.name || "").toLowerCase().includes(search) ||
      String(subject.code || "").toLowerCase().includes(search) ||
      String(subject.section || "").toLowerCase().includes(search) ||
      String(getTeacherNameById(subject.teacher_id) || "").toLowerCase().includes(search)
    );
  });

  const buildPayload = (formData) => ({
    code: normalizeCode(formData.code || "").trim(),
    name: (formData.name || "").trim(),
    description: (formData.description || "").trim() || null,
    credits: formData.credits ? Number(normalizePositiveInteger(String(formData.credits))) : null,
    teacher_id: (() => {
      const t = (formData.teacher || "").trim();
      return (!t || t.toLowerCase() === "null" || t.toLowerCase() === "undefined") ? null : t;
    })(),
    capacity: Number(normalizePositiveInteger(String(formData.capacity || ""))),
    grade_level: (formData.grade_level || "").trim(),
    section: (formData.section || "").trim() || null,
    subject_category: normalizeSubjectCategory(formData.subject_category || "", formData.name || formData.code || "")
  });

  const handleAddSubject = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setErrorMessage("");

    const isValid = await validateSubjectForm(subjectFormData, null, setFormErrors);
    if (!isValid) return;

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildPayload(subjectFormData);
      const tableName = await getSubjectTableName();

      const query = supabase
        .from(tableName)
        .select("id")
        .eq("code", payload.code)
        .eq("name", payload.name)
        .eq("grade_level", payload.grade_level);

      if (payload.section) {
        query.eq("section", payload.section);
      } else {
        query.is("section", null);
      }

      if (payload.teacher_id) {
        query.eq("teacher_id", payload.teacher_id);
      } else {
        query.is("teacher_id", null);
      }

      const { data: existingSubject, error: existingSubjectError } = await query.maybeSingle();

      if (existingSubjectError) {
        throw existingSubjectError;
      }

      if (existingSubject?.id) {
        setFormErrors({
          form: payload.teacher_id 
            ? "This subject is already assigned to this teacher and grade level."
            : "This subject already exists for this grade level."
        });
        return;
      }

      const { data, error } = await adminApi.db(tableName, "insert", { payload, select: subjectSelectColumns, single: true });

      if (error) throw error;

      const next = formatSubject(data);
      if (next.teacher_id) {
        await refreshTeacherSubjectsFromDatabase([next.teacher_id]);
      }
      await Promise.allSettled([fetchTeachers(), fetchSubjects()]);

      logActivity({
        actionType: "added",
        entityType: "subject",
        entityId: next.id,
        entityName: `${next.code} - ${next.name}`,
        details: { teacher: getTeacherNameById(next.teacher_id) },
        timestamp: next.created_at
      });

      logActivity({
        actionType: "assigned_subject_to_teacher",
        entityType: "subject",
        entityId: next.id,
        entityName: `${next.code} - ${next.name}`,
        details: { teacher: getTeacherNameById(next.teacher_id) },
        timestamp: next.created_at
      });

      setSubjectFormData(emptyForm);
      setFormErrors({});
      setShowAddModal(false);
      toast.success("Subject added successfully.");
    } catch (error) {
      const duplicateViolation =
        error &&
        typeof error === "object" &&
        "code" in error &&
        String(error.code) === "23505";

      if (duplicateViolation) {
        toast.error("This subject is already assigned to this teacher and section.");
      } else {
        const errMsg = error instanceof Error ? error.message : "Unable to add subject.";
        toast.error(errMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewSubject = (subject) => {
    setSelectedSubject(subject);
    setShowViewModal(true);
  };

  const handleEditSubject = (subject) => {
    setSelectedSubject(subject);
    setEditFormData({
      code: String(subject.code || ""),
      name: String(subject.name || ""),
      description: String(subject.description || ""),
      credits: String(subject.credits || ""),
      teacher: String(subject.teacher_id || ""),
      capacity: String(subject.capacity || ""),
      grade_level: String(subject.grade_level || ""),
        section: String(subject.section || ""),
        subject_category: normalizeSubjectCategory(subject.subject_category || "", subject.name || subject.code || "")
    });
    setShowEditModal(true);
  };

  const handleUpdateSubject = async (event) => {
    event.preventDefault();
    if (!selectedSubject) return;

    setErrorMessage("");

    const isValid = await validateSubjectForm(editFormData, selectedSubject.id, setEditFormErrors);
    if (!isValid) return;

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildPayload(editFormData);
      const previousTeacherId = selectedSubject.teacher_id || "";
      const tableName = await getSubjectTableName();

      if (payload.capacity > 0 && payload.capacity < (selectedSubject.enrolled || 0)) {
        toast.warning(
          `Current enrollment (${selectedSubject.enrolled}) exceeds the new capacity (${payload.capacity}). Existing enrollments will not be removed, but no additional students can be enrolled until capacity is increased.`,
          { duration: 8000 }
        );
      }

      const { error } = await adminApi.db(tableName, "update", { payload, eq: { column: "id", value: selectedSubject.id }, select: "id" });

      if (error) throw error;

      const { data: refreshedSubject, error: refreshError } = await supabase
        .from(tableName)
        .select(subjectSelectColumns)
        .eq("id", selectedSubject.id)
        .single();

      if (refreshError) throw refreshError;

      const next = formatSubject(refreshedSubject);
      await refreshTeacherSubjectsFromDatabase([previousTeacherId, next.teacher_id]);
      await Promise.allSettled([fetchTeachers(), fetchSubjects()]);

      if (previousTeacherId !== (next.teacher_id || "")) {
        logActivity({
          actionType: next.teacher_id ? (previousTeacherId ? "updated_teacher_subject_assignment" : "assigned_subject_to_teacher") : "removed_subject_from_teacher",
          entityType: "subject",
          entityId: next.id,
          entityName: `${next.code} - ${next.name}`,
          details: { teacher: getTeacherNameById(next.teacher_id) },
          timestamp: next.updated_at || new Date().toISOString()
        });
      } else {
        logActivity({
          actionType: "updated",
          entityType: "subject",
          entityId: next.id,
          entityName: `${next.code} - ${next.name}`,
          details: { teacher: getTeacherNameById(next.teacher_id) },
          timestamp: next.updated_at || new Date().toISOString()
        });
      }

      setShowEditModal(false);
      setSelectedSubject(null);
      setEditFormErrors({});
      toast.success("Subject updated successfully.");
    } catch (error) {
      const errMsg = error?.message || (error instanceof Error ? error.message : "Unable to update subject.");
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSubjectSelection = (subjectId) => {
    const newSelection = new Set(selectedSubjectIds);
    if (newSelection.has(subjectId)) {
      newSelection.delete(subjectId);
    } else {
      newSelection.add(subjectId);
    }
    setSelectedSubjectIds(newSelection);
  };

  const handleSelectAllSubjects = () => {
    if (filteredSubjects.length > 0 && selectedSubjectIds.size === filteredSubjects.length) {
      setSelectedSubjectIds(new Set());
    } else {
      setSelectedSubjectIds(new Set(filteredSubjects.map((s) => s.id)));
    }
  };

  const handleBulkDeleteSubjects = async () => {
    if (selectedSubjectIds.size === 0) return;
    setIsBulkDeleting(true);
    setErrorMessage("");
    try {
      const idsToDelete = Array.from(selectedSubjectIds);
      const tableName = await getSubjectTableName();
      
      const results = await Promise.allSettled(
        idsToDelete.map(async (id) => {
          const { error } = await adminApi.db(tableName, "delete", { eq: { column: "id", value: id } });
          if (error) throw error;
        })
      );

      let successCount = 0;
      results.forEach(result => {
        if (result.status === "fulfilled") successCount++;
      });

      setShowBulkDeleteConfirm(false);
      setSelectedSubjectIds(new Set());
      setSubjects((current) => current.filter((item) => !selectedSubjectIds.has(item.id)));
      await Promise.allSettled([fetchTeachers(), fetchSubjects()]);

      if (successCount === idsToDelete.length) {
        toast.success(`Successfully deleted ${successCount} subject(s).`);
      } else if (successCount > 0) {
        toast.warning(`Deleted ${successCount} out of ${idsToDelete.length} subjects. Some subjects might be referenced by other records.`);
      } else {
        toast.error("Failed to delete any subjects. They might be referenced by other records.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred during bulk deletion.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteSubject = (subject) => {
    setSubjectToDelete(subject);
    setShowDeleteConfirm(true);
  };

  const handleOpenEnrollModal = async (subject) => {
    setSelectedSubjectForEnroll(subject);
    setSelectedStudents(new Set());
    setEnrollmentSearchQuery("");
    setEnrollmentLoading(true);
    setShowEnrollModal(true);

    try {
      await fetchAvailableStudents(subject.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load available students.");
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const handleEnrollStudents = async () => {
    if (!selectedSubjectForEnroll || selectedStudents.size === 0) {
      setErrorMessage("Please select at least one student to enroll.");
      return;
    }

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setEnrollmentLoading(true);
    setErrorMessage("");

    try {
      const subject = selectedSubjectForEnroll;
      const tIdVal = String(subject.teacher_id || "").trim();
      const currentTeacherId = (!tIdVal || tIdVal.toLowerCase() === "null" || tIdVal.toLowerCase() === "undefined") ? null : tIdVal;

      const normalizeGradeLevel = (value) => {
        const v = String(value || "").trim();
        if (!v) return "";
        const digits = v.match(/\d+/);
        if (digits) return String(digits[0]);
        return v.toLowerCase().replace(/grade|year|level|\s+/g, "").trim();
      };

      const normalizeSection = (value) =>
        String(value || "").trim().toLowerCase().replace(/\s+/g, "");

      // Validate selected students against subject's grade_level and section
      const subjectGrade = normalizeGradeLevel(subject.grade_level || "");
      const subjectSection = normalizeSection(subject.section || "");

      if (subjectGrade || subjectSection) {
        const selectedIds = Array.from(selectedStudents);
        const { data: selectedRows, error: selErr } = await supabase
          .from("profiles")
          .select("id, year_level, section")
          .in("id", selectedIds);
        if (selErr) throw selErr;

        for (const r of selectedRows ?? []) {
          if (subjectGrade && normalizeGradeLevel(String(r?.year_level || "")) !== subjectGrade) {
            setErrorMessage("This student cannot be assigned because their Grade Level does not match the selected class or subject.");
            setEnrollmentLoading(false);
            return;
          }
          if (subjectSection && normalizeSection(String(r?.section || "")) !== subjectSection) {
            setErrorMessage("This student belongs to a different section.");
            setEnrollmentLoading(false);
            return;
          }
        }
      }

      // Atomic Enrollment with Server-Side Capacity Validation
      const res = await adminApi.enrollStudents({
        subject_id: subject.id,
        student_ids: Array.from(selectedStudents),
        teacher_id: currentTeacherId,
        section: subject.section || null
      });

      if (res.error) {
        throw new Error(res.error.message || res.error);
      }

      const { enrolled_count, skipped_capacity, already_enrolled_count, new_total_enrolled } = res.data || {};

      // Sync student profile section and grade level if missing in profiles
      if (subject.section || subject.grade_level) {
        const normSec = subject.section ? subject.section.trim() : null;
        const normGrade = subject.grade_level ? normalizeGradeLevel(subject.grade_level) : null;

        for (const studentId of selectedStudents) {
          const sRow = (availableStudents || []).find(s => s.id === studentId);
          if (!sRow?.section || !sRow?.grade_level) {
            const pUpd = {};
            if (!sRow?.section && normSec) pUpd.section = normSec;
            if (!sRow?.grade_level && normGrade) pUpd.year_level = normGrade;
            if (Object.keys(pUpd).length > 0) {
              await adminApi.db("profiles", "update", {
                payload: pUpd,
                eq: { column: "id", value: studentId }
              });
            }
          }
        }
      }

      // Log activity
      logActivity({
        actionType: "enrolled_students_in_subject",
        entityType: "subject",
        entityId: subject.id,
        entityName: `${subject.code} - ${subject.name}`,
        details: { 
          studentCount: selectedStudents.size,
          newTotal: new_total_enrolled ?? ((subject.enrolled || 0) + (enrolled_count || selectedStudents.size))
        },
        timestamp: new Date().toISOString()
      });

      // Refresh data
      await Promise.allSettled([fetchSubjects()]);

      setShowEnrollModal(false);
      setSelectedSubjectForEnroll(null);
      setSelectedStudents(new Set());
      toast.success(`Successfully enrolled ${selectedStudents.size} student(s) in the subject.`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unable to enroll students.";
      toast.error(errMsg);
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const handleToggleStudentSelection = (studentId) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  const handleSelectAllStudents = (filteredStudents) => {
    const allSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudents.has(s.id));
    const newSelection = new Set(selectedStudents);
    if (allSelected) {
      filteredStudents.forEach((s) => newSelection.delete(s.id));
    } else {
      filteredStudents.forEach((s) => newSelection.add(s.id));
    }
    setSelectedStudents(newSelection);
  };

  const handleConfirmDelete = async () => {
    if (!subjectToDelete) return;

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setErrorMessage("");

    const deletingSubject = subjectToDelete;
    setIsSubmitting(true);

    try {
      const tableName = await getSubjectTableName();
      const { data: deletedRow, error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", deletingSubject.id)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!deletedRow?.id) {
        throw new Error("Delete was not applied in the database. Check row-level permissions or whether the subject still exists.");
      }

      setShowDeleteConfirm(false);
      setSubjectToDelete(null);
      setSubjects((current) => current.filter((item) => item.id !== deletingSubject.id));

      await refreshTeacherSubjectsFromDatabase([deletingSubject.teacher_id]);
      await Promise.allSettled([fetchTeachers(), fetchSubjects()]);

      logActivity({
        actionType: "deleted",
        entityType: "subject",
        entityId: deletingSubject.id,
        entityName: `${deletingSubject.code} - ${deletingSubject.name}`,
        details: { teacher: getTeacherNameById(deletingSubject.teacher_id) },
        timestamp: new Date().toISOString()
      });

      if (deletingSubject.teacher_id) {
        logActivity({
          actionType: "removed_subject_from_teacher",
          entityType: "subject",
          entityId: deletingSubject.id,
          entityName: `${deletingSubject.code} - ${deletingSubject.name}`,
          details: { teacher: getTeacherNameById(deletingSubject.teacher_id) },
          timestamp: new Date().toISOString()
        });
      }

      toast.success("Subject deleted successfully.");
    } catch (error) {
      const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const errorMessage = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : (error instanceof Error ? error.message : "Unable to delete subject.");
      toast.error(errorMessage);

      if (errorCode === "23503") {
        setErrorMessage("This subject cannot be deleted because it is referenced by other records. Remove dependent records first, then try again.");
      } else {
        setErrorMessage(errorMessage || "Unable to delete subject.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setSubjectFormData(emptyForm);
    setFormErrors({});
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedSubject(null);
    setEditFormData(emptyForm);
    setEditFormErrors({});
  };

  const handleExportToCSV = () => {
    const headers = ["Subject Code", "Name", "Description", "Credits", "Teacher", "Grade Level", "Section", "Capacity", "Enrolled"];
    const rows = filteredSubjects.map((subject) => [
      subject.code,
      subject.name,
      subject.description || "",
      String(subject.credits),
      getTeacherNameById(subject.teacher_id),
      subject.grade_level || "No grade assigned",
      subject.section || "No section assigned",
      String(subject.capacity),
      String(subject.enrolled)
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `subjects_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 h-screen overflow-y-auto lg:pl-64">
        <div className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-end gap-4">
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))}
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div data-tour="subjects-header" className="relative rounded-2xl p-8 text-gray-900 shadow-lg overflow-hidden bg-white border border-gray-200">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-green-600">Subject Management</h1>
                <p className="text-gray-600">{subjects.length} subjects available</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                <button data-tour="subjects-add-btn" onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-lg shadow-blue-600/20 shadow-sm cursor-pointer">
                  <Plus className="w-5 h-5" />
                  Add Subject
                </button>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">Total Subjects</p>
              <p className="text-3xl font-bold text-gray-900">{subjects.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">Total Enrolled</p>
              <p className="text-3xl font-bold text-blue-400">{subjects.reduce((sum, s) => sum + Number(s.enrolled || 0), 0)}</p>
            </div>
          </div>

          <div data-tour="subjects-list" className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div data-tour="subjects-search" className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  type="text"
                  placeholder="Search by name, code, or teacher..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500/50"
                />
              </div>
              {selectedSubjectIds.size > 0 && (
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors border border-red-600 font-semibold shadow-sm w-full md:w-auto justify-center disabled:opacity-50"
                >
                  {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isBulkDeleting ? "Deleting..." : `Delete Selected (${selectedSubjectIds.size})`}
                </button>
              )}
              <button onClick={handleExportToCSV} className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-900 rounded-xl hover:bg-white/20 transition-colors border border-gray-200">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 mt-2 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm w-fit">
            <button
              onClick={handleSelectAllSubjects}
              className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors"
              id="selectAllSubjects"
            >
              {filteredSubjects.length > 0 && selectedSubjectIds.size === filteredSubjects.length ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
            </button>
            <label htmlFor="selectAllSubjects" className="text-sm font-medium text-gray-700 cursor-pointer select-none" onClick={handleSelectAllSubjects}>
              Select All Subjects
            </label>
          </div>

          {filteredSubjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600">No subjects found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredSubjects.map((subject) => (
                <div key={subject.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-green-300 transition-colors overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500/10 to-teal-500/10 p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleSubjectSelection(subject.id)}
                          className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors"
                        >
                          {selectedSubjectIds.has(subject.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                        </button>
                        <div>
                          <p className="text-sm text-green-600 font-medium">{subject.code}</p>
                          <h3 className="text-lg font-bold text-gray-900 mt-1">{subject.name}</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-gray-600 text-sm">{subject.description || "No description provided"}</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-green-600/70" /><span className="text-gray-700">{getTeacherNameById(subject.teacher_id)}</span></div>
                      <div className="flex items-center gap-2 text-sm"><BookOpen className="w-4 h-4 text-green-600/70" /><span className="text-gray-700">{subject.grade_level || "No grade assigned"} {subject.section ? ` - ${subject.section}` : ""}</span></div>
                    </div>
                      <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-500">Enrollment</p>
                          <div className={`flex items-center gap-1.5 ml-2`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getCapacityStatus(subject.enrolled, subject.capacity).dot}`}></span>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${getCapacityStatus(subject.enrolled, subject.capacity).color}`}>{getCapacityStatus(subject.enrolled, subject.capacity).label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${getCapacityStatus(subject.enrolled, subject.capacity).color}`}>{subject.enrolled}/{subject.capacity}</p>
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full ${getCapacityStatus(subject.enrolled, subject.capacity).bar}`} style={{ width: `${subject.capacity > 0 ? (subject.enrolled / subject.capacity) * 100 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                      <div data-tour="subjects-actions" className="flex items-center gap-1.5">
                        <button onClick={() => handleViewSubject(subject)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4 text-gray-600" /></button>
                        <button onClick={() => handleOpenEnrollModal(subject)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Enroll Students"><UserPlus className="w-4 h-4 text-blue-600" /></button>
                        <button onClick={() => handleEditSubject(subject)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit"><Edit className="w-4 h-4 text-green-600" /></button>
                        <button onClick={() => handleDeleteSubject(subject)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4 text-red-500" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Add New Subject</h3>
              <button onClick={handleCloseAddModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddSubject}>
                {formErrors.form && <p className="text-red-600 text-sm mb-3">{formErrors.form}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                    <input type="text" placeholder="e.g., CS101" value={subjectFormData.code} onChange={(e) => setSubjectFormData({ ...subjectFormData, code: normalizeCode(e.target.value) })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.code ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.code && <p className="text-red-500 text-sm mt-1">{formErrors.code}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                    <input type="text" placeholder="e.g., Computer Science Fundamentals" value={subjectFormData.name} onChange={(e) => setSubjectFormData({ ...subjectFormData, name: e.target.value })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.name && <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                    <textarea rows={3} placeholder="Brief description of the subject" value={subjectFormData.description} onChange={(e) => setSubjectFormData({ ...subjectFormData, description: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Category</label>
                    <CustomSelect
                      value={subjectFormData.subject_category}
                      onChange={(value) => setSubjectFormData({ ...subjectFormData, subject_category: value })}
                      options={DEPED_SUBJECT_CATEGORIES.map((category) => ({ value: category, label: category }))}
                      placeholder="Select category"
                      className="w-full"
                    />
                    {formErrors.subject_category && <p className="text-red-500 text-sm mt-1">{formErrors.subject_category}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                    <CustomSelect
                      value={subjectFormData.grade_level}
                      onChange={(value) => setSubjectFormData({ ...subjectFormData, grade_level: value, section: "" })}
                      options={[
                        { value: "Grade 7", label: "Grade 7" },
                        { value: "Grade 8", label: "Grade 8" },
                        { value: "Grade 9", label: "Grade 9" },
                        { value: "Grade 10", label: "Grade 10" },
                      ]}
                      placeholder="Select grade"
                      className="w-full"
                    />
                    {formErrors.grade_level && <p className="text-red-500 text-sm mt-1">{formErrors.grade_level}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <SectionDropdown
                      value={subjectFormData.section}
                      onChange={(value) => setSubjectFormData({ ...subjectFormData, section: value })}
                      gradeLevel={subjectFormData.grade_level}
                      className="w-full"
                    />
                    {formErrors.section && <p className="text-red-500 text-sm mt-1">{formErrors.section}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input type="text" inputMode="numeric" placeholder="e.g., 30" value={subjectFormData.capacity} onChange={(e) => setSubjectFormData({ ...subjectFormData, capacity: normalizePositiveInteger(e.target.value) })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.capacity ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.capacity && <p className="text-red-500 text-sm mt-1">{formErrors.capacity}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                  <button onClick={handleCloseAddModal} type="button" className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? "Adding..." : "Add Subject"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Edit Subject</h3>
              <button onClick={handleCloseEditModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateSubject}>
                {editFormErrors.form && <p className="text-red-600 text-sm mb-3">{editFormErrors.form}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                    <input type="text" value={editFormData.code} onChange={(e) => setEditFormData({ ...editFormData, code: normalizeCode(e.target.value) })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.code ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {editFormErrors.code && <p className="text-red-500 text-sm mt-1">{editFormErrors.code}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                    <input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {editFormErrors.name && <p className="text-red-500 text-sm mt-1">{editFormErrors.name}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                    <textarea rows={3} value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Category</label>
                    <CustomSelect
                      value={editFormData.subject_category}
                      onChange={(value) => setEditFormData({ ...editFormData, subject_category: value })}
                      options={DEPED_SUBJECT_CATEGORIES.map((category) => ({ value: category, label: category }))}
                      placeholder="Select category"
                      className="w-full"
                    />
                    {editFormErrors.subject_category && <p className="text-red-500 text-sm mt-1">{editFormErrors.subject_category}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                    <CustomSelect
                      value={editFormData.grade_level}
                      onChange={(value) => setEditFormData({ ...editFormData, grade_level: value, section: "" })}
                      options={[
                        { value: "Grade 7", label: "Grade 7" },
                        { value: "Grade 8", label: "Grade 8" },
                        { value: "Grade 9", label: "Grade 9" },
                        { value: "Grade 10", label: "Grade 10" },
                      ]}
                      placeholder="Select grade"
                      className="w-full"
                    />
                    {editFormErrors.grade_level && <p className="text-red-500 text-sm mt-1">{editFormErrors.grade_level}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <SectionDropdown
                      value={editFormData.section}
                      onChange={(value) => setEditFormData({ ...editFormData, section: value })}
                      gradeLevel={editFormData.grade_level}
                      className="w-full"
                    />
                    {editFormErrors.section && <p className="text-red-500 text-sm mt-1">{editFormErrors.section}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input type="text" inputMode="numeric" value={editFormData.capacity} onChange={(e) => setEditFormData({ ...editFormData, capacity: normalizePositiveInteger(e.target.value) })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.capacity ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {editFormErrors.capacity && <p className="text-red-500 text-sm mt-1">{editFormErrors.capacity}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                  <button onClick={handleCloseEditModal} type="button" className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? "Updating..." : "Update Subject"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedSubject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Subject Details</h3>
              <button onClick={() => setShowViewModal(false)} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-6 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium mb-1">{selectedSubject.code}</p>
                    <h4 className="text-2xl font-bold text-gray-900">{selectedSubject.name}</h4>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Teacher</label>
                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-green-600" /><p className="text-gray-900">{getTeacherNameById(selectedSubject.teacher_id)}</p></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Grade Level</label>
                    <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-green-600" /><p className="text-gray-900">{selectedSubject.grade_level || "No grade assigned"}</p></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Subject Category</label>
                    <div className="flex items-center gap-2"><Award className="w-4 h-4 text-green-600" /><p className="text-gray-900">{selectedSubject.subject_category || normalizeSubjectCategory("", selectedSubject.name || selectedSubject.code || "")}</p></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Capacity</label>
                    <div className="flex items-center gap-2"><Users className="w-4 h-4 text-green-600" /><p className="text-gray-900">{selectedSubject.capacity} students</p></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Currently Enrolled</label>
                    <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-green-600" /><p className="text-gray-900">{selectedSubject.enrolled} students</p></div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Description</label>
                  <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">{selectedSubject.description || "No description provided"}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Enrollment Progress</label>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-600">Available Slots:</span>
                        <span className="font-medium text-gray-900">{Math.max(0, selectedSubject.capacity - selectedSubject.enrolled)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getCapacityStatus(selectedSubject.enrolled, selectedSubject.capacity).dot}`}></span>
                        <span className={`font-bold ${getCapacityStatus(selectedSubject.enrolled, selectedSubject.capacity).color}`}>{getCapacityStatus(selectedSubject.enrolled, selectedSubject.capacity).label}</span>
                        <span className="text-gray-500 ml-1">({selectedSubject.enrolled} / {selectedSubject.capacity})</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all ${getCapacityStatus(selectedSubject.enrolled, selectedSubject.capacity).bar}`} style={{ width: `${selectedSubject.capacity > 0 ? (selectedSubject.enrolled / selectedSubject.capacity) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-150">
                <button onClick={() => setShowViewModal(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">Close</button>
                <button onClick={() => { setShowViewModal(false); handleEditSubject(selectedSubject); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-sm"><Edit className="w-4 h-4" />Edit Subject</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDeleteSubjects}
        title="Delete Selected Subjects"
        description={`Are you sure you want to delete ${selectedSubjectIds.size} selected subject(s)? This action cannot be undone.`}
        confirmText={isBulkDeleting ? "Deleting..." : "Delete All Selected"}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSubjectToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Subject"
        description={`Are you sure you want to delete ${subjectToDelete?.code} - ${subjectToDelete?.name}? This action cannot be undone.`}
        confirmText={isSubmitting ? "Deleting..." : "Delete"}
        variant="danger"
      />

      {showEnrollModal && selectedSubjectForEnroll && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Enroll Students</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedSubjectForEnroll.code} - {selectedSubjectForEnroll.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowEnrollModal(false);
                  setSelectedSubjectForEnroll(null);
                  setSelectedStudents(new Set());
                }}
                type="button"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {enrollmentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="flex gap-1.5 justify-center mb-4">
                      <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <p className="text-gray-500">Loading available students...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search Students</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={enrollmentSearchQuery}
                        onChange={(e) => setEnrollmentSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {(() => {
                    const filteredList = availableStudents.filter((student) => {
                      const search = enrollmentSearchQuery.toLowerCase();
                      return (
                        student.name.toLowerCase().includes(search) ||
                        student.email.toLowerCase().includes(search)
                      );
                    });
                    const allFilteredSelected = filteredList.length > 0 && filteredList.every((s) => selectedStudents.has(s.id));

                    return (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {filteredList.length > 0 && (
                              <input
                                type="checkbox"
                                id="selectAllEnrollmentStudents"
                                checked={allFilteredSelected}
                                onChange={() => handleSelectAllStudents(filteredList)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                              />
                            )}
                            <label htmlFor="selectAllEnrollmentStudents" className="block text-sm font-medium text-gray-700 cursor-pointer">
                              Available Students ({filteredList.length})
                            </label>
                          </div>
                          <span className="text-sm text-gray-500">{selectedStudents.size} selected</span>
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg divide-y max-h-96 overflow-y-auto">
                          {filteredList.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                              {availableStudents.length === 0 
                                ? "All eligible students are already enrolled in this subject."
                                : "No students match your search."}
                            </div>
                          ) : (
                            filteredList.map((student) => (
                              <label
                                key={student.id}
                                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedStudents.has(student.id)}
                                  onChange={() => handleToggleStudentSelection(student.id)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{student.name}</p>
                                  <p className="text-sm text-gray-500">{student.email}</p>
                                </div>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className={`border rounded-lg p-3 text-sm mb-4 ${selectedSubjectForEnroll.capacity > 0 && selectedSubjectForEnroll.enrolled + selectedStudents.size > selectedSubjectForEnroll.capacity ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">Enrollment Status</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${getCapacityStatus(selectedSubjectForEnroll.enrolled + selectedStudents.size, selectedSubjectForEnroll.capacity).dot}`}></span>
                        <p className={`font-bold ${getCapacityStatus(selectedSubjectForEnroll.enrolled + selectedStudents.size, selectedSubjectForEnroll.capacity).color}`}>{getCapacityStatus(selectedSubjectForEnroll.enrolled + selectedStudents.size, selectedSubjectForEnroll.capacity).label}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p>
                        Current: {selectedSubjectForEnroll.enrolled}/{selectedSubjectForEnroll.capacity} students
                        {selectedStudents.size > 0 && (
                          <span className="ml-2 font-semibold">
                            → After enrollment: {selectedSubjectForEnroll.enrolled + selectedStudents.size}/{selectedSubjectForEnroll.capacity}
                          </span>
                        )}
                      </p>
                      <p>
                        Available Slots: {Math.max(0, selectedSubjectForEnroll.capacity - (selectedSubjectForEnroll.enrolled + selectedStudents.size))}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-5 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setShowEnrollModal(false);
                        setSelectedSubjectForEnroll(null);
                        setSelectedStudents(new Set());
                      }}
                      type="button"
                      className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
                      disabled={enrollmentLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEnrollStudents}
                      type="button"
                      className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                      disabled={enrollmentLoading || selectedStudents.size === 0}
                    >
                      {enrollmentLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {enrollmentLoading ? "Enrolling..." : `Enroll ${selectedStudents.size} Student${selectedStudents.size !== 1 ? "s" : ""}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { SubjectManagement };
