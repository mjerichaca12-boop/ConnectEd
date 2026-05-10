import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { supabase } from "../../lib/supabaseClient";
import { useActivity } from "../../lib/ActivityContext";
import { Search, Plus, Eye, Edit, Trash2, Download, Clock, User, X, BookOpen, Users, AlertTriangle, Award, Loader2, UserPlus } from "lucide-react";

const emptyForm = {
  code: "",
  name: "",
  description: "",
  credits: "",
  teacher: "",
  section: "",
  schedule: "",
  capacity: ""
};

const subjectSelectColumns = "id, code, name, description, credits, teacher_id, section, schedule, capacity, enrolled, created_at, updated_at";
const subjectTableCandidates = ["subjects"];

function SubjectManagement() {
  const navigate = useNavigate();
  const { logActivity } = useActivity();

  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
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
  const [successMessage, setSuccessMessage] = useState("");
  const resolveSubjectTable = async () => {
    if (!supabase) throw new Error("Supabase client is not configured.");

    for (const tableName of subjectTableCandidates) {
      const { error } = await supabase.from(tableName).select("id", { count: "exact", head: true });

      if (!error) {
        setSubjectTable(tableName);
        return tableName;
      }
    }

    throw new Error("Could not find the table 'public.subjects' in the schema cache.");
  };

  const getSubjectTableName = async () => {
    if (subjectTable) {
      const { error } = await supabase.from(subjectTable).select("id", { count: "exact", head: true });
      if (!error) return subjectTable;
    }

    return resolveSubjectTable();
  };


  const normalizePositiveInteger = (value) => value.replace(/\D/g, "");
  const normalizeCode = (value) => value.toUpperCase().replace(/\s+/g, "");
  const isValidSection = (value) => /^[A-Za-z0-9][A-Za-z0-9\s./-]*$/.test(value);

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
    credits: Number(subjectRow.credits ?? 0),
    capacity: Number(subjectRow.capacity ?? 0),
    enrolled: Number(subjectRow.enrolled ?? 0),
    section: String(subjectRow.section || "").trim(),
    teacher_id: subjectRow.teacher_id ?? null
  });

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

    setSubjects((data ?? []).map(formatSubject));
  };

  const fetchAvailableStudents = async (subjectId) => {
    if (!supabase) throw new Error("Supabase client is not configured.");

    // Get all students
    const { data: allStudents, error: studentsError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, email, role")
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

    // Filter out already enrolled students
    const available = (allStudents ?? [])
      .filter((student) => !enrolledStudentIds.has(student.id))
      .map((student) => ({
        id: student.id,
        name: [student.first_name, student.middle_name, student.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || student.email || "Unknown",
        email: student.email || ""
      }));

    setAvailableStudents(available);
  };

  const formatStudentName = (studentRow) => {
    const parts = [studentRow.first_name, studentRow.middle_name, studentRow.last_name].filter(Boolean);
    const combined = parts.join(" ").trim();
    return combined || studentRow.email || "Unknown student";
  };

  const refreshTeacherSubjectsFromDatabase = async (teacherIds) => {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const uniqueTeacherIds = [...new Set((teacherIds || []).map((value) => String(value).trim()).filter(Boolean))];
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

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ subjects: assignedSubjectIds })
        .eq("id", teacherId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }));
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
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

        await resolveSubjectTable();
        await Promise.all([fetchTeachers(), fetchSubjects()]);
        setErrorMessage("");
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load subjects.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    const subjectChannel = supabase
      ? supabase
          .channel("admin-subject-table")
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
          .channel("admin-subject-teachers")
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
  }, [navigate]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const validateSubjectForm = async (formData, excludeId = null, setErrors = setFormErrors) => {
    const errors = {};

    const code = normalizeCode(formData.code || "").trim();
    const name = (formData.name || "").trim();
    const description = (formData.description || "").trim();
    const credits = normalizePositiveInteger(String(formData.credits || ""));
    const teacherId = (formData.teacher || "").trim();
    const section = (formData.section || "").trim();
    const schedule = (formData.schedule || "").trim();
    const capacity = normalizePositiveInteger(String(formData.capacity || ""));

    if (!code) {
      errors.code = "Subject code is required";
    } else if (!/^[A-Za-z0-9]+$/.test(code)) {
      errors.code = "Subject code must be alphanumeric only";
    }

    if (!name) {
      errors.name = "Subject name is required";
    }

    if (!credits) {
      errors.credits = "Credits are required";
    }

    if (!teacherId) {
      errors.teacher = "Teacher is required";
    } else if (!teachers.some((item) => item.id === teacherId)) {
      errors.teacher = "Selected teacher is invalid";
    }

    if (!section) {
      errors.section = "Section/Class is required";
    } else if (!isValidSection(section)) {
      errors.section = "Section/Class is invalid";
    }

    if (!schedule) {
      errors.schedule = "Schedule is required";
    }

    if (!capacity) {
      errors.capacity = "Capacity is required";
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
    credits: Number(normalizePositiveInteger(String(formData.credits || ""))),
    teacher_id: (formData.teacher || "").trim(),
    section: (formData.section || "").trim(),
    schedule: (formData.schedule || "").trim(),
    capacity: Number(normalizePositiveInteger(String(formData.capacity || "")))
  });

  const handleAddSubject = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

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
      const { data, error } = await supabase.from(tableName).insert(payload).select(subjectSelectColumns).single();

      if (error) throw error;

      const next = formatSubject(data);
      await refreshTeacherSubjectsFromDatabase([next.teacher_id]);
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
      setSuccessMessage("Subject added successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add subject.");
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
      section: String(subject.section || ""),
      schedule: String(subject.schedule || ""),
      capacity: String(subject.capacity || "")
    });
    setShowEditModal(true);
  };

  const handleUpdateSubject = async (event) => {
    event.preventDefault();
    if (!selectedSubject) return;

    setErrorMessage("");
    setSuccessMessage("");

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
      const { error } = await supabase
        .from(tableName)
        .update(payload)
        .eq("id", selectedSubject.id)
        .select("id");

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
      setSuccessMessage("Subject updated successfully.");
    } catch (error) {
      setErrorMessage(error?.message || (error instanceof Error ? error.message : "Unable to update subject."));
    } finally {
      setIsSubmitting(false);
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
    setSuccessMessage("");

    try {
      const subject = selectedSubjectForEnroll;
      const currentTeacherId = subject.teacher_id;

      // Get current enrollment count
      const { count: currentEnrollment, error: countError } = await supabase
        .from("teacher_student_assignments")
        .select("*", { count: "exact" })
        .eq("subject_id", subject.id);

      if (countError) throw countError;

      const newEnrollmentCount = (currentEnrollment ?? 0) + selectedStudents.size;
      
      // Check capacity
      if (newEnrollmentCount > subject.capacity) {
        setErrorMessage(
          `Cannot enroll ${selectedStudents.size} students. Subject capacity is ${subject.capacity} and ${currentEnrollment ?? 0} are already enrolled. ` +
          `Only ${subject.capacity - (currentEnrollment ?? 0)} more students can be added.`
        );
        setEnrollmentLoading(false);
        return;
      }

      // Prepare enrollment records
      const enrollmentRecords = Array.from(selectedStudents).map((studentId) => ({
        teacher_id: currentTeacherId,
        student_id: studentId,
        subject_id: subject.id,
        section: subject.section,
        status: "Active"
      }));

      // Insert enrollment records
      const { error: insertError } = await supabase
        .from("teacher_student_assignments")
        .insert(enrollmentRecords);

      if (insertError) throw insertError;

      // Update the subject's enrolled count
      const { error: updateError } = await supabase
        .from("subjects")
        .update({ enrolled: newEnrollmentCount })
        .eq("id", subject.id);

      if (updateError) throw updateError;

      // Log activity
      logActivity({
        actionType: "enrolled_students_in_subject",
        entityType: "subject",
        entityId: subject.id,
        entityName: `${subject.code} - ${subject.name}`,
        details: { 
          studentCount: selectedStudents.size,
          newTotal: newEnrollmentCount
        },
        timestamp: new Date().toISOString()
      });

      // Refresh data
      await Promise.allSettled([fetchSubjects()]);

      setShowEnrollModal(false);
      setSelectedSubjectForEnroll(null);
      setSelectedStudents(new Set());
      setSuccessMessage(`Successfully enrolled ${selectedStudents.size} student(s) in the subject.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to enroll students.");
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

  const handleConfirmDelete = async () => {
    if (!subjectToDelete) return;

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

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

      setSuccessMessage("Subject deleted successfully.");
    } catch (error) {
      const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const errorMessage = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : (error instanceof Error ? error.message : "Unable to delete subject.");

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
    const headers = ["Subject Code", "Name", "Description", "Credits", "Teacher", "Section", "Schedule", "Capacity", "Enrolled"];
    const rows = filteredSubjects.map((subject) => [
      subject.code,
      subject.name,
      subject.description || "",
      String(subject.credits),
      getTeacherNameById(subject.teacher_id),
      subject.section || "No section assigned",
      subject.schedule,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-gray-500">Loading subject management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10 lg:pl-64">
        <div className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-gray-900">Subject Management</h2>
              </div>
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))}
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="relative rounded-2xl p-8 text-gray-900 shadow-lg overflow-hidden bg-white border border-gray-200">
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
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-gray-900 rounded-xl hover:bg-green-500 transition-colors font-semibold shadow-lg shadow-green-500/20">
                <Plus className="w-5 h-5" />
                Add Subject
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-200">
              {successMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">Total Subjects</p>
              <p className="text-3xl font-bold text-gray-900">{subjects.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">Total Credits</p>
              <p className="text-3xl font-bold text-green-600">{subjects.reduce((sum, s) => sum + Number(s.credits || 0), 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">Total Enrolled</p>
              <p className="text-3xl font-bold text-blue-400">{subjects.reduce((sum, s) => sum + Number(s.enrolled || 0), 0)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  type="text"
                  placeholder="Search by name, code, or teacher..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500/50"
                />
              </div>
              <button onClick={handleExportToCSV} className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-900 rounded-xl hover:bg-white/20 transition-colors border border-gray-200">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
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
                      <div>
                        <p className="text-sm text-green-600 font-medium">{subject.code}</p>
                        <h3 className="text-lg font-bold text-gray-900 mt-1">{subject.name}</h3>
                      </div>
                      <div className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full">
                        <p className="text-sm font-medium text-gray-700">{subject.credits} Credits</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-gray-600 text-sm">{subject.description || "No description provided"}</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-green-600/70" /><span className="text-gray-700">{getTeacherNameById(subject.teacher_id)}</span></div>
                      <div className="flex items-center gap-2 text-sm"><BookOpen className="w-4 h-4 text-green-600/70" /><span className="text-gray-700">{subject.section || "No section assigned"}</span></div>
                      <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-green-600/70" /><span className="text-gray-700">{subject.schedule}</span></div>
                    </div>
                      <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Enrollment</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-green-600">{subject.enrolled}/{subject.capacity}</p>
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${subject.capacity > 0 ? (subject.enrolled / subject.capacity) * 100 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
                    <input type="text" inputMode="numeric" placeholder="e.g., 3" value={subjectFormData.credits} onChange={(e) => setSubjectFormData({ ...subjectFormData, credits: normalizePositiveInteger(e.target.value) })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.credits ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.credits && <p className="text-red-500 text-sm mt-1">{formErrors.credits}</p>}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                    <select value={subjectFormData.teacher} onChange={(e) => setSubjectFormData({ ...subjectFormData, teacher: e.target.value })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.teacher ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}>
                      <option value="">Select teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                      ))}
                    </select>
                    {formErrors.teacher && <p className="text-red-500 text-sm mt-1">{formErrors.teacher}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section/Class</label>
                    <input type="text" placeholder="e.g., Grade 10 - Section A" value={subjectFormData.section} onChange={(e) => setSubjectFormData({ ...subjectFormData, section: e.target.value })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.section ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.section && <p className="text-red-500 text-sm mt-1">{formErrors.section}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input type="text" inputMode="numeric" placeholder="e.g., 30" value={subjectFormData.capacity} onChange={(e) => setSubjectFormData({ ...subjectFormData, capacity: normalizePositiveInteger(e.target.value) })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.capacity ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.capacity && <p className="text-red-500 text-sm mt-1">{formErrors.capacity}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                    <input type="text" placeholder="e.g., MWF 8:00-9:00 AM" value={subjectFormData.schedule} onChange={(e) => setSubjectFormData({ ...subjectFormData, schedule: e.target.value })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.schedule ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.schedule && <p className="text-red-500 text-sm mt-1">{formErrors.schedule}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={handleCloseAddModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2" disabled={isSubmitting}>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
                    <input type="text" inputMode="numeric" value={editFormData.credits} onChange={(e) => setEditFormData({ ...editFormData, credits: normalizePositiveInteger(e.target.value) })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.credits ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {editFormErrors.credits && <p className="text-red-500 text-sm mt-1">{editFormErrors.credits}</p>}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                    <select value={editFormData.teacher} onChange={(e) => setEditFormData({ ...editFormData, teacher: e.target.value })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.teacher ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}>
                      <option value="">Select teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                      ))}
                    </select>
                    {editFormErrors.teacher && <p className="text-red-500 text-sm mt-1">{editFormErrors.teacher}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section/Class</label>
                    <input type="text" value={editFormData.section} onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.section ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {editFormErrors.section && <p className="text-red-500 text-sm mt-1">{editFormErrors.section}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input type="text" inputMode="numeric" value={editFormData.capacity} onChange={(e) => setEditFormData({ ...editFormData, capacity: normalizePositiveInteger(e.target.value) })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.capacity ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {editFormErrors.capacity && <p className="text-red-500 text-sm mt-1">{editFormErrors.capacity}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                    <input type="text" value={editFormData.schedule} onChange={(e) => setEditFormData({ ...editFormData, schedule: e.target.value })} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.schedule ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {editFormErrors.schedule && <p className="text-red-500 text-sm mt-1">{editFormErrors.schedule}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={handleCloseEditModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2" disabled={isSubmitting}>
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
                  <div className="px-4 py-2 bg-white rounded-full">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-gray-900">{selectedSubject.credits} Credits</span>
                    </div>
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
                    <label className="block text-sm font-medium text-gray-500 mb-1">Section/Class</label>
                    <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-green-600" /><p className="text-gray-900">{selectedSubject.section || "No section assigned"}</p></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Schedule</label>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-green-600" /><p className="text-gray-900">{selectedSubject.schedule}</p></div>
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
                      <span className="text-gray-600">Available Slots</span>
                      <span className="font-medium text-gray-900">{selectedSubject.capacity - selectedSubject.enrolled} / {selectedSubject.capacity}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-gradient-to-r from-green-600 to-teal-600 h-3 rounded-full transition-all" style={{ width: `${selectedSubject.capacity > 0 ? selectedSubject.enrolled / selectedSubject.capacity * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                <button onClick={() => { setShowViewModal(false); handleEditSubject(selectedSubject); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-colors"><Edit className="w-4 h-4" />Edit Subject</button>
                <button onClick={() => setShowViewModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && subjectToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-md w-full transform border border-gray-200 overflow-hidden">
            <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl border bg-red-50 border-red-200">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Delete Subject</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setSubjectToDelete(null); }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-gray-50">
              <p className="text-gray-700 leading-relaxed">
                Are you sure you want to permanently delete {subjectToDelete.name}? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 rounded-b-2xl border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setSubjectToDelete(null); }}
                className="px-6 py-2.5 text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-6 py-2.5 text-gray-900 rounded-xl transition-all duration-200 font-medium shadow-lg bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Available Students</label>
                      <span className="text-sm text-gray-500">{selectedStudents.size} selected</span>
                    </div>
                    
                    <div className="border border-gray-200 rounded-lg divide-y max-h-96 overflow-y-auto">
                      {availableStudents
                        .filter((student) => {
                          const search = enrollmentSearchQuery.toLowerCase();
                          return (
                            student.name.toLowerCase().includes(search) ||
                            student.email.toLowerCase().includes(search)
                          );
                        })
                        .length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          {availableStudents.length === 0 
                            ? "All students are already enrolled in this subject."
                            : "No students match your search."}
                        </div>
                      ) : (
                        availableStudents
                          .filter((student) => {
                            const search = enrollmentSearchQuery.toLowerCase();
                            return (
                              student.name.toLowerCase().includes(search) ||
                              student.email.toLowerCase().includes(search)
                            );
                          })
                          .map((student) => (
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

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 mb-4">
                    <p className="font-medium mb-1">Enrollment Status</p>
                    <p>
                      Current: {selectedSubjectForEnroll.enrolled}/{selectedSubjectForEnroll.capacity} students
                      {selectedStudents.size > 0 && (
                        <span className="ml-2">
                          → After enrollment: {selectedSubjectForEnroll.enrolled + selectedStudents.size}/{selectedSubjectForEnroll.capacity}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowEnrollModal(false);
                        setSelectedSubjectForEnroll(null);
                        setSelectedStudents(new Set());
                      }}
                      type="button"
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      disabled={enrollmentLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEnrollStudents}
                      type="button"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
