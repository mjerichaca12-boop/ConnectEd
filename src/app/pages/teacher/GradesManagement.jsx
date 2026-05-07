import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { CustomSelect } from "@/app/components/CustomSelect";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { teacherNotifications } from "@/app/components/NotificationDefault";
import { supabase } from "@/app/lib/supabaseClient";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import * as LucideIcons from "lucide-react";
import {
  createDefaultGradeRecord,
  clampGradeValue,
  getGradeRemarks,
  calculateOverallGrade,
  resolveTeacherIdByEmail
} from "@/app/lib/teacherHelpers";
import {
  TrendingUp,
  TrendingDown,
  Save,
  Filter,
  Search,
  CheckCircle,
  Award,
  Target,
  Users,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const ASSIGNMENT_TABLE_CANDIDATES = ["assignments_activity", "class_assignments", "assignments", "teacher_assignments", "class_activities"];
const EmptyStateIcon = LucideIcons.ClipboardList || LucideIcons.BookOpen;

/* ─── pure helpers ────────────────────────────────────────────────── */
const exportToExcel = (studentGrades, className) => {
  const passedStudents = studentGrades.filter((s) => s.overallGrade >= 75);
  const failedStudents = studentGrades.filter((s) => s.overallGrade < 75);

  const rows = [
    ["ConnectEd – Grade Report"],
    [`Class: ${className}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ["Student Name", "LRN", "Quizzes", "Activities", "Assignments", "Midterm", "Final", "Overall Grade", "Remarks"],
    ...studentGrades.map((s) => [
      s.studentName,
      s.studentId,
      s.quizAverage,
      s.activityGrade,
      s.projectGrade,
      s.midtermGrade,
      s.finalGrade,
      s.overallGrade,
      s.remarks,
    ]),
    [],
    [`Passed (≥ 75): ${passedStudents.length}`, "", "", "", "", "", "", "", ""],
    [`Failed (< 75): ${failedStudents.length}`, "", "", "", "", "", "", "", ""],
  ];

  const tsv = rows.map((row) => row.join("\t")).join("\n");
  const blob = new Blob([tsv], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `grades_${className.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const normalizeAssessment = (row) => {
  const assessmentType = String(row?.type || row?.activity_type || row?.task_type || "assignment").trim().toLowerCase();
  const maxPoints = Number(row?.max_points ?? row?.total_points ?? row?.maxPoints ?? 100) || 100;

  return {
    id: String(row?.id || "").trim(),
    title: String(row?.title || row?.name || "Untitled Assessment").trim() || "Untitled Assessment",
    type: assessmentType || "assignment",
    dueDate: String(row?.due_date || row?.dueDate || row?.deadline || "").trim(),
    maxPoints: Math.max(1, maxPoints),
  };
};

const clampAssessmentScore = (value, maxPoints) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "";
  const safeMax = Number(maxPoints) > 0 ? Number(maxPoints) : 100;
  return Math.max(0, Math.min(safeMax, numeric));
};

const normalizeSubmission = (row) => ({
  assessmentId: String(row?.assessment_id || "").trim(),
  studentId: String(row?.student_id || "").trim(),
  responseText: String(row?.response_text || row?.answer_text || row?.response || "").trim(),
  fileUrl: String(row?.file_url || "").trim(),
  fileName: String(row?.file_name || "").trim(),
  filePath: String(row?.file_path || "").trim(),
  submittedAt: row?.submitted_at || row?.updated_at || row?.created_at || null,
});

/* ─── component ──────────────────────────────────────────────────── */
function GradesManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState(teacherNotifications);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentGrades, setStudentGrades] = useState([]);
  const [gradesCache, setGradesCache] = useState({});
  const gradesCacheRef = useRef({});
  const [activeView, setActiveView] = useState("all"); // "all" | "passed" | "failed"
  const [assessmentItems, setAssessmentItems] = useState([]);
  const [assessmentGradesMap, setAssessmentGradesMap] = useState({});
  const [expandedAssessments, setExpandedAssessments] = useState({});
  const [focusedAssessmentId, setFocusedAssessmentId] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [hasViewedSubmission, setHasViewedSubmission] = useState(false);
  const [assessmentSubmissionsMap, setAssessmentSubmissionsMap] = useState({});
  const [submittedStudentProfiles, setSubmittedStudentProfiles] = useState({});
  const [assessmentStatusMap, setAssessmentStatusMap] = useState({});
  const [autoSaveStateMap, setAutoSaveStateMap] = useState({});
  const [autoSaveMessage, setAutoSaveMessage] = useState("");
  const autoSaveTimersRef = useRef({});

  useEffect(() => {
    gradesCacheRef.current = gradesCache;
  }, [gradesCache]);

  const requestedContext = useMemo(() => {
    const query = new URLSearchParams(location.search || "");
    const state = location.state || {};

    return {
      classId: String(state.selectedClassId || query.get("classId") || "").trim(),
      assessmentId: String(state.selectedAssessmentId || query.get("assessmentId") || "").trim(),
    };
  }, [location.search, location.state]);

  /* ─── fetch classes ─────────────────────────────────────────────── */
  const fetchClasses = useCallback(async (id) => {
    if (!supabase || !id) { setClasses([]); return; }
    const { data, error } = await supabase
      .from("subjects")
      .select("id, code, name, section")
      .eq("teacher_id", id)
      .order("code", { ascending: true });
    if (error) { console.error("Failed to load classes:", error); setClasses([]); return; }
    setClasses((data ?? []).map((item) => ({
      id: String(item.id),
      code: String(item.code || "").trim(),
      name: String(item.name || "Untitled Subject").trim(),
      section: String(item.section || "").trim() || "No section assigned",
    })));
  }, []);

  const fetchAssessmentsForClass = useCallback(async (currentTeacherId, classId) => {
    if (!supabase || !currentTeacherId || !classId) { setAssessmentItems([]); return []; }

    let tableName = "";
    for (const t of ASSIGNMENT_TABLE_CANDIDATES) {
      const { error } = await supabase.from(t).select("id", { count: "exact", head: true });
      if (!error) { tableName = t; break; }
    }

    if (!tableName) {
      setAssessmentItems([]);
      return [];
    }

    const { data, error } = await supabase.from(tableName).select("*");
    if (error) {
      console.error("Failed to load assessments:", error);
      setAssessmentItems([]);
      return [];
    }

    const rows = (data ?? []).filter((row) => {
      const rowCourseId = String(row?.course_id || row?.subject_id || row?.class_id || "").trim();
      const rowTeacherId = String(row?.teacher_id || row?.created_by || "").trim();
      const classMatches = !classId || !rowCourseId || rowCourseId === classId;
      const teacherMatches = !rowTeacherId || rowTeacherId === currentTeacherId;
      return classMatches && teacherMatches;
    });

    const mapped = rows
      .map(normalizeAssessment)
      .filter((assessment) => assessment.id)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));

    setAssessmentItems(mapped);
    setExpandedAssessments((prev) => {
      const next = { ...prev };
      mapped.forEach((assessment) => {
        if (typeof next[assessment.id] === "undefined") {
          next[assessment.id] = true;
        }
      });
      return next;
    });
    return mapped;
  }, []);

  const fetchAssessmentGrades = useCallback(async (currentTeacherId, classId, assessments, studentIds) => {
    if (!supabase || !currentTeacherId || !classId || assessments.length === 0 || studentIds.length === 0) {
      setAssessmentGradesMap({});
      setAssessmentStatusMap({});
      return;
    }

    const assessmentIds = assessments.map((item) => item.id);

    let gradeResult = await supabase
      .from("teacher_assessment_grades")
      .select("assessment_id, student_id, grade_value, status, grading_status")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .in("assessment_id", assessmentIds)
      .in("student_id", studentIds);

    if (gradeResult.error) {
      gradeResult = await supabase
        .from("teacher_assessment_grades")
        .select("assessment_id, student_id, grade_value")
        .eq("teacher_id", currentTeacherId)
        .eq("subject_id", classId)
        .in("assessment_id", assessmentIds)
        .in("student_id", studentIds);
    }

    const { data, error } = gradeResult;

    if (error) {
      console.error("Failed to load assessment grades:", error);
      setAssessmentGradesMap({});
      return;
    }

    const assessmentLookup = new Map(assessments.map((item) => [item.id, item]));
    const mapped = {};
    const statusMapped = {};
    (data ?? []).forEach((row) => {
      const assessmentId = String(row.assessment_id || "");
      const studentId = String(row.student_id || "");
      if (!assessmentId || !studentId) return;
      const assessment = assessmentLookup.get(assessmentId);
      const score = clampAssessmentScore(row.grade_value, assessment?.maxPoints ?? 100);
      if (!mapped[assessmentId]) mapped[assessmentId] = {};
      mapped[assessmentId][studentId] = score;

      if (!statusMapped[assessmentId]) statusMapped[assessmentId] = {};
      const rowStatus = String(row.status || row.grading_status || "").trim();
      statusMapped[assessmentId][studentId] = rowStatus || (typeof score === "number" ? "Graded" : "Pending");
    });

    setAssessmentGradesMap(mapped);
    setAssessmentStatusMap(statusMapped);
  }, []);

  const fetchAssessmentSubmissions = useCallback(async (currentTeacherId, classId, assessments, enrolledStudentIds) => {
    if (!supabase || !currentTeacherId || !classId || assessments.length === 0) {
      setAssessmentSubmissionsMap({});
      setSubmittedStudentProfiles({});
      return;
    }

    const assessmentIds = assessments.map((item) => item.id);
    const { data, error } = await supabase
      .from("teacher_assessment_submissions")
      .select("assessment_id, student_id, response_text, answer_text, response, file_url, file_name, file_path, submitted_at, updated_at, created_at")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .in("assessment_id", assessmentIds);

    if (error) {
      console.error("Failed to load assessment submissions:", error);
      setAssessmentSubmissionsMap({});
      setSubmittedStudentProfiles({});
      return;
    }

    const mapped = {};
    const enrolledSet = new Set(enrolledStudentIds.map((id) => String(id || "").trim()).filter(Boolean));
    const submittedOnlyIds = new Set();

    (data ?? []).forEach((row) => {
      const normalized = normalizeSubmission(row);
      if (!normalized.assessmentId || !normalized.studentId) return;

      if (!mapped[normalized.assessmentId]) {
        mapped[normalized.assessmentId] = {};
      }
      mapped[normalized.assessmentId][normalized.studentId] = normalized;

      if (!enrolledSet.has(normalized.studentId)) {
        submittedOnlyIds.add(normalized.studentId);
      }
    });

    setAssessmentSubmissionsMap(mapped);

    if (submittedOnlyIds.size === 0) {
      setSubmittedStudentProfiles({});
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, lrn")
      .eq("role", "student")
      .in("id", [...submittedOnlyIds]);

    if (profileError) {
      console.error("Failed to load submitted student profiles:", profileError);
      setSubmittedStudentProfiles({});
      return;
    }

    const profileMap = {};
    (profileRows ?? []).forEach((row) => {
      const id = String(row.id || "");
      if (!id) return;

      const fullName = [row.first_name, row.middle_name, row.last_name]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim() || "Student";

      profileMap[id] = {
        id,
        studentName: fullName,
        studentId: String(row.lrn || "N/A"),
      };
    });

    setSubmittedStudentProfiles(profileMap);
  }, []);

  /* ─── fetch students + grades ───────────────────────────────────── */
  const fetchStudentsForClass = useCallback(async (currentTeacherId, classId) => {
    if (!supabase || !currentTeacherId || !classId) { setStudentGrades([]); return []; }

    const { data: assignments, error: assignmentError } = await supabase
      .from("teacher_student_assignments")
      .select("student_id")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId);

    if (assignmentError) { console.error("Failed to load class assignments:", assignmentError); setStudentGrades([]); return []; }

    const studentIds = [...new Set((assignments ?? []).map((row) => String(row.student_id || "")).filter(Boolean))];
    if (studentIds.length === 0) { setStudentGrades([]); return []; }

    const { data: studentRows, error: studentError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, lrn")
      .eq("role", "student")
      .in("id", studentIds);

    if (studentError) { console.error("Failed to load students:", studentError); setStudentGrades([]); return []; }

    const { data: gradeRows } = await supabase
      .from("teacher_student_grades")
      .select("student_id, midterm_grade, final_grade, quiz_average, project_grade, activity_grade")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .in("student_id", studentIds);

    const persistedGradeMap = {};
    (gradeRows ?? []).forEach((row) => {
      const id = String(row.student_id || "");
      if (!id) return;
      persistedGradeMap[id] = {
        midtermGrade: clampGradeValue(row.midterm_grade),
        finalGrade: clampGradeValue(row.final_grade),
        quizAverage: clampGradeValue(row.quiz_average),
        projectGrade: clampGradeValue(row.project_grade),
        activityGrade: clampGradeValue(row.activity_grade ?? 0),
      };
    });

    const cacheForClass = gradesCacheRef.current[classId] || {};
    const mapped = (studentRows ?? []).map((student) => {
      const studentId = String(student.id);
      const cached = cacheForClass[studentId] || persistedGradeMap[studentId] || { ...createDefaultGradeRecord(), activityGrade: 0 };
      const studentName = [student.first_name, student.middle_name, student.last_name]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim() || "Student";

      const current = {
        id: studentId,
        studentName,
        studentId: String(student.lrn || "N/A"),
        midtermGrade: clampGradeValue(cached.midtermGrade),
        finalGrade: clampGradeValue(cached.finalGrade),
        quizAverage: clampGradeValue(cached.quizAverage),
        projectGrade: clampGradeValue(cached.projectGrade),
        activityGrade: clampGradeValue(cached.activityGrade ?? 0),
      };

      const overallGrade = calculateOverallGrade(current);
      return { ...current, overallGrade, remarks: getGradeRemarks(overallGrade) };
    });

    setGradesCache((prev) => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), ...persistedGradeMap },
    }));
    setStudentGrades(mapped);
    return studentIds;
  }, []);

  /* ─── init ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) { navigate("/login"); return; }
      const user = JSON.parse(userData);
      if (user.role !== "teacher") { navigate("/login"); return; }
      setTeacherName(user.name);
      const resolvedTeacherId = await resolveTeacherIdByEmail(user.email);
      setTeacherId(resolvedTeacherId);
      await fetchClasses(resolvedTeacherId);
      setLoading(false);
    };
    initialize();
  }, [navigate, fetchClasses]);

  useEffect(() => {
    if (!requestedContext.classId) return;
    if (!classes.some((item) => item.id === requestedContext.classId)) return;

    setSelectedClass(requestedContext.classId);
    setActiveView("all");
    if (requestedContext.assessmentId) {
      setFocusedAssessmentId(requestedContext.assessmentId);
    }
  }, [classes, requestedContext.classId, requestedContext.assessmentId]);

  useEffect(() => {
    if (!focusedAssessmentId || !selectedClass) return;

    const target = document.getElementById(`assessment-item-${focusedAssessmentId}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedAssessmentId, selectedClass, assessmentItems.length]);

  useEffect(() => {
    if (assessmentItems.length === 0) {
      setSelectedAssessmentId("");
      setSelectedStudentId("");
      setHasViewedSubmission(false);
      return;
    }

    const hasSelected = assessmentItems.some((item) => item.id === selectedAssessmentId);
    if (hasSelected) return;

    const preferred = focusedAssessmentId && assessmentItems.some((item) => item.id === focusedAssessmentId)
      ? focusedAssessmentId
      : assessmentItems[0].id;

    setSelectedAssessmentId(preferred);
    setSelectedStudentId("");
    setHasViewedSubmission(false);
  }, [assessmentItems, selectedAssessmentId, focusedAssessmentId]);

  useEffect(() => {
    if (!teacherId || !selectedClass) {
      setStudentGrades([]);
      setAssessmentItems([]);
      setAssessmentGradesMap({});
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      const studentIds = await fetchStudentsForClass(teacherId, selectedClass);
      if (!isMounted) return;

      const assessments = await fetchAssessmentsForClass(teacherId, selectedClass);
      if (!isMounted) return;

      if (requestedContext.assessmentId) {
        const hasTarget = assessments.some((item) => item.id === requestedContext.assessmentId);
        if (hasTarget) {
          setExpandedAssessments((prev) => ({ ...prev, [requestedContext.assessmentId]: true }));
          setFocusedAssessmentId(requestedContext.assessmentId);
        }
      }

      if (assessments.length > 0 && studentIds.length > 0) {
        await fetchAssessmentGrades(teacherId, selectedClass, assessments, studentIds);
      } else {
        setAssessmentGradesMap({});
      }

      await fetchAssessmentSubmissions(teacherId, selectedClass, assessments, studentIds);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [teacherId, selectedClass, fetchStudentsForClass, fetchAssessmentsForClass, fetchAssessmentGrades, fetchAssessmentSubmissions, requestedContext.assessmentId]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = window.setTimeout(() => setSaveSuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  useEffect(() => {
    if (!autoSaveMessage) return;
    const timer = window.setTimeout(() => setAutoSaveMessage(""), 1800);
    return () => window.clearTimeout(timer);
  }, [autoSaveMessage]);

  useEffect(() => {
    return () => {
      Object.values(autoSaveTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      autoSaveTimersRef.current = {};
    };
  }, []);

  /* ─── handlers ──────────────────────────────────────────────────── */
  const handleLogoutClick = () => { localStorage.removeItem("currentUser"); navigate("/login"); };

  const handleGradeChange = (studentId, field, value) => {
    const nextValue = clampGradeValue(value);
    setStudentGrades((prev) => prev.map((student) => {
      if (student.id !== studentId) return student;
      const updated = { ...student, [field]: nextValue };
      const overallGrade = calculateOverallGrade(updated);
      return { ...updated, overallGrade, remarks: getGradeRemarks(overallGrade) };
    }));
    setGradesCache((current) => {
      const classCache = { ...(current[selectedClass] || {}) };
      const existing = classCache[studentId] || { ...createDefaultGradeRecord(), activityGrade: 0 };
      classCache[studentId] = { ...existing, [field]: nextValue };
      return { ...current, [selectedClass]: classCache };
    });
    setHasUnsavedChanges(true);
  };

  const persistAssessmentGrade = useCallback(async (assessmentId, studentId, rawValue) => {
    if (!supabase || !teacherId || !selectedClass) return;

    const assessment = assessmentItems.find((item) => item.id === assessmentId);
    if (!assessment) return;

    const scoreValue = rawValue === "" ? 0 : Number(clampAssessmentScore(rawValue, assessment.maxPoints));
    const statusValue = rawValue === "" ? "Pending" : "Graded";
    const key = `${assessmentId}:${studentId}`;

    setAutoSaveStateMap((prev) => ({ ...prev, [key]: "saving" }));

    const payloadWithStatus = {
      teacher_id: teacherId,
      subject_id: selectedClass,
      assessment_id: assessment.id,
      assessment_title: assessment.title,
      assessment_type: assessment.type,
      max_points: assessment.maxPoints,
      student_id: studentId,
      grade_value: scoreValue,
      status: statusValue,
      updated_at: new Date().toISOString(),
    };

    let result = await supabase
      .from("teacher_assessment_grades")
      .upsert(payloadWithStatus, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });

    if (result.error) {
      const payloadWithoutStatus = {
        ...payloadWithStatus,
      };
      delete payloadWithoutStatus.status;

      result = await supabase
        .from("teacher_assessment_grades")
        .upsert(payloadWithoutStatus, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });
    }

    if (result.error) {
      console.error("Failed to auto-save assessment grade:", result.error);
      setAutoSaveStateMap((prev) => ({ ...prev, [key]: "error" }));
      setAutoSaveMessage("Auto-save failed. Please try again.");
      return;
    }

    setAssessmentStatusMap((prev) => ({
      ...prev,
      [assessmentId]: {
        ...(prev[assessmentId] || {}),
        [studentId]: statusValue,
      },
    }));
    setAutoSaveStateMap((prev) => ({ ...prev, [key]: "saved" }));
    setAutoSaveMessage(`Saved grade for ${assessment.title}.`);

    const clearTimer = autoSaveTimersRef.current[`clear:${key}`];
    if (clearTimer) {
      window.clearTimeout(clearTimer);
    }

    autoSaveTimersRef.current[`clear:${key}`] = window.setTimeout(() => {
      setAutoSaveStateMap((prev) => ({ ...prev, [key]: "idle" }));
      delete autoSaveTimersRef.current[`clear:${key}`];
    }, 1000);
  }, [assessmentItems, selectedClass, supabase, teacherId]);

  const scheduleAssessmentAutoSave = useCallback((assessmentId, studentId, value) => {
    const key = `${assessmentId}:${studentId}`;
    const existingTimer = autoSaveTimersRef.current[key];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    autoSaveTimersRef.current[key] = window.setTimeout(() => {
      persistAssessmentGrade(assessmentId, studentId, value);
    }, 350);
  }, [persistAssessmentGrade]);

  const handleAssessmentGradeChange = (assessmentId, studentId, maxPoints, value) => {
    const nextValue = value === "" ? "" : clampAssessmentScore(value, maxPoints);

    setAssessmentGradesMap((prev) => ({
      ...prev,
      [assessmentId]: {
        ...(prev[assessmentId] || {}),
        [studentId]: nextValue,
      },
    }));

    scheduleAssessmentAutoSave(assessmentId, studentId, nextValue);
  };

  const handleSave = async () => {
    if (!selectedClass || studentGrades.length === 0 || !teacherId || !supabase) return;
    try {
      setSaving(true);
      const payload = studentGrades.map((student) => ({
        teacher_id: teacherId,
        subject_id: selectedClass,
        student_id: student.id,
        midterm_grade: clampGradeValue(student.midtermGrade),
        final_grade: clampGradeValue(student.finalGrade),
        quiz_average: clampGradeValue(student.quizAverage),
        project_grade: clampGradeValue(student.projectGrade),
        activity_grade: clampGradeValue(student.activityGrade ?? 0),
        overall_grade: clampGradeValue(student.overallGrade),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("teacher_student_grades")
        .upsert(payload, { onConflict: "teacher_id,subject_id,student_id" });
      if (error) { console.error("Failed to save grades:", error); return; }

      const assessmentPayload = [];
      assessmentItems.forEach((assessment) => {
        studentGrades.forEach((student) => {
          const rawValue = assessmentGradesMap?.[assessment.id]?.[student.id];
          if (rawValue === "" || typeof rawValue === "undefined") return;

          assessmentPayload.push({
            teacher_id: teacherId,
            subject_id: selectedClass,
            assessment_id: assessment.id,
            assessment_title: assessment.title,
            assessment_type: assessment.type,
            max_points: assessment.maxPoints,
            student_id: student.id,
            grade_value: Number(clampAssessmentScore(rawValue, assessment.maxPoints)),
            status: "Graded",
            updated_at: new Date().toISOString(),
          });
        });
      });

      if (assessmentPayload.length > 0) {
        const { error: assessmentError } = await supabase
          .from("teacher_assessment_grades")
          .upsert(assessmentPayload, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });

        if (assessmentError) {
          console.error("Failed to save assessment grades:", assessmentError);
          return;
        }

        setAssessmentStatusMap((prev) => {
          const next = { ...prev };
          assessmentPayload.forEach((item) => {
            const assessmentId = String(item.assessment_id || "");
            const studentId = String(item.student_id || "");
            if (!assessmentId || !studentId) return;
            if (!next[assessmentId]) next[assessmentId] = {};
            next[assessmentId][studentId] = "Graded";
          });
          return next;
        });

        setAutoSaveStateMap((prev) => {
          const next = { ...prev };
          assessmentPayload.forEach((item) => {
            const key = `${String(item.assessment_id || "")}:${String(item.student_id || "")}`;
            next[key] = "saved";

            const clearTimer = autoSaveTimersRef.current[`clear:${key}`];
            if (clearTimer) {
              window.clearTimeout(clearTimer);
            }

            autoSaveTimersRef.current[`clear:${key}`] = window.setTimeout(() => {
              setAutoSaveStateMap((current) => ({ ...current, [key]: "idle" }));
              delete autoSaveTimersRef.current[`clear:${key}`];
            }, 1000);
          });
          return next;
        });
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Unexpected save error:", error);
    } finally {
      setSaving(false);
    }
  };

  /* ─── derived ───────────────────────────────────────────────────── */
  const selectedClassName = useMemo(() => {
    const classItem = classes.find((item) => item.id === selectedClass);
    if (!classItem) return "";
    return `${classItem.code} - ${classItem.name} (${classItem.section})`;
  }, [classes, selectedClass]);

  const filteredByView = useMemo(() => {
    let base = studentGrades;
    if (activeView === "passed") base = base.filter((s) => s.overallGrade >= 75);
    if (activeView === "failed") base = base.filter((s) => s.overallGrade < 75);
    const search = searchQuery.toLowerCase();
    if (search) base = base.filter((s) => s.studentName.toLowerCase().includes(search) || s.studentId.toLowerCase().includes(search));
    return base;
  }, [studentGrades, activeView, searchQuery]);

  const classAverage = studentGrades.length > 0 ? Math.round(studentGrades.reduce((sum, item) => sum + item.overallGrade, 0) / studentGrades.length) : 0;
  const highestGrade = studentGrades.length > 0 ? Math.max(...studentGrades.map((item) => item.overallGrade)) : 0;
  const lowestGrade = studentGrades.length > 0 ? Math.min(...studentGrades.map((item) => item.overallGrade)) : 0;
  const passingCount = studentGrades.filter((s) => s.overallGrade >= 75).length;
  const failingCount = studentGrades.filter((s) => s.overallGrade < 75).length;
  const passingRate = studentGrades.length > 0 ? Math.round((passingCount / studentGrades.length) * 100) : 0;

  const selectedAssessment = useMemo(
    () => assessmentItems.find((item) => item.id === selectedAssessmentId) || null,
    [assessmentItems, selectedAssessmentId]
  );

  const studentsForSelectedAssessment = useMemo(() => {
    if (!selectedAssessmentId) return [];

    const search = String(searchQuery || "").trim().toLowerCase();
    const submissionsForAssessment = assessmentSubmissionsMap[selectedAssessmentId] || {};
    const submittedStudentIds = Object.keys(submissionsForAssessment);

    const enrolled = studentGrades.map((student) => ({
      id: student.id,
      studentName: student.studentName,
      studentId: student.studentId,
      isSubmitted: Boolean(submissionsForAssessment[student.id]),
    }));

    const enrolledSet = new Set(enrolled.map((student) => student.id));
    const submittedOnly = submittedStudentIds
      .filter((studentId) => !enrolledSet.has(studentId))
      .map((studentId) => {
        const profile = submittedStudentProfiles[studentId];
        return {
          id: studentId,
          studentName: profile?.studentName || "Student",
          studentId: profile?.studentId || "N/A",
          isSubmitted: true,
        };
      });

    const combined = [...enrolled, ...submittedOnly];
    if (!search) return combined;

    return combined.filter((student) => {
      const name = String(student.studentName || "").toLowerCase();
      const lrn = String(student.studentId || "").toLowerCase();
      return name.includes(search) || lrn.includes(search);
    });
  }, [selectedAssessmentId, searchQuery, assessmentSubmissionsMap, studentGrades, submittedStudentProfiles]);

  const selectedStudentSubmission = useMemo(() => {
    if (!selectedAssessmentId || !selectedStudentId) return null;
    return assessmentSubmissionsMap?.[selectedAssessmentId]?.[selectedStudentId] || null;
  }, [selectedAssessmentId, selectedStudentId, assessmentSubmissionsMap]);


  /* ─── render ────────────────────────────────────────────────────── */
  if (loading) return <LoadingScreen message="Loading grades..." />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogoutClick} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-gray-900">Grades Management</h2>
                {hasUnsavedChanges && <span className="text-sm text-amber-400 font-medium animate-pulse">● Unsaved changes</span>}
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
          {/* Hero */}
          <div className="bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-gray-900 shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1">Grade Management</h1>
                <p className="text-green-50 text-sm">Grades auto-consolidate from class activities, quizzes &amp; assignments</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Class Average", value: `${classAverage}%`, icon: <TrendingUp className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50 border-green-200" },
              { label: "Highest Grade", value: `${highestGrade}%`, icon: <Award className="w-5 h-5" />, color: "text-blue-400", bg: "bg-blue-50 border-blue-200" },
              { label: "Lowest Grade", value: `${lowestGrade}%`, icon: <TrendingDown className="w-5 h-5" />, color: "text-red-400", bg: "bg-red-50 border-red-200" },
              { label: "Passing Rate", value: `${passingRate}%`, icon: <Target className="w-5 h-5" />, color: "text-purple-400", bg: "bg-purple-50 border-purple-200" },
            ].map(({ label, value, icon, color, bg }) => (
              <div key={label} className={`rounded-xl p-5 border ${bg}`}>
                <div className={`${color} mb-2`}>{icon}</div>
                <p className="text-gray-600 text-xs mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Success banner */}
          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-300 font-medium">Grades saved successfully!</p>
            </div>
          )}

          {autoSaveMessage && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-300" />
              <p className="text-green-200 text-sm">{autoSaveMessage}</p>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5 inline mr-1.5" />
                  Select Subject / Section
                </label>
                {classes.length === 0 ? (
                  <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm">No classes available</div>
                ) : (
                  <CustomSelect
                    value={selectedClass}
                    onChange={(value) => { setSelectedClass(value); setHasUnsavedChanges(false); setActiveView("all"); }}
                    placeholder="Select a class"
                    className="w-full"
                    options={classes.map((c) => ({ value: c.id, label: `${c.code} - ${c.name} (${c.section})` }))}
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wider">
                  <Search className="w-3.5 h-3.5 inline mr-1.5" />
                  Search Student
                </label>
                <input
                  type="text"
                  placeholder="Search by name or LRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Grade Table */}
          {selectedClass && (
            <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Table header row */}
              <div className="p-5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selectedClassName || "Select a class to view grades"}</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{filteredByView.length} student{filteredByView.length !== 1 ? "s" : ""}</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Pass/Fail filter tabs */}
                  <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200">
                    {[
                      { key: "all", label: `All (${studentGrades.length})` },
                      { key: "passed", label: `Passed (${passingCount})`, color: "text-green-600" },
                      { key: "failed", label: `Failed (${failingCount})`, color: "text-red-400" },
                    ].map(({ key, label, color }) => (
                      <button
                        key={key}
                        onClick={() => setActiveView(key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === key ? "bg-gray-100 text-gray-900" : `text-gray-600 hover:text-gray-900 ${color || ""}`}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || !selectedClass || saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving…" : "Save All"}
                  </button>
                </div>
              </div>

              {filteredByView.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">{!selectedClass ? "Select a class to load students" : "No students found"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz Avg</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Midterm</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Final</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Overall</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredByView.map((student) => {
                        const isPassed = student.overallGrade >= 75;
                        return (
                          <tr key={student.id} className={`hover:bg-gray-50 transition-colors ${!isPassed ? "bg-red-500/5" : ""}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-gray-900 ${isPassed ? "bg-green-600" : "bg-red-600"}`}>
                                  {student.studentName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{student.studentName}</p>
                                  <p className="text-xs text-gray-500">{student.studentId}</p>
                                </div>
                              </div>
                            </td>
                            {[
                              { field: "quizAverage", value: student.quizAverage, color: "ring-violet-500" },
                              { field: "activityGrade", value: student.activityGrade, color: "ring-orange-500" },
                              { field: "projectGrade", value: student.projectGrade, color: "ring-sky-500" },
                              { field: "midtermGrade", value: student.midtermGrade, color: "ring-green-500" },
                              { field: "finalGrade", value: student.finalGrade, color: "ring-green-500" },
                            ].map(({ field, value, color }) => (
                              <td key={field} className="px-5 py-4 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={value}
                                  onChange={(e) => handleGradeChange(student.id, field, e.target.value)}
                                  className={`w-20 px-2 py-1.5 text-center bg-gray-50 text-gray-900 border border-white/20 rounded-lg focus:outline-none focus:ring-2 ${color} text-sm`}
                                />
                              </td>
                            ))}
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${isPassed ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-400"}`}>
                                {student.overallGrade}%
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${isPassed ? "bg-green-50 text-green-300 border border-green-200" : "bg-red-50 text-red-300 border border-red-200"}`}>
                                {student.remarks}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary footer */}
              {studentGrades.length > 0 && (
                <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-black/10 flex-wrap gap-3">
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                      <span className="text-gray-600">Passed: <span className="text-green-600 font-semibold">{passingCount}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="text-gray-600">Failed: <span className="text-red-400 font-semibold">{failingCount}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                      <span className="text-gray-600">Total: <span className="text-gray-900 font-semibold">{studentGrades.length}</span></span>
                    </div>
                  </div>
                  <button
                    onClick={() => exportToExcel(studentGrades, selectedClassName)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-300 text-green-300 rounded-lg text-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Download Excel Report
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Assessment-Based Grading</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Review student submissions and assign grades for each assessment.
                </p>
              </div>

              {assessmentItems.length === 0 ? (
                <div className="p-8 text-center">
                  <EmptyStateIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No assessments found for this class yet.</p>
                </div>
              ) : (
                <div className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">1. Assessments</p>
                      </div>
                      <div className="max-h-[460px] overflow-y-auto dark-scrollbar p-2 space-y-2">
                        {assessmentItems.map((assessment) => {
                          const isActive = selectedAssessmentId === assessment.id;
                          return (
                            <button
                              id={`assessment-item-${assessment.id}`}
                              key={assessment.id}
                              type="button"
                              onClick={() => {
                                setSelectedAssessmentId(assessment.id);
                                setSelectedStudentId("");
                                setHasViewedSubmission(false);
                                setFocusedAssessmentId(assessment.id);
                              }}
                              className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${isActive ? "border-green-400/50 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}
                            >
                              <p className="text-sm font-semibold text-gray-900 line-clamp-1">{assessment.title}</p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1)} • Max {assessment.maxPoints}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="lg:col-span-4 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">2. Students</p>
                      </div>
                      <div className="max-h-[460px] overflow-y-auto dark-scrollbar p-2 space-y-2">
                        {!selectedAssessment ? (
                          <div className="px-3 py-8 text-center text-sm text-gray-500">Select an assessment to view students.</div>
                        ) : studentsForSelectedAssessment.length === 0 ? (
                          <div className="px-3 py-8 text-center text-sm text-gray-500">No enrolled or submitted students found.</div>
                        ) : (
                          studentsForSelectedAssessment.map((student) => {
                            const isActive = selectedStudentId === student.id;
                            const gradingStatus = assessmentStatusMap?.[selectedAssessmentId]?.[student.id] || "Pending";
                            const rowKey = `${selectedAssessmentId}:${student.id}`;
                            const rowSaveState = autoSaveStateMap[rowKey] || "idle";
                            return (
                              <button
                                key={`${selectedAssessmentId}-${student.id}`}
                                type="button"
                                onClick={() => {
                                  setSelectedStudentId(student.id);
                                  setHasViewedSubmission(true);
                                }}
                                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${isActive ? "border-green-400/50 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{student.studentName}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                    {student.isSubmitted ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-300 border border-green-200">Submitted</span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-300 border border-amber-200">No Submission</span>
                                    )}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${gradingStatus === "Graded" ? "bg-blue-50 text-blue-300 border-blue-200" : "bg-gray-500/10 text-gray-700 border-gray-500/20"}`}>
                                      {gradingStatus}
                                    </span>
                                    {rowSaveState === "saving" ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-300 border border-amber-200">Saving…</span>
                                    ) : null}
                                    {rowSaveState === "saved" ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-300 border border-green-200">Saved</span>
                                    ) : null}
                                    {rowSaveState === "error" ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-300 border border-red-200">Save Failed</span>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500">{student.studentId}</p>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-4 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">3. Submission & Grade</p>
                      </div>
                      <div className="p-4 space-y-4">
                        {!selectedAssessment || !selectedStudentId ? (
                          <div className="text-center py-10">
                            <p className="text-sm text-gray-500">Select a student to view submission and input grade.</p>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Submission Output</p>

                              {selectedStudentSubmission ? (
                                <div className="space-y-3">
                                  {selectedStudentSubmission.responseText ? (
                                    <div>
                                      <p className="text-[11px] text-gray-500 mb-1">Response</p>
                                      <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{selectedStudentSubmission.responseText}</p>
                                    </div>
                                  ) : null}

                                  {selectedStudentSubmission.fileUrl || selectedStudentSubmission.filePath ? (
                                    <div>
                                      <p className="text-[11px] text-gray-500 mb-1">Attachment</p>
                                      <a
                                        href={selectedStudentSubmission.fileUrl || selectedStudentSubmission.filePath}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-300 text-xs border border-green-200 hover:bg-green-500/20"
                                      >
                                        {selectedStudentSubmission.fileName || "Open submitted file"}
                                      </a>
                                    </div>
                                  ) : null}

                                  {selectedStudentSubmission.submittedAt ? (
                                    <p className="text-[11px] text-gray-500">
                                      Submitted: {new Date(selectedStudentSubmission.submittedAt).toLocaleString()}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="text-sm text-amber-300">No submission found for this student yet.</p>
                              )}
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Grade Input</p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max={selectedAssessment.maxPoints}
                                  step="0.01"
                                  value={assessmentGradesMap?.[selectedAssessment.id]?.[selectedStudentId] ?? ""}
                                  onChange={(e) => handleAssessmentGradeChange(selectedAssessment.id, selectedStudentId, selectedAssessment.maxPoints, e.target.value)}
                                  disabled={!hasViewedSubmission}
                                  className="w-full px-3 py-2 text-sm bg-gray-50 text-gray-900 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  placeholder="Enter grade"
                                />
                                <span className="text-xs text-gray-600 whitespace-nowrap">/ {selectedAssessment.maxPoints}</span>
                              </div>
                              {selectedAssessment && selectedStudentId ? (
                                <p className="text-[11px] text-gray-600 mt-2">
                                  Status: <span className="text-gray-900 font-medium">{assessmentStatusMap?.[selectedAssessment.id]?.[selectedStudentId] || "Pending"}</span>
                                </p>
                              ) : null}
                              {!hasViewedSubmission ? (
                                <p className="text-[11px] text-amber-300 mt-2">View the student submission first before grading.</p>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            </>
          )}

          {/* Empty state when no class selected */}
          {!selectedClass && (
            <div className="bg-gray-500 rounded-xl border border-gray-100 p-16 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-gray-900 font-semibold mb-1">Select a class to view grades</h3>
              <p className="text-gray-600 text-sm">Grades are automatically consolidated from activities, quizzes, and assignments.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export { GradesManagement };
