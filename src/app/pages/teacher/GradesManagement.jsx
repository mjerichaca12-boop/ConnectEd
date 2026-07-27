import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { CustomSelect } from "@/app/components/CustomSelect";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { teacherNotifications } from "@/app/components/NotificationDefault";
import { supabase } from "@/app/lib/supabaseClient";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { StudentGradebookModal } from "./components/StudentGradebookModal";
import { useAcademic } from "@/app/context/AcademicContext";
import { useTourPreview } from "@/app/hooks/useTourPreview";
import { useModuleTour } from "@/app/context/ModuleTourContext";
import { useTeacherTour } from "@/app/context/TeacherTourContext";
import * as LucideIcons from "lucide-react";
import {
  createDefaultGradeRecord,
  clampGradeValue,
  getGradeRemarks,
  calculateOverallGrade,
  resolveTeacherIdByEmail
} from "@/app/lib/teacherHelpers";
import {
  DEPED_DEFAULT_GRADE_SETTINGS,
  DEPED_SUBJECT_CATEGORIES,
  computeDepEdStudentComputation,
  inferAssessmentComponent,
  normalizeSubjectCategory,
  resolveQuarterFromTerm,
  serializeDepEdComputation,
} from "@/app/lib/depedGrading";
import {
  Save,
  Filter,
  Search,
  CheckCircle,
  Award,
  Users,
  Download,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
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
    ["Student Name", "LRN", "1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter", "Quizzes", "Activities", "Assignments", "Exams", "Overall Grade", "Remarks"],
    ...studentGrades.map((s) => [
      s.studentName,
      s.studentId,
      s.term1Grade,
      s.term2Grade,
      s.term3Grade,
      s.term4Grade,
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
  const term = String(row?.term || "1st Quarter").trim();
  const maxPoints = Number(row?.max_points ?? row?.total_points ?? row?.maxPoints ?? 100) || 100;
  const gradingComponent = inferAssessmentComponent({
    gradingComponent: row?.grading_component,
    grading_component: row?.grading_component,
    component: row?.component,
    designation,
    type: assessmentType,
    assessment_type: assessmentType,
    title: row?.title,
  });
  const gradingTerm = term;
  
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
    gradingTerm,
    gradingComponent,
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
  id: row?.id ? String(row.id).trim() : undefined,
  assessmentId: String(row?.assessment_id || "").trim(),
  studentId: String(row?.student_id || "").trim(),
  responseText: String(row?.response_text || row?.answer_text || row?.response || "").trim(),
  fileUrl: String(row?.file_url || "").trim(),
  fileName: String(row?.file_name || "").trim(),
  filePath: String(row?.file_path || "").trim(),
  submittedAt: row?.submitted_at || row?.updated_at || row?.created_at || null,
  status: String(row?.status || "Submitted").trim(),
});

/* ΓöÇΓöÇΓöÇ component ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
const MOCK_DEMO_STUDENTS = [
  {
    id: "demo-stu-1",
    studentName: "Juan Dela Cruz",
    studentId: "108234910012",
    quarter1Grade: 88,
    quarter2Grade: 91,
    quarter3Grade: 90,
    quarter4Grade: 93,
    overallGrade: 91,
    quizAverage: 92,
    activityGrade: 89,
    assignmentGrade: 90,
    examGrade: 91,
    remarks: "Passed (Promoted)",
  },
  {
    id: "demo-stu-2",
    studentName: "Maria Santos",
    studentId: "108234910013",
    quarter1Grade: 94,
    quarter2Grade: 96,
    quarter3Grade: 95,
    quarter4Grade: 97,
    overallGrade: 96,
    quizAverage: 96,
    activityGrade: 95,
    assignmentGrade: 96,
    examGrade: 96,
    remarks: "Passed (With Honors)",
  },
  {
    id: "demo-stu-3",
    studentName: "John Reyes",
    studentId: "108234910014",
    quarter1Grade: 84,
    quarter2Grade: 86,
    quarter3Grade: 88,
    quarter4Grade: 89,
    overallGrade: 87,
    quizAverage: 86,
    activityGrade: 85,
    assignmentGrade: 88,
    examGrade: 87,
    remarks: "Passed",
  },
  {
    id: "demo-stu-4",
    studentName: "Angelica Gonzales",
    studentId: "108234910015",
    quarter1Grade: 92,
    quarter2Grade: 93,
    quarter3Grade: 94,
    quarter4Grade: 95,
    overallGrade: 94,
    quizAverage: 94,
    activityGrade: 93,
    assignmentGrade: 94,
    examGrade: 95,
    remarks: "Passed (With Honors)",
  },
  {
    id: "demo-stu-5",
    studentName: "Carlos Mendoza",
    studentId: "108234910016",
    quarter1Grade: 76,
    quarter2Grade: 78,
    quarter3Grade: 80,
    quarter4Grade: 82,
    overallGrade: 79,
    quizAverage: 78,
    activityGrade: 80,
    assignmentGrade: 77,
    examGrade: 81,
    remarks: "Passed",
  },
];

const MOCK_DEMO_ASSESSMENTS = [
  {
    id: "demo-asg-1",
    title: "Written Work 1 - Pag-aaral ng mga Kontinente",
    displayName: "Written Work 1 - Pag-aaral ng mga Kontinente",
    type: "assignment",
    designation: "Assignment",
    totalPoints: 30,
    maxScore: 30,
    dueDate: "2026-08-15",
    schoolYear: "2026-2027",
    term: "1st Quarter",
  },
  {
    id: "demo-quiz-1",
    title: "Quiz 1 - Kasaysayan at Lipunan",
    displayName: "Quiz 1 - Kasaysayan at Lipunan",
    type: "quiz",
    designation: "Quiz",
    totalPoints: 20,
    maxScore: 20,
    dueDate: "2026-08-20",
    schoolYear: "2026-2027",
    term: "1st Quarter",
  },
  {
    id: "demo-act-1",
    title: "Performance Task - Environmental Action Plan Poster",
    displayName: "Performance Task - Environmental Action Plan Poster",
    type: "activity",
    designation: "Activity",
    totalPoints: 50,
    maxScore: 50,
    dueDate: "2026-08-28",
    schoolYear: "2026-2027",
    term: "1st Quarter",
  },
  {
    id: "demo-exam-1",
    title: "1st Periodical Examination - AP10",
    displayName: "1st Periodical Examination - AP10",
    type: "exam",
    designation: "Exam",
    totalPoints: 100,
    maxScore: 100,
    dueDate: "2026-09-10",
    schoolYear: "2026-2027",
    term: "1st Quarter",
  },
];

const MOCK_DEMO_GRADES_MAP = {
  "demo-asg-1": {
    "demo-stu-1": 27,
    "demo-stu-2": 29,
    "demo-stu-3": 25,
    "demo-stu-4": 28,
    "demo-stu-5": 23,
  },
  "demo-quiz-1": {
    "demo-stu-1": 18,
    "demo-stu-2": 20,
    "demo-stu-3": 16,
    "demo-stu-4": 19,
    "demo-stu-5": 14,
  },
  "demo-act-1": {
    "demo-stu-1": 45,
    "demo-stu-2": 48,
    "demo-stu-3": 42,
    "demo-stu-4": 47,
    "demo-stu-5": 38,
  },
  "demo-exam-1": {
    "demo-stu-1": 91,
    "demo-stu-2": 96,
    "demo-stu-3": 87,
    "demo-stu-4": 95,
    "demo-stu-5": 81,
  },
};

const MOCK_DEMO_STATUS_MAP = {
  "demo-asg-1": { "demo-stu-1": "Returned", "demo-stu-2": "Returned", "demo-stu-3": "Returned", "demo-stu-4": "Returned", "demo-stu-5": "Returned" },
  "demo-quiz-1": { "demo-stu-1": "Returned", "demo-stu-2": "Returned", "demo-stu-3": "Returned", "demo-stu-4": "Returned", "demo-stu-5": "Returned" },
  "demo-act-1": { "demo-stu-1": "Returned", "demo-stu-2": "Returned", "demo-stu-3": "Returned", "demo-stu-4": "Returned", "demo-stu-5": "Returned" },
  "demo-exam-1": { "demo-stu-1": "Returned", "demo-stu-2": "Returned", "demo-stu-3": "Returned", "demo-stu-4": "Returned", "demo-stu-5": "Returned" },
};

function GradesManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDemoMode, mockData } = useTourPreview();

  let moduleTour = null;
  let teacherTour = null;
  try { moduleTour = useModuleTour(); } catch {}
  try { teacherTour = useTeacherTour(); } catch {}

  const activeStepId = moduleTour?.currentStep?.id || teacherTour?.currentStep?.id || "";
  const isClassSelectStepActive = activeStepId === "grades-class-select" || activeStepId === "teacher-grades-class-select";

  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState(teacherNotifications);
  const [loading, setLoading] = useState(true);
  const [isSwitchingTerm, setIsSwitchingTerm] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [classes, setClasses] = useState([]);
  const activeClassesList = isDemoMode ? mockData.classes : classes;
  const [selectedClass, setSelectedClass] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gradingSettingsByCategory, setGradingSettingsByCategory] = useState(DEPED_DEFAULT_GRADE_SETTINGS);
  const [studentGrades, setStudentGrades] = useState([]);
  const [gradesCache, setGradesCache] = useState({});
  const gradesCacheRef = useRef({});
  const gradingSettingsRef = useRef(DEPED_DEFAULT_GRADE_SETTINGS);
  const [activeView, setActiveView] = useState("all"); // "all" | "passed" | "failed"
  const [activeTerm, setActiveTerm] = useState("all"); // "all" | "term1" | "term2" | "term3" | "term4"
  const hasInitializedTerm = useRef(false);
  const { activeSchoolYear, activeQuarter, viewMode, setViewMode } = useAcademic();
  const [academicSettings, setAcademicSettings] = useState({ schoolYear: "2026-2027", quarter: "1st Quarter" });

  useEffect(() => {
    setAcademicSettings({ schoolYear: activeSchoolYear, quarter: activeQuarter });
    
    // Auto-select term based on activeQuarter ONLY once
    if (activeQuarter && !hasInitializedTerm.current) {
      const quarterMap = {
        "1st Quarter": "term1",
        "2nd Quarter": "term2",
        "3rd Quarter": "term3",
        "4th Quarter": "term4"
      };
      setActiveTerm(quarterMap[activeQuarter] || "all");
      hasInitializedTerm.current = true;
    }
  }, [activeSchoolYear, activeQuarter]);

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
  const assessmentSubmissionsMapRef = useRef({});
  const submittedStudentProfilesRef = useRef({});
  const [assessmentStatusMap, setAssessmentStatusMap] = useState({});
  const [assessmentFeedbackMap, setAssessmentFeedbackMap] = useState({});
  const [submissionActionStateMap, setSubmissionActionStateMap] = useState({});
  const assessmentGradesMapRef = useRef({});
  const assessmentItemsRef = useRef([]);
  const [autoSaveStateMap, setAutoSaveStateMap] = useState({});
  const [autoSaveMessage, setAutoSaveMessage] = useState("");
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);
  const autoSaveTimersRef = useRef({});

  useEffect(() => {
    gradesCacheRef.current = gradesCache;
  }, [gradesCache]);

  useEffect(() => {
    gradingSettingsRef.current = gradingSettingsByCategory;
  }, [gradingSettingsByCategory]);

  useEffect(() => {
    assessmentGradesMapRef.current = assessmentGradesMap;
  }, [assessmentGradesMap]);

  useEffect(() => {
    assessmentSubmissionsMapRef.current = assessmentSubmissionsMap;
  }, [assessmentSubmissionsMap]);

  useEffect(() => {
    submittedStudentProfilesRef.current = submittedStudentProfiles;
  }, [submittedStudentProfiles]);

  useEffect(() => {
    assessmentItemsRef.current = assessmentItems;
  }, [assessmentItems]);

  const mergeNestedMaps = (currentMap, incomingMap) => {
    const next = { ...(currentMap || {}) };
    Object.entries(incomingMap || {}).forEach(([outerKey, value]) => {
      next[outerKey] = {
        ...(next[outerKey] || {}),
        ...(value || {}),
      };
    });
    return next;
  };

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
      .select("id, code, name, section, grade_level, subject_category")
      .eq("teacher_id", id)
      .order("code", { ascending: true });
    if (error) { console.error("Failed to load classes:", error); setClasses([]); return; }
    setClasses((data ?? []).map((item) => ({
      id: String(item.id),
      code: String(item.code || "").trim(),
      name: String(item.name || "Untitled Subject").trim(),
      section: String(item.section || item.grade_level || "").trim() || "No section assigned",
      subjectCategory: normalizeSubjectCategory(item.subject_category || "", item.name || item.code || ""),
    })));
  }, []);

  const fetchGradingSettings = useCallback(async () => {
    if (!supabase) {
      setGradingSettingsByCategory(DEPED_DEFAULT_GRADE_SETTINGS);
      return;
    }

    const { data, error } = await supabase
      .from("grading_settings")
      .select("subject_category, written_works_weight, performance_tasks_weight, written_works_enabled, performance_tasks_enabled");

    if (error || !data) {
      console.warn("Failed to load grading settings, falling back to defaults:", error);
      setGradingSettingsByCategory(DEPED_DEFAULT_GRADE_SETTINGS);
      return;
    }

    const mapped = { ...DEPED_DEFAULT_GRADE_SETTINGS };
    (data ?? []).forEach((row) => {
      const category = normalizeSubjectCategory(row.subject_category || "", row.subject_category || "");
      mapped[category] = {
        writtenWorksWeight: Number(row.written_works_weight ?? 0) || 0,
        performanceTasksWeight: Number(row.performance_tasks_weight ?? 0) || 0,
        writtenWorksEnabled: row.written_works_enabled !== false,
        performanceTasksEnabled: row.performance_tasks_enabled !== false,
      };
    });

    setGradingSettingsByCategory(mapped);
  }, []);

  const fetchAssessmentsForClass = useCallback(async (currentTeacherId, classId, schoolYear, quarter) => {
    if (isDemoMode || String(classId).startsWith("demo-")) {
      return MOCK_DEMO_ASSESSMENTS;
    }
    if (!supabase || !currentTeacherId || !classId) { setAssessmentItems([]); return []; }

    const allAssessments = [];

    // 1. Try to fetch from assignments_activity
    try {
      let query = supabase
        .from("assignments_activity")
        .select("*")
        .eq("school_year", schoolYear);
      if (quarter) {
        query = query.eq("term", quarter);
      }
      const { data, error } = await query;
      if (!error && data) {
        const rows = (data ?? []).filter((row) => {
          const rowCourseId = String(row?.course_id || row?.subject_id || row?.class_id || "").trim();
          const rowTeacherId = String(row?.teacher_id || row?.created_by || "").trim();
          const classMatches = !classId || !rowCourseId || rowCourseId === classId;
          const teacherMatches = !rowTeacherId || rowTeacherId === currentTeacherId;
          return classMatches && teacherMatches;
        });
        rows.forEach(row => {
          allAssessments.push(normalizeAssessment(row));
        });
      }
    } catch (e) {
      console.warn("Failed to fetch from assignments_activity:", e);
    }

    // 2. Fetch lessons of this class to resolve LMS assignments and quizzes
    let lessonIds = [];
    try {
      let lQuery = supabase
        .from("lessons")
        .select("id")
        .eq("subject_id", classId)
        .eq("school_year", schoolYear);
      if (quarter) {
        lQuery = lQuery.eq("term", quarter);
      }
      const { data: lessons, error: lessonsError } = await lQuery;
      
      if (!lessonsError && lessons) {
        lessonIds = lessons.map(l => l.id);
      }
    } catch (e) {
      console.warn("Failed to fetch lessons:", e);
    }

    if (lessonIds.length > 0) {
      // 3. Try to fetch LMS assignments + their lesson_activities category
      try {
        let asgQuery = supabase
          .from("assignments")
          .select("*")
          .in("lesson_id", lessonIds);
        
        if (quarter) {
          asgQuery = asgQuery.eq("term", quarter);
        }
        
        const { data, error } = await asgQuery;
        
        if (!error && data && data.length > 0) {
          // Fetch lesson_activities to determine activity_type (Assignment vs Assessment/Seatwork)
          const assignmentIds = data.map(r => r.id);
          let activityTypeMap = {};
          try {
            const { data: laData, error: laError } = await supabase
              .from("lesson_activities")
              .select("activity_id, activity_type")
              .in("activity_id", assignmentIds);
            if (!laError && laData) {
              laData.forEach(la => {
                activityTypeMap[la.activity_id] = la.activity_type;
              });
            }
          } catch (e) {
            console.warn("Failed to fetch lesson_activities for assignments:", e);
          }

          data.forEach(row => {
            const normalized = normalizeAssessment(row);
            const isQuiz = String(row.assignment_type || "").trim().toLowerCase() === "quiz" || String(row.title || "").toLowerCase().includes("quiz");
            // Use lesson_activities.activity_type to determine grading category
            const laType = activityTypeMap[row.id]; // "Assignment", "Assessment", "Activity", etc.
            let resolvedType;
            if (isQuiz) {
              resolvedType = "quiz";
            } else if (laType === "Assessment" || laType === "Activity") {
              // Seatwork / Activity → maps to "activity" grading component
              resolvedType = "activity";
            } else {
              resolvedType = "assignment";
            }
            const resolvedDesignation = isQuiz ? "Quiz" : (resolvedType === "activity" ? "Activity" : "Assignment");
            allAssessments.push({
              ...normalized,
              type: resolvedType,
              designation: resolvedDesignation,
            });
          });
        }
      } catch (e) {
        console.warn("Failed to fetch LMS assignments:", e);
      }

      // 4. Try to fetch LMS quizzes
      try {
        let quizQuery = supabase
          .from("quizzes")
          .select("*")
          .in("lesson_id", lessonIds);
          
        if (quarter) {
          quizQuery = quizQuery.eq("term", quarter);
        }
        
        const { data, error } = await quizQuery;
        
        if (!error && data) {
          data.forEach(row => {
            allAssessments.push(normalizeAssessment({
              ...row,
              assessment_type: "quiz",
              designation: "Quiz"
            }));
          });
        }
      } catch (e) {
        console.warn("Failed to fetch LMS quizzes:", e);
      }
    }

    // Deduplicate assessments by ID
    const uniqueMap = new Map();
    allAssessments.forEach(item => {
      if (item.id) {
        uniqueMap.set(item.id, item);
      }
    });

    const mapped = Array.from(uniqueMap.values())
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

    return assessmentsWithNames;
  }, []);

  const fetchAssessmentGrades = useCallback(async (currentTeacherId, classId, assessments, studentIds) => {
    if (isDemoMode || String(classId).startsWith("demo-")) {
      setAssessmentGradesMap(MOCK_DEMO_GRADES_MAP);
      setAssessmentStatusMap(MOCK_DEMO_STATUS_MAP);
      return;
    }
    if (!supabase || !currentTeacherId || !classId || assessments.length === 0 || studentIds.length === 0) {
      setAssessmentGradesMap({});
      setAssessmentStatusMap({});
      return;
    }

    const assessmentIds = assessments.map((item) => item.id);

    let gradeResult = await supabase
      .from("teacher_assessment_grades")
      .select("assessment_id, student_id, grade_value, status, feedback, grading_component, grading_term")
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
    const gradesMap = {};
    const statusMap = {};
    const feedbackMapped = {};

    (data ?? []).forEach((row) => {
      const aid = String(row.assessment_id || "").trim();
      const sid = String(row.student_id || "").trim();
      if (!aid || !sid) return;

      if (!gradesMap[aid]) gradesMap[aid] = {};
      gradesMap[aid][sid] = typeof row.grade_value === "number" ? row.grade_value : Number(row.grade_value || 0);
      if (!gradesMap[aid].meta) gradesMap[aid].meta = {};
      gradesMap[aid].meta[sid] = {
        gradingComponent: String(row.grading_component || "").trim(),
        gradingTerm: String(row.grading_term || "").trim(),
      };

      if (!statusMap[aid]) statusMap[aid] = {};
      statusMap[aid][sid] = String(row.status || "Pending");

      const fb = String(row.feedback || row.feedback_text || row.comments || "").trim();
      if (fb) {
        if (!feedbackMapped[aid]) feedbackMapped[aid] = {};
        feedbackMapped[aid][sid] = fb;
      }
    });

    setAssessmentGradesMap((prev) => mergeNestedMaps(prev, gradesMap));
    setAssessmentStatusMap((prev) => mergeNestedMaps(prev, statusMap));
    setAssessmentFeedbackMap((prev) => mergeNestedMaps(prev, feedbackMapped));
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
      .select("id, assessment_id, student_id, response_text, file_url, file_name, file_path, submitted_at, updated_at, created_at")
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
    assessmentSubmissionsMapRef.current = mapped;

    const submissionIds = (data ?? []).map((row) => String(row.id || "")).filter(Boolean);
    if (submissionIds.length > 0) {
      const { data: feedbackRows, error: feedbackError } = await supabase
        .from("submission_feedback")
        .select("submission_id, comments, teacher_id")
        .eq("teacher_id", currentTeacherId)
        .in("submission_id", submissionIds);

      if (!feedbackError && feedbackRows) {
        const feedbackMap = {};
        (feedbackRows ?? []).forEach((row) => {
          const submissionId = String(row.submission_id || "");
          if (!submissionId) return;
          const submission = (data ?? []).find((item) => String(item.id || "") === submissionId);
          if (!submission) return;
          const assessmentId = String(submission.assessment_id || "");
          const studentId = String(submission.student_id || "");
          if (!assessmentId || !studentId) return;
          
          const fb = String(row.comments || "").trim();
          if (fb) {
            if (!feedbackMap[assessmentId]) feedbackMap[assessmentId] = {};
            feedbackMap[assessmentId][studentId] = fb;
          }
        });
        setAssessmentFeedbackMap((prev) => mergeNestedMaps(prev, feedbackMap));
      }
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
    if (isDemoMode || String(classId).startsWith("demo-")) {
      return {
        studentIds: MOCK_DEMO_STUDENTS.map((s) => s.id),
        mapped: MOCK_DEMO_STUDENTS,
        persistedGradeMap: {},
      };
    }
    if (!supabase || !currentTeacherId || !classId) { return { studentIds: [], mapped: [], persistedGradeMap: {} }; }

    const currentClass = activeClassesList.find((item) => item.id === classId) || null;
    const subjectCategory = normalizeSubjectCategory(currentClass?.subjectCategory || "", currentClass?.name || currentClass?.code || "");

    const { data: assignments, error: assignmentError } = await supabase
      .from("teacher_student_assignments")
      .select("student_id")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId);

    if (assignmentError) { console.error("Failed to load class assignments:", assignmentError); return { studentIds: [], mapped: [], persistedGradeMap: {} }; }

    const studentIds = [...new Set((assignments ?? []).map((row) => String(row.student_id || "")).filter(Boolean))];
    if (studentIds.length === 0) { return { studentIds: [], mapped: [], persistedGradeMap: {} }; }

    const { data: studentRows, error: studentError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, lrn")
      .eq("role", "student")
      .in("id", studentIds);

    if (studentError) { console.error("Failed to load students:", studentError); return { studentIds: [], mapped: [], persistedGradeMap: {} }; }

    const { data: gradeRows } = await supabase
      .from("teacher_student_grades")
      .select("quarter1_grade, quarter2_grade, quarter3_grade, quarter4_grade, overall_grade, grade_computation, subject_category, student_id")
      .eq("teacher_id", currentTeacherId)
      .eq("subject_id", classId)
      .in("student_id", studentIds);

    const persistedGradeMap = {};
    (gradeRows ?? []).forEach((row) => {
      const id = String(row.student_id || "");
      if (!id) return;

      let gradeComputation = null;
      try {
        gradeComputation = row.grade_computation ? (typeof row.grade_computation === "string" ? JSON.parse(row.grade_computation) : row.grade_computation) : null;
      } catch {
        gradeComputation = null;
      }

      persistedGradeMap[id] = {
        quarter1Grade: clampGradeValue(row.quarter1_grade),
        quarter2Grade: clampGradeValue(row.quarter2_grade),
        quarter3Grade: clampGradeValue(row.quarter3_grade),
        quarter4Grade: clampGradeValue(row.quarter4_grade),
        overallGrade: clampGradeValue(row.overall_grade ?? 0),
        gradeComputation,
        subjectCategory: normalizeSubjectCategory(row.subject_category || subjectCategory, currentClass?.name || currentClass?.code || ""),
      };
    });

    const cacheForClass = gradesCacheRef.current[classId] || {};
    const mapped = (studentRows ?? []).map((student) => {
      const studentId = String(student.id);
      const cached = cacheForClass[studentId] || persistedGradeMap[studentId] || { ...createDefaultGradeRecord(), quarter1Grade: 0, quarter2Grade: 0, quarter3Grade: 0, quarter4Grade: 0 };
      const studentName = [student.first_name, student.middle_name, student.last_name]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim() || "Student";

      const computation = computeDepEdStudentComputation({
        assessmentItems: assessmentItemsRef.current,
        assessmentGradesMap: assessmentGradesMapRef.current,
        studentId,
        subjectCategory,
        gradingSettingsByCategory: gradingSettingsRef.current,
      });

      const current = {
        id: studentId,
        studentName,
        studentId: String(student.lrn || "N/A"),
        quarter1Grade: clampGradeValue(computation.quarters.quarter1.quarterlyGrade || cached.quarter1Grade || 0),
        quarter2Grade: clampGradeValue(computation.quarters.quarter2.quarterlyGrade || cached.quarter2Grade || 0),
        quarter3Grade: clampGradeValue(computation.quarters.quarter3.quarterlyGrade || cached.quarter3Grade || 0),
        quarter4Grade: clampGradeValue(computation.quarters.quarter4.quarterlyGrade || cached.quarter4Grade || 0),
        gradeComputation: computation,
        overallGrade: computation.finalGrade > 0 ? computation.finalGrade : clampGradeValue(cached.overallGrade ?? 0),
      };

      const overallGrade = current.overallGrade;
      return { ...current, overallGrade, remarks: computation.remarks || getGradeRemarks(overallGrade) };
    });

    return { studentIds, mapped, persistedGradeMap };
  }, []);

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
      await fetchGradingSettings();
      setLoading(false);
    };
    initialize();
  }, [navigate, fetchClasses, fetchGradingSettings]);

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
    if ((isDemoMode || activeClassesList.length > 0) && (!selectedClass || !activeClassesList.some(c => c.id === selectedClass))) {
      if (activeClassesList[0]?.id) {
        setSelectedClass(activeClassesList[0].id);
      }
    }
  }, [isDemoMode, activeClassesList, selectedClass]);

  useEffect(() => {
    if (isDemoMode) {
      if (assessmentItems.length > 0 && !selectedAssessmentId) {
        setSelectedAssessmentId(assessmentItems[0].id);
      }
      if (!selectedStudentId) {
        setSelectedStudentId("demo-stu-1");
      }
    }
  }, [isDemoMode, assessmentItems, selectedAssessmentId, selectedStudentId]);

  useEffect(() => {
    if ((!teacherId && !isDemoMode) || !selectedClass) {
      setStudentGrades([]);
      setAssessmentItems([]);
      setAssessmentGradesMap({});
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      setIsSwitchingTerm(true);
      const { studentIds, mapped, persistedGradeMap } = await fetchStudentsForClass(teacherId, selectedClass);
      if (!isMounted) return;

      const termMap = {
        "term1": "1st Quarter",
        "term2": "2nd Quarter",
        "term3": "3rd Quarter",
        "term4": "4th Quarter"
      };
      const targetQuarter = activeTerm === "all" ? null : termMap[activeTerm];

      const assessments = await fetchAssessmentsForClass(teacherId, selectedClass, activeSchoolYear, targetQuarter);
      if (!isMounted) return;

      // Set everything together to avoid race conditions and UI flashing
      setGradesCache((prev) => ({
        ...prev,
        [selectedClass]: { ...(prev[selectedClass] || {}), ...persistedGradeMap },
      }));
      setStudentGrades(mapped);
      setAssessmentItems(assessments);
      setExpandedAssessments((prev) => {
        const next = { ...prev };
        assessments.forEach((assessment) => {
          if (typeof next[assessment.id] === "undefined") {
            next[assessment.id] = true;
          }
        });
        return next;
      });

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
      
      if (isMounted) {
        setIsSwitchingTerm(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [teacherId, selectedClass, activeSchoolYear, activeQuarter, viewMode, activeTerm, fetchStudentsForClass, fetchAssessmentsForClass, fetchAssessmentGrades, fetchAssessmentSubmissions, requestedContext.assessmentId]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = window.setTimeout(() => setSaveSuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  // Sync studentGrades in real-time when assessment scores or settings change.
  useEffect(() => {
    if (studentGrades.length === 0 || !selectedClass) return;

    const classItem = activeClassesList.find((item) => item.id === selectedClass) || null;
    const subjectCategory = normalizeSubjectCategory(classItem?.subjectCategory || "", classItem?.name || classItem?.code || "");

    setStudentGrades((prev) => {
      let isDifferent = false;
      const nextGrades = prev.map((student) => {
        const computation = computeDepEdStudentComputation({
          assessmentItems,
          assessmentGradesMap,
          assessmentStatusMap,
          studentId: student.id,
          subjectCategory,
          gradingSettingsByCategory,
        });

        // Compute per-category averages (Quiz, Activity, Assignment, Exam)
        const categoryAverages = calculateStudentAssessmentAverages(
          student.id,
          assessmentGradesMap,
          assessmentItems
        );

        const next = {
          ...student,
          quarter1Grade: computation.quarters.quarter1.quarterlyGrade,
          quarter2Grade: computation.quarters.quarter2.quarterlyGrade,
          quarter3Grade: computation.quarters.quarter3.quarterlyGrade,
          quarter4Grade: computation.quarters.quarter4.quarterlyGrade,
          gradeComputation: computation,
          overallGrade: computation.finalGrade,
          remarks: computation.remarks,
          // Per-category averages shown in the grade table columns
          quizAverage: categoryAverages.quizAverage,
          activityGrade: categoryAverages.activityGrade,
          assignmentGrade: categoryAverages.assignmentGrade,
          examGrade: categoryAverages.examGrade,
        };

        if (
          student.quarter1Grade !== next.quarter1Grade ||
          student.quarter2Grade !== next.quarter2Grade ||
          student.quarter3Grade !== next.quarter3Grade ||
          student.quarter4Grade !== next.quarter4Grade ||
          student.overallGrade !== next.overallGrade ||
          student.quizAverage !== next.quizAverage ||
          student.activityGrade !== next.activityGrade ||
          student.assignmentGrade !== next.assignmentGrade ||
          student.examGrade !== next.examGrade
        ) {
          isDifferent = true;
        }

        return next;
      });

      if (isDifferent) {
        // Trigger a separate state update for unsaved changes to avoid side-effects inside setter
        setTimeout(() => setHasUnsavedChanges(true), 0);
        return nextGrades;
      }
      return prev;
    });
  }, [assessmentGradesMap, assessmentStatusMap, assessmentItems, gradingSettingsByCategory, selectedClass, classes, studentGrades.length]);

  // Real-time subscription: update submissions map when students submit
  useEffect(() => {
    if (!supabase || !teacherId || !selectedClass) return;

    const channel = supabase
      .channel(`teacher-submissions-${teacherId}-${selectedClass}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "teacher_assessment_submissions" }, async (payload) => {
        const newRow = payload.new;
        if (!newRow) return;
        // ensure it's for the current class and teacher
        if (String(newRow.subject_id || "") !== String(selectedClass)) return;
        if (String(newRow.teacher_id || "") !== String(teacherId)) return;

        const normalized = normalizeSubmission(newRow);
        if (!normalized.assessmentId || !normalized.studentId) return;

        // Merge into submissions map
        setAssessmentSubmissionsMap((prev) => {
          const next = { ...(prev || {}) };
          if (!next[normalized.assessmentId]) next[normalized.assessmentId] = {};
          next[normalized.assessmentId][normalized.studentId] = normalized;
          assessmentSubmissionsMapRef.current = next;
          return next;
        });

        // Fetch and cache submitter profile if missing
        let studentName = "Student";
        try {
          if (!submittedStudentProfilesRef.current[normalized.studentId]) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, first_name, middle_name, last_name, lrn")
              .eq("id", normalized.studentId)
              .maybeSingle();
            if (profile && profile.id) {
              const fullName = [profile.first_name, profile.middle_name, profile.last_name]
                .map((p) => String(p || "").trim())
                .filter(Boolean)
                .join(" ") || "Student";
              const profileObj = { id: String(profile.id), studentName: fullName, studentId: String(profile.lrn || "N/A") };
              setSubmittedStudentProfiles((prev) => {
                const next = { ...(prev || {}) };
                next[profileObj.id] = profileObj;
                submittedStudentProfilesRef.current = next;
                return next;
              });
              studentName = profileObj.studentName;
            }
          } else {
            studentName = submittedStudentProfilesRef.current[normalized.studentId]?.studentName || studentName;
          }
        } catch (e) {
          console.error("Failed to fetch submitted student profile:", e);
        }

        // Find assessment title if available
        const assessment = (assessmentItemsRef.current || []).find((a) => String(a.id) === String(normalized.assessmentId));
        const assessmentTitle = assessment ? (assessment.displayName || assessment.title) : "an assessment";

        // Show toast to teacher
        try {
          toast.success(`${studentName} submitted ${assessmentTitle}`);
        } catch {}

        // Create a notification row so NotificationDropdown picks it up in realtime
        try {
          await supabase.from("notifications").insert([{
            user_id: teacherId,
            type: "assignments",
            title: `New submission: ${assessmentTitle}`,
            body: `${studentName} submitted ${assessmentTitle}`,
            related_id: normalized.assessmentId,
            class_id: selectedClass,
          }]);
        } catch (err) {
          console.error("Failed to insert notification for new submission:", err);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teacher_assessment_submissions" }, async (payload) => {
        const newRow = payload.new;
        if (!newRow) return;
        if (String(newRow.subject_id || "") !== String(selectedClass)) return;
        if (String(newRow.teacher_id || "") !== String(teacherId)) return;

        const normalized = normalizeSubmission(newRow);
        if (!normalized.assessmentId || !normalized.studentId) return;

        setAssessmentSubmissionsMap((prev) => {
          const next = { ...(prev || {}) };
          if (!next[normalized.assessmentId]) next[normalized.assessmentId] = {};
          next[normalized.assessmentId][normalized.studentId] = normalized;
          assessmentSubmissionsMapRef.current = next;
          return next;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "teacher_assessment_submissions" }, (payload) => {
        const oldRow = payload.old;
        if (!oldRow) return;
        if (String(oldRow.subject_id || "") !== String(selectedClass)) return;
        if (String(oldRow.teacher_id || "") !== String(teacherId)) return;

        const normalized = normalizeSubmission(oldRow);
        if (!normalized.assessmentId || !normalized.studentId) return;

        setAssessmentSubmissionsMap((prev) => {
          const next = { ...(prev || {}) };
          if (next[normalized.assessmentId]) {
            delete next[normalized.assessmentId][normalized.studentId];
            if (Object.keys(next[normalized.assessmentId]).length === 0) delete next[normalized.assessmentId];
          }
          assessmentSubmissionsMapRef.current = next;
          return next;
        });
      })
      // Also listen to legacy/general `submissions` table
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "submissions" }, async (payload) => {
        const newRow = payload.new;
        if (!newRow) return;
        const normalized = normalizeSubmission(newRow);
        if (!normalized.assessmentId || !normalized.studentId) return;
        // check whether this assessment belongs to the currently-loaded class
        const assessment = (assessmentItemsRef.current || []).find((a) => String(a.id) === String(normalized.assessmentId));
        if (!assessment) return;

        setAssessmentSubmissionsMap((prev) => {
          const next = { ...(prev || {}) };
          if (!next[normalized.assessmentId]) next[normalized.assessmentId] = {};
          next[normalized.assessmentId][normalized.studentId] = normalized;
          assessmentSubmissionsMapRef.current = next;
          return next;
        });

        // fetch profile if missing
        try {
          if (!submittedStudentProfilesRef.current[normalized.studentId]) {
            const { data: profile } = await supabase.from("profiles").select("id, first_name, middle_name, last_name, lrn").eq("id", normalized.studentId).maybeSingle();
            if (profile && profile.id) {
              const fullName = [profile.first_name, profile.middle_name, profile.last_name].map((p)=>String(p||"").trim()).filter(Boolean).join(" ")||"Student";
              const profileObj = { id: String(profile.id), studentName: fullName, studentId: String(profile.lrn||"N/A") };
              setSubmittedStudentProfiles((prev) => { const next = { ...(prev||{}) }; next[profileObj.id]=profileObj; submittedStudentProfilesRef.current = next; return next; });
            }
          }
        } catch (e) { console.error("Failed to fetch profile for submission:", e); }

        const assessmentTitle = assessment.displayName || assessment.title || "an assessment";
        try { toast.success(`${submittedStudentProfilesRef.current[normalized.studentId]?.studentName || 'Student'} submitted ${assessmentTitle}`); } catch {}
        try { await supabase.from("notifications").insert([{ user_id: teacherId, type: "assignments", title: `New submission: ${assessmentTitle}`, body: `${submittedStudentProfilesRef.current[normalized.studentId]?.studentName || 'Student'} submitted ${assessmentTitle}`, related_id: normalized.assessmentId, class_id: selectedClass }]); } catch (e) { console.error("Failed to create notification from submissions table:", e); }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "submissions" }, (payload) => {
        const newRow = payload.new;
        if (!newRow) return;
        const normalized = normalizeSubmission(newRow);
        if (!normalized.assessmentId || !normalized.studentId) return;
        const assessment = (assessmentItemsRef.current || []).find((a) => String(a.id) === String(normalized.assessmentId));
        if (!assessment) return;
        setAssessmentSubmissionsMap((prev) => { const next = { ...(prev||{}) }; if (!next[normalized.assessmentId]) next[normalized.assessmentId] = {}; next[normalized.assessmentId][normalized.studentId] = normalized; assessmentSubmissionsMapRef.current = next; return next; });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "submissions" }, (payload) => {
        const oldRow = payload.old;
        if (!oldRow) return;
        const normalized = normalizeSubmission(oldRow);
        if (!normalized.assessmentId || !normalized.studentId) return;
        const assessment = (assessmentItemsRef.current || []).find((a) => String(a.id) === String(normalized.assessmentId));
        if (!assessment) return;
        setAssessmentSubmissionsMap((prev) => { const next = { ...(prev||{}) }; if (next[normalized.assessmentId]) { delete next[normalized.assessmentId][normalized.studentId]; if (Object.keys(next[normalized.assessmentId]).length===0) delete next[normalized.assessmentId]; } assessmentSubmissionsMapRef.current = next; return next; });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teacherId, selectedClass]);

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
    determinePassFailStatus(percentage);
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
    console.log("Grade input:", value);

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
    console.log("Feedback input:", value);
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
    let currentSubmission = assessmentSubmissionsMap?.[selectedAssessmentId]?.[selectedStudentId] || null;
    const currentFeedback = assessmentFeedbackMap?.[selectedAssessmentId]?.[selectedStudentId] || "";
    const actionKey = `${selectedAssessmentId}:${selectedStudentId}`;

    if (!supabase || !teacherId || !selectedClass || !currentAssessment || !selectedStudentId) {
      console.warn("[GradesManagement] Return action aborted due to missing context:", {
        teacherId,
        selectedClass,
        currentAssessmentExists: !!currentAssessment,
        selectedStudentId,
      });
      return;
    }

    const currentGrade = assessmentGradesMap?.[selectedAssessmentId]?.[selectedStudentId] ?? "";

    console.log("[GradesManagement] Manual grading process initiated:", {
      teacherId,
      subjectId: selectedClass,
      studentId: selectedStudentId,
      assessmentId: currentAssessment.id,
      gradeValue: currentGrade,
      feedback: currentFeedback,
      hasSubmission: !!currentSubmission,
    });

    // Check if duplicate grade exists with status Returned to prevent duplicate creation
    const currentStatus = assessmentStatusMap?.[selectedAssessmentId]?.[selectedStudentId];
    if (currentStatus === "Returned") {
      console.log("[GradesManagement] Grade already returned. Preventing duplicate grade action.");
      toast.info("This assignment has already been returned.");
      return;
    }

    setSubmissionActionStateMap((prev) => ({ ...prev, [actionKey]: "returning" }));

    // 1. If student did not submit anything, create a placeholder submission so feedback & grades track correctly.
    try {
      if (!currentSubmission) {
        console.log("[GradesManagement] Missing submission handling: Creating placeholder submission...");
        const placeholderSubmission = {
          teacher_id: teacherId,
          subject_id: selectedClass,
          assessment_id: currentAssessment.id,
          student_id: selectedStudentId,
          response_text: "Placeholder submission (Teacher Graded / Missing Submission)",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: newSubData, error: submissionInsertError } = await supabase
          .from("teacher_assessment_submissions")
          .upsert(placeholderSubmission, { onConflict: "teacher_id,subject_id,assessment_id,student_id" })
          .select("*")
          .maybeSingle();

        if (submissionInsertError) {
          console.error("[GradesManagement] Failed to create placeholder submission. RLS failure or DB error:", submissionInsertError);
          toast.error("Failed to initialize submission record for grading.");
          return;
        }

        if (newSubData) {
          currentSubmission = normalizeSubmission(newSubData);
          console.log("[GradesManagement] Placeholder submission created successfully:", currentSubmission);

          setAssessmentSubmissionsMap((prev) => ({
            ...prev,
            [currentAssessment.id]: {
              ...(prev[currentAssessment.id] || {}),
              [selectedStudentId]: currentSubmission,
            },
          }));
        }
      }

      const gradePayload = {
        teacher_id: teacherId,
        subject_id: selectedClass,
        assessment_id: currentAssessment.id,
        assessment_title: currentAssessment.title || "Assessment",
        assessment_type: currentAssessment.type || "assignment",
        max_points: currentAssessment.maxPoints || 100,
        student_id: selectedStudentId,
        grade_value: Number(currentGrade || 0),
        status: "Returned",
        updated_at: new Date().toISOString(),
      };

      console.log("[GradesManagement] Upserting into teacher_assessment_grades:", gradePayload);

      const { error: gradeError } = await supabase
        .from("teacher_assessment_grades")
        .upsert(gradePayload, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });

      if (gradeError) {
        console.error("[GradesManagement] Database write error on teacher_assessment_grades:", gradeError);
        toast.error("Failed to save grade in gradebook.");
        return;
      }

      console.log("[GradesManagement] Gradebook insertion/update success.");

      if (currentSubmission?.id) {
        console.log("[GradesManagement] Updating submission record for ID:", currentSubmission.id);
        const { error: submissionUpdateError } = await supabase
          .from("teacher_assessment_submissions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", currentSubmission.id);

        if (submissionUpdateError) {
          console.error("[GradesManagement] Failed to update submission status:", submissionUpdateError);
        } else {
          setAssessmentSubmissionsMap((prev) => ({
            ...prev,
            [currentAssessment.id]: {
              ...(prev[currentAssessment.id] || {}),
              [selectedStudentId]: {
                ...(prev[currentAssessment.id]?.[selectedStudentId] || currentSubmission || {}),
                status: 'Submitted'
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

        console.log("[GradesManagement] Syncing submission feedback:", feedbackPayload);
        const { error: feedbackError } = await supabase
          .from("submission_feedback")
          .upsert(feedbackPayload, { onConflict: "submission_id,teacher_id" });

        if (feedbackError) {
          console.error("[GradesManagement] Failed to sync submission feedback:", feedbackError);
        } else {
          console.log("[GradesManagement] Synchronized submission feedback success.");
        }
      }

      const key = `${currentAssessment.id}:${selectedStudentId}`;
      setAssessmentStatusMap((prev) => ({
        ...prev,
        [currentAssessment.id]: {
          ...(prev[currentAssessment.id] || {}),
          [selectedStudentId]: "Returned",
        },
      }));

      setAssessmentGradesMap((prev) => ({
        ...prev,
        [currentAssessment.id]: {
          ...(prev[currentAssessment.id] || {}),
          [selectedStudentId]: Number(currentGrade || 0),
        },
      }));

      setAutoSaveStateMap((prev) => ({ ...prev, [key]: "saved" }));
      setAutoSaveMessage("Assignment returned successfully.");
      toast.success("Assignment returned successfully.");
    } finally {
      setSubmissionActionStateMap((prev) => ({ ...prev, [actionKey]: "idle" }));
    }
  }, [assessmentFeedbackMap, assessmentGradesMap, assessmentItems, assessmentSubmissionsMap, selectedAssessmentId, selectedClass, selectedStudentId, supabase, teacherId, assessmentStatusMap]);

  const handleUndoReturn = useCallback(async () => {
    const currentAssessment = assessmentItems.find((item) => item.id === selectedAssessmentId) || null;
    let currentSubmission = assessmentSubmissionsMap?.[selectedAssessmentId]?.[selectedStudentId] || null;
    const currentFeedback = assessmentFeedbackMap?.[selectedAssessmentId]?.[selectedStudentId] || "";
    const currentGrade = assessmentGradesMap?.[selectedAssessmentId]?.[selectedStudentId] ?? "";
    const actionKey = `${selectedAssessmentId}:${selectedStudentId}`;

    if (!supabase || !teacherId || !selectedClass || !currentAssessment || !selectedStudentId) {
      console.warn("[GradesManagement] Undo Return action aborted due to missing context:", {
        teacherId,
        selectedClass,
        currentAssessmentExists: !!currentAssessment,
        selectedStudentId,
      });
      return;
    }

    console.log("[GradesManagement] Undo Return process initiated:", {
      teacherId,
      subjectId: selectedClass,
      studentId: selectedStudentId,
      assessmentId: currentAssessment.id,
    });

    setSubmissionActionStateMap((prev) => ({ ...prev, [actionKey]: "undoing" }));

    try {
      const revertedGradeStatus = currentGrade === "" ? "Pending" : "Graded";

      const gradePayload = {
        teacher_id: teacherId,
        subject_id: selectedClass,
        assessment_id: currentAssessment.id,
        assessment_title: currentAssessment.title || "Assessment",
        assessment_type: currentAssessment.type || "assignment",
        max_points: currentAssessment.maxPoints || 100,
        student_id: selectedStudentId,
        grade_value: currentGrade !== "" ? Number(currentGrade) : 0,
        status: revertedGradeStatus,
        updated_at: new Date().toISOString(),
      };

      console.log("[GradesManagement] Reverting status in teacher_assessment_grades:", gradePayload);
      const { error: gradeError } = await supabase
        .from("teacher_assessment_grades")
        .upsert(gradePayload, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });

      if (gradeError) {
        console.error("[GradesManagement] Failed to update grade status on Undo Return:", gradeError);
        toast.error("Failed to undo return.");
        return;
      }

      if (currentSubmission?.id) {
        console.log("[GradesManagement] Updating submission record for ID:", currentSubmission.id);
        const { error: submissionUpdateError } = await supabase
          .from("teacher_assessment_submissions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", currentSubmission.id);

        if (submissionUpdateError) {
          console.error("[GradesManagement] Failed to revert submission status:", submissionUpdateError);
        } else {
          setAssessmentSubmissionsMap((prev) => ({
            ...prev,
            [currentAssessment.id]: {
              ...(prev[currentAssessment.id] || {}),
              [selectedStudentId]: {
                ...(prev[currentAssessment.id]?.[selectedStudentId] || currentSubmission || {}),
                status: 'Submitted'
              },
            },
          }));
        }
      }

      const key = `${currentAssessment.id}:${selectedStudentId}`;
      setAssessmentStatusMap((prev) => ({
        ...prev,
        [currentAssessment.id]: {
          ...(prev[currentAssessment.id] || {}),
          [selectedStudentId]: revertedGradeStatus,
        },
      }));

      setAutoSaveStateMap((prev) => ({ ...prev, [key]: "saved" }));
      setAutoSaveMessage("Return undone successfully.");
      toast.success("Return undone successfully.");
    } finally {
      setSubmissionActionStateMap((prev) => ({ ...prev, [actionKey]: "idle" }));
    }
  }, [assessmentFeedbackMap, assessmentGradesMap, assessmentItems, assessmentSubmissionsMap, selectedAssessmentId, selectedClass, selectedStudentId, supabase, teacherId, assessmentStatusMap]);

  const handleSave = async () => {
    if (!selectedClass || studentGrades.length === 0 || !teacherId || !supabase) return;
    try {
      setSaving(true);
      const currentClass = activeClassesList.find((item) => item.id === selectedClass) || null;
      const subjectCategory = normalizeSubjectCategory(currentClass?.subjectCategory || "", currentClass?.name || currentClass?.code || "");

      const gradesPayload = studentGrades.map((student) => ({
        teacher_id: teacherId,
        subject_id: selectedClass,
        student_id: student.id,
        quarter1_grade: clampGradeValue(student.quarter1Grade),
        quarter2_grade: clampGradeValue(student.quarter2Grade),
        quarter3_grade: clampGradeValue(student.quarter3Grade),
        quarter4_grade: clampGradeValue(student.quarter4Grade),
        overall_grade: clampGradeValue(student.overallGrade),
        grade_computation: student.gradeComputation ? JSON.parse(serializeDepEdComputation(student.gradeComputation)) : {},
        subject_category: subjectCategory,
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
    const classItem = activeClassesList.find((item) => item.id === selectedClass);
    if (!classItem) return "";
    return `${classItem.code} - ${classItem.name} (${classItem.section})`;
  }, [activeClassesList, selectedClass]);

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
<main className="flex-1 h-screen overflow-y-auto lg:pl-64">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
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
          {/* Hero */}
          <div data-tour="teacher-grades-header" className="bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-white shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1">Grade Management</h1>
                <p className="text-white/90 text-sm">Grades auto-consolidate from class activities, quizzes &amp; assignments</p>
              </div>
            </div>
          </div>


          {autoSaveMessage && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-green-700 text-sm">{autoSaveMessage}</p>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div data-tour="teacher-grades-class-select">
                <label className="block text-sm font-bold text-green-700 mb-3 uppercase tracking-widest flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Select Subject / Section
                </label>
                {activeClassesList.length === 0 ? (
                  <div className="w-full h-12 px-4 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm flex items-center">No classes available</div>
                ) : (
                  <CustomSelect
                    value={selectedClass || activeClassesList[0]?.id}
                    onChange={(value) => { setSelectedClass(value); setHasUnsavedChanges(false); setActiveView("all"); }}
                    placeholder="Select a class"
                    className="w-full [&>button]:h-12 [&>button]:py-0"
                    options={activeClassesList.map((c) => ({ value: c.id, label: `${c.code} - ${c.name} (${c.section})` }))}
                    forceOpen={isClassSelectStepActive}
                  />
                )}
              </div>
              <div data-tour="teacher-grades-search">
                <label className="block text-xs font-medium text-green-600 mb-2 uppercase tracking-wider">
                  <Search className="w-3.5 h-3.5 inline mr-1.5" />
                  Search Student
                </label>
                <input
                  type="text"
                  placeholder="Search by name or LRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 px-4 bg-gray-50 text-green-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Grade Table */}
          {selectedClass && (
            <>
            <div data-tour="teacher-grades-table" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Table header row */}
              <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-green-900">{selectedClassName || "Select a class to view grades"}</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{filteredByView.length} student{filteredByView.length !== 1 ? "s" : ""}</p>
                </div>

                <div data-tour="teacher-grades-filters" className="flex items-center gap-3 flex-wrap">
                  {/* Quarter tabs */}
                  <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                    {[
                      { key: "all", label: "All Quarters" },
                      { key: "term1", label: "Q1" },
                      { key: "term2", label: "Q2" },
                      { key: "term3", label: "Q3" },
                      { key: "term4", label: "Q4" },
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
                        {/* Quarter columns - conditionally shown by term filter */}
                        {(activeTerm === "all" || activeTerm === "term1") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">
                            <div>Q1</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">1st Quarter</div>
                          </th>
                        )}
                        {(activeTerm === "all" || activeTerm === "term2") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">
                            <div>Q2</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">2nd Quarter</div>
                          </th>
                        )}
                        {(activeTerm === "all" || activeTerm === "term3") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">
                            <div>Q3</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">3rd Quarter</div>
                          </th>
                        )}
                        {(activeTerm === "all" || activeTerm === "term4") && (
                          <th className="px-3 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">
                            <div>Q4</div>
                            <div className="text-[10px] font-normal text-gray-400 normal-case">4th Quarter</div>
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
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredByView.map((student) => {
                        const isPassed = student.overallGrade >= 75;
                        const studentSubmissions = assessmentItems.filter(a => assessmentSubmissionsMap[a.id]?.[student.id]);
                        const completionRate = assessmentItems.length > 0 ? Math.round((studentSubmissions.length / assessmentItems.length) * 100) : 0;
                        const quarterOne = student.gradeComputation?.quarters?.quarter1 || null;
                        const fallbackWrittenWorks = quarterOne?.writtenWorks?.percentageScore ?? 0;
                        const fallbackPerformanceTasks = quarterOne?.performanceTasks?.percentageScore ?? 0;
                        const fallbackInitialGrade = quarterOne?.initialGrade ?? 0;
                        const fallbackQuarterlyGrade = quarterOne?.quarterlyGrade ?? student.overallGrade ?? 0;
                        // Use computed activityGrade if available, fall back to DepEd performanceTasks percentageScore
                        const activityDisplay = (student.activityGrade != null && student.activityGrade > 0)
                          ? student.activityGrade
                          : (fallbackPerformanceTasks > 0 ? fallbackPerformanceTasks : "Not yet graded");
                        let lastActivityDate = null;
                        studentSubmissions.forEach(a => {
                          const sub = assessmentSubmissionsMap[a.id]?.[student.id];
                          if (sub && sub.submittedAt) {
                            const date = new Date(sub.submittedAt);
                            if (!lastActivityDate || date > lastActivityDate) {
                              lastActivityDate = date;
                            }
                          }
                        });
                        return (
                          <tr 
                            key={student.id} 
                            onClick={() => setSelectedStudentForModal(student)}
                            className={`cursor-pointer hover:bg-green-50 transition-colors ${!isPassed ? "bg-red-50" : "bg-white"}`}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${isPassed ? "bg-green-600" : "bg-red-600"}`}>
                                  {student.studentName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-green-900 group-hover:text-green-700">{student.studentName}</p>
                                  <p className="text-xs text-gray-500">{student.studentId}</p>
                                </div>
                              </div>
                            </td>
                            {/* Quarter grade inputs - conditionally shown */}
                            {(activeTerm === "all" || activeTerm === "term1") && (
                              <td className="px-3 py-4 text-center bg-green-50/30" onClick={(e) => e.stopPropagation()}>
                                <span className="inline-flex min-w-16 justify-center px-2 py-1.5 rounded-lg bg-white text-green-900 border border-green-200 text-sm font-medium">
                                  {student.quarter1Grade ?? 0}
                                </span>
                              </td>
                            )}
                            {(activeTerm === "all" || activeTerm === "term2") && (
                              <td className="px-3 py-4 text-center bg-green-50/30" onClick={(e) => e.stopPropagation()}>
                                <span className="inline-flex min-w-16 justify-center px-2 py-1.5 rounded-lg bg-white text-green-900 border border-green-200 text-sm font-medium">
                                  {student.quarter2Grade ?? 0}
                                </span>
                              </td>
                            )}
                            {(activeTerm === "all" || activeTerm === "term3") && (
                              <td className="px-3 py-4 text-center bg-green-50/30" onClick={(e) => e.stopPropagation()}>
                                <span className="inline-flex min-w-16 justify-center px-2 py-1.5 rounded-lg bg-white text-green-900 border border-green-200 text-sm font-medium">
                                  {student.quarter3Grade ?? 0}
                                </span>
                              </td>
                            )}
                            {(activeTerm === "all" || activeTerm === "term4") && (
                              <td className="px-3 py-4 text-center bg-green-50/30" onClick={(e) => e.stopPropagation()}>
                                <span className="inline-flex min-w-16 justify-center px-2 py-1.5 rounded-lg bg-white text-green-900 border border-green-200 text-sm font-medium">
                                  {student.quarter4Grade ?? 0}
                                </span>
                              </td>
                            )}
                            {/* Designation Averages - conditionally shown */}
                            {(activeDesignation === "all" || activeDesignation === "Quiz") && (
                              <td className="px-3 py-4 text-center bg-violet-50/30">
                                <span className="font-semibold text-violet-700">{student.quizAverage ?? fallbackWrittenWorks}</span>
                              </td>
                            )}
                            {(activeDesignation === "all" || activeDesignation === "Activity") && (
                              <td className="px-3 py-4 text-center bg-orange-50/30">
                                <span className={`font-semibold ${activityDisplay === "Not yet graded" ? "text-gray-500" : "text-orange-700"}`}>
                                  {activityDisplay}
                                </span>
                              </td>
                            )}
                            {(activeDesignation === "all" || activeDesignation === "Assignment") && (
                              <td className="px-3 py-4 text-center bg-sky-50/30">
                                <span className="font-semibold text-sky-700">{student.assignmentGrade ?? fallbackInitialGrade}</span>
                              </td>
                            )}
                            {(activeDesignation === "all" || activeDesignation === "Exam") && (
                              <td className="px-3 py-4 text-center bg-red-50/30">
                                <span className="font-semibold text-red-700">{student.examGrade ?? fallbackQuarterlyGrade}</span>
                              </td>
                            )}
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${isPassed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {student.overallGrade}%
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="text-xs font-semibold text-gray-700">
                                {completionRate}% <span className="text-[10px] text-gray-400">({studentSubmissions.length}/{assessmentItems.length})</span>
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center text-xs text-gray-500">
                              {lastActivityDate ? lastActivityDate.toLocaleDateString() : "Never"}
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => exportToExcel(studentGrades, selectedClassName)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-lg text-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download Excel Report
                    </button>
                    
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
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div data-tour="teacher-grades-seatworks-header" className="p-5 border-b border-gray-100">
                <h3 className="text-base font-semibold text-green-900">Activity-Based Performance Evaluation</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Review student submissions and assign grades across all activities.
                </p>
              </div>

              {assessmentItems.length === 0 ? (
                <div className="p-8 text-center">
                  <EmptyStateIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No seatworks found for this class yet.</p>
                </div>
              ) : (
                <div className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left: Assessment List */}
                    <div data-tour="teacher-grades-seatworks-eval" className="lg:col-span-3 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Seatworks</p>
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
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Seatwork Details</p>
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
                          <p className="text-sm text-gray-500">Select a seatwork to view details</p>
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
                        <div data-tour="teacher-grades-submission-detail" className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                          <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Submission & Grade</p>
                          </div>
                          <div className="p-4 space-y-4">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Submission Output</p>

                              {selectedStudentSubmission ? (() => {
                                const isPlaceholder = selectedStudentSubmission.responseText?.startsWith("Placeholder submission");
                                return (
                                  <div className="space-y-3">
                                    {!isPlaceholder && selectedStudentSubmission.responseText ? (
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

                                    {!isPlaceholder && selectedStudentSubmission.submittedAt ? (
                                      <p className="text-[11px] text-gray-500">
                                        Submitted: {new Date(selectedStudentSubmission.submittedAt).toLocaleString()}
                                      </p>
                                    ) : null}

                                    {isPlaceholder && !selectedStudentSubmission.fileUrl && !selectedStudentSubmission.filePath ? (
                                      <p className="text-sm text-amber-600">No submission from this student.</p>
                                    ) : null}
                                  </div>
                                );
                              })() : (
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
                                  disabled={assessmentStatusMap?.[selectedAssessment.id]?.[selectedStudentId] === "Returned" || (academicSettings.quarter && selectedAssessment.term !== academicSettings.quarter)}
                                  className="w-full px-3 py-2 text-sm bg-white text-green-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
                                  placeholder="Enter grade"
                                />
                                <span className="text-xs text-gray-400 whitespace-nowrap">/ {selectedAssessment.maxPoints}</span>
                              </div>
                              
                              {academicSettings.quarter && selectedAssessment.term !== academicSettings.quarter && (
                                <p className="text-[11px] text-red-500 mt-2">
                                  This assessment belongs to a past quarter and is read-only.
                                </p>
                              )}
                              
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
                              {assessmentStatusMap?.[selectedAssessment.id]?.[selectedStudentId] === "Returned" ? (
                                <p className="text-[11px] text-amber-600 mt-2">This grade is locked after return. Click Undo Return to edit it again.</p>
                              ) : !hasViewedSubmission ? (
                                <p className="text-[11px] text-amber-600 mt-2">View student submission first before grading.</p>
                              ) : null}
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Teacher Feedback</p>
                              </div>

                              <div className={`space-y-3 ${assessmentStatusMap?.[selectedAssessment.id]?.[selectedStudentId] === "Returned" ? "opacity-80" : ""}`}>
                                <div>
                                  <label className="text-[11px] text-gray-400 block mb-2">Comments</label>
                                  <textarea
                                    rows={4}
                                    value={selectedStudentFeedback}
                                    onChange={(e) => handleAssessmentFeedbackChange(selectedAssessment.id, selectedStudentId, e.target.value)}
                                    placeholder="Enter feedback for the student..."
                                    disabled={assessmentStatusMap?.[selectedAssessment.id]?.[selectedStudentId] === "Returned" || (academicSettings.quarter && selectedAssessment.term !== academicSettings.quarter)}
                                    className="w-full p-2 text-sm bg-white text-green-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
                                  />
                                </div>

                                {(() => {
                                  const actionKey = `${selectedAssessment.id}:${selectedStudentId}`;
                                  const actionState = submissionActionStateMap[actionKey] || "idle";
                                  const isReturned = assessmentStatusMap?.[selectedAssessment.id]?.[selectedStudentId] === "Returned";
                                  const isPastQuarter = academicSettings.quarter && selectedAssessment.term !== academicSettings.quarter;
                                  const isBusy = actionState === "returning" || actionState === "undoing";
                                  return (
                                <button
                                  type="button"
                                  onClick={isBusy || isPastQuarter ? undefined : (isReturned ? handleUndoReturn : handleReturnAssignment)}
                                  disabled={isBusy || isPastQuarter}
                                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-full transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isReturned
                                      ? "bg-red-600 hover:bg-red-700"
                                      : "bg-yellow-600 hover:bg-yellow-700"
                                  }`}
                                >
                                  {isBusy ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      {actionState === "undoing" ? "Undoing..." : "Returning..."}
                                    </>
                                  ) : isReturned ? (
                                    <>
                                      <RotateCcw className="w-4 h-4" />
                                      Undo Return
                                    </>
                                  ) : (
                                    <>
                                      <ChevronUp className="w-4 h-4" />
                                      Return Assignment
                                    </>
                                  )}
                                </button>
                                  );
                                })()}
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

      {/* Gradebook Modal */}
      {selectedStudentForModal && (
        <StudentGradebookModal
          student={selectedStudentForModal}
          assessmentItems={assessmentItems}
          submissions={assessmentSubmissionsMap}
          grades={assessmentGradesMap}
          statusMap={assessmentStatusMap}
          feedbackMap={assessmentFeedbackMap}
            subjectCategory={activeClassesList.find((item) => item.id === selectedClass)?.subjectCategory || DEPED_SUBJECT_CATEGORIES[0]}
            gradingSettingsByCategory={gradingSettingsByCategory}
          studentOverallGrades={studentGrades.find((student) => student.id === selectedStudentForModal.id) || gradesCache?.[selectedClass]?.[selectedStudentForModal.id]}
          onClose={() => setSelectedStudentForModal(null)}
        />
      )}
    </div>
  );
}

export { GradesManagement };
