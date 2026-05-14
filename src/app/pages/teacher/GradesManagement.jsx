import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
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

/* ΓöÇΓöÇΓöÇ pure helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
const exportToExcel = (studentGrades, className) => {
  const passedStudents = studentGrades.filter((s) => s.overallGrade >= 75);
  const failedStudents = studentGrades.filter((s) => s.overallGrade < 75);

  const rows = [
    ["ConnectEd – Grade Report"],
    [`Class: ${className}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ["Student Name", "LRN", "Term 1", "Term 2", "Term 3", "Quizzes", "Activities", "Assignments", "Exams", "Overall Grade", "Remarks"],
    ...studentGrades.map((s) => [
      s.studentName,
      s.studentId,
      s.term1Grade,
      s.term2Grade,
      s.term3Grade,
      s.quizAverage,
      s.activityGrade,
      s.assignmentGrade,
      s.examGrade,
      s.overallGrade,
      s.remarks,
    ]),
    [],
    [`Passed (≥ 75): ${passedStudents.length}`, "", "", "", "", "", "", "", "", ""],
    [`Failed (< 75): ${failedStudents.length}`, "", "", "", "", "", "", "", "", ""],
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
  const assessmentType = String(row?.assessment_type || row?.type || row?.task_type || "assignment").trim().toLowerCase();
  const designation = String(row?.designation || (assessmentType === 'quiz' ? 'Quiz' : 'Activity')).trim();
  const term = String(row?.term || "Term 1").trim();
  const maxPoints = Number(row?.max_points ?? row?.total_points ?? row?.maxPoints ?? 100) || 100;
  
  // Parse attachments
  const attachments = [];
  if (row?.file_url || row?.fileUrl) {
    attachments.push({
      fileName: row?.file_name || row?.fileName || "Attachment",
      fileUrl: row?.file_url || row?.fileUrl || "",
      filePath: row?.file_path || row?.filePath || "",
    });
  }

  return {
    id: String(row?.id || "").trim(),
    title: String(row?.title || row?.name || "Untitled Assessment").trim() || "Untitled Assessment",
    description: String(row?.description || row?.instructions || row?.content || "").trim(),
    type: assessmentType || "assignment",
    designation: designation,
    term: term,
    dueDate: String(row?.due_date || row?.dueDate || row?.deadline || "").trim(),
    maxPoints: Math.max(1, maxPoints),
    attachments: attachments,
  };
};

const clampAssessmentScore = (value, maxPoints) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "";
  const safeMax = Number(maxPoints) > 0 ? Number(maxPoints) : 100;
  return Math.max(0, Math.min(safeMax, numeric));
};

const calculateQuizPercentage = (score, maxPoints) => {
  const numericScore = Number(score);
  const numericMax = Number(maxPoints);
  if (Number.isNaN(numericScore) || Number.isNaN(numericMax) || numericMax === 0) return 0;
  return Math.round((numericScore / numericMax) * 100);
};

const determinePassFailStatus = (percentage, passingScore = 74) => {
  return percentage >= passingScore ? "Passed" : "Failed";
};

const generateQuizName = (assessmentTitle, quizOrder) => {
  // If assessment title already starts with Q, use it; otherwise generate Q1, Q2, etc.
  if (assessmentTitle.toLowerCase().startsWith('q')) {
    return assessmentTitle;
  }
  return `Q${quizOrder}`;
};

const calculateAssessmentAverages = (assessmentGradesMap, assessmentItems) => {
  const totals = {
    quiz: { totalScore: 0, maxPoints: 0, count: 0 },
    activity: { totalScore: 0, maxPoints: 0, count: 0 },
    assignment: { totalScore: 0, maxPoints: 0, count: 0 },
    exam: { totalScore: 0, maxPoints: 0, count: 0 },
    all: { totalScore: 0, maxPoints: 0, count: 0 }
  };

  Object.keys(assessmentGradesMap).forEach(assessmentId => {
    const assessment = assessmentItems.find(item => item.id === assessmentId);
    if (!assessment) return;

    const grades = assessmentGradesMap[assessmentId];
    Object.values(grades).forEach(gradeValue => {
      if (typeof gradeValue === 'number' && gradeValue > 0) {
        const designation = (assessment.designation || assessment.type || 'Activity').toLowerCase();
        const type = designation.includes('quiz') ? 'quiz' : 
                     designation.includes('exam') ? 'exam' :
                     designation.includes('assignment') ? 'assignment' : 'activity';
        
        if (totals[type]) {
          totals[type].totalScore += gradeValue;
          totals[type].maxPoints += assessment.maxPoints;
          totals[type].count++;
        }
        
        totals.all.totalScore += gradeValue;
        totals.all.maxPoints += assessment.maxPoints;
        totals.all.count++;
      }
    });
  });

  const calculatePercentage = (total, max) => {
    if (!max || max === 0) return 0;
    return Math.round((total / max) * 100);
  };

  return {
    quizAverage: calculatePercentage(totals.quiz.totalScore, totals.quiz.maxPoints),
    activityGrade: calculatePercentage(totals.activity.totalScore, totals.activity.maxPoints),
    assignmentGrade: calculatePercentage(totals.assignment.totalScore, totals.assignment.maxPoints),
    examGrade: calculatePercentage(totals.exam.totalScore, totals.exam.maxPoints),
    overallGrade: calculatePercentage(totals.all.totalScore, totals.all.maxPoints)
  };
};

const calculateStudentAssessmentAverages = (studentId, assessmentGradesMap, assessmentItems) => {
  const totals = {
    quiz: { totalScore: 0, maxPoints: 0, count: 0 },
    activity: { totalScore: 0, maxPoints: 0, count: 0 },
    assignment: { totalScore: 0, maxPoints: 0, count: 0 },
    exam: { totalScore: 0, maxPoints: 0, count: 0 },
    all: { totalScore: 0, maxPoints: 0, count: 0 }
  };

  Object.keys(assessmentGradesMap).forEach(assessmentId => {
    const assessment = assessmentItems.find(item => item.id === assessmentId);
    if (!assessment) return;

    const gradeValue = assessmentGradesMap[assessmentId][studentId];
    if (typeof gradeValue === 'number' && gradeValue > 0) {
      const designation = (assessment.designation || assessment.type || 'Activity').toLowerCase();
      const type = designation.includes('quiz') ? 'quiz' : 
                   designation.includes('exam') ? 'exam' :
                   designation.includes('assignment') ? 'assignment' : 'activity';
      
      if (totals[type]) {
        totals[type].totalScore += gradeValue;
        totals[type].maxPoints += assessment.maxPoints;
        totals[type].count++;
      }
      
      totals.all.totalScore += gradeValue;
      totals.all.maxPoints += assessment.maxPoints;
      totals.all.count++;
    }
  });

  const calculatePercentage = (total, max) => {
    if (!max || max === 0) return 0;
    return Math.round((total / max) * 100);
  };

  return {
    quizAverage: calculatePercentage(totals.quiz.totalScore, totals.quiz.maxPoints),
    activityGrade: calculatePercentage(totals.activity.totalScore, totals.activity.maxPoints),
    assignmentGrade: calculatePercentage(totals.assignment.totalScore, totals.assignment.maxPoints),
    examGrade: calculatePercentage(totals.exam.totalScore, totals.exam.maxPoints),
    overallGrade: calculatePercentage(totals.all.totalScore, totals.all.maxPoints)
  };
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

/* ΓöÇΓöÇΓöÇ component ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
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
  const [activeTerm, setActiveTerm] = useState("all"); // "all" | "term1" | "term2" | "term3"
  const [activeDesignation, setActiveDesignation] = useState("all"); // "all" | "Quiz" | "Activity" | "Assignment" | "Exam"
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
  const [assessmentFeedbackMap, setAssessmentFeedbackMap] = useState({});
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

  /* ΓöÇΓöÇΓöÇ fetch classes ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
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

    // Add quiz ordering for dynamic naming
    const quizCounters = {};
    const assessmentsWithNames = mapped.map((assessment) => {
      if (assessment.type === 'quiz') {
        if (!quizCounters[classId]) quizCounters[classId] = 0;
        quizCounters[classId]++;
        return {
          ...assessment,
          displayName: generateQuizName(assessment.title, quizCounters[classId]),
          quizOrder: quizCounters[classId]
        };
      }
      return {
        ...assessment,
        displayName: assessment.title,
        quizOrder: null
      };
    });

    setAssessmentItems(assessmentsWithNames);
    setExpandedAssessments((prev) => {
      const next = { ...prev };
      assessmentsWithNames.forEach((assessment) => {
        if (typeof next[assessment.id] === "undefined") {
          next[assessment.id] = true;
        }
      });
      return next;
    });
    return assessmentsWithNames;
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
      .select("assessment_id, student_id, grade_value, status, feedback")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .in("assessment_id", assessmentIds)
      .in("student_id", studentIds);

    if (gradeResult.error) {
      gradeResult = await supabase
        .from("teacher_assessment_grades")
        .select("assessment_id, student_id, grade_value, status")
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
    const feedbackMapped = {};
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

      if (!feedbackMapped[assessmentId]) feedbackMapped[assessmentId] = {};
      feedbackMapped[assessmentId][studentId] = String(row.feedback || "").trim();
    });

    setAssessmentGradesMap(mapped);
    setAssessmentStatusMap(statusMapped);
    setAssessmentFeedbackMap(feedbackMapped);
  }, []);

  const fetchAssessmentSubmissions = useCallback(async (currentTeacherId, classId, assessments, enrolledStudentIds) => {
    if (!supabase || !currentTeacherId || !classId || assessments.length === 0) {
      setAssessmentSubmissionsMap({});
      setSubmittedStudentProfiles({});
      setAssessmentFeedbackMap({});
      return;
    }

    const assessmentIds = assessments.map((item) => item.id);
    const { data, error } = await supabase
      .from("teacher_assessment_submissions")
      .select("id, assessment_id, student_id, response_text, file_url, file_name, file_path, submitted_at, updated_at, created_at")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .in("assessment_id", assessmentIds);

    if (error) {
      console.error("Failed to load assessment submissions:", error);
      setAssessmentSubmissionsMap({});
      setSubmittedStudentProfiles({});
      setAssessmentFeedbackMap({});
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

    const submissionIds = (data ?? []).map((row) => String(row.id || "")).filter(Boolean);
    if (submissionIds.length > 0) {
      const { data: feedbackRows, error: feedbackError } = await supabase
        .from("submission_feedback")
        .select("submission_id, comments, feedback_text, teacher_id")
        .eq("teacher_id", currentTeacherId)
        .in("submission_id", submissionIds);

      if (feedbackError) {
        console.error("Failed to load submission feedback:", feedbackError);
        setAssessmentFeedbackMap({});
      } else {
        const feedbackMap = {};
        (feedbackRows ?? []).forEach((row) => {
          const submissionId = String(row.submission_id || "");
          if (!submissionId) return;
          const submission = (data ?? []).find((item) => String(item.id || "") === submissionId);
          if (!submission) return;
          const assessmentId = String(submission.assessment_id || "");
          const studentId = String(submission.student_id || "");
          if (!assessmentId || !studentId) return;
          if (!feedbackMap[assessmentId]) feedbackMap[assessmentId] = {};
          feedbackMap[assessmentId][studentId] = String(row.feedback_text || row.comments || "").trim();
        });
        setAssessmentFeedbackMap(feedbackMap);
      }
    } else {
      setAssessmentFeedbackMap({});
    }

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

  /* ΓöÇΓöÇΓöÇ fetch students + grades ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
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
      .select("*")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .in("student_id", studentIds);

    const persistedGradeMap = {};
    (gradeRows ?? []).forEach((row) => {
      const id = String(row.student_id || "");
      if (!id) return;
      persistedGradeMap[id] = {
        term1Grade: clampGradeValue(row.term1_grade),
        term2Grade: clampGradeValue(row.term2_grade),
        term3Grade: clampGradeValue(row.term3_grade),
        quizAverage: clampGradeValue(row.quiz_average),
        activityGrade: clampGradeValue(row.activity_grade ?? 0),
        assignmentGrade: clampGradeValue(row.assignment_grade ?? 0),
        examGrade: clampGradeValue(row.exam_grade ?? 0),
        overallGrade: clampGradeValue(row.overall_grade ?? 0),
      };
    });

    const cacheForClass = gradesCacheRef.current[classId] || {};
    const mapped = (studentRows ?? []).map((student) => {
      const studentId = String(student.id);
      const cached = cacheForClass[studentId] || persistedGradeMap[studentId] || { ...createDefaultGradeRecord(), activityGrade: 0, assignmentGrade: 0, examGrade: 0 };
      const studentName = [student.first_name, student.middle_name, student.last_name]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim() || "Student";

      // Calculate assessment-based averages for this student
      const assessmentAverages = calculateStudentAssessmentAverages(studentId, assessmentGradesMap, assessmentItems);

      const current = {
        id: studentId,
        studentName,
        studentId: String(student.lrn || "N/A"),
        term1Grade: clampGradeValue(cached.term1Grade),
        term2Grade: clampGradeValue(cached.term2Grade),
        term3Grade: clampGradeValue(cached.term3Grade),
        // Use calculated averages from assessments if available, otherwise use cached values
        quizAverage: assessmentAverages.quizAverage > 0 ? assessmentAverages.quizAverage : clampGradeValue(cached.quizAverage),
        activityGrade: assessmentAverages.activityGrade > 0 ? assessmentAverages.activityGrade : clampGradeValue(cached.activityGrade ?? 0),
        assignmentGrade: assessmentAverages.assignmentGrade > 0 ? assessmentAverages.assignmentGrade : (cached.assignmentGrade ?? 0),
        examGrade: assessmentAverages.examGrade > 0 ? assessmentAverages.examGrade : (cached.examGrade ?? 0),
        overallGrade: assessmentAverages.overallGrade > 0 ? assessmentAverages.overallGrade : clampGradeValue(cached.overallGrade ?? 0),
        projectGrade: cached.projectGrade ?? "",
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
  }, [assessmentGradesMap, assessmentItems]);

  /* ΓöÇΓöÇΓöÇ init ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
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

  /* ΓöÇΓöÇΓöÇ handlers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
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
      const existing = classCache[studentId] || { ...createDefaultGradeRecord(), activityGrade: 0, assignmentGrade: 0 };
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
    const percentage = calculateQuizPercentage(scoreValue, assessment.maxPoints);
    const passFailStatus = determinePassFailStatus(percentage);
    
    // For quizzes, use pass/fail status; for other assessments, use Graded/Pending
    const isQuiz = assessment.type === 'quiz';
    const statusValue = rawValue === "" ? "Pending" : (isQuiz ? passFailStatus : "Graded");
    
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
      feedback: String(assessmentFeedbackMap?.[assessmentId]?.[studentId] || "").trim(),
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
    setAutoSaveMessage(`Saved grade for ${assessment.title}. ${isQuiz ? `(${percentage}%)` : ''}`);

    const clearTimer = autoSaveTimersRef.current[`clear:${key}`];
    if (clearTimer) {
      window.clearTimeout(clearTimer);
    }

    autoSaveTimersRef.current[`clear:${key}`] = window.setTimeout(() => {
      setAutoSaveStateMap((prev) => ({ ...prev, [key]: "idle" }));
      delete autoSaveTimersRef.current[`clear:${key}`];
    }, 1000);
  }, [assessmentFeedbackMap, assessmentItems, selectedClass, supabase, teacherId]);

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

  const handleAssessmentFeedbackChange = (assessmentId, studentId, value) => {
    setAssessmentFeedbackMap((prev) => ({
      ...prev,
      [assessmentId]: {
        ...(prev[assessmentId] || {}),
        [studentId]: value,
      },
    }));
  };

  const handleReturnAssignment = useCallback(async () => {
    const currentAssessment = assessmentItems.find((item) => item.id === selectedAssessmentId) || null;
    const currentSubmission = assessmentSubmissionsMap?.[selectedAssessmentId]?.[selectedStudentId] || null;
    const currentFeedback = assessmentFeedbackMap?.[selectedAssessmentId]?.[selectedStudentId] || "";

    if (!supabase || !teacherId || !selectedClass || !currentAssessment || !selectedStudentId) return;

    const currentGrade = assessmentGradesMap?.[selectedAssessmentId]?.[selectedStudentId] ?? "";

    const gradePayload = {
      teacher_id: teacherId,
      subject_id: selectedClass,
      assessment_id: currentAssessment.id,
      student_id: selectedStudentId,
      grade_value: Number(currentGrade || 0),
      feedback: currentFeedback,
      status: "returned",
      updated_at: new Date().toISOString(),
    };

    const { error: gradeError } = await supabase
      .from("teacher_assessment_grades")
      .upsert(gradePayload, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });

    if (gradeError) {
      console.error("Failed to return assignment:", gradeError);
      return;
    }

    if (currentSubmission?.id) {
      // Update submission status to 'done' when assignment is returned
      const { error: submissionUpdateError } = await supabase
        .from("teacher_assessment_submissions")
        .update({ 
          status: 'done',
          updated_at: new Date().toISOString()
        })
        .eq("id", currentSubmission.id);

      if (submissionUpdateError) {
        console.error("Failed to update submission status:", submissionUpdateError);
      } else {
        // Update local state to reflect the status change
        setAssessmentSubmissionsMap((prev) => ({
          ...prev,
          [currentAssessment.id]: {
            ...(prev[currentAssessment.id] || {}),
            [selectedStudentId]: {
              ...(prev[currentAssessment.id]?.[selectedStudentId] || currentSubmission || {}),
              status: 'done'
            },
          },
        }));
      }

      const feedbackPayload = {
        submission_id: currentSubmission.id,
        teacher_id: teacherId,
        comments: currentFeedback,
        updated_at: new Date().toISOString(),
      };

      const { error: feedbackError } = await supabase
        .from("submission_feedback")
        .upsert(feedbackPayload, { onConflict: "submission_id,teacher_id" });

      if (feedbackError) {
        console.error("Failed to sync submission feedback:", feedbackError);
      }
    }

    const key = `${selectedAssessment.id}:${selectedStudentId}`;
    setAssessmentStatusMap((prev) => ({
      ...prev,
      [currentAssessment.id]: {
        ...(prev[currentAssessment.id] || {}),
        [selectedStudentId]: "Returned",
      },
    }));

    setAutoSaveStateMap((prev) => ({ ...prev, [key]: "saved" }));
    setAutoSaveMessage("Assignment returned successfully.");
    toast.success("Assignment returned successfully.");
  }, [assessmentFeedbackMap, assessmentGradesMap, assessmentItems, assessmentSubmissionsMap, selectedAssessmentId, selectedClass, selectedStudentId, supabase, teacherId]);

  const handleSave = async () => {
    if (!selectedClass || studentGrades.length === 0 || !teacherId || !supabase) return;
    try {
      setSaving(true);
      const gradesPayload = studentGrades.map((student) => ({
        teacher_id: teacherId,
        subject_id: selectedClass,
        student_id: student.id,
        term1_grade: clampGradeValue(student.term1Grade),
        term2_grade: clampGradeValue(student.term2Grade),
        term3_grade: clampGradeValue(student.term3Grade),
        quiz_average: clampGradeValue(student.quizAverage),
        activity_grade: clampGradeValue(student.activityGrade ?? 0),
        assignment_grade: clampGradeValue(student.assignmentGrade ?? 0),
        exam_grade: clampGradeValue(student.examGrade ?? 0),
        overall_grade: clampGradeValue(student.overallGrade),
        updated_at: new Date().toISOString(),
      }));

      console.log("[GradesManagement] Saving grades payload:", gradesPayload);

      const { data, error } = await supabase
        .from("teacher_student_grades")
        .upsert(gradesPayload, { onConflict: "teacher_id,subject_id,student_id" })
        .select("*");

      if (error) {
        console.error("Failed to save grades:", error);
        throw new Error(error.message || "Failed to save grades.");
      }

      if (!data || data.length === 0) {
        throw new Error("No grades were saved.");
      }

      toast.success("Grades successfully saved");
      setSaveSuccess(true);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Unexpected save error:", error);
      toast.error(error?.message || "Failed to save grades.");
    } finally {
      setSaving(false);
    }
  };

  /* ΓöÇΓöÇΓöÇ derived ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
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

  const selectedStudentFeedback = useMemo(() => {
    if (!selectedAssessmentId || !selectedStudentId) return "";
    return assessmentFeedbackMap?.[selectedAssessmentId]?.[selectedStudentId] || "";
  }, [assessmentFeedbackMap, selectedAssessmentId, selectedStudentId]);


  /* ΓöÇΓöÇΓöÇ render ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  if (loading) return <LoadingScreen message="Loading grades..." />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogoutClick} />

      <main className="flex-1 overflow-y-auto scrollbar-hide lg:pl-64">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-green-900">Grades Management</h2>
                {hasUnsavedChanges && <span className="text-sm text-amber-600 font-medium animate-pulse">⚠ Unsaved changes</span>}
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
          <div className="bg-green-600 rounded-2xl p-8 text-white shadow-sm relative overflow-hidden">
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
              { label: "Class Average", value: `${classAverage}%`, icon: <TrendingUp className="w-5 h-5" />, color: "text-green-600", bg: "bg-white border-gray-200" },
              { label: "Highest Grade", value: `${highestGrade}%`, icon: <Award className="w-5 h-5" />, color: "text-green-600", bg: "bg-white border-gray-200" },
              { label: "Lowest Grade", value: `${lowestGrade}%`, icon: <TrendingDown className="w-5 h-5" />, color: "text-red-600", bg: "bg-white border-gray-200" },
              { label: "Passing Rate", value: `${passingRate}%`, icon: <Target className="w-5 h-5" />, color: "text-purple-600", bg: "bg-white border-gray-200" },
            ].map(({ label, value, icon, color, bg }) => (
              <div key={label} className={`rounded-2xl p-5 border ${bg} shadow-sm`}>
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
              <p className="text-green-700 font-medium">Grades saved successfully!</p>
            </div>
          )}

          {autoSaveMessage && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-green-700 text-sm">{autoSaveMessage}</p>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-green-700 mb-3 uppercase tracking-widest flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Select Subject / Section
                </label>
                {classes.length === 0 ? (
                  <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm">No classes available</div>
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
                <label className="block text-xs font-medium text-green-600 mb-2 uppercase tracking-wider">
                  <Search className="w-3.5 h-3.5 inline mr-1.5" />
                  Search Student
                </label>
                <input
                  type="text"
                  placeholder="Search by name or LRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 text-green-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Grade Table */}
          {selectedClass && (
            <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Table header row */}
              <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-green-900">{selectedClassName || "Select a class to view grades"}</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{filteredByView.length} student{filteredByView.length !== 1 ? "s" : ""}</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Term tabs */}
                  <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                    {[
                      { key: "all", label: "All Terms" },
                      { key: "term1", label: "T1" },
                      { key: "term2", label: "T2" },
                      { key: "term3", label: "T3" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setActiveTerm(key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTerm === key ? "bg-green-600 text-white shadow-sm" : "text-gray-600 hover:text-green-900"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Designation tabs */}
                  <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                    {[
                      { key: "all", label: "All" },
                      { key: "Quiz", label: "Quizzes" },
                      { key: "Activity", label: "Activities" },
                      { key: "Assignment", label: "Assignments" },
                      { key: "Exam", label: "Exams" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setActiveDesignation(key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeDesignation === key ? "bg-green-600 text-white shadow-sm" : "text-gray-600 hover:text-green-900"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Pass/Fail filter tabs */}
                  <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                    {[
                      { key: "all", label: `All (${studentGrades.length})` },
                      { key: "passed", label: `Passed (${passingCount})`, color: "text-green-600" },
                      { key: "failed", label: `Failed (${failingCount})`, color: "text-red-600" },
                    ].map(({ key, label, color }) => (
                      <button
                        key={key}
                        onClick={() => setActiveView(key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === key ? "bg-white text-green-900 shadow-sm" : `text-gray-600 hover:text-green-900 ${color || ""}`}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || !selectedClass || saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Save All"}
                  </button>
                </div>
              </div>

              {filteredByView.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">{!selectedClass ? "Select a class to load students" : "No students found"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        {/* Term columns - conditionally shown by term filter */}
                        {(activeTerm === "all" || activeTerm === "term1") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">
                            <div>T1</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">Term 1</div>
                          </th>
                        )}
                        {(activeTerm === "all" || activeTerm === "term2") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">
                            <div>T2</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">Term 2</div>
                          </th>
                        )}
                        {(activeTerm === "all" || activeTerm === "term3") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">
                            <div>T3</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">Term 3</div>
                          </th>
                        )}
                        {(activeDesignation === "all" || activeDesignation === "Quiz") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-violet-600 uppercase tracking-wider bg-violet-50">
                            <div>Quiz</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">Avg (0-100)</div>
                          </th>
                        )}
                        {(activeDesignation === "all" || activeDesignation === "Activity") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-orange-600 uppercase tracking-wider bg-orange-50">
                            <div>Activity</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">Score (0-100)</div>
                          </th>
                        )}
                        {(activeDesignation === "all" || activeDesignation === "Assignment") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-sky-600 uppercase tracking-wider bg-sky-50">
                            <div>Assignment</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">Score (0-100)</div>
                          </th>
                        )}
                        {(activeDesignation === "all" || activeDesignation === "Exam") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-red-600 uppercase tracking-wider bg-red-50">
                            <div>Exam</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">Score (0-100)</div>
                          </th>
                        )}
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Overall</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredByView.map((student) => {
                        const isPassed = student.overallGrade >= 75;
                        return (
                          <tr key={student.id} className={`hover:bg-green-50 transition-colors ${!isPassed ? "bg-red-50" : "bg-white"}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${isPassed ? "bg-green-600" : "bg-red-600"}`}>
                                  {student.studentName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-green-900">{student.studentName}</p>
                                  <p className="text-xs text-gray-500">{student.studentId}</p>
                                </div>
                              </div>
                            </td>
                            {/* Term grade inputs - conditionally shown */}
                            {(activeTerm === "all" || activeTerm === "term1") && (
                              <td className="px-3 py-4 text-center bg-green-50/30">
                                <input
                                  type="number" min="0" max="100"
                                  value={student.term1Grade ?? ""}
                                  onChange={(e) => handleGradeChange(student.id, "term1Grade", e.target.value || "")}
                                  className="w-16 px-2 py-1.5 text-center bg-white text-green-900 border border-green-200 rounded-lg focus:outline-none focus:ring-2 ring-green-500 text-sm"
                                />
                              </td>
                            )}
                            {(activeTerm === "all" || activeTerm === "term2") && (
                              <td className="px-3 py-4 text-center bg-green-50/30">
                                <input
                                  type="number" min="0" max="100"
                                  value={student.term2Grade ?? ""}
                                  onChange={(e) => handleGradeChange(student.id, "term2Grade", e.target.value || "")}
                                  className="w-16 px-2 py-1.5 text-center bg-white text-green-900 border border-green-200 rounded-lg focus:outline-none focus:ring-2 ring-green-500 text-sm"
                                />
                              </td>
                            )}
                            {(activeTerm === "all" || activeTerm === "term3") && (
                              <td className="px-3 py-4 text-center bg-green-50/30">
                                <input
                                  type="number" min="0" max="100"
                                  value={student.term3Grade ?? ""}
                                  onChange={(e) => handleGradeChange(student.id, "term3Grade", e.target.value || "")}
                                  className="w-16 px-2 py-1.5 text-center bg-white text-green-900 border border-green-200 rounded-lg focus:outline-none focus:ring-2 ring-green-500 text-sm"
                                />
                              </td>
                            )}
                            {/* Designation Averages - conditionally shown */}
                            {(activeDesignation === "all" || activeDesignation === "Quiz") && (
                              <td className="px-3 py-4 text-center bg-violet-50/30">
                                <input
                                  type="number" min="0" max="100"
                                  value={student.quizAverage ?? ""}
                                  onChange={(e) => handleGradeChange(student.id, "quizAverage", e.target.value || "")}
                                  className="w-16 px-2 py-1.5 text-center bg-white text-green-900 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 ring-violet-500 text-sm"
                                />
                              </td>
                            )}
                            {(activeDesignation === "all" || activeDesignation === "Activity") && (
                              <td className="px-3 py-4 text-center bg-orange-50/30">
                                <input
                                  type="number" min="0" max="100"
                                  value={student.activityGrade ?? ""}
                                  onChange={(e) => handleGradeChange(student.id, "activityGrade", e.target.value || "")}
                                  className="w-16 px-2 py-1.5 text-center bg-white text-green-900 border border-orange-200 rounded-lg focus:outline-none focus:ring-2 ring-orange-500 text-sm"
                                />
                              </td>
                            )}
                            {(activeDesignation === "all" || activeDesignation === "Assignment") && (
                              <td className="px-3 py-4 text-center bg-sky-50/30">
                                <input
                                  type="number" min="0" max="100"
                                  value={student.assignmentGrade ?? ""}
                                  onChange={(e) => handleGradeChange(student.id, "assignmentGrade", e.target.value || "")}
                                  className="w-16 px-2 py-1.5 text-center bg-white text-green-900 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 ring-sky-500 text-sm"
                                />
                              </td>
                            )}
                            {(activeDesignation === "all" || activeDesignation === "Exam") && (
                              <td className="px-3 py-4 text-center bg-red-50/30">
                                <input
                                  type="number" min="0" max="100"
                                  value={student.examGrade ?? ""}
                                  onChange={(e) => handleGradeChange(student.id, "examGrade", e.target.value || "")}
                                  className="w-16 px-2 py-1.5 text-center bg-white text-green-900 border border-red-200 rounded-lg focus:outline-none focus:ring-2 ring-red-500 text-sm"
                                />
                              </td>
                            )}
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${isPassed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {student.overallGrade}%
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${isPassed ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
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
                <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50 flex-wrap gap-3">
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span className="text-gray-600">Passed: <span className="text-green-600 font-semibold">{passingCount}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-gray-600">Failed: <span className="text-red-600 font-semibold">{failingCount}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                      <span className="text-gray-600">Total: <span className="text-green-900 font-semibold">{studentGrades.length}</span></span>
                    </div>
                  </div>
                  <button
                    onClick={() => exportToExcel(studentGrades, selectedClassName)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-lg text-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Download Excel Report
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="text-base font-semibold text-green-900">Assessment-Based Grading</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Review student submissions and assign grades for each assessment.
                </p>
              </div>

              {assessmentItems.length === 0 ? (
                <div className="p-8 text-center">
                  <EmptyStateIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No assessments found for this class yet.</p>
                </div>
              ) : (
                <div className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left: Assessment List */}
                    <div className="lg:col-span-3 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Assessments</p>
                      </div>
                      <div className="flex-1 max-h-[600px] overflow-y-auto scrollbar-hide p-2 space-y-2">
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
                              className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${isActive ? "border-green-300 bg-green-50" : "border-transparent hover:bg-gray-100"}`}
                            >
                              <p className="text-sm font-semibold text-green-900 line-clamp-1">{assessment.displayName || assessment.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1)} • Max {assessment.maxPoints}
                                {assessment.type === 'quiz' && assessment.quizOrder && ` • ${assessment.displayName}`}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="lg:col-span-9 space-y-4">
                      {/* Assessment Details Section */}
                      {selectedAssessment ? (
                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Assessment Details</p>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedAssessment.type === "activity" ? "bg-purple-100 text-purple-700" : selectedAssessment.type === "quiz" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                              {selectedAssessment.type === "activity" ? "Activity" : selectedAssessment.type === "quiz" ? "Quiz" : "Assignment"}
                            </span>
                          </div>
                          <div className="p-4 space-y-3">
                            <div>
                              <h4 className="text-base font-semibold text-green-900 mb-1">{selectedAssessment.title}</h4>
                              {selectedAssessment.description && (
                                <p className="text-sm text-gray-700 leading-relaxed">{selectedAssessment.description}</p>
                              )}
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Due Date</p>
                                <p className="text-green-900 font-medium">
                                  {selectedAssessment.dueDate
                                    ? new Date(selectedAssessment.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : "No due date"}
                                </p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Max Points</p>
                                <p className="text-green-900 font-medium">{selectedAssessment.maxPoints}</p>
                              </div>
                              </div>
                            {/* Attachments */}
                            {selectedAssessment.attachments && selectedAssessment.attachments.length > 0 ? (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-2">Attached File(s)</p>
                                <div className="space-y-2">
                                  {selectedAssessment.attachments.map((attachment, index) => (
                                    <a
                                      key={index}
                                      href={attachment.fileUrl || attachment.filePath || "#"}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs border border-green-200 hover:bg-green-100 transition-colors w-full"
                                    >
                                      <LucideIcons.File className="w-4 h-4 flex-shrink-0" />
                                      <span className="truncate flex-1">{attachment.fileName || `File ${index + 1}`}</span>
                                      <LucideIcons.Download className="w-3 h-3 flex-shrink-0" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500">No attachment provided</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                          <p className="text-sm text-gray-500">Select an assessment to view details</p>
                        </div>
                      )}

                      {/* Students List Section */}
                      {selectedAssessment && (
                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                          <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Students ({studentsForSelectedAssessment.length})</p>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto scrollbar-hide p-2 space-y-2">
                            {studentsForSelectedAssessment.length === 0 ? (
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
                                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${isActive ? "border-green-300 bg-green-50" : "border-transparent hover:bg-gray-50"}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-green-900 line-clamp-1">{student.studentName}</p>
                                        <p className="text-xs text-gray-500">{student.studentId}</p>
                                      </div>
                                      <div className="flex items-center gap-1 flex-wrap justify-end flex-shrink-0">
                                        {student.isSubmitted ? (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Submitted</span>
                                        ) : (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Not Submitted</span>
                                        )}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${gradingStatus === "Graded" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                          {gradingStatus}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* Submission & Grade Section (only when student selected) */}
                      {selectedAssessment && selectedStudentId && (
                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                          <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Submission & Grade</p>
                          </div>
                          <div className="p-4 space-y-4">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Submission Output</p>

                              {selectedStudentSubmission ? (
                                <div className="space-y-3">
                                  {selectedStudentSubmission.responseText ? (
                                    <div>
                                      <p className="text-[11px] text-gray-500 mb-1">Response</p>
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedStudentSubmission.responseText}</p>
                                    </div>
                                  ) : null}

                                  {selectedStudentSubmission.fileUrl || selectedStudentSubmission.filePath ? (
                                    <div>
                                      <p className="text-[11px] text-gray-500 mb-1">Attachment</p>
                                      <a
                                        href={selectedStudentSubmission.fileUrl || selectedStudentSubmission.filePath}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs border border-green-200 hover:bg-green-100"
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
                                <p className="text-sm text-amber-600">No submission found for this student yet.</p>
                              )}
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Grade Input</p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max={selectedAssessment.maxPoints}
                                  step="0.01"
                                  value={assessmentGradesMap?.[selectedAssessment.id]?.[selectedStudentId] ?? ""}
                                  onChange={(e) => handleAssessmentGradeChange(selectedAssessment.id, selectedStudentId, selectedAssessment.maxPoints, e.target.value)}
                                  className="w-full px-3 py-2 text-sm bg-white text-green-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  placeholder="Enter grade"
                                />
                                <span className="text-xs text-gray-400 whitespace-nowrap">/ {selectedAssessment.maxPoints}</span>
                              </div>
                              
                              {/* Show percentage and pass/fail status for quizzes */}
                              {selectedAssessment.type === 'quiz' && (
                                <div className="mt-2 space-y-1">
                                  {(() => {
                                    const currentGrade = assessmentGradesMap?.[selectedAssessment.id]?.[selectedStudentId];
                                    const percentage = currentGrade ? calculateQuizPercentage(currentGrade, selectedAssessment.maxPoints) : 0;
                                    const passFailStatus = currentGrade ? determinePassFailStatus(percentage) : null;
                                    
                                    return (
                                      <>
                                        <p className="text-[11px] text-gray-400">
                                          Percentage: <span className="text-green-900 font-medium">{percentage}%</span>
                                        </p>
                                        {passFailStatus && (
                                          <p className="text-[11px] text-gray-400">
                                            Status: <span className={`font-medium ${passFailStatus === 'Passed' ? 'text-green-600' : 'text-red-600'}`}>
                                              {passFailStatus} (74% passing score)
                                            </span>
                                          </p>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                              
                              <p className="text-[11px] text-gray-400 mt-2">
                                Grade Status: <span className="text-green-900 font-medium">{assessmentStatusMap?.[selectedAssessment.id]?.[selectedStudentId] || "Pending"}</span>
                              </p>
                              {!hasViewedSubmission ? (
                                <p className="text-[11px] text-amber-600 mt-2">View student submission first before grading.</p>
                              ) : null}
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Teacher Feedback</p>
                                <p className="text-xs text-gray-500">Visible to student</p>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <label className="text-[11px] text-gray-400 block mb-2">Comments</label>
                                  <textarea
                                    rows={4}
                                    value={selectedStudentFeedback}
                                    onChange={(e) => handleAssessmentFeedbackChange(selectedAssessment.id, selectedStudentId, e.target.value)}
                                    placeholder="Enter feedback for the student..."
                                    className="w-full p-2 text-sm bg-white text-green-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={handleReturnAssignment}
                                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 text-white rounded-full hover:bg-yellow-700 transition-colors font-semibold text-sm"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                  Return Assignment
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            </>
          )}

          {/* Empty state when no class selected */}
          {!selectedClass && (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-green-900 font-semibold mb-1">Select a class to view grades</h3>
              <p className="text-gray-600 text-sm">Grades are automatically consolidated from activities, quizzes, and assignments.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export { GradesManagement };
