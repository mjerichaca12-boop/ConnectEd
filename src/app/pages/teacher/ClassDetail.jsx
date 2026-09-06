import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAcademic } from "@/app/context/AcademicContext";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { ConfirmDialog } from "@/app/components/ui/ConfirmDialog";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { CustomSelect } from "@/app/components/admin/CustomSelect";
import { TeacherLessonsTab } from "./lessons/TeacherLessonsTab";
import { supabase } from "@/app/lib/supabaseClient";
import { triggerScheduledPublishingProcess } from "@/app/services/scheduledPublishingService";
import { adminApi } from "@/app/lib/adminApi";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import {
  sanitizeFileName,
  isColumnMissingError,
  isStorageNotFoundError,
  resolveColumnName,
  parseStoredFileList,
  buildAssignmentAttachments,
  buildMaterialAttachments,
  normalizeAudience,
  normalizeAnnouncement,
  formatAnnouncementDate
} from "@/app/lib/teacherHelpers";
import { streamMessage } from "@/app/lib/groqClient";
import { parseDocument } from "@/app/lib/documentParser";
import { useTourPreview } from "@/app/hooks/useTourPreview";
import {
  ArrowLeft,
  Users,
  Clock,
  MapPin,
  BookOpen,
  TrendingUp,
  Search,
  Download,
  Mail,
  Phone,
  CheckCircle,
  FileText,
  Megaphone,
  Upload,
  Plus,
  X,
  File,
  FilePlus,
  Trash2,
  Calendar,
  AlertCircle,
  Bell,
  Sparkles,
  Send,
  RefreshCw,
  ClipboardList,
  Loader2,
  Edit3,
} from "lucide-react";

const STORAGE_BUCKET = "class-materials";
const ANNOUNCEMENT_STORAGE_BUCKET = "class-announcements";
const ASSIGNMENT_TABLE_CANDIDATES = ["assignments", "assignments_activity"];
const ASSESSMENT_TABLE = "teacher_assessment_grades";
const ANNOUNCEMENT_TABLE_CANDIDATES = ["class_announcements", "announcements"];
const MAX_ANNOUNCEMENT_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_ANNOUNCEMENT_FILE_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "jpg", "jpeg", "png", "gif", "webp", "zip"
]);

const parseAnnouncementAttachmentsValue = (value) => {
  if (Array.isArray(value)) return value;
  const text = String(value || "").trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeMaterialRecord = (row) => {
  const attachments = buildMaterialAttachments(row);

  return {
    id: String(row?.id || ""),
    title: String(row?.title || "").trim(),
    description: String(row?.description || "").trim(),
    fileType: String(row?.file_type || "OTHER").trim() || "OTHER",
    fileNames: attachments.fileNames,
    filePaths: attachments.filePaths,
    fileUrls: attachments.fileUrls,
    attachments: attachments.attachments,
    fileName: attachments.fileNames[0] || "",
    filePath: attachments.filePaths[0] || "",
    fileUrl: attachments.fileUrls[0] || "",
    uploadDate: row?.created_at || new Date().toISOString(),
    subject: String(row?.subject || "").trim(),
    section: String(row?.section || "").trim()
  };
};

const normalizeAssignmentRecord = (row) => {
  const attachments = buildAssignmentAttachments(row);
  const assessmentType = String(row?.assessment_type || row?.type || row?.task_type || "assignment").trim().toLowerCase();

  let type = "assignment";
  if (assessmentType === "activity") type = "activity";
  else if (assessmentType === "quiz") type = "quiz";

  return {
    id: String(row?.id || ""),
    type: type,
    title: String(row?.title || row?.name || "").trim(),
    description: String(row?.description || row?.instructions || row?.content || "").trim(),
    dueDate: String(row?.due_date || row?.dueDate || row?.deadline || "").trim(),
    maxPoints: Number(row?.max_points ?? row?.total_points ?? row?.maxPoints ?? 100) || 100,
    fileNames: attachments.fileNames,
    filePaths: attachments.filePaths,
    fileUrls: attachments.fileUrls,
    attachments: attachments.attachments,
    fileName: attachments.fileNames[0] || "",
    filePath: attachments.filePaths[0] || "",
    fileUrl: attachments.fileUrls[0] || "",
    subject: String(row?.subject || row?.class_code || row?.course_id || "").trim(),
    section: String(row?.section || "").trim(),
    classCode: String(row?.subject || row?.class_code || row?.course_id || "").trim(),
    className: String(row?.class_name || "").trim(),
    teacherName: String(row?.author || row?.teacher_name || "").trim(),
    uploadDate: row?.created_at || row?.date_posted || new Date().toISOString()
  };
};

const getAssignmentLifecycle = (dueDate) => {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return { key: "open", label: "Open", cls: "bg-emerald-100 text-emerald-700" };
  }

  const now = new Date();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (today > dueDay) return { key: "closed", label: "Closed", cls: "bg-red-100 text-red-700" };
  if (today.getTime() === dueDay.getTime()) return { key: "due", label: "Due", cls: "bg-amber-100 text-amber-700" };
  return { key: "open", label: "Open", cls: "bg-emerald-100 text-emerald-700" };
};

const parsePriorityMetadata = (priority) => {
  try {
    if (priority && String(priority).trim().startsWith('{')) {
      const parsed = JSON.parse(priority);
      return {
        is_pinned: !!parsed.is_pinned,
        status: parsed.status || "Published",
        scheduled_at: parsed.scheduled_at || null,
        link_url: parsed.link_url || ""
      };
    }
  } catch (e) {
    // ignore
  }
  return {
    is_pinned: priority === "pinned",
    status: "Published",
    scheduled_at: null,
    link_url: ""
  };
};

const normalizeAnnouncementRecordLocal = (row) => {
  const fileName = String(row?.file_name || "").trim();
  const filePath = String(row?.file_path || "").trim();
  const fileUrl = String(row?.file_url || "").trim();
  const fileType = String(row?.file_type || "").trim();

  const structuredAttachments = parseAnnouncementAttachmentsValue(row?.attachments)
    .map((attachment, index) => {
      const attachmentName = String(attachment?.name || attachment?.fileName || `File ${index + 1}`).trim();
      const attachmentPath = String(attachment?.path || attachment?.filePath || "").trim();
      const attachmentUrl = String(attachment?.signedUrl || attachment?.url || attachment?.fileUrl || "").trim();
      const attachmentType = String(attachment?.mimeType || "").trim();

      return {
        fileName: attachmentName,
        filePath: attachmentPath,
        fileUrl: attachmentUrl,
        fileType: attachmentType,
        kind: getAnnouncementAttachmentKind({
          fileType: attachmentType,
          fileName: attachmentName,
          fileUrl: attachmentUrl
        })
      };
    })
    .filter((attachment) => attachment.fileName || attachment.filePath || attachment.fileUrl);

  const legacyAttachment = (fileName || filePath || fileUrl)
    ? [{
      fileName: fileName || "Attached file",
      filePath,
      fileUrl,
      fileType,
      kind: getAnnouncementAttachmentKind({ fileType, fileName, fileUrl })
    }]
    : [];

  const attachments = structuredAttachments.length > 0 ? structuredAttachments : legacyAttachment;
  const meta = parsePriorityMetadata(row?.priority);

  return {
    id: String(row?.id || ""),
    title: String(row?.title || "").trim(),
    content: String(row?.content || "").trim(),

    targetAudience: normalizeAudience(row?.target_audience || row?.audience || row?.targetAudience || "Students"),
    author: String(row?.author || row?.created_by_name || "Faculty").trim(),
    fileName: attachments[0]?.fileName || fileName,
    filePath: attachments[0]?.filePath || filePath,
    fileUrl: attachments[0]?.fileUrl || fileUrl,
    fileType,
    attachments,
    datePosted: row?.created_at || row?.date_posted || row?.updated_at || new Date().toISOString(),
    classCode: String(row?.subject || row?.class_code || "").trim(),
    className: String(row?.class_name || "").trim(),
    section: String(row?.section || "").trim(),
    isPinned: meta.is_pinned,
    status: meta.status,
    scheduledAt: meta.scheduled_at,
    linkUrl: meta.link_url
  };
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());

const getAnnouncementAttachmentKind = (announcement) => {
  const fileType = String(announcement?.fileType || announcement?.file_type || "").trim().toLowerCase();
  const fileName = String(announcement?.fileName || announcement?.file_name || "").trim().toLowerCase();
  const fileUrl = String(announcement?.fileUrl || announcement?.file_url || "").trim().toLowerCase();
  const source = fileType || fileName || fileUrl;

  if (fileType.startsWith("image/")) return "image";
  if (fileType.startsWith("video/")) return "video";

  const match = source.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  const extension = match ? match[1].toLowerCase() : "";

  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(extension)) return "image";
  if (["mp4", "webm", "ogg", "mov", "m4v"].includes(extension)) return "video";
  return fileUrl ? "document" : "";
};

let classMaterialsTableStatus = "missing";

export function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDemoMode, mockData } = useTourPreview();
  const { activeSchoolYear, activeQuarter, viewMode } = useAcademic();
  const fileInputRef = useRef(null);
  const selectAllCheckboxRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("lessons");

  useEffect(() => {
    const handleSwitchTab = (e) => {
      const tab = e.detail?.tab;
      if (tab) {
        setActiveTab(tab);
      }
    };
    window.addEventListener("tour-switch-tab", handleSwitchTab);
    return () => window.removeEventListener("tour-switch-tab", handleSwitchTab);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");

  // Quiz AI state
  const [quizTopic, setQuizTopic] = useState("");
  const [quizItemCount, setQuizItemCount] = useState(10);
  const [quizType, setQuizType] = useState("Multiple Choice");
  const [quizDifficulty, setQuizDifficulty] = useState("Medium");
  const [quizMessages, setQuizMessages] = useState([]);
  const [quizInput, setQuizInput] = useState("");
  const [isQuizStreaming, setIsQuizStreaming] = useState(false);
  const [quizGenerated, setQuizGenerated] = useState("");
  const [quizMaterialFile, setQuizMaterialFile] = useState(null);
  const [quizMaterialContent, setQuizMaterialContent] = useState("");
  const quizMaterialInputRef = useRef(null);

  // Class data from localStorage
  const [classData, setClassData] = useState(null);

  // Per-class lists from localStorage
  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Live dashboard metrics state
  const [metrics, setMetrics] = useState({
    totalLessons: 0,
    publishedLessons: 0,
    activitiesCount: 0,
    seatworksCount: 0,
    assignmentsCount: 0,
    quizzesCount: 0,
    materialsCount: 0,
  });

  // Modal states
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);

  // Student assignment state
  const [teacherProfileId, setTeacherProfileId] = useState("");
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);
  const [studentPickerQuery, setStudentPickerQuery] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [isStudentSubmitting, setIsStudentSubmitting] = useState(false);
  const [stuError, setStuError] = useState("");
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [pendingDeleteStudent, setPendingDeleteStudent] = useState(null);
  
  // Advanced Add Student State
  const [addStudentMode, setAddStudentMode] = useState("individual"); // "individual", "masterlist", "csv"
  const [masterlistStudents, setMasterlistStudents] = useState([]);
  const [selectedMasterlistIds, setSelectedMasterlistIds] = useState([]);
  const [masterlistQuery, setMasterlistQuery] = useState("");
  const [masterlistYearFilter, setMasterlistYearFilter] = useState("all");
  const [masterlistSectionFilter, setMasterlistSectionFilter] = useState("all");
  const [isMasterlistLoading, setIsMasterlistLoading] = useState(false);
  
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreviewData, setCsvPreviewData] = useState([]);
  const [csvValidRecords, setCsvValidRecords] = useState([]);
  const [csvErrorRecords, setCsvErrorRecords] = useState([]);
  const [isCsvValidating, setIsCsvValidating] = useState(false);
  const csvFileInputRef = useRef(null);

  // Material form
  const [matForm, setMatForm] = useState({ title: "", description: "", fileType: "PDF" });
  const [matFiles, setMatFiles] = useState([]);
  const [matFileNames, setMatFileNames] = useState([]);
  const [matError, setMatError] = useState("");
  const [matSuccess, setMatSuccess] = useState("");
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [materialColumns, setMaterialColumns] = useState([]);
  const [isEditingMaterial, setIsEditingMaterial] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [matOriginalFiles, setMatOriginalFiles] = useState({ fileNames: [], filePaths: [], fileUrls: [] });
  const [showDeleteMaterialModal, setShowDeleteMaterialModal] = useState(false);
  const [pendingDeleteMaterial, setPendingDeleteMaterial] = useState(null);

  // Assignment form
  const [asgForm, setAsgForm] = useState({
    title: "",
    description: "",
    type: "assignment",
    dueDate: "",
    maxPoints: "100",
  });
  const [asgFiles, setAsgFiles] = useState([]);
  const [asgFileNames, setAsgFileNames] = useState([]);
  const [asgError, setAsgError] = useState("");
  const [asgSuccess, setAsgSuccess] = useState("");
  const [isPostingAssignment, setIsPostingAssignment] = useState(false);
  const [assignmentTable, setAssignmentTable] = useState("");
  const [assignmentColumns, setAssignmentColumns] = useState([]);
  const [assignmentColumnsTrusted, setAssignmentColumnsTrusted] = useState(false);
  const [asgSupportsFiles, setAsgSupportsFiles] = useState(false);
  const asgFileRef = useRef(null);

  // Assignment edit mode
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [asgOriginalFile, setAsgOriginalFile] = useState(null);

  // Pick materials for assignment
  const [asgPickedMaterialIds, setAsgPickedMaterialIds] = useState([]);
  const [asgMaterialAttachments, setAsgMaterialAttachments] = useState({ fileNames: [], filePaths: [], fileUrls: [] });

  // Assignment delete confirmation
  const [showDeleteAssignmentModal, setShowDeleteAssignmentModal] = useState(false);
  const [pendingDeleteAssignment, setPendingDeleteAssignment] = useState(null);
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);

  // Announcement form
  const [annForm, setAnnForm] = useState({ title: "", content: "" });
  const [annFiles, setAnnFiles] = useState([]);
  const [annFileNames, setAnnFileNames] = useState([]);
  const [annOriginalFiles, setAnnOriginalFiles] = useState({ fileNames: [], filePaths: [], fileUrls: [], attachments: [] });
  const [announcementTable, setAnnouncementTable] = useState(ANNOUNCEMENT_TABLE_CANDIDATES[0]);
  const [announcementColumns, setAnnouncementColumns] = useState([]);
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [showDeleteAnnouncementModal, setShowDeleteAnnouncementModal] = useState(false);
  const [pendingDeleteAnnouncement, setPendingDeleteAnnouncement] = useState(null);
  const [activeAnnouncementTab, setActiveAnnouncementTab] = useState("Active");
  const [selectedAnnouncementDetail, setSelectedAnnouncementDetail] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    const handleCloseMenu = () => setOpenMenuId(null);
    window.addEventListener("click", handleCloseMenu);
    return () => window.removeEventListener("click", handleCloseMenu);
  }, []);
  const annFileRef = useRef(null);

  const getStudentFullName = (student) => {
    const fullName = [student?.first_name, student?.middle_name, student?.last_name]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    if (fullName) return fullName;
    return String(student?.email || "").split("@")[0] || "Student";
  };

  const normalizeGradeLevel = (value) => {
    const v = String(value || "").trim();
    if (!v) return "";
    const digits = v.match(/\d+/);
    if (digits) return String(digits[0]);
    return v.toLowerCase().replace(/grade|year|level|\s+/g, "").trim();
  };

  const normalizeSection = (value) =>
    String(value || "").trim().toLowerCase().replace(/\s+/g, "");

  const dedupeStudentsById = (rows) => {
    const seen = new Set();
    return (rows ?? []).filter((student) => {
      const key = String(student?.id || "").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const normalizeSearchText = (value) => String(value || "").toLowerCase().trim();

  const extractGradeFromText = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";

    const labeled = text.match(/(?:grade|year)\s*([0-9]{1,2})/i);
    if (labeled) return `Grade ${labeled[1]}`;

    const numericOnly = text.match(/^([1-9]|1[0-2])$/);
    if (numericOnly) return `Grade ${numericOnly[1]}`;

    return "";
  };

  const getClassGradeValue = (classObj) => {
    const direct = String(classObj?.gradeLevel || classObj?.grade_level || classObj?.year_level || "").trim();
    if (direct) return direct;

    const fromSection = extractGradeFromText(classObj?.section);
    if (fromSection) return fromSection;

    const fromName = extractGradeFromText(classObj?.name);
    if (fromName) return fromName;

    return "";
  };

  const normalizeStudentRecord = (student) => {
    const yearLevel = student?.year_level ?? student?.grade_level ?? student?.grade ?? student?.year ?? "";
    return {
      id: String(student?.id || student?.student_id || "").trim(),
      first_name: String(student?.first_name || student?.firstname || "").trim(),
      middle_name: String(student?.middle_name || student?.middlename || "").trim(),
      last_name: String(student?.last_name || student?.lastname || "").trim(),
      email: String(student?.email || "").trim(),
      lrn: String(student?.lrn || student?.student_number || "").trim(),
      year_level: String(yearLevel || "").trim(),
      grade_level: String(student?.grade_level || yearLevel || "").trim(),
      section: String(student?.section || "").trim(),
      phone: String(student?.phone || student?.contact_number || "").trim(),
      status: String(student?.status || "Active").trim()
    };
  };

  const resolveSubjectGradeLevel = async (classObj) => {
    const localGrade = getClassGradeValue(classObj);
    if (localGrade) return localGrade;

    if (!supabase || !id) return "";

    let { data, error } = await supabase
      .from("subjects")
      .select("grade_level")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.warn("[ClassDetail] Unable to resolve subject grade level:", error);
      return "";
    }

    const fetchedGrade = String(data?.grade_level || data?.year_level || "").trim();
    if (fetchedGrade) {
      setClassData((current) => {
        if (!current) return current;
        return {
          ...current,
          gradeLevel: fetchedGrade,
          grade_level: data?.grade_level ?? current?.grade_level,
          year_level: data?.year_level ?? current?.year_level
        };
      });
    }

    return fetchedGrade;
  };

  const syncStudentsIntoClassData = (students) => {
    const count = Array.isArray(students) ? students.length : 0;
    setAssignedStudents(students || []);
    setClassData((current) => {
      if (!current) return current;
      return {
        ...current,
        students: students || [],
        studentCount: count,
        enrolled: count
      };
    });

    try {
      const saved = localStorage.getItem("teacher_classes");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const updated = parsed.map(c => String(c.id) === String(id) ? { ...c, studentCount: count, enrolled: count } : c);
          localStorage.setItem("teacher_classes", JSON.stringify(updated));
        }
      }
    } catch (e) {
      console.warn("[syncStudentsIntoClassData] localStorage update error:", e);
    }

    if (supabase && id && !String(id).startsWith("demo-")) {
      const queryId = !isNaN(Number(id)) ? Number(id) : id;
      supabase
        .from("subjects")
        .update({ enrolled: count })
        .eq("id", queryId)
        .then(() => {
          window.dispatchEvent(new CustomEvent("enrollment-changed", { detail: { subjectId: id, count } }));
        })
        .catch(e => console.warn("[syncStudentsIntoClassData] sync error:", e));
    }
  };

  const loadAssignedStudents = async (teacherId, subjectId) => {
    if (!supabase || !teacherId || !subjectId || String(subjectId).startsWith("demo-")) {
      syncStudentsIntoClassData([]);
      return;
    }

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("teacher_student_assignments")
      .select("id, student_id, status, assigned_at")
      .eq("teacher_id", teacherId)
      .eq("subject_id", subjectId)
      .order("assigned_at", { ascending: false });

    if (assignmentError) {
      console.error("Failed to load assigned students:", assignmentError);
      syncStudentsIntoClassData([]);
      return;
    }

    const uniqueAssignmentsByStudent = new Map();
    (assignmentRows ?? []).forEach((row) => {
      const studentKey = String(row?.student_id || "").trim();
      if (!studentKey || uniqueAssignmentsByStudent.has(studentKey)) return;
      uniqueAssignmentsByStudent.set(studentKey, row);
    });

    const uniqueAssignmentRows = Array.from(uniqueAssignmentsByStudent.values());
    const studentIds = uniqueAssignmentRows.map((row) => String(row.student_id || "")).filter(Boolean);

    if (studentIds.length === 0) {
      syncStudentsIntoClassData([]);
      return;
    }

    const { data: studentRows, error: studentError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, email, lrn, year_level, section, phone, status")
      .eq("role", "student")
      .in("id", studentIds);

    if (studentError) {
      console.error("Failed to load student records:", studentError);
      syncStudentsIntoClassData([]);
      return;
    }

    const studentById = new Map((studentRows ?? []).map((student) => {
      const normalized = normalizeStudentRecord(student);
      return [String(normalized.id), normalized];
    }));
    const mapped = uniqueAssignmentRows.map((row) => {
      const student = studentById.get(String(row.student_id || ""));
      return {
        assignmentId: row.id,
        id: String(student?.id || row.student_id || ""),
        studentId: String(student?.lrn || "N/A"),
        name: getStudentFullName(student),
        yearLevel: String(student?.year_level || ""),
        email: String(student?.email || ""),
        phone: String(student?.phone || ""),
        status: String(row.status || student?.status || "Active")
      };
    });

    syncStudentsIntoClassData(mapped);

    if (supabase && subjectId && !String(subjectId).startsWith("demo-")) {
      try {
        const queryId = !isNaN(Number(subjectId)) ? Number(subjectId) : subjectId;
        const { data: sub } = await supabase.from("subjects").select("capacity, enrolled").eq("id", queryId).maybeSingle();
        if (sub && sub.capacity !== undefined) {
          setClassData(prev => prev ? ({ ...prev, capacity: Number(sub.capacity || 0), enrolled: mapped.length }) : prev);
        }
      } catch (e) {
        console.warn("[ClassDetail] Failed to re-fetch subject capacity:", e);
      }
    }
  };

  const fetchDashboardMetrics = async (teacherId, subjectId) => {
    if (!supabase || !teacherId || !subjectId || String(subjectId).startsWith("demo-")) return;
    try {
      // 1. Fetch lessons count
      let lessonsQuery = supabase
        .from("lessons")
        .select("id, status")
        .eq("subject_id", subjectId)
        .eq("teacher_id", teacherId);

      if (activeSchoolYear) lessonsQuery = lessonsQuery.eq("school_year", activeSchoolYear);
      if (viewMode === "current" && activeQuarter) lessonsQuery = lessonsQuery.eq("term", activeQuarter);

      const { data: lessons, error: lessonsError } = await lessonsQuery;

      if (lessonsError) throw lessonsError;

      const activeLessons = lessons.filter(l => l.status !== "Archived");
      const totalLessons = activeLessons.length;
      const publishedLessons = activeLessons.filter(l => l.status === "Published").length;

      const activeLessonIds = activeLessons.map(l => l.id);

      let activitiesCount = 0;
      let seatworksCount = 0;
      let assignmentsCount = 0;
      let quizzesCount = 0;
      let materialsCount = 0;

      if (activeLessonIds.length > 0) {
        // 2. Fetch lesson activities
        const { data: activities, error: actError } = await supabase
          .from("lesson_activities")
          .select("activity_type, activity_id")
          .in("lesson_id", activeLessonIds);

        if (actError) throw actError;

        if (activities && activities.length > 0) {
          activitiesCount = activities.filter(a => ["Activity", "Assignment", "Assessment", "Seatwork", "Quiz"].includes(a.activity_type)).length;
          seatworksCount = activities.filter(a => a.activity_type === "Assessment" || a.activity_type === "Seatwork").length;
          assignmentsCount = activities.filter(a => a.activity_type === "Assignment").length;
          quizzesCount = activities.filter(a => a.activity_type === "Quiz").length;
        }

        // 3. Fetch lesson materials count across all lessons for this subject
        const { data: allSubjectLessons } = await supabase
          .from("lessons")
          .select("id")
          .eq("subject_id", subjectId);

        const allSubjectLessonIds = (allSubjectLessons || []).map(l => l.id);
        if (allSubjectLessonIds.length > 0) {
          const { count: matCount, error: matError } = await supabase
            .from("lesson_materials")
            .select("id", { count: "exact", head: true })
            .in("lesson_id", allSubjectLessonIds);

          if (!matError) materialsCount = matCount || 0;
        }
      }

      setMetrics({
        totalLessons,
        publishedLessons,
        activitiesCount,
        seatworksCount,
        assignmentsCount,
        quizzesCount,
        materialsCount
      });

    } catch (err) {
      console.error("Error fetching dashboard metrics:", err);
    }
  };

  const loadAvailableStudents = async (classObj) => {
    if (!supabase) {
      setStuError("Supabase client is not configured.");
      return;
    }

    setIsStudentsLoading(true);
    setHasLoadedStudents(false);

    const tableCandidates = ["profiles", "students"];
    const classCandidate = classObj || classData || {};
    const resolvedClassGradeRaw = await resolveSubjectGradeLevel(classCandidate);
    let classGrade = normalizeGradeLevel(resolvedClassGradeRaw);
    const classSectionRaw = String(classCandidate?.section || "").trim();

    try {
      let loadedRows = null;
      let lastError = null;

      for (const tableName of tableCandidates) {
        let query = tableName === "students"
          ? supabase.from(tableName).select("*")
          : supabase
            .from(tableName)
            .select("*")
            .eq("role", "student")
            .order("first_name", { ascending: true });

        if (classSectionRaw && classSectionRaw.toLowerCase() !== "unassigned") {
          query = query.ilike("section", classSectionRaw);
        }

        const { data, error } = await query;

        if (error) {
          lastError = error;
          console.warn(`[ClassDetail] Student fetch failed on table ${tableName}:`, error);
          continue;
        }

        loadedRows = (data ?? [])
          .map(normalizeStudentRecord)
          .filter((student) => String(student.id || "").trim());
        break;
      }

      if (!loadedRows) {
        const message = String(lastError?.message || "").toLowerCase();
        if (lastError?.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
          setStuError("Unable to load students due to permissions (RLS). Ensure teacher/admin has SELECT access to students/profiles.");
        } else {
          setStuError(lastError?.message || "Unable to load students right now.");
        }
        return;
      }

      setAvailableStudents(dedupeStudentsById(loadedRows));
      setStuError("");
      setHasLoadedStudents(true);
    } catch (err) {
      console.error("[ClassDetail] Failed to load students:", err);
      setStuError(err instanceof Error ? err.message : "Unable to load students.");
    } finally {
      setIsStudentsLoading(false);
    }
  };

  const resolveTeacherProfileId = async (email) => {
    if (!supabase || !email) return "";

    const normalizedEmail = String(email).trim().toLowerCase();

    // Try teacher role first
    let { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .eq("role", "teacher")
      .limit(1)
      .maybeSingle();

    if (!error && data?.id) return String(data.id);

    // Fallback: match by email with no role restriction (handles RLS edge cases)
    ({ data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle());

    if (error) {
      console.warn("[ClassDetail] Profile lookup failed - will use localStorage user id as fallback:", error);
    }

    if (data?.id) return String(data.id);

    // Last resort: try to get id from Supabase auth session
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUserId = sessionData?.session?.user?.id;
      if (sessionUserId) return String(sessionUserId);
    } catch { }

    return "";
  };

  const resolveMaterialColumns = async () => {
    if (!supabase) {
      return [];
    }

    const candidates = [
      "id",
      "title",
      "description",
      "file_type",
      "file_url",
      "file_name",
      "teacher_id",
      "created_by",
      "class_id",
      "subject_id",
      "course_id"
    ];

    const detected = [];

    if (classMaterialsTableStatus === "missing") {
      return ["id", "title", "description", "file_type", "file_url", "created_at"];
    }

    // First check if table exists by trying a simple query
    try {
      const { error: tableCheckError } = await supabase.from("class_materials").select("id").limit(1);

      if (tableCheckError && (tableCheckError.code === 'PGRST116' || tableCheckError.status === 400 || tableCheckError.status === 404 || tableCheckError.code === '42P01' || tableCheckError.code === 'PGRST205')) {
        classMaterialsTableStatus = "missing";
        console.warn("class_materials table not accessible in ClassDetail, using default columns:", tableCheckError);
        // Return default columns that might exist
        return ["id", "title", "description", "file_type", "file_url", "created_at"];
      }
    } catch (err) {
      console.warn("Error checking class_materials table in ClassDetail:", err);
      return ["id", "title", "description", "file_type", "file_url", "created_at"];
    }

    for (const columnName of candidates) {
      try {
        const { error } = await supabase.from("class_materials").select(columnName).limit(1);
        if (!error) {
          detected.push(columnName);
        }
      } catch (err) {
        console.warn(`Error checking column ${columnName} in ClassDetail:`, err);
      }
    }

    setMaterialColumns(detected);
    return detected;
  };

  const resolveAssignmentTable = async () => {
    if (!supabase) {
      return "";
    }

    for (const tableName of ASSIGNMENT_TABLE_CANDIDATES) {
      const { error } = await supabase.from(tableName).select("id").limit(1);
      if (!error) {
        setAssignmentTable(tableName);
        return tableName;
      }
    }

    return "";
  };

  const getAssignmentTableName = async () => {
    if (!supabase) {
      return "";
    }

    if (assignmentTable) {
      const { error } = await supabase.from(assignmentTable).select("id").limit(1);
      if (!error) {
        return assignmentTable;
      }
    }

    return resolveAssignmentTable();
  };

  const getAssessmentTableName = async (assignmentType) => {
    // Always use the regular assignment table for now
    return getAssignmentTableName();
  };

  const resolveAssignmentColumns = async (tableNameOverride) => {
    if (!supabase) {
      return [];
    }

    const tableName = tableNameOverride || (await getAssignmentTableName());
    if (!tableName) {
      setAssignmentColumns([]);
      return [];
    }

    const defaultColumns = tableName === 'assignments_activity'
      ? [
          "id",
          "course_id",
          "title",
          "assessment_type",
          "description",
          "deadline",
          "file_url",
          "file_name",
          "file_path",
          "created_at",
          "updated_at",
          "updated_by"
        ]
      : [
          "id",
          "title",
          "name",
          "description",
          "instructions",
          "content",
          "due_date",
          "deadline",
          "file_url",
          "file_name",
          "file_path",
          "subject",
          "class_code",
          "class_name",
          "section",
          "class_id",
          "course_id",
          "subject_id",
          "created_by",
          "teacher_id",
          "author",
          "teacher_name",
          "created_at",
          "updated_at",
          "updated_by",
          "assessment_type",
          "task_type",
          "max_points",
          "total_points",
          "maxPoints"
        ];

    // Probe the table with a single select(*) to retrieve a sample row and infer columns.
    try {
      const { data, error } = await supabase.from(tableName).select("*").limit(1);
      if (error) {
        console.error("[ClassDetail] Failed to resolve assignment columns via sample query:", error);
        // Do not trust default columns when the sample query failed ΓÇö return defaults but mark as untrusted
        setAssignmentColumns(defaultColumns);
        setAssignmentColumnsTrusted(false);
        setAsgSupportsFiles(defaultColumns.includes("file_url") || defaultColumns.includes("file_name") || defaultColumns.includes("file_path"));
        return defaultColumns;
      }

      const detected = data && data.length > 0 ? Object.keys(data[0]) : defaultColumns;
      setAssignmentColumns(detected);
      // If we actually got a sample row, we can trust the detected columns. If not, mark untrusted.
      const isTrusted = Array.isArray(data) && data.length > 0;
      setAssignmentColumnsTrusted(isTrusted);
      const supportsFiles = detected.includes("file_url") || detected.includes("file_name") || detected.includes("file_path");
      setAsgSupportsFiles(supportsFiles);
      return detected;
    } catch (err) {
      console.error("[ClassDetail] Unexpected error resolving assignment columns:", err);
      setAssignmentColumns(defaultColumns);
      setAssignmentColumnsTrusted(false);
      setAsgSupportsFiles(defaultColumns.includes("file_url") || defaultColumns.includes("file_name") || defaultColumns.includes("file_path"));
      return defaultColumns;
    }
  };

  const getAssignmentColumns = async (tableNameOverride) => {
    if (assignmentColumns.length > 0) {
      return assignmentColumns;
    }

    return resolveAssignmentColumns(tableNameOverride);
  };

  const resolveAnnouncementTable = async () => {
    if (!supabase) {
      return "";
    }

    for (const tableName of ANNOUNCEMENT_TABLE_CANDIDATES) {
      const { error } = await supabase.from(tableName).select("id").limit(1);
      if (!error) {
        setAnnouncementTable(tableName);
        return tableName;
      }
    }

    console.error("[ClassDetail] Announcements table check failed for candidates:", ANNOUNCEMENT_TABLE_CANDIDATES);
    return "";
  };

  const getAnnouncementTableName = async () => {
    if (!supabase) {
      return "";
    }

    if (announcementTable) {
      const { error } = await supabase.from(announcementTable).select("id").limit(1);
      if (!error) {
        return announcementTable;
      }
    }

    return resolveAnnouncementTable();
  };

  const resolveAnnouncementColumns = async (tableNameOverride) => {
    if (!supabase) {
      return [];
    }

    const tableName = tableNameOverride || (await getAnnouncementTableName());
    if (!tableName) {
      setAnnouncementColumns([]);
      return [];
    }

    const defaultColumns = [
      "id",
      "class_id",
      "teacher_id",
      "title",
      "content",

      "attachments",
      "author",
      "created_by_name",
      "created_at",
      "updated_at"
    ];

    const { data, error } = await supabase.from(tableName).select("*").limit(1);
    if (error) {
      console.error("[ClassDetail] Failed to resolve announcement columns:", error);
      setAnnouncementColumns(defaultColumns);
      return defaultColumns;
    }

    const detected = data && data.length > 0 ? Object.keys(data[0]) : defaultColumns;
    setAnnouncementColumns(detected);
    return detected;
  };

  const getAnnouncementColumns = async (tableNameOverride) => {
    if (announcementColumns.length > 0) {
      return announcementColumns;
    }

    return resolveAnnouncementColumns(tableNameOverride);
  };

  const hydrateAnnouncementAttachmentUrls = async (rows) => {
    const normalizedRows = Array.isArray(rows) ? rows : [];

    return Promise.all(
      normalizedRows.map(async (row) => {
        const attachments = parseAnnouncementAttachmentsValue(row?.attachments);
        if (!Array.isArray(attachments) || attachments.length === 0 || !supabase) {
          return row;
        }

        const hydrated = await Promise.all(
          attachments.map(async (attachment) => {
            const path = String(attachment?.path || attachment?.filePath || "").trim();
            if (!path) return attachment;

            const bucket = path.includes("announcements/") ? "class-materials" : ANNOUNCEMENT_STORAGE_BUCKET;
            const signed = await supabase.storage
              .from(bucket)
              .createSignedUrl(path, 60 * 60);

            if (signed.error) {
              console.error("[ClassDetail] Announcement signed URL generation failed:", signed.error, path, "bucket:", bucket);
              return attachment;
            }

            return {
              ...attachment,
              signedUrl: String(signed.data?.signedUrl || "").trim() || attachment?.signedUrl || attachment?.url || ""
            };
          })
        );

        return { ...row, attachments: hydrated };
      })
    );
  };

  const fetchClassAnnouncements = async (resolvedTeacherId, currentClassData) => {
    const cleanTeacherId = resolvedTeacherId && resolvedTeacherId !== "null" && resolvedTeacherId !== "undefined" ? resolvedTeacherId : null;
    const cleanClassId = id && id !== "null" && id !== "undefined" ? id : null;

    if (isDemoMode) {
      setAnnouncements(MOCK_ANNOUNCEMENTS);
      return;
    }

    if (!supabase || !cleanTeacherId) {
      setAnnouncements([]);
      return;
    }

    const tableName = await getAnnouncementTableName();
    if (!tableName) {
      setAnnouncements([]);
      return;
    }

    const columns = await getAnnouncementColumns(tableName);
    const ownerColumn = resolveColumnName(columns, ["created_by", "teacher_id"]);
    const classColumn = resolveColumnName(columns, ["class_id", "course_id", "subject_id"]);
    const orderColumn = columns.includes("created_at")
      ? "created_at"
      : columns.includes("date_posted")
        ? "date_posted"
        : columns.includes("updated_at")
          ? "updated_at"
          : "";

    let query = supabase.from(tableName).select("*");
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: false });
    }

    if (classColumn && cleanClassId) {
      query = query.eq(classColumn, cleanClassId);
    } else if (ownerColumn) {
      query = query.eq(ownerColumn, cleanTeacherId);
    }

    let { data, error } = await query;

    if (error && isColumnMissingError(error)) {
      query = supabase.from(tableName).select("*");
      if (classColumn && cleanClassId) {
        query = query.eq(classColumn, cleanClassId);
      } else if (ownerColumn) {
        query = query.eq(ownerColumn, cleanTeacherId);
      }
      const fallback = await query;
      data = fallback.data;
      error = fallback.error;
    }



    if (error) {
      console.error("[ClassDetail] Failed to fetch announcements:", error);
      toast.error("Unable to load announcements from database.");
      setAnnouncements([]);
      return;
    }

    const classCode = String(currentClassData?.code || "").trim();
    const classSection = String(currentClassData?.section || "").trim();
    const classId = String(id || "").trim();

    const filtered = (data ?? []).filter((row) => {
      const rowClassId = String(row?.class_id || row?.course_id || row?.subject_id || "").trim();
      const rowTeacherId = String(row?.teacher_id || row?.created_by || "").trim();
      const rowSubject = String(row?.subject || row?.class_code || "").trim();
      const rowSection = String(row?.section || "").trim();

      const teacherMatches = !cleanTeacherId || !rowTeacherId || rowTeacherId === cleanTeacherId;

      if (rowClassId) {
        return rowClassId === classId && teacherMatches;
      }

      if (rowSubject && rowSection && classCode && classSection) {
        const subjectMatches = rowSubject.toLowerCase() === classCode.toLowerCase();
        const sectionMatches = rowSection.toLowerCase() === classSection.toLowerCase();
        return subjectMatches && sectionMatches && teacherMatches;
      }

      return false;
    });

    const hydratedRows = await hydrateAnnouncementAttachmentUrls(filtered);
    setAnnouncements(hydratedRows.map(normalizeAnnouncementRecordLocal));
  };

  const fetchClassAssignments = async (resolvedTeacherId, currentClassData) => {
    const cleanTeacherId = resolvedTeacherId && resolvedTeacherId !== "null" && resolvedTeacherId !== "undefined" ? resolvedTeacherId : null;
    const cleanClassId = id && id !== "null" && id !== "undefined" ? id : null;

    if (!supabase || !cleanTeacherId || !cleanClassId || String(cleanClassId).startsWith("demo-")) {
      setAssignments([]);
      return;
    }

    const previousAssignments = Array.isArray(assignments) ? assignments : [];
    const allAssignments = [];

    // 1. Try to fetch from assignments_activity
    try {
      const { data, error } = await supabase
        .from("assignments_activity")
        .select("*")
        .eq("course_id", cleanClassId);
      if (!error && data) {
        const rows = (data ?? []).filter((row) => {
          const rowCourseId = String(row?.course_id || row?.subject_id || row?.class_id || "").trim();
          const rowTeacherId = String(row?.teacher_id || row?.created_by || "").trim();
          const classMatches = Boolean(rowCourseId) && rowCourseId === cleanClassId;
          const teacherMatches = !cleanTeacherId || !rowTeacherId || rowTeacherId === cleanTeacherId;
          return classMatches && teacherMatches;
        });
        rows.forEach(row => allAssignments.push(normalizeAssignmentRecord(row)));
      }
    } catch (e) {
      console.warn("Failed to fetch from assignments_activity in ClassDetail:", e);
    }

    // 2. Fetch lessons of this class to resolve LMS assignments and quizzes
    let lessonIds = [];
    try {
      const { data: lessons, error: lessonsError } = await supabase
        .from("lessons")
        .select("id")
        .eq("subject_id", cleanClassId);
      
      if (!lessonsError && lessons) {
        lessonIds = lessons.map(l => l.id);
      }
    } catch (e) {
      console.warn("Failed to fetch lessons in ClassDetail:", e);
    }

    if (lessonIds.length > 0) {
      // 3. Try to fetch LMS assignments
      try {
        const { data, error } = await supabase
          .from("assignments")
          .select("*")
          .in("lesson_id", lessonIds);
        
        if (!error && data) {
          data.forEach(row => {
            const normalized = normalizeAssignmentRecord(row);
            const isQuiz = String(row.assignment_type || "").trim().toLowerCase() === "quiz" || String(row.title || "").toLowerCase().includes("quiz");
            allAssignments.push({
              ...normalized,
              type: isQuiz ? "quiz" : normalized.type || "assignment"
            });
          });
        }
      } catch (e) {
        console.warn("Failed to fetch LMS assignments in ClassDetail:", e);
      }

      // 4. Try to fetch LMS quizzes
      try {
        const { data, error } = await supabase
          .from("quizzes")
          .select("*")
          .in("lesson_id", lessonIds);
        
        if (!error && data) {
          data.forEach(row => {
            allAssignments.push(normalizeAssignmentRecord({
              ...row,
              assessment_type: "quiz",
              designation: "Quiz"
            }));
          });
        }
      } catch (e) {
        console.warn("Failed to fetch LMS quizzes in ClassDetail:", e);
      }
    }

    // Deduplicate assignments by ID
    const uniqueMap = new Map();
    allAssignments.forEach(item => {
      if (item.id) {
        uniqueMap.set(item.id, item);
      }
    });

    const serverAssignments = Array.from(uniqueMap.values())
      .sort((a, b) => {
        const timeA = new Date(a.dueDate || 0).getTime();
        const timeB = new Date(b.dueDate || 0).getTime();
        return timeB - timeA;
      })
      .map((item) => ({ ...item, _optimistic: false }));

    setAssignments((previous) => {
      const prev = Array.isArray(previous) ? previous : [];
      const optimistic = prev.filter((item) => item?._optimistic);
      const serverIds = new Set(serverAssignments.map((item) => String(item.id || "")));
      const carryOverOptimistic = optimistic.filter((item) => !serverIds.has(String(item.id || "")));
      return [...serverAssignments, ...carryOverOptimistic];
    });
  };

  const fetchClassMaterials = async (cleanTeacherId, targetClass) => {
    if (!supabase) {
      setMaterials([]);
      return;
    }

    const cleanClassId = targetClass?.id || id;
    if (!cleanClassId || String(cleanClassId).startsWith("demo-")) {
      setMaterials([]);
      return;
    }

    try {
      // 1. Fetch materials from class_materials table for this subject if available
      let classMats = [];
      if (classMaterialsTableStatus !== "missing") {
        const queryFilter = !isNaN(Number(cleanClassId)) && Number(cleanClassId) > 0
          ? `subject_id.eq.${cleanClassId},subject_id.eq.${Number(cleanClassId)}`
          : `subject_id.eq.${cleanClassId}`;
        let cmQuery = supabase
          .from("class_materials")
          .select("*")
          .or(queryFilter);
        if (cleanTeacherId) cmQuery = cmQuery.eq("teacher_id", cleanTeacherId);
        const { data: cmData, error: cmErr } = await cmQuery;

        if (cmErr) {
          if (cmErr.status === 404 || cmErr.code === "PGRST205" || cmErr.code === "42P01" || cmErr.status === 400) {
            classMaterialsTableStatus = "missing";
          }
        } else if (cmData) {
          classMats = cmData;
        }
      }

      // 2. Fetch lessons for subject (retrieve all lessons under this subject so materials are never lost)
      let lessonsQuery = supabase
        .from("lessons")
        .select("id, title, topic")
        .eq("subject_id", cleanClassId);

      const { data: lessonsData } = await lessonsQuery;

      const lessonMap = new Map();
      (lessonsData || []).forEach(l => {
        lessonMap.set(String(l.id), String(l.title || l.topic || "Untitled Lesson").trim());
      });

      const lessonIds = Array.from(lessonMap.keys());
      let lessonMats = [];
      if (lessonIds.length > 0) {
        const { data: lmData } = await supabase
          .from("lesson_materials")
          .select("*")
          .in("lesson_id", lessonIds)
          .order("created_at", { ascending: false });
        if (lmData) lessonMats = lmData;
      }

      const combined = [...classMats, ...lessonMats];
      const seenIds = new Set();
      const uniqueMats = [];
      for (const row of combined) {
        const rowId = String(row.id || "");
        if (rowId && !seenIds.has(rowId)) {
          seenIds.add(rowId);
          uniqueMats.push(row);
        }
      }

      const normalized = uniqueMats.map(row => normalizeMaterialRecord({
        ...row,
        lesson_title: row.lesson_id ? (lessonMap.get(String(row.lesson_id)) || "General") : (row.lesson_title || "General")
      }));

      setMaterials(normalized);
    } catch (err) {
      console.warn("[ClassDetail] fetchClassMaterials notice:", err);
      setMaterials([]);
    }
  };

  useEffect(() => {
    if (!supabase || !id || String(id).startsWith("demo-")) return;

    // Trigger server-side scheduled publishing check on DB time NOW()
    triggerScheduledPublishingProcess();

    const refreshAllClassData = () => {
      fetchClassMaterials(teacherProfileId, classData);
      fetchClassAssignments(teacherProfileId, classData);
      fetchClassAnnouncements(teacherProfileId, classData);
      fetchDashboardMetrics(teacherProfileId, id);
    };

    const channelId = `class-detail-rt-${id}-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, refreshAllClassData)
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_materials" }, refreshAllClassData)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments_activity" }, refreshAllClassData)
      .on("postgres_changes", { event: "*", schema: "public", table: "quizzes" }, refreshAllClassData)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_announcements" }, refreshAllClassData)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, refreshAllClassData)
      .subscribe();

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [teacherProfileId, id, classData]);

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setClassData(null);
    setAssignedStudents([]);
    setMaterials([]);
    setAssignments([]);
    setAnnouncements([]);
    setMetrics({
      totalLessons: 0,
      publishedLessons: 0,
      activitiesCount: 0,
      seatworksCount: 0,
      assignmentsCount: 0,
      quizzesCount: 0,
      materialsCount: 0
    });

    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) { navigate("/login"); return; }
      const user = JSON.parse(userData);
      if (user.role !== "teacher") { navigate("/login"); return; }
      setTeacherName(user.name);

      const saved = localStorage.getItem("teacher_classes");
      let foundClass = null;
      if (saved) {
        try {
          const all = JSON.parse(saved);
          foundClass = all.find((c) => String(c.id) === String(id)) || null;
        } catch {
          foundClass = null;
        }
      }

      if (supabase && id && !String(id).startsWith("demo-")) {
        try {
          const queryId = !isNaN(Number(id)) ? Number(id) : id;
          const { data: subData } = await supabase.from("subjects").select("*").eq("id", queryId).maybeSingle();
          if (subData) {
            foundClass = {
              ...(foundClass || {}),
              id: String(subData.id),
              code: String(subData.code || ""),
              name: String(subData.name || "Untitled Class"),
              section: String(subData.section || "Section"),
              schedule: String(subData.schedule || ""),
              room: "",
              semester: "Current School Year",
              studentCount: Number(subData.enrolled || 0),
              capacity: Number(subData.capacity || 0),
              gradeLevel: String(subData.grade_level || "")
            };
          }
        } catch (err) {
          console.warn("[ClassDetail] Fresh subject fetch error:", err);
        }
      }

      if (!isDemoMode && String(id).startsWith("demo-")) {
        navigate("/teacher/classes");
        return;
      }

      if (!foundClass && isDemoMode) {
        foundClass = mockData.classes.find((c) => String(c.id) === String(id)) || mockData.classes[0];
      }

      if (isMounted) {
        setClassData(foundClass || null);
      }

      const resolvedTeacherId = await resolveTeacherProfileId(user.email);
      if (isMounted) {
        setTeacherProfileId(resolvedTeacherId);
      }

      await Promise.all([
        resolveMaterialColumns(),
        resolveAssignmentTable().then(tableName => tableName ? resolveAssignmentColumns(tableName) : null),
        resolveAnnouncementTable().then(tableName => tableName ? resolveAnnouncementColumns(tableName) : null)
      ]);

      await Promise.all([
        loadAvailableStudents(foundClass),
        loadAssignedStudents(resolvedTeacherId, id),
        fetchClassMaterials(resolvedTeacherId, foundClass),
        fetchClassAssignments(resolvedTeacherId, foundClass),
        fetchClassAnnouncements(resolvedTeacherId, foundClass),
        fetchDashboardMetrics(resolvedTeacherId, id)
      ]);

      if (isMounted) {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [navigate, id]);

  useEffect(() => {
    if (!supabase || !teacherProfileId || !id) return;

    const channel = supabase
      .channel(`teacher-class-students-${teacherProfileId}-${id}-${Math.random().toString(36).substring(7)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_student_assignments",
          filter: `teacher_id=eq.${teacherProfileId}`
        },
        (payload) => {
          const newSubjectId = String(payload?.new?.subject_id || "");
          const oldSubjectId = String(payload?.old?.subject_id || "");
          if (newSubjectId === String(id) || oldSubjectId === String(id)) {
            loadAssignedStudents(teacherProfileId, id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherProfileId, id]);

  useEffect(() => {
    if (!supabase || !teacherProfileId) return;

    const ownerColumn = materialColumns.includes("teacher_id")
      ? "teacher_id"
      : materialColumns.includes("created_by")
        ? "created_by"
        : "";

    const config = {
      event: "*",
      schema: "public",
      table: "lesson_materials"
    };

    if (ownerColumn) {
      config.filter = `${ownerColumn}=eq.${teacherProfileId}`;
    }

    if (classMaterialsTableStatus !== "missing") {
      const channel = supabase
        .channel(`class-detail-materials-${teacherProfileId}-${id}-${Math.random().toString(36).substring(7)}`)
        .on("postgres_changes", config, () => {
          fetchClassMaterials(teacherProfileId, classData);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [teacherProfileId, id, materialColumns, classData]);

  useEffect(() => {
    if (!supabase || !teacherProfileId || !assignmentTable) return;

    const ownerColumn = assignmentColumns.includes("created_by")
      ? "created_by"
      : assignmentColumns.includes("teacher_id")
        ? "teacher_id"
        : "";

    const config = {
      event: "*",
      schema: "public",
      table: assignmentTable
    };

    if (ownerColumn) {
      config.filter = `${ownerColumn}=eq.${teacherProfileId}`;
    }

    const channel = supabase
      .channel(`class-detail-assignments-${teacherProfileId}-${id}-${Math.random().toString(36).substring(7)}`)
      .on("postgres_changes", config, () => {
        fetchClassAssignments(teacherProfileId, classData);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherProfileId, id, assignmentTable, assignmentColumns, classData]);

  useEffect(() => {
    if (!supabase || !teacherProfileId || !announcementTable) return;

    const ownerColumn = announcementColumns.includes("created_by")
      ? "created_by"
      : announcementColumns.includes("teacher_id")
        ? "teacher_id"
        : "";
    const classColumn = announcementColumns.includes("class_id")
      ? "class_id"
      : announcementColumns.includes("course_id")
        ? "course_id"
        : announcementColumns.includes("subject_id")
          ? "subject_id"
          : "";

    const config = {
      event: "*",
      schema: "public",
      table: announcementTable
    };

    if (classColumn && id) {
      config.filter = `${classColumn}=eq.${id}`;
    } else if (ownerColumn) {
      config.filter = `${ownerColumn}=eq.${teacherProfileId}`;
    }

    const channel = supabase
      .channel(`class-detail-announcements-${teacherProfileId}-${id}-${announcementTable}-${Math.random().toString(36).substring(7)}`)
      .on("postgres_changes", config, () => {
        fetchClassAnnouncements(teacherProfileId, classData);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherProfileId, id, announcementTable, announcementColumns, classData]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };


  const loadMasterlistStudents = async () => {
    if (!supabase) return;
    setIsMasterlistLoading(true);
    try {
      const { data, error } = await supabase.from("student_masterlist").select("*").order("first_name", { ascending: true });
      if (error) {
        console.error("Failed to fetch masterlist:", error);
      } else {
        setMasterlistStudents(data || []);
      }
    } catch (err) {
      console.error("Error fetching masterlist:", err);
    } finally {
      setIsMasterlistLoading(false);
    }
  };

  const handleOpenStudentModal = () => {
    setSelectedStudentIds([]);
    setStudentPickerQuery("");
    setStuError("");
    setAddStudentMode("individual");
    setSelectedMasterlistIds([]);
    setMasterlistQuery("");
    setCsvFile(null);
    setCsvPreviewData([]);
    setShowStudentModal(true);
    loadMasterlistStudents();
  };
  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds((current) => {
      if (current.includes(studentId)) {
        return current.filter((idValue) => idValue !== studentId);
      }

      return [...current, studentId];
    });
  };

  const handleAddStudent = async () => {
    if (!supabase) {
      setStuError("Supabase client is not configured.");
      return;
    }

    if (!teacherProfileId) {
      setStuError("Teacher profile could not be resolved.");
      return;
    }

    if (selectedStudentIds.length === 0) {
      setStuError("Please select at least one valid student.");
      return;
    }

    const currentCapacity = Number(classData?.capacity || 0);
    const currentEnrolled = assignedStudents.length;
    const availableSlots = Math.max(0, currentCapacity - currentEnrolled);

    if (currentCapacity > 0 && availableSlots <= 0) {
      const msg = `Cannot enroll student. This class has reached its maximum capacity of ${currentCapacity} students.`;
      setStuError(msg);
      toast.error(msg);
      return;
    }

    if (currentCapacity > 0 && selectedStudentIds.length > availableSlots) {
      const msg = `Only ${availableSlots} slots are available for this class.`;
      setStuError(msg);
      toast.error(msg);
      return;
    }

    const alreadyAssigned = selectedStudentIds.some((studentId) => assignedStudents.some((student) => String(student.id) === String(studentId)));
    if (alreadyAssigned) {
      setStuError("This student is already assigned to this class.");
      return;
    }

    const selectedStudents = selectedStudentIds
      .map((studentId) => availableStudents.find((student) => String(student.id) === String(studentId)))
      .filter(Boolean);

    if (selectedStudents.length !== selectedStudentIds.length) {
      setStuError("One or more selected students are invalid.");
      return;
    }

    // Grade Level and Section Parity Validation
    const classGradeNorm = normalizeGradeLevel(getClassGradeValue(classData));
    const classSectionNorm = normalizeSection(classData?.section);

    for (const student of selectedStudents) {
      const studentGradeNorm = normalizeGradeLevel(student.grade_level || student.year_level);
      const studentSectionNorm = normalizeSection(student.section);
      if (!studentSectionNorm || studentSectionNorm === "unassigned" || (classGradeNorm && studentGradeNorm && studentGradeNorm !== classGradeNorm) || (classSectionNorm && studentSectionNorm && studentSectionNorm !== classSectionNorm)) {
        const msg = "Student does not belong to this class section.";
        setStuError(msg);
        toast.error(msg);
        return;
      }
    }

    setIsStudentSubmitting(true);
    setStuError("");

    try {
      const res = await adminApi.enrollStudents({
        subject_id: id,
        student_ids: selectedStudentIds,
        teacher_id: teacherProfileId,
        section: String(classData?.section || "").trim() || null
      });

      if (res.error) {
        throw new Error(res.error.message || res.error);
      }

      const { enrolled_count, skipped_capacity, already_enrolled_count } = res.data;

      await loadAssignedStudents(teacherProfileId, id);
      setSelectedStudentIds([]);
      setShowStudentModal(false);

      if (skipped_capacity > 0) {
        toast.warning(`Successfully enrolled ${enrolled_count} student(s). ${skipped_capacity} student(s) skipped because class capacity was reached.`);
      } else if (already_enrolled_count > 0 && enrolled_count === 0) {
        toast.info("Selected student(s) are already enrolled in this class.");
      } else {
        toast.success(`Successfully enrolled ${enrolled_count} student(s).`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to add student.";
      setStuError(msg);
      toast.error(msg);
    } finally {
      setIsStudentSubmitting(false);
    }
  };

  const handleImportMasterlist = async () => {
    if (!supabase || !teacherProfileId) return;
    if (selectedMasterlistIds.length === 0) {
      setStuError("Please select at least one student from the masterlist.");
      return;
    }

    const selectedStudents = masterlistStudents.filter(s => selectedMasterlistIds.includes(s.id));
    if (selectedStudents.length === 0) return;

    const currentCapacity = Number(classData?.capacity || 0);
    const currentEnrolled = assignedStudents.length;
    const availableSlots = Math.max(0, currentCapacity - currentEnrolled);

    if (currentCapacity > 0 && availableSlots <= 0) {
      const msg = `Cannot enroll student. This class has reached its maximum capacity of ${currentCapacity} students.`;
      setStuError(msg);
      toast.error(msg);
      return;
    }

    if (currentCapacity > 0 && selectedStudents.length > availableSlots) {
      const msg = `Only ${availableSlots} slots are available for this class.`;
      setStuError(msg);
      toast.error(msg);
      return;
    }

    // Grade Level and Section Parity Validation
    const classGradeNorm = normalizeGradeLevel(getClassGradeValue(classData));
    const classSectionNorm = normalizeSection(classData?.section);

    for (const student of selectedStudents) {
      const studentGradeNorm = normalizeGradeLevel(student.year_level || student.grade_level);
      const studentSectionNorm = normalizeSection(student.section);
      if (!studentSectionNorm || studentSectionNorm === "unassigned" || (classGradeNorm && studentGradeNorm && studentGradeNorm !== classGradeNorm) || (classSectionNorm && studentSectionNorm && studentSectionNorm !== classSectionNorm)) {
        const msg = "Student does not belong to this class section.";
        setStuError(msg);
        toast.error(msg);
        return;
      }
    }

    setIsStudentSubmitting(true);
    setStuError("");

    try {
      const selectedLrns = selectedStudents.map(s => String(s.lrn || "").replace(/\D/g, "")).filter(Boolean);
      const { data: profiles } = await supabase.from("profiles").select("id, lrn").in("lrn", selectedLrns);
      const lrnToProfileId = new Map((profiles || []).map(p => [String(p.lrn || "").replace(/\D/g, ""), p.id]));

      const targetStudentIds = [];
      let skippedNoAccount = 0;

      for (const student of selectedStudents) {
        const lrn = String(student.lrn || "").replace(/\D/g, "");
        const profileId = lrnToProfileId.get(lrn);
        if (profileId) {
          targetStudentIds.push(profileId);
        } else {
          skippedNoAccount++;
        }
      }

      if (targetStudentIds.length === 0) {
        setStuError("Selected masterlist students do not have registered student accounts.");
        setIsStudentSubmitting(false);
        return;
      }

      const res = await adminApi.enrollStudents({
        subject_id: id,
        student_ids: targetStudentIds,
        teacher_id: teacherProfileId,
        section: String(classData?.section || "").trim() || null
      });

      if (res.error) throw new Error(res.error.message || res.error);

      const { enrolled_count, skipped_capacity } = res.data;

      await loadAssignedStudents(teacherProfileId, id);
      setShowStudentModal(false);
      
      if (skipped_capacity > 0 || skippedNoAccount > 0) {
        toast.warning(`Imported ${enrolled_count} student(s). ${skipped_capacity > 0 ? `${skipped_capacity} skipped (capacity reached). ` : ''}${skippedNoAccount > 0 ? `${skippedNoAccount} skipped (no account).` : ''}`);
      } else {
        toast.success(`Imported ${enrolled_count} student(s) from Masterlist.`);
      }
    } catch (err) {
      setStuError(err.message || "Failed to import from masterlist.");
      toast.error(err.message || "Failed to import from masterlist.");
    } finally {
      setIsStudentSubmitting(false);
    }
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setIsCsvValidating(true);
    setStuError("");
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').map(row => row.trim()).filter(Boolean);
        if (rows.length < 2) throw new Error("CSV file is empty or missing headers");
        
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        const lrnIdx = headers.indexOf('lrn');
        const firstNameIdx = headers.indexOf('first_name');
        const lastNameIdx = headers.indexOf('last_name');
        const middleNameIdx = headers.indexOf('middle_name');
        const yearLevelIdx = headers.indexOf('year_level');
        const sectionIdx = headers.indexOf('section');
        
        if (lrnIdx === -1 || firstNameIdx === -1 || lastNameIdx === -1) {
          throw new Error("CSV missing required headers: lrn, first_name, last_name");
        }
        
        const records = [];
        const errors = [];
        const classGradeNorm = normalizeGradeLevel(getClassGradeValue(classData));
        const classSectionNorm = normalizeSection(classData?.section);
        
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length > lrnIdx && cols[lrnIdx]) {
            const lrn = cols[lrnIdx].replace(/\D/g, "");
            if (!lrn) {
              errors.push(`Row ${i+1}: Invalid LRN`);
              continue;
            }

            const rowYearLevel = yearLevelIdx !== -1 ? cols[yearLevelIdx] : null;
            const rowSection = sectionIdx !== -1 ? cols[sectionIdx] : null;

            if (classGradeNorm && rowYearLevel) {
              const rowGradeNorm = normalizeGradeLevel(rowYearLevel);
              if (rowGradeNorm && rowGradeNorm !== classGradeNorm) {
                errors.push(`Row ${i+1}: Grade Level mismatch (${rowYearLevel})`);
                continue;
              }
            }

            if (classSectionNorm && rowSection) {
              const rowSecNorm = normalizeSection(rowSection);
              if (rowSecNorm && rowSecNorm !== classSectionNorm) {
                errors.push(`Row ${i+1}: Section mismatch (${rowSection})`);
                continue;
              }
            }

            records.push({
               lrn,
               first_name: cols[firstNameIdx],
               last_name: cols[lastNameIdx],
               middle_name: middleNameIdx !== -1 ? cols[middleNameIdx] : null,
               year_level: rowYearLevel,
               section: rowSection,
            });
          } else {
             errors.push(`Row ${i+1}: Missing LRN`);
          }
        }
        
        setCsvPreviewData(records);
        setCsvValidRecords(records);
        setCsvErrorRecords(errors);
      } catch (err) {
        setStuError(err.message);
        setCsvFile(null);
      } finally {
        setIsCsvValidating(false);
      }
    };
    reader.readAsText(file);
  };

  const handleImportCSV = async () => {
    if (!supabase || !teacherProfileId || csvValidRecords.length === 0) return;

    const currentCapacity = Number(classData?.capacity || 0);
    const currentEnrolled = assignedStudents.length;
    const availableSlots = Math.max(0, currentCapacity - currentEnrolled);

    if (currentCapacity > 0 && availableSlots <= 0) {
      const msg = `Cannot enroll student. This class has reached its maximum capacity of ${currentCapacity} students.`;
      setStuError(msg);
      toast.error(msg);
      return;
    }

    setIsStudentSubmitting(true);
    setStuError("");
    try {
      const { data: existingMaster } = await supabase.from("student_masterlist").select("id, lrn");
      const existingLrns = new Map((existingMaster || []).map(r => [String(r.lrn || "").replace(/\D/g, ""), r.id]));
      
      const newRecords = csvValidRecords.filter(r => !existingLrns.has(String(r.lrn || "").replace(/\D/g, ""))).map(r => ({ ...r, account_created: false }));
      
      if (newRecords.length > 0) {
        const { error } = await supabase.from("student_masterlist").insert(newRecords);
        if (error) throw error;
      }
      
      const csvLrns = csvValidRecords.map(r => String(r.lrn || "").replace(/\D/g, ""));
      const { data: profiles } = await supabase.from("profiles").select("id, lrn").in("lrn", csvLrns);
      const lrnToProfileId = new Map((profiles || []).map(p => [String(p.lrn || "").replace(/\D/g, ""), p.id]));
      
      const targetStudentIds = [];
      for (const student of csvValidRecords) {
         const profileId = lrnToProfileId.get(String(student.lrn || "").replace(/\D/g, ""));
         if (profileId) targetStudentIds.push(profileId);
      }

      if (targetStudentIds.length === 0) {
        setStuError("No registered student accounts found for the CSV LRNs.");
        setIsStudentSubmitting(false);
        return;
      }

      const res = await adminApi.enrollStudents({
        subject_id: id,
        student_ids: targetStudentIds,
        teacher_id: teacherProfileId,
        section: String(classData?.section || "").trim() || null
      });

      if (res.error) throw new Error(res.error.message || res.error);

      const { enrolled_count, skipped_capacity } = res.data;

      await loadAssignedStudents(teacherProfileId, id);
      setShowStudentModal(false);
      
      const skippedNoAccount = csvValidRecords.length - targetStudentIds.length;
      if (skipped_capacity > 0 || skippedNoAccount > 0) {
        toast.warning(`Enrolled ${enrolled_count} students. ${skipped_capacity > 0 ? `${skipped_capacity} skipped (capacity reached). ` : ''}${skippedNoAccount > 0 ? `${skippedNoAccount} skipped (without accounts).` : ''}`);
      } else {
        toast.success(`Successfully imported and enrolled ${enrolled_count} students from CSV.`);
      }
    } catch (err) {
      setStuError(err.message || "Failed to process CSV enrollment.");
      toast.error(err.message || "Failed to process CSV enrollment.");
    } finally {
      setIsStudentSubmitting(false);
    }
  };

  const handleRemoveStudent = async (assignmentId) => {
    if (!supabase || !assignmentId) return;

    try {
      const { error } = await supabase
        .from("teacher_student_assignments")
        .delete()
        .eq("id", assignmentId)
        .eq("teacher_id", teacherProfileId)
        .eq("subject_id", id);

      if (error) {
        throw error;
      }

      await loadAssignedStudents(teacherProfileId, id);
      toast.success("Student removed successfully.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to remove student.";
      setStuError(msg);
      toast.error(msg);
    }
  };

  const requestDeleteStudent = (student) => {
    if (!student?.assignmentId) return;
    setPendingDeleteStudent(student);
    setShowDeleteStudentModal(true);
  };

  const confirmDeleteStudent = async () => {
    if (!pendingDeleteStudent?.assignmentId) {
      setShowDeleteStudentModal(false);
      setPendingDeleteStudent(null);
      return;
    }

    await handleRemoveStudent(pendingDeleteStudent.assignmentId);
    setShowDeleteStudentModal(false);
    setPendingDeleteStudent(null);
  };

  const ensureSubjectLesson = async (subjectId, teacherId) => {
    if (!supabase || !subjectId) return null;
    const cleanId = !isNaN(Number(subjectId)) ? Number(subjectId) : subjectId;
    const { data: existing } = await supabase
      .from("lessons")
      .select("id")
      .eq("subject_id", cleanId)
      .limit(1)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created, error } = await supabase
      .from("lessons")
      .insert({
        subject_id: cleanId,
        teacher_id: teacherId || null,
        school_year: activeSchoolYear || null,
        term: activeQuarter || null,
        title: "General Class Materials",
        status: "Published"
      })
      .select("id")
      .single();

    if (error) {
      console.error("[ensureSubjectLesson] Error creating fallback lesson:", error);
      return null;
    }

    return created?.id;
  };

  // Upload Material
  const handleAddMaterial = async () => {
    const title = String(matForm.title || "").trim();
    const fileType = String(matForm.fileType || "").trim();

    if (!title) {
      setMatError("Title is required.");
      return;
    }

    if (!fileType) {
      setMatError("File Type is required.");
      return;
    }

    if (matFiles.length === 0) {
      setMatError("Attach File is required.");
      return;
    }

    if (!supabase) {
      setMatError("Supabase client is not configured. Check your .env file.");
      return;
    }

    // Ensure we have a teacher ID - try to resolve it now if missing
    let effectiveTeacherId = teacherProfileId;
    if (!effectiveTeacherId) {
      const userData = localStorage.getItem("currentUser");
      const user = userData ? JSON.parse(userData) : null;
      if (user?.email) {
        effectiveTeacherId = await resolveTeacherProfileId(user.email);
        if (effectiveTeacherId) setTeacherProfileId(effectiveTeacherId);
      }
      if (!effectiveTeacherId) {
        setMatError("Unable to identify your teacher account. Please log out and log in again.");
        return;
      }
    }

    setIsUploadingMaterial(true);
    setMatError("");
    setMatSuccess("");

    try {
      const uploadedFiles = [];

      for (const file of matFiles) {
        const timestamp = Date.now();
        const storedFileName = `${timestamp}_${sanitizeFileName(file.name)}`;
        const storagePath = `${effectiveTeacherId}/${storedFileName}`;

        console.log("[ClassDetail] Material upload selected file:", file.name, "size:", file.size);

        const uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, { upsert: false });
        console.log("[ClassDetail] Storage upload response:", uploadResult.error ? uploadResult.error : "OK");

        if (uploadResult.error) {
          const errCode = String(uploadResult.error?.statusCode || uploadResult.error?.status || uploadResult.error?.error || "");
          console.error("[ClassDetail] Storage upload failed:", uploadResult.error);
          if (errCode === "404" || String(uploadResult.error?.message || "").toLowerCase().includes("not found")) {
            setMatError(`Storage bucket '${STORAGE_BUCKET}' not found. Please create it in Supabase Storage.`);
          } else if (["401", "403"].includes(errCode) || String(uploadResult.error?.message || "").toLowerCase().includes("policy")) {
            setMatError(`Upload blocked by storage policy. In Supabase: Storage → ${STORAGE_BUCKET} → Policies → Allow uploads for authenticated users.`);
          } else {
            setMatError(`File upload failed: ${uploadResult.error.message || "Unknown error"}`);
          }
          const rollbackResult = await supabase.storage.from(STORAGE_BUCKET).remove(uploadedFiles.map((item) => item.filePath));
          if (rollbackResult.error) {
            console.error("[ClassDetail] Rollback file delete failed:", rollbackResult.error);
          }
          return;
        }

        const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
        const fileUrl = String(publicData?.publicUrl || "").trim();

        if (!fileUrl) {
          const rollbackResult = await supabase.storage.from(STORAGE_BUCKET).remove([...uploadedFiles.map((item) => item.filePath), storagePath]);
          if (rollbackResult.error) {
            console.error("[ClassDetail] Rollback file delete failed:", rollbackResult.error);
          }
          setMatError("Unable to get uploaded file URL.");
          return;
        }

        uploadedFiles.push({
          fileName: storedFileName,
          filePath: storagePath,
          fileUrl
        });
      }

      // FIXED: Use FIRST file URL as plain string (not JSON array)
      const firstFileUrl = uploadedFiles[0]?.fileUrl;

      const columns = await getMaterialColumns();
      const payload = {
        title,
        description: String(matForm.description || "").trim() || null,
        file_type: fileType,
        file_url: firstFileUrl,  // FIXED Plain URL string - CRITICAL FIX
        teacher_id: effectiveTeacherId  // Always include
      };

      // FIXED: Conditionally add fields ONLY if columns exist
      if (columns.includes("file_name")) {
        payload.file_name = uploadedFiles[0]?.fileName;  // Single file
      }

      if (columns.includes("file_path")) {
        payload.file_path = uploadedFiles[0]?.filePath;  // Single file
      }

      if (columns.includes("subject_id")) {
        payload.subject_id = classData?.id || classData?.subject_id || null;
      }

      if (columns.includes("class_id")) {
        payload.class_id = classData?.id || classData?.subject_id || null;
      }

      if (columns.includes("course_id")) {
        payload.course_id = classData?.id || classData?.subject_id || null;
      }

      if (columns.includes("subject")) {
        payload.subject = String(classData?.code || classData?.name || "").trim() || null;
      }

      if (columns.includes("section")) {
        payload.section = String(classData?.section || "").trim() || null;
      }

      if (columns.includes("created_by")) {
        payload.created_by = effectiveTeacherId;
      }

      // Let DB handle timestamps if possible
      if (columns.includes("created_at") && !columns.find(col => col.includes('default'))) {
        payload.created_at = new Date().toISOString();
      }

      let insertedRecord = null;
      let saveError = null;

      try {
        const { data, error } = await supabase
          .from("class_materials")
          .insert(payload)
          .select("id, *")
          .single();

        if (!error && data) {
          insertedRecord = data;
        } else {
          saveError = error;
        }
      } catch (err) {
        saveError = err;
      }

      if (saveError || !insertedRecord) {
        console.warn("[ClassDetail] class_materials insert notice, attempting lesson_materials fallback:", saveError?.message || saveError);
        const cleanSubId = classData?.id || classData?.subject_id || id;
        const targetLessonId = await ensureSubjectLesson(cleanSubId, effectiveTeacherId);

        if (targetLessonId) {
          const lmPayload = {
            lesson_id: targetLessonId,
            file_name: title || uploadedFiles[0]?.fileName || "Attached Material",
            file_url: firstFileUrl,
            file_size: matFiles[0]?.size || 0,
            file_type: fileType || matFiles[0]?.type || "application/pdf"
          };

          const { data: lmData, error: lmErr } = await supabase
            .from("lesson_materials")
            .insert(lmPayload)
            .select("*")
            .single();

          if (lmErr) {
            console.error("[ClassDetail] Fallback insert to lesson_materials failed:", lmErr);
            setMatError(`Failed to save material: ${lmErr.message}`);
            if (uploadedFiles.length > 0) {
              await supabase.storage.from(STORAGE_BUCKET).remove(uploadedFiles.map((item) => item.filePath));
            }
            return;
          }

          insertedRecord = lmData;
          saveError = null;
        } else {
          setMatError(`Failed to save material: ${saveError?.message || "Could not resolve lesson or subject ID"}`);
          if (uploadedFiles.length > 0) {
            await supabase.storage.from(STORAGE_BUCKET).remove(uploadedFiles.map((item) => item.filePath));
          }
          return;
        }
      }

      if (insertedRecord) {
        const normalized = normalizeMaterialRecord(insertedRecord);
        setMaterials((current) => [normalized, ...current]);
      }

      await fetchClassMaterials(teacherProfileId, classData);
      await fetchDashboardMetrics(effectiveTeacherId || teacherProfileId, id);
      setMatSuccess("Material uploaded successfully!");
      resetMaterialForm(true);
      setShowMaterialModal(false);
    } catch (error) {
      console.error("[ClassDetail] Unexpected error:", error);
      setMatError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploadingMaterial(false);
    }
  };

  const deleteMaterialRecord = async (targetMaterial) => {
    if (!supabase || !targetMaterial?.id) return;

    const materialId = String(targetMaterial.id);

    const previous = materials;
    setMatError("");
    setMatSuccess("");
    setMaterials((current) => current.filter((item) => String(item.id) !== materialId));

    const materialFilePaths = Array.isArray(targetMaterial.filePaths) && targetMaterial.filePaths.length > 0
      ? targetMaterial.filePaths
      : parseStoredFileList(targetMaterial.filePath);

    const backups = [];

    try {
      if (materialFilePaths.length > 0) {
        for (const filePath of materialFilePaths) {
          const downloadResult = await supabase.storage.from(STORAGE_BUCKET).download(filePath);
          if (downloadResult.error) {
            if (isStorageNotFoundError(downloadResult.error)) {
              console.warn("[ClassDetail] Material file missing in storage during delete:", downloadResult.error);
              continue;
            }
            throw new Error(`Failed to prepare file deletion: ${downloadResult.error.message || "Unknown error"}`);
          }

          backups.push({ filePath, blob: downloadResult.data });
        }

        const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(materialFilePaths);
        if (storageError && !isStorageNotFoundError(storageError)) {
          throw new Error(`Failed to delete file from storage: ${storageError.message || "Unknown error"}`);
        }
      }

      let dbDeleteError = null;
      let deleteSuccess = false;

      // 1. Try class_materials table first
      const { error: cmError } = await supabase.from("class_materials").delete().eq("id", materialId);
      if (!cmError) {
        deleteSuccess = true;
      } else {
        dbDeleteError = cmError;
        console.warn("[ClassDetail] class_materials delete notice, trying lesson_materials fallback:", cmError?.message || cmError);

        // 2. Try lesson_materials table as fallback
        try {
          const { error: lmError } = await supabase.from("lesson_materials").delete().eq("id", materialId);
          if (!lmError) {
            deleteSuccess = true;
            dbDeleteError = null;
          }
        } catch (lmErr) {
          console.warn("[ClassDetail] Fallback delete from lesson_materials error:", lmErr);
        }

        // 3. If missing table (404/400/42P01/PGRST205) or item already gone, treat as successful cleanup
        const isTableOrNotFoundError = dbDeleteError && (
          dbDeleteError.status === 404 ||
          dbDeleteError.status === 400 ||
          dbDeleteError.code === "PGRST205" ||
          dbDeleteError.code === "42P01" ||
          dbDeleteError.code === "PGRST116" ||
          String(dbDeleteError.message || "").toLowerCase().includes("not found")
        );

        if (isTableOrNotFoundError) {
          deleteSuccess = true;
          dbDeleteError = null;
        }
      }

      if (dbDeleteError && !deleteSuccess) {
        if (backups.length > 0) {
          for (const backup of backups) {
            const restoreResult = await supabase.storage.from(STORAGE_BUCKET).upload(backup.filePath, backup.blob, {
              upsert: true,
              contentType: backup.blob.type || "application/octet-stream"
            });
            if (restoreResult.error) {
              console.error("[ClassDetail] Failed to restore material file after DB delete failure:", restoreResult.error);
            }
          }
        }
        throw dbDeleteError;
      }

      setMatSuccess("Material deleted successfully.");
    } catch (error) {
      console.error("[ClassDetail] Failed to delete material:", error);
      setMaterials(previous);
      setMatError(error instanceof Error ? error.message : "Unable to delete class material.");
    }
  };

  const requestDeleteMaterial = (materialId) => {
    const target = materials.find((item) => String(item.id) === String(materialId));
    if (!target) return;

    setPendingDeleteMaterial(target);
    setShowDeleteMaterialModal(true);
  };

  const handleDeleteMaterial = (materialId) => {
    requestDeleteMaterial(materialId);
  };

  const confirmDeleteMaterial = async () => {
    await deleteMaterialRecord(pendingDeleteMaterial);
    setShowDeleteMaterialModal(false);
    setPendingDeleteMaterial(null);
  };

  const handleEditMaterial = async () => {
    const title = String(matForm.title || "").trim();
    const fileType = String(matForm.fileType || "").trim();

    if (!title) {
      setMatError("Title is required.");
      return;
    }

    if (!fileType) {
      setMatError("File Type is required.");
      return;
    }

    if (!supabase) {
      setMatError("Supabase client is not configured.");
      return;
    }

    if (!teacherProfileId || !editingMaterialId) {
      setMatError("Material could not be resolved.");
      return;
    }

    setIsUploadingMaterial(true);
    setMatError("");
    setMatSuccess("");

    const existingFilePaths = Array.isArray(matOriginalFiles?.filePaths) ? matOriginalFiles.filePaths : [];
    const existingFileNames = Array.isArray(matOriginalFiles?.fileNames) ? matOriginalFiles.fileNames : [];
    const existingFileUrls = Array.isArray(matOriginalFiles?.fileUrls) ? matOriginalFiles.fileUrls : [];

    try {
      const replacingFiles = matFiles.length > 0;
      const uploadedFiles = [];

      if (replacingFiles) {
        for (const file of matFiles) {
          const timestamp = Date.now();
          const storedFileName = `${timestamp}_${sanitizeFileName(file.name)}`;
          const storagePath = `${teacherProfileId}/${storedFileName}`;

          const uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, { upsert: false });
          if (uploadResult.error) {
            console.error("[ClassDetail] Material replacement upload failed:", uploadResult.error);
            setMatError(`File upload failed: ${uploadResult.error.message || "Unknown error"}`);

            if (uploadedFiles.length > 0) {
              const rollbackResult = await supabase.storage.from(STORAGE_BUCKET).remove(uploadedFiles.map((item) => item.filePath));
              if (rollbackResult.error) {
                console.error("[ClassDetail] Rollback file delete failed:", rollbackResult.error);
              }
            }
            return;
          }

          const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
          const nextFileUrl = String(publicData?.publicUrl || "").trim();

          if (!nextFileUrl) {
            const rollbackResult = await supabase.storage.from(STORAGE_BUCKET).remove([...uploadedFiles.map((item) => item.filePath), storagePath]);
            if (rollbackResult.error) {
              console.error("[ClassDetail] Rollback file delete failed after missing public URL:", rollbackResult.error);
            }
            setMatError("Unable to get uploaded file URL.");
            return;
          }

          uploadedFiles.push({
            fileName: storedFileName,
            filePath: storagePath,
            fileUrl: nextFileUrl
          });
        }
      }

      const nextFileNames = replacingFiles ? uploadedFiles.map((item) => item.fileName) : existingFileNames;
      const nextFilePaths = replacingFiles ? uploadedFiles.map((item) => item.filePath) : existingFilePaths;
      const nextFileUrls = replacingFiles ? uploadedFiles.map((item) => item.fileUrl) : existingFileUrls;

      const fileNamesValue = JSON.stringify(nextFileNames);
      const filePathsValue = JSON.stringify(nextFilePaths);
      const fileUrlsValue = JSON.stringify(nextFileUrls);

      const columns = await getMaterialColumns();
      const payload = {
        title,
        description: String(matForm.description || "").trim() || null,
        file_type: fileType,
        file_url: fileUrlsValue
      };

      // Only add file_name if the column exists in the database
      if (columns.includes("file_name")) {
        payload.file_name = fileNamesValue;
      }

      if (columns.includes("file_path")) {
        payload.file_path = filePathsValue;
      }

      if (columns.includes("subject")) {
        payload.subject = String(classData?.code || "").trim() || null;
      }

      if (columns.includes("subject_id")) {
        payload.subject_id = classData?.id || classData?.subject_id || null;
      }

      if (columns.includes("class_id")) {
        payload.class_id = classData?.id || classData?.subject_id || null;
      }

      if (columns.includes("course_id")) {
        payload.course_id = classData?.id || classData?.subject_id || null;
      }

      if (columns.includes("section")) {
        payload.section = String(classData?.section || "").trim() || null;
      }

      if (columns.includes("teacher_id")) {
        payload.teacher_id = teacherProfileId;
      }

      if (columns.includes("created_by")) {
        payload.created_by = teacherProfileId;
      }

      if (columns.includes("updated_at")) {
        payload.updated_at = new Date().toISOString();
      }

      console.log("[ClassDetail] DB update payload:", payload);

      const updateResult = await supabase.from("class_materials").update(payload).eq("id", editingMaterialId).select("*").single();
      console.log("[ClassDetail] DB update response:", updateResult);

      if (updateResult.error) {
        console.error("[ClassDetail] DB update failed:", updateResult.error);
        setMatError(`Failed to update material record: ${updateResult.error.message || "Unknown error"}`);

        if (replacingFiles && uploadedFiles.length > 0) {
          const rollbackResult = await supabase.storage.from(STORAGE_BUCKET).remove(uploadedFiles.map((item) => item.filePath));
          if (rollbackResult.error) {
            console.error("[ClassDetail] Rollback file delete failed:", rollbackResult.error);
          }
        }
        return;
      }

      let oldFileCleanupFailed = false;
      if (replacingFiles && existingFilePaths.length > 0) {
        const rollbackResult = await supabase.storage.from(STORAGE_BUCKET).remove(existingFilePaths);
        if (rollbackResult.error && !isStorageNotFoundError(rollbackResult.error)) {
          oldFileCleanupFailed = true;
          console.error("[ClassDetail] Old material files delete failed:", rollbackResult.error);
        }
      }

      if (updateResult.data) {
        const normalized = normalizeMaterialRecord(updateResult.data);
        setMaterials((current) =>
          current.map((item) => (String(item.id) === String(editingMaterialId) ? normalized : item))
        );
      }

      await fetchClassMaterials(teacherProfileId, classData);
      if (oldFileCleanupFailed) {
        setMatError("Material was updated, but old file cleanup failed. Please retry or contact admin.");
      }
      setMatSuccess("Material updated successfully.");
      resetMaterialForm(true);
      setShowMaterialModal(false);
    } catch (error) {
      console.error("[ClassDetail] Unexpected material update flow error:", error);
      setMatError(error instanceof Error ? error.message : "Unexpected error while updating material.");
    } finally {
      setIsUploadingMaterial(false);
    }
  };

  const resetMaterialForm = (preserveMessages = false) => {
    setMatForm({ title: "", description: "", fileType: "PDF" });
    setMatFiles([]);
    setMatFileNames([]);
    if (!preserveMessages) {
      setMatError("");
      setMatSuccess("");
    }
    setIsEditingMaterial(false);
    setEditingMaterialId(null);
    setMatOriginalFiles({ fileNames: [], filePaths: [], fileUrls: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openCreateMaterialModal = () => {
    resetMaterialForm();
    setShowMaterialModal(true);
  };

  const openEditMaterialModal = (material) => {
    if (!material?.id) return;

    setIsEditingMaterial(true);
    setEditingMaterialId(material.id);
    setMatForm({
      title: material.title || "",
      description: material.description || "",
      fileType: material.fileType || "PDF"
    });
    setMatFileNames(material.fileNames || (material.fileName ? [material.fileName] : []));
    setMatOriginalFiles({
      fileNames: material.fileNames || (material.fileName ? [material.fileName] : []),
      filePaths: material.filePaths || (material.filePath ? [material.filePath] : []),
      fileUrls: material.fileUrls || (material.fileUrl ? [material.fileUrl] : [])
    });
    setMatFiles([]);
    setMatError("");
    setMatSuccess("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setShowMaterialModal(true);
  };

  const resetAssignmentForm = (preserveMessages = false) => {
    const typeFromTab = activeTab === "quiz" ? "quiz" : activeTab === "assignments" ? "assignment" : "assignment";
    setAsgForm({ title: "", description: "", type: typeFromTab, dueDate: "", maxPoints: "100" });
    setAsgFiles([]);
    setAsgFileNames([]);
    setAsgPickedMaterialIds([]);
    setAsgMaterialAttachments({ fileNames: [], filePaths: [], fileUrls: [] });
    if (!preserveMessages) {
      setAsgError("");
      setAsgSuccess("");
    }
    setIsEditingAssignment(false);
    setEditingAssignmentId(null);
    setAsgOriginalFile(null);
    if (asgFileRef.current) {
      asgFileRef.current.value = "";
    }
  };

  const openCreateAssignmentModal = () => {
    resetAssignmentForm();
    setShowAssignmentModal(true);
  };

  const openCreateQuizModal = () => {
    resetAssignmentForm();
    setAsgForm({
      title: quizTopic ? `Quiz: ${quizTopic}` : "AI Generated Quiz",
      description: quizGenerated || "",
      type: "quiz",
      dueDate: "",
      maxPoints: "100",
    });
    setShowAssignmentModal(true);
  };

  const requestDeleteAssignment = (assignmentId) => {
    const target = assignments.find((item) => String(item.id) === String(assignmentId));
    if (!target) return;

    setPendingDeleteAssignment(target);
    setShowDeleteAssignmentModal(true);
  };

  const deleteAssignmentRecord = async (targetAssignment) => {
    if (!supabase || !targetAssignment?.id) return;

    const assignmentId = String(targetAssignment.id);
    const tableName = await getAssignmentTableName();
    if (!tableName) return;

    const previous = assignments;
    setIsDeletingAssignment(true);
    setAssignments((current) => current.filter((item) => String(item.id) !== assignmentId));

    try {
      const { error } = await supabase.from(tableName).delete().eq("id", assignmentId);
      if (error) {
        throw error;
      }

      if ((targetAssignment.filePaths && targetAssignment.filePaths.length > 0) || targetAssignment.filePath) {
        await removeAssignmentFilesFromStorage(targetAssignment.filePaths || targetAssignment.filePath);
      }

      await fetchClassAssignments(teacherProfileId, classData);
      setAsgSuccess("Assignment/Activity deleted successfully.");
      setAsgError("");
    } catch (error) {
      console.error("[ClassDetail] Failed to delete assignment:", error);
      setAssignments(previous);
      setAsgError(error instanceof Error ? error.message : "Unable to delete assignment.");
    } finally {
      setIsDeletingAssignment(false);
    }
  };

  const removeAssignmentFilesFromStorage = async (filePaths) => {
    const uniquePaths = [...new Set(parseStoredFileList(filePaths))];
    if (uniquePaths.length === 0) return;

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(uniquePaths);
    if (error) {
      console.error("[ClassDetail] Failed to remove assignment files from storage:", error);
    }
  };

  const uploadAssignmentFiles = async (files, resolvedTeacherId) => {
    const tid = resolvedTeacherId || teacherProfileId;
    const uploadedFiles = [];

    for (const file of files) {
      const timestamp = Date.now();
      const storedFileName = `${timestamp}_${sanitizeFileName(file.name)}`;
      const uploadedPath = `assignments/${tid}/${storedFileName}`;

      const uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(uploadedPath, file, { upsert: false });
      if (uploadResult.error) {
        console.error("[ClassDetail] Assignment file upload failed:", uploadResult.error);
        const errCode = String(uploadResult.error?.statusCode || uploadResult.error?.status || uploadResult.error?.error || "");
        if (errCode === "404" || String(uploadResult.error?.message || "").toLowerCase().includes("not found")) {
          throw new Error(`Storage bucket '${STORAGE_BUCKET}' not found. Create it in Supabase Storage.`);
        } else if (["401", "403"].includes(errCode) || String(uploadResult.error?.message || "").toLowerCase().includes("policy")) {
          throw new Error(`Upload blocked by storage policy. In Supabase: Storage ΓåÆ ${STORAGE_BUCKET} ΓåÆ Policies ΓåÆ Allow uploads.`);
        }
        await removeAssignmentFilesFromStorage(uploadedFiles.map((item) => item.filePath));
        throw uploadResult.error;
      }

      const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(uploadedPath);
      const fileUrl = String(publicUrlData?.publicUrl || "").trim();

      if (!fileUrl) {
        await removeAssignmentFilesFromStorage([...uploadedFiles.map((item) => item.filePath), uploadedPath]);
        throw new Error("Unable to get uploaded file URL.");
      }

      uploadedFiles.push({
        fileName: storedFileName,
        filePath: uploadedPath,
        fileUrl
      });
    }

    return uploadedFiles;
  };

  const confirmDeleteAssignment = async () => {
    await deleteAssignmentRecord(pendingDeleteAssignment);
    setShowDeleteAssignmentModal(false);
    setPendingDeleteAssignment(null);
  };

  // Create Assignment/Activity
  const handleAddAssignment = async () => {
    const assignmentType = String(asgForm.type || "").trim().toLowerCase();
    const title = String(asgForm.title || "").trim();
    const dueDate = String(asgForm.dueDate || "").trim();

    if (!assignmentType) {
      setAsgError("Type is required.");
      return;
    }

    if (!title) {
      setAsgError("Title is required.");
      return;
    }

    if (!dueDate) {
      setAsgError("Due Date is required.");
      return;
    }

    if (!supabase) {
      setAsgError("Supabase client is not configured.");
      return;
    }

    // Ensure we have a teacher ID
    let effectiveTeacherId = teacherProfileId;
    if (!effectiveTeacherId) {
      const userData = localStorage.getItem("currentUser");
      const user = userData ? JSON.parse(userData) : null;
      if (user?.email) {
        effectiveTeacherId = await resolveTeacherProfileId(user.email);
        if (effectiveTeacherId) setTeacherProfileId(effectiveTeacherId);
      }
      if (!effectiveTeacherId) {
        setAsgError("Unable to identify your teacher account. Please log out and log in again.");
        return;
      }
    }

    const tableName = await getAssessmentTableName(assignmentType);
    if (!tableName) {
      setAsgError("Assignment table is not available.");
      return;
    }

    setIsPostingAssignment(true);
    setAsgError("");
    setAsgSuccess("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data: userData } = await supabase.auth.getUser();
      const authSessionUser = sessionData?.session?.user || null;
      const authUser = userData?.user || authSessionUser;

      console.log("[ClassDetail] Assignment auth session:", sessionData?.session || null);
      console.log("[ClassDetail] Assignment auth user:", authUser || null);
      console.log("[ClassDetail] Assignment auth user id:", authUser?.id || null);

      const uploadedFiles = asgFiles.length > 0 ? await uploadAssignmentFiles(asgFiles, effectiveTeacherId) : [];
      const nextFileNames = uploadedFiles.length > 0 ? uploadedFiles.map((item) => item.fileName) : asgMaterialAttachments.fileNames;
      const nextFilePaths = uploadedFiles.length > 0 ? uploadedFiles.map((item) => item.filePath) : asgMaterialAttachments.filePaths;
      const nextFileUrls = uploadedFiles.length > 0 ? uploadedFiles.map((item) => item.fileUrl) : asgMaterialAttachments.fileUrls;

      // Build strict payload with only columns that exist in assignments_activity table
      // Schema verified: id (auto), course_id (REQUIRED), title (REQUIRED), assessment_type, description, deadline, file_url, file_name, file_path, created_at (auto), updated_at, updated_by
      const assignmentId = uuidv4();
      const payload = {
        id: assignmentId,
        course_id: id, // REQUIRED: maps class_id/subject_id to course_id
        title: title,
        assessment_type: assignmentType,
        description: String(asgForm.description || "").trim() || null,
        deadline: dueDate || null,
        file_url: nextFileUrls.length > 0 ? JSON.stringify(nextFileUrls) : null,
        file_name: nextFileNames.length > 0 ? JSON.stringify(nextFileNames) : null,
        file_path: nextFilePaths.length > 0 ? JSON.stringify(nextFilePaths) : null,
        school_year: activeSchoolYear,
        term: activeQuarter
      };

      console.log("[ClassDetail] FINAL VALIDATED PAYLOAD:", payload);
      console.log("[ClassDetail] Payload keys:", Object.keys(payload));
      console.log("[ClassDetail] Required fields present:", { id: !!payload.id, course_id: !!payload.course_id, title: !!payload.title, assessment_type: !!payload.assessment_type });

      if (!authUser?.id) {
        throw new Error("Your Supabase session is missing. Please sign out and sign in again.");
      }

      // Direct insert with returned row ΓÇö no retry logic
      const insertResult = await supabase.from(tableName).insert(payload).select("*").maybeSingle();
      console.log("[ClassDetail] Assignment insert response:", insertResult);

      if (insertResult.error) {
        console.error("[ClassDetail] Assignment insert failed:", insertResult.error);

        if (uploadedFiles.length > 0) {
          await removeAssignmentFilesFromStorage(uploadedFiles.map((item) => item.filePath));
        }

        const errCode = String(insertResult.error?.code || insertResult.error?.status || "");
        if (["42501", "401", "403"].includes(errCode) || String(insertResult.error?.message || "").toLowerCase().includes("policy")) {
          setAsgError(`Database blocked by Row Level Security. In Supabase: Table Editor ΓåÆ ${tableName} ΓåÆ RLS Policies ΓåÆ Allow INSERT.`);
        } else {
          setAsgError(`Failed to save assignment: ${insertResult.error.message || "Unknown error"}`);
        }
        return;
      }

      // Get the returned row
      let insertedRow = insertResult?.data || null;

      // Build optimistic UI row from the inserted/returned row or fallback payload
      const optimisticSource = insertedRow || payload;
      const optimisticRow = {
        id: assignmentId,
        course_id: payload.course_id,
        title: payload.title,
        assessment_type: payload.assessment_type,
        description: payload.description,
        deadline: payload.deadline,
        file_url: payload.file_url,
        file_name: payload.file_name,
        file_path: payload.file_path,
        created_at: insertedRow?.created_at || new Date().toISOString()
      };

      const optimisticAssignment = { ...normalizeAssignmentRecord(optimisticRow), _optimistic: !Boolean(insertedRow) };
      setAssignments((prev) => {
        const existing = Array.isArray(prev) ? prev : [];
        const deduped = existing.filter((item) => String(item?.id || "") !== String(optimisticAssignment.id));
        return [optimisticAssignment, ...deduped];
      });

      // Refresh the assignments list to ensure consistency
      await fetchClassAssignments(effectiveTeacherId, classData);

      await fetchClassAssignments(effectiveTeacherId, classData);
      console.log("[ClassDetail] Refreshed assignments count:", assignments.length);
      setAsgSuccess("Assignment/Activity saved successfully.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("connected:assessments-changed", { detail: { classId: id } }));
      }
      resetAssignmentForm(true);
      setShowAssignmentModal(false);
    } catch (error) {
      console.error("[ClassDetail] Unexpected assignment flow error:", error);
      setAsgError(error instanceof Error ? error.message : "Unexpected error while saving assignment.");
    } finally {
      setIsPostingAssignment(false);
    }
  };

  const openEditAssignmentModal = async (assignmentId) => {
    const assignment = assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;

    setIsEditingAssignment(true);
    setEditingAssignmentId(assignmentId);
    setAsgForm({
      title: assignment.title,
      description: assignment.description,
      type: assignment.type,
      dueDate: assignment.dueDate,
      maxPoints: String(assignment.maxPoints || "100"),
    });
    setAsgFileNames(assignment.fileNames || (assignment.fileName ? [assignment.fileName] : []));
    setAsgOriginalFile({
      fileNames: assignment.fileNames || (assignment.fileName ? [assignment.fileName] : []),
      filePaths: assignment.filePaths || (assignment.filePath ? [assignment.filePath] : []),
      fileUrls: assignment.fileUrls || (assignment.fileUrl ? [assignment.fileUrl] : []),
    });
    setAsgFiles([]);
    setAsgError("");
    setAsgSuccess("");
    if (asgFileRef.current) {
      asgFileRef.current.value = "";
    }
    setShowAssignmentModal(true);
  };

  const handleEditAssignment = async () => {
    const assignmentType = String(asgForm.type || "").trim().toLowerCase();
    const title = String(asgForm.title || "").trim();
    const dueDate = String(asgForm.dueDate || "").trim();

    if (!assignmentType) {
      setAsgError("Type is required.");
      return;
    }

    if (!title) {
      setAsgError("Title is required.");
      return;
    }

    if (!dueDate) {
      setAsgError("Due Date is required.");
      return;
    }

    if (!supabase || !editingAssignmentId) {
      setAsgError("Cannot resolve assignment or Supabase client.");
      return;
    }

    const tableName = await getAssessmentTableName(assignmentType);
    if (!tableName) {
      setAsgError("Assignment table is not available.");
      return;
    }

    setIsPostingAssignment(true);
    setAsgError("");
    setAsgSuccess("");

    const existingFileNames = asgOriginalFile?.fileNames || [];
    const existingFilePaths = asgOriginalFile?.filePaths || [];
    const existingFileUrls = asgOriginalFile?.fileUrls || [];

    try {
      const columns = await getAssignmentColumns(tableName);
      const replacingFiles = asgFiles.length > 0;
      const replacingWithMaterials = !replacingFiles && asgPickedMaterialIds.length > 0;
      const uploadedFiles = replacingFiles ? await uploadAssignmentFiles(asgFiles) : [];
      const nextFileNames = replacingFiles ? uploadedFiles.map((item) => item.fileName) : replacingWithMaterials ? asgMaterialAttachments.fileNames : existingFileNames;
      const nextFilePaths = replacingFiles ? uploadedFiles.map((item) => item.filePath) : replacingWithMaterials ? asgMaterialAttachments.filePaths : existingFilePaths;
      const nextFileUrls = replacingFiles ? uploadedFiles.map((item) => item.fileUrl) : replacingWithMaterials ? asgMaterialAttachments.fileUrls : existingFileUrls;
      const fileNamesValue = JSON.stringify(nextFileNames);
      const filePathsValue = JSON.stringify(nextFilePaths);
      const fileUrlsValue = JSON.stringify(nextFileUrls);

      const payload = {};

      const titleColumn = resolveColumnName(columns, ["title", "name"]);
      const descriptionColumn = resolveColumnName(columns, ["description", "instructions", "content"]);
      const dueDateColumn = resolveColumnName(columns, ["deadline"]);
      const maxPointsColumn = resolveColumnName(columns, ["max_points", "total_points", "maxPoints"]);
      const typeColumns = ["assessment_type", "type", "task_type"];

      typeColumns.forEach((columnName) => {
        if (columns.includes(columnName)) {
          payload[columnName] = assignmentType;
        }
      });

      if (titleColumn) payload[titleColumn] = title;

      // Include max_points in description if it exists in form and table doesn't have max_points column
      let descriptionValue = String(asgForm.description || "").trim() || null;
      if (asgForm.maxPoints && !maxPointsColumn) {
        descriptionValue = descriptionValue ? `${descriptionValue}\n\nMax Points: ${asgForm.maxPoints}` : `Max Points: ${asgForm.maxPoints}`;
      }
      if (descriptionColumn) payload[descriptionColumn] = descriptionValue;

      if (dueDateColumn) payload[dueDateColumn] = dueDate;

      // Only add max_points if the column actually exists in the table AND it's not assignments_activity
      // assignments_activity table doesn't have max_points column according to schema
      if (maxPointsColumn && tableName !== 'assignments_activity') {
        payload[maxPointsColumn] = Number(asgForm.maxPoints || 100) || 100;
      }

      if (columns.includes("file_url")) payload.file_url = fileUrlsValue;
      if (columns.includes("file_name")) payload.file_name = fileNamesValue;
      if (columns.includes("file_path")) payload.file_path = filePathsValue;

      if (columns.includes("subject")) payload.subject = String(classData?.code || "").trim() || null;
      if (columns.includes("class_code")) payload.class_code = String(classData?.code || "").trim() || null;
      if (columns.includes("class_name")) payload.class_name = String(classData?.name || "").trim() || null;
      if (columns.includes("section")) payload.section = String(classData?.section || "").trim() || null;
      if (columns.includes("course_id")) payload.course_id = id;
      if (columns.includes("subject_id")) payload.subject_id = id;

      if (columns.includes("updated_by")) payload.updated_by = teacherProfileId;
      if (columns.includes("teacher_id")) payload.teacher_id = teacherProfileId;
      if (columns.includes("author")) payload.author = teacherName;
      if (columns.includes("teacher_name")) payload.teacher_name = teacherName;
      if (columns.includes("updated_at")) payload.updated_at = new Date().toISOString();

      const updateResult = await supabase.from(tableName).update(payload).eq("id", editingAssignmentId);

      if (updateResult.error) {
        console.error("[ClassDetail] Assignment update failed:", updateResult.error);

        if (uploadedFiles.length > 0) {
          await removeAssignmentFilesFromStorage(uploadedFiles.map((item) => item.filePath));
        }

        setAsgError(`Failed to update assignment: ${updateResult.error.message || "Unknown error"}`);
        return;
      }

      if (replacingFiles && existingFilePaths.length > 0) {
        await removeAssignmentFilesFromStorage(existingFilePaths);
      }

      await fetchClassAssignments(teacherProfileId, classData);
      setAsgSuccess("Assignment/Activity updated successfully.");
      resetAssignmentForm(true);
      setShowAssignmentModal(false);
    } catch (error) {
      console.error("[ClassDetail] Unexpected assignment edit flow error:", error);
      setAsgError(error instanceof Error ? error.message : "Unexpected error while updating assignment.");
    } finally {
      setIsPostingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    requestDeleteAssignment(assignment?.id);
  };

  const resetAnnouncementForm = (preserveMessages = false) => {
    setAnnForm({
      title: "",
      content: "",
      link_url: "",
      is_pinned: false,
      status: "Published",
      scheduled_date: new Date().toISOString().split("T")[0],
      scheduled_time: "08:00",
      publishImmediately: true
    });
    setAnnFiles([]);
    setAnnFileNames([]);
    setAnnOriginalFiles({ fileNames: [], filePaths: [], fileUrls: [], attachments: [] });
    setIsEditingAnnouncement(false);
    setEditingAnnouncementId(null);
    if (!preserveMessages) {
      
      
    }
    if (annFileRef.current) {
      annFileRef.current.value = "";
    }
  };

  const openCreateAnnouncementModal = () => {
    resetAnnouncementForm();
    setShowAnnouncementModal(true);
  };

  const openEditAnnouncementModal = (announcement) => {
    if (!announcement?.id) return;

    const existingAttachments = Array.isArray(announcement.attachments) ? announcement.attachments : [];

    setIsEditingAnnouncement(true);
    setEditingAnnouncementId(announcement.id);
    
    let sDate = "";
    let sTime = "08:00";
    if (announcement.scheduledAt) {
      const d = new Date(announcement.scheduledAt);
      sDate = d.toISOString().split("T")[0];
      sTime = d.toTimeString().split(" ")[0].substring(0, 5);
    }

    setAnnForm({
      title: announcement.title || "",
      content: announcement.content || "",
      link_url: announcement.linkUrl || "",
      is_pinned: !!announcement.isPinned,
      status: announcement.status || "Published",
      scheduled_date: sDate,
      scheduled_time: sTime,
      publishImmediately: announcement.status !== "Scheduled"
    });
    setAnnOriginalFiles({
      fileNames: existingAttachments.map((item) => item.fileName || "").filter(Boolean),
      filePaths: existingAttachments.map((item) => item.filePath || "").filter(Boolean),
      fileUrls: existingAttachments.map((item) => item.fileUrl || "").filter(Boolean),
      attachments: existingAttachments
    });
    setAnnFiles([]);
    setAnnFileNames(existingAttachments.map((item) => item.fileName || "").filter(Boolean));
    
    
    if (annFileRef.current) {
      annFileRef.current.value = "";
    }
    setShowAnnouncementModal(true);
  };

  const togglePinAnnouncement = async (e, ann) => {
    e.stopPropagation();
    if (!supabase) return;
    const nextPinned = !ann.isPinned;
    const tableName = await getAnnouncementTableName();
    
    const priorityPayload = JSON.stringify({
      is_pinned: nextPinned,
      status: ann.status,
      scheduled_at: ann.scheduledAt,
      link_url: ann.linkUrl
    });

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ priority: priorityPayload })
        .eq("id", ann.id);

      if (error) throw error;
      toast.success(nextPinned ? "Announcement pinned successfully" : "Announcement unpinned successfully");
      await fetchClassAnnouncements(teacherProfileId, classData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update announcement priority.");
    }
  };

  const toggleArchiveAnnouncement = async (e, ann) => {
    e.stopPropagation();
    if (!supabase) return;
    const nextStatus = ann.status === "Archived" ? "Published" : "Archived";
    const tableName = await getAnnouncementTableName();

    const priorityPayload = JSON.stringify({
      is_pinned: ann.isPinned,
      status: nextStatus,
      scheduled_at: ann.scheduledAt,
      link_url: ann.linkUrl
    });

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ priority: priorityPayload })
        .eq("id", ann.id);

      if (error) throw error;
      toast.success(nextStatus === "Archived" ? "Announcement archived successfully" : "Announcement restored successfully");
      await fetchClassAnnouncements(teacherProfileId, classData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to archive/restore announcement.");
    }
  };

  const validateAnnouncementFiles = (files) => {
    const selected = Array.from(files || []);
    for (const file of selected) {
      const extension = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_ANNOUNCEMENT_FILE_EXTENSIONS.has(extension)) {
        return `Unsupported file type: ${file.name}`;
      }
      if (Number(file?.size || 0) > MAX_ANNOUNCEMENT_FILE_SIZE) {
        return `File too large: ${file.name}. Max size is 15MB.`;
      }
    }
    return "";
  };

  const removeAnnouncementFilesFromStorage = async (filePaths) => {
    const uniquePaths = [...new Set(parseStoredFileList(filePaths))];
    if (uniquePaths.length === 0 || !supabase) return;

    // Files uploaded after the RLS fix live in ANNOUNCEMENT_STORAGE_BUCKET.
    // Legacy files that were uploaded to class-materials as a workaround
    // can be identified because their path starts with "announcements/".
    for (const path of uniquePaths) {
      const bucket = path.startsWith("announcements/") ? "class-materials" : ANNOUNCEMENT_STORAGE_BUCKET;
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error && !isStorageNotFoundError(error)) {
        console.warn("[ClassDetail] Could not remove file from storage:", error.message, path);
      }
    }
  };

  const uploadAnnouncementFiles = async (files) => {
    if (!supabase || !teacherProfileId) return [];

    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return [];

    const uploaded = [];

    // Resolve a valid class UUID for use as the first path segment.
    // The storage RLS policy checks split_part(name, '/', 1) as the class UUID.
    let classUuid = "";
    if (isUuid(id)) {
      classUuid = String(id).trim();
    } else {
      const targetClassId = classData?.id || id;
      if (isUuid(targetClassId)) {
        classUuid = String(targetClassId).trim();
      } else {
        const savedClasses = localStorage.getItem("teacher_classes");
        if (savedClasses) {
          try {
            const parsed = JSON.parse(savedClasses);
            const found = parsed.find(c => isUuid(c.id));
            if (found) classUuid = String(found.id).trim();
          } catch (_) {}
        }
      }
    }

    try {
      for (const file of selectedFiles) {
        const timestamp = Date.now();
        const storedFileName = `${timestamp}_${sanitizeFileName(file.name)}`;

        // Path: <class_uuid>/<teacher_uuid>/<filename>
        // The RLS policy on class-announcements bucket checks split_part(name,'/',1) as the class UUID
        // and verifies the current user is teacher of that class (via TSA or subjects.teacher_id).
        const uploadedPath = classUuid
          ? `${classUuid}/${teacherProfileId}/${storedFileName}`
          : `${teacherProfileId}/${storedFileName}`;

        const uploadResult = await supabase.storage
          .from(ANNOUNCEMENT_STORAGE_BUCKET)
          .upload(uploadedPath, file, { upsert: false });

        console.log("[ClassDetail] Announcement upload result:", uploadResult);

        if (uploadResult.error) {
          throw new Error(uploadResult.error.message || "Unable to upload file.");
        }

        // Build a signed URL so students can download even from a private bucket
        const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
          .from(ANNOUNCEMENT_STORAGE_BUCKET)
          .createSignedUrl(uploadedPath, 60 * 60 * 24 * 365); // 1 year

        const fileUrl = signedUrlData?.signedUrl
          || `storage://${ANNOUNCEMENT_STORAGE_BUCKET}/${uploadedPath}`;

        if (signedUrlErr) {
          console.warn("[ClassDetail] Could not create signed URL:", signedUrlErr.message);
        }

        uploaded.push({
          name: file.name,
          path: uploadedPath,
          url: fileUrl,
          mimeType: file.type || null,
          size: Number(file.size || 0)
        });
      }

      return uploaded;
    } catch (error) {
      if (uploaded.length > 0) {
        await removeAnnouncementFilesFromStorage(uploaded.map((item) => item.path));
      }
      throw error;
    }
  };

  const handleSaveAnnouncement = async () => {
    const title = String(annForm.title || "").trim();
    const content = String(annForm.content || "").trim();

    if (!title) {
      toast.error("Title is required.");
      return;
    }
    if (!content) {
      toast.error("Content is required.");
      return;
    }

    if (!supabase) {
      toast.error("Supabase client is not configured.");
      return;
    }

    // ── Verify active auth session (auth.uid() powers all RLS checks) ────────
    let authUid = "";
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        toast.error("Authentication session expired. Please log in again.");
        console.error("[ClassDetail] Session check failed:", sessionError);
        return;
      }
      authUid = sessionData.session.user?.id || "";
    } catch (sessionErr) {
      toast.error("Authentication session expired. Please log in again.");
      console.error("[ClassDetail] Session check exception:", sessionErr);
      return;
    }

    if (!authUid) {
      toast.error("You must be logged in as a teacher to post announcements.");
      return;
    }

    // ── Resolve effective teacher ID — must match auth.uid() for RLS ─────────
    // In Supabase, profiles.id == auth.uid() for all normal users.
    // If they somehow differ, prefer authUid which is what RLS sees.
    let effectiveTeacherId = teacherProfileId || authUid;
    if (effectiveTeacherId !== authUid) {
      console.warn(
        "[ClassDetail] teacherProfileId does not match authUid — using authUid for RLS compliance.",
        { teacherProfileId, authUid }
      );
      effectiveTeacherId = authUid;
      setTeacherProfileId(authUid);
    }

    // ── Resolve and validate class UUID ──────────────────────────────────────
    const classId = String((isUuid(id) ? id : classData?.id) || "").trim();
    if (!classId || !isUuid(classId)) {
      toast.error("Class information could not be found. Please navigate back and try again.");
      console.error("[ClassDetail] Invalid class ID:", { routeId: id, classData });
      return;
    }

    const tableName = await getAnnouncementTableName();
    if (!tableName) {
      toast.error("Announcements table is not available. Please contact support.");
      return;
    }

    const selectedFiles = Array.from(annFiles || []);
    const validationError = validateAnnouncementFiles(selectedFiles);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    let status = "Published";
    let scheduled_at = null;

    if (!annForm.publishImmediately) {
      if (!annForm.scheduled_date) {
        toast.error("Scheduled date is required for scheduled announcements.");
        return;
      }
      status = "Scheduled";
      scheduled_at = new Date(
        `${annForm.scheduled_date}T${annForm.scheduled_time || "00:00"}`
      ).toISOString();
    }

    setIsPostingAnnouncement(true);
    
    

    console.log("[ClassDetail] Announcement save — debug context:", {
      authUid,
      effectiveTeacherId,
      classId,
      tableName,
      isEditing: isEditingAnnouncement,
      status,
      fileCount: selectedFiles.length,
    });

    const existingAttachments = Array.isArray(annOriginalFiles?.attachments)
      ? annOriginalFiles.attachments.map((attachment) => ({
        name: String(attachment?.fileName || attachment?.name || "").trim(),
        path: String(attachment?.filePath || attachment?.path || "").trim(),
        url: String(attachment?.fileUrl || attachment?.url || "").trim(),
        mimeType: String(attachment?.fileType || attachment?.mimeType || "").trim() || null,
        size: Number(attachment?.size || 0) || null
      })).filter((attachment) => attachment.name || attachment.path || attachment.url)
      : [];

    try {
      const columns = await getAnnouncementColumns(tableName);

      const replacingAttachments = selectedFiles.length > 0;
      const uploadedAttachments = replacingAttachments ? await uploadAnnouncementFiles(selectedFiles) : [];
      const nextAttachments = replacingAttachments ? uploadedAttachments : existingAttachments;

      const titleColumn = resolveColumnName(columns, ["title", "subject", "name"]);
      const contentColumn = resolveColumnName(columns, ["content", "description", "message", "body"]);
      const audienceColumn = resolveColumnName(columns, ["target_audience", "audience", "targetAudience", "target_audience_type", "recipient_audience"]);
      const audienceTypeColumn = resolveColumnName(columns, ["audience_type", "audienceType"]);

      const payload = {};

      if (titleColumn) payload[titleColumn] = title;
      if (contentColumn) payload[contentColumn] = content;
      if (audienceColumn) payload[audienceColumn] = "Students";
      if (audienceTypeColumn) payload[audienceTypeColumn] = "student";

      if (columns.includes("created_by_name")) payload.created_by_name = teacherName;
      // Use effectiveTeacherId (= authUid) so RLS INSERT check passes
      if (columns.includes("created_by") && isUuid(effectiveTeacherId)) payload.created_by = effectiveTeacherId;
      if (columns.includes("teacher_id") && isUuid(effectiveTeacherId)) payload.teacher_id = effectiveTeacherId;
      if (columns.includes("subject")) payload.subject = String(classData?.code || "").trim() || null;
      if (columns.includes("class_code")) payload.class_code = String(classData?.code || "").trim() || null;
      if (columns.includes("class_name")) payload.class_name = String(classData?.name || "").trim() || null;
      if (columns.includes("section")) payload.section = String(classData?.section || "").trim() || null;
      // classId is pre-validated above — required NOT NULL and used by RLS
      if (columns.includes("class_id")) payload.class_id = classId;
      if (columns.includes("course_id")) payload.course_id = classId;
      if (columns.includes("subject_id")) payload.subject_id = classId;

      if (columns.includes("status")) payload.status = status;
      if (columns.includes("scheduled_publish_at")) payload.scheduled_publish_at = scheduled_at;
      if (columns.includes("published_at")) payload.published_at = status === "Published" ? new Date().toISOString() : null;

      if (columns.includes("priority")) {
        payload.priority = JSON.stringify({
          is_pinned: !!annForm.is_pinned,
          status: status,
          scheduled_at: scheduled_at,
          link_url: annForm.link_url || ""
        });
      }

      if (columns.includes("attachments")) {
        payload.attachments = nextAttachments;
      }

      const nextFileNames = nextAttachments.map((attachment) => attachment.name).filter(Boolean);
      const nextFilePaths = nextAttachments.map((attachment) => attachment.path).filter(Boolean);
      const nextFileUrls = nextAttachments.map((attachment) => attachment.url).filter(Boolean);

      if (columns.includes("file_name")) payload.file_name = nextFileNames.length > 0 ? JSON.stringify(nextFileNames) : null;
      if (columns.includes("file_path")) payload.file_path = nextFilePaths.length > 0 ? JSON.stringify(nextFilePaths) : null;
      if (columns.includes("file_url")) payload.file_url = nextFileUrls.length > 0 ? JSON.stringify(nextFileUrls) : null;

      if (!isEditingAnnouncement && columns.includes("created_at")) {
        payload.created_at = new Date().toISOString();
      }
      if (columns.includes("updated_at")) {
        payload.updated_at = new Date().toISOString();
      }

      console.log("[ClassDetail] Announcement payload:", payload);

      const writeResult = isEditingAnnouncement
        ? await supabase.from(tableName).update(payload).eq("id", editingAnnouncementId).select("*").single()
        : await supabase.from(tableName).insert(payload).select("*").single();

      console.log("[ClassDetail] Announcement write result:", writeResult);

      if (writeResult.error) {
        if (uploadedAttachments.length > 0) {
          await removeAnnouncementFilesFromStorage(uploadedAttachments.map((item) => item.path));
        }

        const errMsg = writeResult.error.message || "";
        console.error("[ClassDetail] Supabase write error:", writeResult.error);

        // Map known Supabase/Postgres error messages to user-friendly text
        if (errMsg.includes("row-level security") || errMsg.includes("new row violates")) {
          throw new Error(
            "You do not have permission to post announcements in this class. " +
            "Ensure you are the assigned teacher and your session is active."
          );
        } else if (errMsg.includes("not-null") || errMsg.includes("null value")) {
          throw new Error("A required field is missing. Please fill in the title and content.");
        } else if (errMsg.includes("foreign key") || errMsg.includes("violates foreign key")) {
          throw new Error("Class information could not be found. Please navigate back to the class and try again.");
        } else if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
          throw new Error("This announcement already exists. Please try editing it instead.");
        } else {
          throw new Error(`Failed to save announcement: ${errMsg || "Unknown database error."}`);
        }
      }

      let oldFileCleanupFailed = false;
      if (isEditingAnnouncement && replacingAttachments) {
        const oldPaths = existingAttachments.map((item) => item.path).filter(Boolean);
        if (oldPaths.length > 0) {
          try {
            await removeAnnouncementFilesFromStorage(oldPaths);
          } catch (error) {
            oldFileCleanupFailed = true;
            console.error("[ClassDetail] Old announcement file cleanup failed:", error);
          }
        }
      }

      // Send notifications to students if published immediately
      if (!isEditingAnnouncement && status === "Published" && assignedStudents.length > 0) {
        const notificationInserts = assignedStudents.map(student => ({
          user_id: student.id,
          type: "announcement",
          title: "New Announcement Posted",
          message: `"${title}" is now available in your class.`,
          related_id: String(id),
          is_read: false
        }));

        const { error: notifErr } = await supabase
          .from("notifications")
          .insert(notificationInserts);
        if (notifErr) console.error("[ClassDetail] Notification insert failed:", notifErr);
      }

      if (writeResult.data) {
        const normalized = normalizeAnnouncementRecordLocal(writeResult.data);
        if (isEditingAnnouncement) {
          setAnnouncements((current) => current.map((item) => (String(item.id) === String(editingAnnouncementId) ? normalized : item)));
        } else {
          setAnnouncements((current) => [normalized, ...current]);
        }
      }

      await fetchClassAnnouncements(effectiveTeacherId || teacherProfileId, classData);
      await fetchDashboardMetrics(effectiveTeacherId || teacherProfileId, id);

      if (oldFileCleanupFailed) {
        toast.error("Announcement was saved, but old file cleanup failed. Please contact support if files are missing.");
      }
      toast.success(isEditingAnnouncement ? "Announcement updated successfully." : "Announcement posted successfully.");
      resetAnnouncementForm(true);
      setShowAnnouncementModal(false);
    } catch (error) {
      console.error("[ClassDetail] Announcement save failed:", error);
      const msg = error instanceof Error ? error.message : "Unable to save announcement. Please try again.";
      toast.error(msg);
    } finally {
      setIsPostingAnnouncement(false);
    }
  };

  const requestDeleteAnnouncement = (announcement) => {
    if (!announcement?.id) return;
    setPendingDeleteAnnouncement(announcement);
    setShowDeleteAnnouncementModal(true);
  };

  const deleteAnnouncementRecord = async (targetAnnouncement) => {
    if (!supabase || !targetAnnouncement?.id || !teacherProfileId) return;

    const tableName = await getAnnouncementTableName();
    if (!tableName) {
      toast.error("Announcements table is not available.");
      return;
    }

    const announcementId = String(targetAnnouncement.id);
    const previous = announcements;
    
    
    setAnnouncements((current) => current.filter((item) => String(item.id) !== announcementId));

    const targetFilePaths = [
      ...parseStoredFileList(targetAnnouncement.filePath),
      ...(Array.isArray(targetAnnouncement.attachments)
        ? targetAnnouncement.attachments.map((attachment) => String(attachment?.filePath || attachment?.path || "").trim()).filter(Boolean)
        : [])
    ];
    const uniqueTargetPaths = [...new Set(targetFilePaths)];
    const backups = [];

    try {
      if (uniqueTargetPaths.length > 0) {
        for (const path of uniqueTargetPaths) {
          const bucket = path.includes("announcements/") ? "class-materials" : ANNOUNCEMENT_STORAGE_BUCKET;
          const downloadResult = await supabase.storage.from(bucket).download(path);
          if (downloadResult.error) {
            if (!isStorageNotFoundError(downloadResult.error)) {
              throw new Error(downloadResult.error.message || "Failed to prepare file deletion.");
            }
          } else {
            backups.push({ filePath: path, blob: downloadResult.data, bucket });
          }
        }

        await removeAnnouncementFilesFromStorage(uniqueTargetPaths);
      }

      const { error } = await supabase.from(tableName).delete().eq("id", announcementId);
      if (error) {
        if (backups.length > 0) {
          for (const backup of backups) {
            const restoreResult = await supabase.storage.from(backup.bucket).upload(backup.filePath, backup.blob, {
              upsert: true,
              contentType: backup.blob.type || "application/octet-stream"
            });
            if (restoreResult.error) {
              console.error("[ClassDetail] Failed to restore announcement file after DB delete failure:", restoreResult.error);
            }
          }
        }
        throw new Error(error.message || "Failed to delete announcement.");
      }

      await fetchClassAnnouncements(teacherProfileId, classData);
      await fetchDashboardMetrics(teacherProfileId, id);
      toast.success("Announcement deleted successfully.");
    } catch (error) {
      console.error("[ClassDetail] Announcement delete failed:", error);
      setAnnouncements(previous);
      toast.error(error instanceof Error ? error.message : "Unable to delete announcement.");
    }
  };

  const confirmDeleteAnnouncement = async () => {
    await deleteAnnouncementRecord(pendingDeleteAnnouncement);
    setShowDeleteAnnouncementModal(false);
    setPendingDeleteAnnouncement(null);
  };

  const MOCK_ANNOUNCEMENTS = [
    {
      id: "demo-ann-1",
      title: "📢 Quarter 1 Periodic Examination Schedule & Review Materials",
      content: "Please be reminded that our Quarter 1 Examination for Grade 10 Araling Panlipunan will be held on Thursday, August 15. Make sure to review Module 1 (Kontemporaryong Isyu) and Module 2 (Suliraning Pangkapaligiran). Practice quiz items have been uploaded under the Lessons tab.",
      isPinned: true,
      pinned: true,
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      datePosted: new Date(Date.now() - 3600000 * 24).toISOString(),
      authorName: teacherName || "Class Teacher",
      category: "Exam Notice",
      status: "Active",
    },
    {
      id: "demo-ann-2",
      title: "🌱 Group Project Submission: Environmental Action Plan Poster",
      content: "Reminder for all section groups: Submit your printed infographic or digital poster for the DepEd Climate Change Awareness Campaign by Friday at 5:00 PM. Late submissions will receive a 5-point deduction per day.",
      isPinned: false,
      pinned: false,
      createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
      datePosted: new Date(Date.now() - 3600000 * 72).toISOString(),
      authorName: teacherName || "Class Teacher",
      category: "Project Reminder",
      status: "Active",
    },
  ];

  const MOCK_STUDENTS = [
    { id: "s1", studentId: "109876543210", name: "Juan Dela Cruz", yearLevel: "Grade 10", email: "juan.delacruz@deped.gov.ph", phone: "0917-123-4567", status: "Active" },
    { id: "s2", studentId: "109876543211", name: "Maria Clara Santos", yearLevel: "Grade 10", email: "maria.santos@deped.gov.ph", phone: "0918-234-5678", status: "Active" },
    { id: "s3", studentId: "109876543212", name: "John Mark Reyes", yearLevel: "Grade 10", email: "john.reyes@deped.gov.ph", phone: "0919-345-6789", status: "Active" },
  ];

  const activeStudentsList = isDemoMode
    ? MOCK_STUDENTS
    : assignedStudents;

  const activeAnnouncementsList = isDemoMode && announcements.length === 0
    ? MOCK_ANNOUNCEMENTS
    : announcements;

  const filteredStudents = activeStudentsList.filter(
    (s) =>
      String(s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.studentId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.yearLevel || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const classGradeValue = getClassGradeValue(classData);
  const classGradeNormalized = normalizeGradeLevel(classGradeValue);
  const classSectionNormalized = normalizeSection(classData?.section);

  const filteredAvailableStudents = availableStudents
    .filter((student) => !assignedStudents.some((assigned) => String(assigned.id) === String(student.id)))
    .filter((student) => {
      const yearLevelRaw = student.grade_level || student.year_level || "";
      const studentGradeNorm = normalizeGradeLevel(yearLevelRaw);
      const studentSectionNorm = normalizeSection(student.section || "");

      // Unassigned or missing section is never eligible
      if (!studentSectionNorm || studentSectionNorm === "unassigned") {
        return false;
      }
      // Grade Level validation
      if (classGradeNormalized && studentGradeNorm !== classGradeNormalized) {
        return false;
      }
      // Section validation
      if (classSectionNormalized && studentSectionNorm !== classSectionNormalized) {
        return false;
      }

      const name = normalizeSearchText(getStudentFullName(student));
      const lrn = normalizeSearchText(student.lrn || "");
      const yearLevel = normalizeSearchText(yearLevelRaw);
      const yearLevelCompact = yearLevel.replace(/\s+/g, "");
      const query = normalizeSearchText(studentPickerQuery);
      const queryCompact = query.replace(/\s+/g, "");
      const queryGradeNormalized = normalizeGradeLevel(query);

      const matchesQuery =
        !query ||
        name.includes(query) ||
        lrn.includes(query) ||
        yearLevel.includes(query) ||
        yearLevelCompact.includes(queryCompact) ||
        (queryGradeNormalized && studentGradeNorm === queryGradeNormalized);

      return matchesQuery;
    });

  useEffect(() => {
    if (!selectAllCheckboxRef.current) return;
    const allFilteredIds = new Set(filteredAvailableStudents.map((student) => student.id));
    const selectedInFiltered = selectedStudentIds.filter((idValue) => allFilteredIds.has(idValue));
    const allSelected = filteredAvailableStudents.length > 0 && selectedInFiltered.length === filteredAvailableStudents.length;
    const partiallySelected = selectedInFiltered.length > 0 && selectedInFiltered.length < filteredAvailableStudents.length;

    selectAllCheckboxRef.current.checked = allSelected;
    selectAllCheckboxRef.current.indeterminate = partiallySelected;
  }, [selectedStudentIds, filteredAvailableStudents]);

  useEffect(() => {
    if (!showStudentModal) return;
    loadAvailableStudents(classData);
  }, [showStudentModal, id, classGradeNormalized, teacherProfileId]);

  useEffect(() => {
    if (!showStudentModal) return;
    console.log("[ClassDetail] Student modal search input:", studentPickerQuery);
    console.log("[ClassDetail] Filtered available students:", filteredAvailableStudents);
  }, [showStudentModal, studentPickerQuery, filteredAvailableStudents]);

  const getDaysUntilDue = (dueDate) => {
    const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "Overdue", color: "text-red-600 bg-red-50" };
    if (diff === 0) return { label: "Due today", color: "text-orange-600 bg-orange-50" };
    if (diff === 1) return { label: "Due tomorrow", color: "text-yellow-600 bg-yellow-50" };
    return { label: `${diff} days left`, color: "text-emerald-600 bg-emerald-50" };
  };



  const getFileIcon = (type = "PDF") => {
    const t = type.toUpperCase();
    if (t === "PDF") return <FileText className="w-5 h-5 text-red-500" />;
    if (t === "PPTX" || t === "PPT") return <File className="w-5 h-5 text-orange-500" />;
    if (t === "DOCX" || t === "DOC") return <File className="w-5 h-5 text-blue-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
          <p className="text-sm font-medium text-gray-600">Loading class details...</p>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Class not found</h2>
          <button
            onClick={() => navigate("/teacher/classes")}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Back to Classes
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "students", label: "Students", icon: <Users className="w-4 h-4" /> },
    { id: "lessons", label: "Lessons", icon: <BookOpen className="w-4 h-4" /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone className="w-4 h-4" /> },
  ];

  const handleQuizFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setQuizMaterialFile(file);
    try {
      const content = await parseDocument(file);
      setQuizMaterialContent(content);
    } catch (err) {
      console.error("Failed to parse quiz material:", err);
      alert("Failed to parse the document. Please try a different file.");
    }
  };

  const handleGenerateQuiz = async () => {
    const topic = String(quizTopic || "").trim();
    if (!topic && !quizInput.trim()) return;
    if (isQuizStreaming) return;

    const materialInfo = quizMaterialContent ? `\n\nREFERENCE MATERIAL:\n${quizMaterialContent}` : "";
    const userPrompt = quizInput.trim() ||
      `Generate a ${quizType} quiz about "${topic}" for ${classData?.name || "this class"}. Include ${quizItemCount} items. Difficulty: ${quizDifficulty}. Format each item clearly with numbered questions and lettered options (A, B, C, D) if multiple choice. Include the answer key at the end.${materialInfo}`;

    const userMsg = { role: "user", content: userPrompt, timestamp: Date.now() };
    const updatedMessages = [...quizMessages, userMsg];
    setQuizMessages(updatedMessages);
    setQuizInput("");
    setIsQuizStreaming(true);

    let accum = "";
    setQuizMessages([...updatedMessages, { role: "assistant", content: "", timestamp: Date.now() }]);

    await streamMessage({
      messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
      fileContents: [],
      onChunk: (text) => {
        accum += text;
        setQuizMessages([...updatedMessages, { role: "assistant", content: accum + "Γûî", timestamp: Date.now() }]);
      },
      onDone: (fullText) => {
        setQuizMessages([...updatedMessages, { role: "assistant", content: fullText, timestamp: Date.now() }]);
        setQuizGenerated(fullText);
        setIsQuizStreaming(false);
      },
      onError: (err) => {
        console.error("Quiz AI Error:", err);
        setQuizMessages([...updatedMessages, { role: "assistant", content: "⚠️ Unable to generate quiz. Please check your AI configuration or try again.", timestamp: Date.now() }]);
        setIsQuizStreaming(false);
      }
    });
  };





  const displayMetrics = isDemoMode ? {
    totalLessons: 5,
    publishedLessons: 5,
    activitiesCount: 2,
    seatworksCount: 2,
    assignmentsCount: 2,
    quizzesCount: 4,
    materialsCount: 4,
    studentCount: 42,
    announcementsCount: 4,
  } : {
    ...metrics,
    studentCount: assignedStudents.length,
    materialsCount: materials.length,
    announcementsCount: announcements.length,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide lg:pl-64">
        <input
          type="file"
          ref={quizMaterialInputRef}
          onChange={handleQuizFileChange}
          className="hidden"
          accept=".pdf,.docx,.doc,.txt"
        />
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Class Details</h2>
            <NotificationDropdown />
          </div>
        </div>

        <div className="p-6 space-y-6">

          <button
            onClick={() => navigate("/teacher/classes")}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Classes
          </button>

          <div data-tour="teacher-class-banner" className="rounded-2xl bg-green-600 p-6 text-white shadow-sm border border-green-500/30">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-green-100 font-medium">Assigned Class</p>
                <h3 className="text-3xl font-bold leading-tight">
                  {[String(classData?.name || "").trim(), String(classData?.section || "").trim()].filter(Boolean).join(" - ")
                    || String(classData?.name || classData?.section || "Section").trim()}
                </h3>
              </div>
            </div>

            {/* Dashboard Stats Panel */}
            <div className="space-y-4">
              {/* Row 1 */}
              <div>
                <p className="text-sm font-semibold text-green-100 uppercase tracking-wider mb-2">Class Overview</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div 
                    className="rounded-xl bg-white/10 border border-white/20 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 text-green-100 text-xs font-semibold uppercase tracking-wider">
                      <div className="p-1.5 rounded-lg bg-white/10">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      Students
                    </div>
                    <p className="text-3xl font-bold mt-2 text-white">{displayMetrics.studentCount}</p>
                  </div>

                  <div 
                    className="rounded-xl bg-white/10 border border-white/20 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 text-green-100 text-xs font-semibold uppercase tracking-wider">
                      <div className="p-1.5 rounded-lg bg-white/10">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                      Lessons
                    </div>
                    <p className="text-3xl font-bold mt-2 text-white">{displayMetrics.totalLessons}</p>
                  </div>

                  <div 
                    className="rounded-xl bg-white/10 border border-white/20 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 text-green-100 text-xs font-semibold uppercase tracking-wider">
                      <div className="p-1.5 rounded-lg bg-white/10">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      Materials
                    </div>
                    <p className="text-3xl font-bold mt-2 text-white">{displayMetrics.materialsCount}</p>
                  </div>

                  <div 
                    className="rounded-xl bg-white/10 border border-white/20 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 text-green-100 text-xs font-semibold uppercase tracking-wider">
                      <div className="p-1.5 rounded-lg bg-white/10">
                        <Megaphone className="w-4 h-4 text-white" />
                      </div>
                      Announcements
                    </div>
                    <p className="text-3xl font-bold mt-2 text-white">{displayMetrics.announcementsCount}</p>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="mt-6">
                <p className="text-sm font-semibold text-green-100 uppercase tracking-wider mb-2">Classroom Activity</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="rounded-xl bg-white/10 border border-white/20 p-4 shadow-sm">
                    <div className="flex items-center gap-2.5 text-green-100 text-xs font-semibold uppercase tracking-wider">
                      <div className="p-1.5 rounded-lg bg-white/10">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      Seatworks
                    </div>
                    <p className="text-3xl font-bold mt-2 text-white">{displayMetrics.seatworksCount}</p>
                  </div>

                  <div className="rounded-xl bg-white/10 border border-white/20 p-4 shadow-sm">
                    <div className="flex items-center gap-2.5 text-green-100 text-xs font-semibold uppercase tracking-wider">
                      <div className="p-1.5 rounded-lg bg-white/10">
                        <ClipboardList className="w-4 h-4 text-white" />
                      </div>
                      Assignments
                    </div>
                    <p className="text-3xl font-bold mt-2 text-white">{displayMetrics.assignmentsCount}</p>
                  </div>

                  <div className="rounded-xl bg-white/10 border border-white/20 p-4 shadow-sm">
                    <div className="flex items-center gap-2.5 text-green-100 text-xs font-semibold uppercase tracking-wider">
                      <div className="p-1.5 rounded-lg bg-white/10">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      Quizzes
                    </div>
                    <p className="text-3xl font-bold mt-2 text-white">{displayMetrics.quizzesCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs + Content */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tab Nav */}
            <div data-tour="teacher-class-tabs" className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  data-tour-tab={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap rounded-t-lg ${activeTab === tab.id
                      ? "bg-gray-100 text-green-600"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* STUDENTS TAB */}
              {activeTab === "students" && (() => {
                const capacity = Number(classData?.capacity || 0);
                const enrolledCount = activeStudentsList.length;
                const availableSlots = capacity > 0 ? Math.max(0, capacity - enrolledCount) : "Unlimited";
                const isClassFull = capacity > 0 && enrolledCount >= capacity;

                return (
                <div data-tour="class-detail-students-list">
                  <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Student List</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {enrolledCount} / {capacity > 0 ? capacity : "∞"} Students
                          <span className="ml-2 font-medium">
                            ({isClassFull ? "0 slots available" : `${availableSlots} slot(s) available`})
                          </span>
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${
                        isClassFull
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}>
                        {isClassFull ? "FULL" : "Available"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search students..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <button
                        onClick={handleOpenStudentModal}
                        disabled={isClassFull}
                        title={isClassFull ? "Class is full. No additional students can be enrolled." : ""}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Add Student
                      </button>
                    </div>
                  </div>

                  {isClassFull && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-semibold flex items-center gap-2 mb-4">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Class is full. No additional students can be enrolled. (Capacity: {enrolledCount}/{capacity})</span>
                    </div>
                  )}

                  {filteredStudents.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
                      <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users className="w-7 h-7 text-green-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-1">No students enrolled yet</h4>
                      <p className="text-gray-500 text-sm mb-4">Add students to this class so they can access materials and assignments.</p>
                      <button
                        onClick={handleOpenStudentModal}
                        disabled={isClassFull}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Add First Student
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredStudents.map((student) => (
                            <tr key={student.id} className="hover:bg-green-50 transition-colors">
                              <td className="px-6 py-4 text-sm font-medium text-green-600">{student.studentId}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                    {student.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">{student.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-xs text-gray-600">
                                {student.email && <div className="flex items-center gap-1 mb-0.5"><Mail className="w-3 h-3" />{student.email}</div>}
                                {student.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{student.phone}</div>}
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">{student.status ?? "Active"}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => requestDeleteStudent(student)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* LESSONS TAB */}
              {activeTab === "lessons" && (
                <div data-tour="class-detail-lessons-content">
                  <TeacherLessonsTab 
                    subjectId={id} 
                    teacherId={teacherProfileId} 
                    onLessonsChange={() => fetchDashboardMetrics(teacherProfileId, id)}
                  />
                </div>
              )}

              {/* ANNOUNCEMENTS TAB */}
              {activeTab === "announcements" && (
                <div data-tour="class-detail-announcements-content">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Class Announcements</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Manage and post announcements for your class.</p>
                      </div>
                    <button
                      onClick={openCreateAnnouncementModal}
                      className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm hover:shadow transition-all font-semibold text-sm whitespace-nowrap self-start md:self-auto"
                    >
                      <Megaphone className="w-4 h-4" />
                      New Announcement
                    </button>
                  </div>

                  {/* Feed Filters & Mini Dashboard */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl self-start">
                      <button
                        onClick={() => setActiveAnnouncementTab("Active")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                          activeAnnouncementTab === "Active"
                            ? "bg-white text-green-700 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Active Feed
                      </button>
                      <button
                        onClick={() => setActiveAnnouncementTab("Archived")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                          activeAnnouncementTab === "Archived"
                            ? "bg-white text-green-700 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Archive
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-gray-500 self-end sm:self-auto">
                      <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full">
                        <span className="font-bold">{activeAnnouncementsList.filter(a => (a.isPinned || a.pinned) && a.status !== "Archived").length}</span> Pinned
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                        <span className="font-bold">{activeAnnouncementsList.length}</span> Total
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const filteredList = activeAnnouncementsList.filter((ann) => {
                      if (activeAnnouncementTab === "Archived") {
                        return ann.status === "Archived";
                      }
                      return ann.status !== "Archived";
                    });

                    // Order: Pinned on top, then newest first
                    const sortedList = [...filteredList].sort((a, b) => {
                      if (a.isPinned && !b.isPinned) return -1;
                      if (!a.isPinned && b.isPinned) return 1;
                      return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
                    });

                    if (sortedList.length === 0) {
                      return (
                        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                          <div className="w-14 h-14 bg-green-100/60 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Megaphone className="w-6 h-6 text-green-600" />
                          </div>
                          <h4 className="font-bold text-gray-900 mb-1">
                            {activeAnnouncementTab === "Archived" ? "No archived announcements" : "No announcements posted yet"}
                          </h4>
                          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-5">
                            {activeAnnouncementTab === "Archived"
                              ? "Announcements you archive will be moved here and hidden from student feeds."
                              : "Get your students' attention! Post a lesson update, course announcement, or resource link."}
                          </p>
                          {activeAnnouncementTab !== "Archived" && (
                            <button
                              onClick={openCreateAnnouncementModal}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                            >
                              <Megaphone className="w-4 h-4" />
                              Create Announcement
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {sortedList.map((ann) => (
                          <div
                            key={ann.id}
                            onClick={() => setSelectedAnnouncementDetail(ann)}
                            className={`p-5 bg-white border rounded-2xl hover:shadow-md hover:border-green-200 transition-all duration-200 cursor-pointer relative group ${
                              ann.isPinned ? "border-green-200 bg-green-50/10 ring-1 ring-green-100" : "border-gray-200"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-2.5">
                                  {ann.isPinned && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                      <Sparkles className="w-3.5 h-3.5 fill-green-600 text-green-600" />
                                      Pinned
                                    </span>
                                  )}
                                  {ann.status === "Scheduled" && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                      <Clock className="w-3.5 h-3.5" />
                                      Scheduled: {ann.scheduledAt ? new Date(ann.scheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500 font-medium">
                                    By {ann.author} &bull; {new Date(ann.datePosted).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                </div>

                                <h4 className="font-bold text-gray-900 text-base leading-snug group-hover:text-green-700 transition-colors">
                                  {ann.title}
                                </h4>

                                <p className="text-sm text-gray-600 mt-2 whitespace-pre-line line-clamp-3 leading-relaxed">
                                  {ann.content}
                                </p>

                                {/* Optional Link Indicator */}
                                {ann.linkUrl && (
                                  <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600 font-semibold hover:underline">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Attachment Link Associated</span>
                                  </div>
                                )}

                                {/* Attachments Listing */}
                                {Array.isArray(ann.attachments) && ann.attachments.length > 0 && (
                                  <div className="mt-3.5 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                                    {ann.attachments.map((attachment, idx) => {
                                      const attachmentUrl = String(attachment?.fileUrl || attachment?.url || "").trim();
                                      const attachmentName = String(attachment?.fileName || attachment?.name || `Attachment ${idx + 1}`).trim();
                                      const attachmentKind = String(attachment?.kind || "document");

                                      if (!attachmentUrl) {
                                        return (
                                          <div
                                            key={`${ann.id}-att-${idx}`}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium border border-gray-100"
                                          >
                                            <File className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="truncate max-w-[150px]">{attachmentName}</span>
                                          </div>
                                        );
                                      }

                                      return (
                                        <a
                                          key={`${ann.id}-att-${idx}`}
                                          href={attachmentUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-50/50 hover:bg-green-100/60 text-green-700 text-xs font-medium border border-green-100/50 hover:border-green-200 transition-all"
                                        >
                                          {attachmentKind === "image" ? (
                                            <Sparkles className="w-3.5 h-3.5" />
                                          ) : (
                                            <File className="w-3.5 h-3.5 text-green-500" />
                                          )}
                                          <span className="truncate max-w-[180px]">{attachmentName}</span>
                                        </a>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Three-Dot Menu Options */}
                              <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(openMenuId === ann.id ? null : ann.id);
                                  }}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                                >
                                  <Sparkles className="w-4 h-4 rotate-90" />
                                </button>

                                {openMenuId === ann.id && (
                                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 z-30 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150">
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        openEditAnnouncementModal(ann);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2 transition-colors"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        setOpenMenuId(null);
                                        togglePinAnnouncement(e, ann);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2 transition-colors"
                                    >
                                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                                      {ann.isPinned ? "Unpin" : "Pin"}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        setOpenMenuId(null);
                                        toggleArchiveAnnouncement(e, ann);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2 transition-colors"
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                      {ann.status === "Archived" ? "Restore" : "Archive"}
                                    </button>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        requestDeleteAnnouncement(ann);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* AI QUIZ GENERATOR TAB REMOVED */}
          {/* ••••• ADD STUDENT MODAL ••••• */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-xl flex flex-col max-h-[90vh]">
            <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add Students</h3>
                  <p className="text-sm text-gray-500">Enroll students in {classData.code} — {classData.section}</p>
                </div>
              </div>
              <button onClick={() => setShowStudentModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 pt-4 border-b border-gray-100 flex gap-6 shrink-0">
              <button onClick={() => setAddStudentMode("individual")} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${addStudentMode === "individual" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Individual Student</button>
              <button onClick={() => setAddStudentMode("masterlist")} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${addStudentMode === "masterlist" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Import from Masterlist</button>
              <button onClick={() => setAddStudentMode("csv")} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${addStudentMode === "csv" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Upload CSV</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const capacity = Number(classData?.capacity || 0);
                const currentEnrolled = assignedStudents.length;
                const availableSlots = capacity > 0 ? Math.max(0, capacity - currentEnrolled) : Infinity;
                const selectedCount = addStudentMode === "individual" ? selectedStudentIds.length : (addStudentMode === "masterlist" ? selectedMasterlistIds.length : csvValidRecords.length);
                const isOverCapacity = capacity > 0 && selectedCount > availableSlots;

                return (
                  <>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600 shrink-0" />
                        <span><strong>Capacity Status:</strong> {currentEnrolled} / {capacity > 0 ? capacity : "∞"} Enrolled ({capacity > 0 ? (availableSlots > 0 ? `${availableSlots} slot(s) available` : "Class Full") : "Unlimited"})</span>
                      </div>
                    </div>

                    {isOverCapacity && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2 mb-4">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Notice: Only {availableSlots} slot(s) are available. You selected {selectedCount} students. System will enroll the first {availableSlots} and skip the remaining.</span>
                      </div>
                    )}
                  </>
                );
              })()}

              {stuError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{stuError}</div>
              )}

              {addStudentMode === "individual" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Search Enrolled Students</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by Name, ID, or Year Level"
                        value={studentPickerQuery}
                        onChange={(e) => setStudentPickerQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        const allFilteredIds = filteredAvailableStudents.map((student) => student.id);
                        if (e.target.checked) {
                          setSelectedStudentIds((current) => Array.from(new Set([...current, ...allFilteredIds])));
                        } else {
                          const removable = new Set(allFilteredIds);
                          setSelectedStudentIds((current) => current.filter((idValue) => !removable.has(idValue)));
                        }
                      }}
                      className="accent-green-600"
                    />
                    <span>Select All Students</span>
                  </label>

                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {isStudentsLoading ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">Loading students...</td></tr>
                        ) : filteredAvailableStudents.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No available students found.</td></tr>
                        ) : (
                          filteredAvailableStudents.map((student) => (
                            <tr
                              key={student.id}
                              className={`cursor-pointer transition-colors ${selectedStudentIds.includes(student.id) ? "bg-green-50" : "hover:bg-gray-50"}`}
                              onClick={() => toggleStudentSelection(student.id)}
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedStudentIds.includes(student.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleStudentSelection(student.id);
                                  }}
                                  className="accent-green-600"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{getStudentFullName(student)}</td>
                              <td className="px-4 py-3 text-sm text-green-600">{student.lrn || "N/A"}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{student.year_level || "N/A"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {addStudentMode === "masterlist" && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search Masterlist..."
                        value={masterlistQuery}
                        onChange={(e) => setMasterlistQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                  </div>

                  {(() => {
                    const filtered = masterlistStudents.filter(s => {
                      const studentGradeNorm = normalizeGradeLevel(s.year_level || s.grade_level);
                      const studentSectionNorm = normalizeSection(s.section);

                      if (!studentSectionNorm || studentSectionNorm === "unassigned") return false;
                      if (classGradeNormalized && studentGradeNorm !== classGradeNormalized) return false;
                      if (classSectionNormalized && studentSectionNorm !== classSectionNormalized) return false;

                      // Exclude already enrolled
                      const lrnNorm = String(s.lrn || "").replace(/\D/g, "");
                      if (assignedStudents.some(a => String(a.lrn || "").replace(/\D/g, "") === lrnNorm)) {
                        return false;
                      }

                      const q = masterlistQuery.toLowerCase();
                      const matchesQuery = !q || (
                        (s.first_name && s.first_name.toLowerCase().includes(q)) ||
                        (s.last_name && s.last_name.toLowerCase().includes(q)) ||
                        (s.lrn && String(s.lrn).includes(q))
                      );

                      return matchesQuery;
                    });

                    return (
                      <>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMasterlistIds(Array.from(new Set([...selectedMasterlistIds, ...filtered.map(f => f.id)])));
                              } else {
                                const removable = new Set(filtered.map(f => f.id));
                                setSelectedMasterlistIds(selectedMasterlistIds.filter(id => !removable.has(id)));
                              }
                            }}
                            className="accent-green-600"
                          />
                          <span>Select All Filtered</span>
                        </label>
                        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LRN</th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {isMasterlistLoading ? (
                                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">Loading masterlist...</td></tr>
                              ) : filtered.length === 0 ? (
                                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No students found.</td></tr>
                              ) : (
                                filtered.map((student) => (
                                  <tr
                                    key={student.id}
                                    className={`cursor-pointer transition-colors ${selectedMasterlistIds.includes(student.id) ? "bg-green-50" : "hover:bg-gray-50"}`}
                                    onClick={() => {
                                      setSelectedMasterlistIds(curr => curr.includes(student.id) ? curr.filter(id => id !== student.id) : [...curr, student.id]);
                                    }}
                                  >
                                    <td className="px-4 py-3">
                                      <input
                                        type="checkbox"
                                        checked={selectedMasterlistIds.includes(student.id)}
                                        onChange={() => {}}
                                        className="accent-green-600"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{[student.first_name, student.last_name].filter(Boolean).join(" ")}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{student.lrn || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{student.section || student.year_level || "-"}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {addStudentMode === "csv" && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-2">Upload a CSV file to enroll multiple students</p>
                    <p className="text-xs text-gray-500 mb-4">Required columns: lrn, first_name, last_name. Optional: middle_name, year_level, section</p>
                    <button onClick={() => csvFileInputRef.current?.click()} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
                      {csvFile ? csvFile.name : "Select CSV File"}
                    </button>
                    <input type="file" accept=".csv" ref={csvFileInputRef} onChange={handleCsvFileUpload} className="hidden" />
                  </div>

                  {isCsvValidating && <p className="text-sm text-gray-500 text-center">Validating file...</p>}
                  
                  {!isCsvValidating && (csvValidRecords.length > 0 || csvErrorRecords.length > 0) && (
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <div className="flex-1 bg-green-50 rounded-xl p-3 border border-green-100">
                          <p className="text-xs font-semibold text-green-700 uppercase">Valid Records</p>
                          <p className="text-xl font-bold text-green-800">{csvValidRecords.length}</p>
                        </div>
                        <div className="flex-1 bg-red-50 rounded-xl p-3 border border-red-100">
                          <p className="text-xs font-semibold text-red-700 uppercase">Errors</p>
                          <p className="text-xl font-bold text-red-800">{csvErrorRecords.length}</p>
                        </div>
                      </div>

                      {csvErrorRecords.length > 0 && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-200 max-h-32 overflow-y-auto">
                          <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                            {csvErrorRecords.map((err, i) => <li key={i}>{err}</li>)}
                          </ul>
                        </div>
                      )}
                      
                      {csvValidRecords.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                          <table className="w-full text-left">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">LRN</th>
                                <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Name</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {csvValidRecords.slice(0, 10).map((r, i) => (
                                <tr key={i}>
                                  <td className="px-4 py-2 text-sm text-gray-600">{r.lrn}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900">{r.first_name} {r.last_name}</td>
                                </tr>
                              ))}
                              {csvValidRecords.length > 10 && (
                                <tr>
                                  <td colSpan={2} className="px-4 py-2 text-xs text-gray-500 text-center italic">...and {csvValidRecords.length - 10} more</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex gap-3 shrink-0">
              <button onClick={() => setShowStudentModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
              
              {addStudentMode === "individual" && (
                <button onClick={handleAddStudent} disabled={isStudentSubmitting || selectedStudentIds.length === 0} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                  {isStudentSubmitting ? "Adding..." : `Add Selected (${selectedStudentIds.length})`}
                </button>
              )}
              {addStudentMode === "masterlist" && (
                <button onClick={handleImportMasterlist} disabled={isStudentSubmitting || selectedMasterlistIds.length === 0} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                  {isStudentSubmitting ? "Importing..." : `Import Selected (${selectedMasterlistIds.length})`}
                </button>
              )}
              {addStudentMode === "csv" && (
                <button onClick={handleImportCSV} disabled={isStudentSubmitting || csvValidRecords.length === 0} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                  {isStudentSubmitting ? "Processing..." : `Enroll ${csvValidRecords.length} Students`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteStudentModal && Boolean(pendingDeleteStudent)}
        onClose={() => {
          setShowDeleteStudentModal(false);
          setPendingDeleteStudent(null);
        }}
        onConfirm={confirmDeleteStudent}
        title="Remove Student"
        message={pendingDeleteStudent
          ? `Are you sure you want to remove ${pendingDeleteStudent.name} from this class?`
          : "Are you sure you want to remove this student from this class?"}
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteMaterialModal && Boolean(pendingDeleteMaterial)}
        onClose={() => {
          setShowDeleteMaterialModal(false);
          setPendingDeleteMaterial(null);
        }}
        onConfirm={confirmDeleteMaterial}
        title="Delete Material"
        message={pendingDeleteMaterial
          ? `Are you sure you want to delete this material? (${pendingDeleteMaterial.title})`
          : "Are you sure you want to delete this material?"}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* ••••• CREATE / EDIT MATERIAL MODAL ••••• */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {isEditingMaterial ? "Edit Material" : "Upload Class Material"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {isEditingMaterial ? "Update resource details and links" : "Add learning resources for your students"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowMaterialModal(false);
                  resetMaterialForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {matError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{matError}</span>
                </div>
              )}

              {matSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-700 font-medium">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{matSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Material Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 1: Introduction to Biology"
                  value={matForm.title}
                  onChange={(e) => setMatForm({ ...matForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Category / File Type
                </label>
                <select
                  value={matForm.fileType}
                  onChange={(e) => setMatForm({ ...matForm, fileType: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all"
                >
                  <option value="PDF">PDF Document</option>
                  <option value="DOCX">Word Document (DOCX)</option>
                  <option value="PPTX">Presentation (PPTX)</option>
                  <option value="Video">Video File</option>
                  <option value="Audio">Audio Recording</option>
                  <option value="Link">External Link / URL</option>
                  <option value="Other">Other Resource</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide instructions or background details about this material..."
                  value={matForm.description}
                  onChange={(e) => setMatForm({ ...matForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Attach File {!isEditingMaterial && <span className="text-red-500">*</span>}
                </label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:bg-green-50/10 transition-colors cursor-pointer relative">
                  <Upload className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-600 mb-1">Click to select files from your device</p>
                  <p className="text-[10px] text-gray-400">PDF, DOCX, PPTX, Images, MP4 (Max 50MB)</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setMatFiles(files);
                      setMatFileNames(files.map((file) => file.name));
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                {matFileNames.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {matFileNames.map((name, i) => (
                      <div key={i} className="flex items-center justify-between bg-green-50/50 border border-green-100 rounded-lg px-3 py-1.5 text-xs text-green-800 font-medium">
                        <span className="truncate max-w-[280px]">{name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextFiles = Array.from(matFiles).filter((_, idx) => idx !== i);
                            setMatFiles(nextFiles);
                            setMatFileNames(nextFiles.map(f => f.name));
                          }}
                          className="text-red-500 hover:text-red-700 font-bold"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex gap-3 shrink-0">
              <button
                onClick={() => {
                  setShowMaterialModal(false);
                  resetMaterialForm();
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={isEditingMaterial ? handleUpdateMaterial : handleAddMaterial}
                disabled={isUploadingMaterial || (!isEditingMaterial && matFiles.length === 0 && !matForm.title)}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isUploadingMaterial ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>{isEditingMaterial ? "Save Changes" : "Upload Material"}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteAssignmentModal && Boolean(pendingDeleteAssignment)}
        onClose={() => {
          setShowDeleteAssignmentModal(false);
          setPendingDeleteAssignment(null);
        }}
        onConfirm={confirmDeleteAssignment}
        title="Delete Assignment / Activity"
        message={pendingDeleteAssignment
          ? `Are you sure you want to delete ${pendingDeleteAssignment.title}? This action cannot be undone.`
          : "Are you sure you want to delete this assignment/activity? This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteAnnouncementModal && Boolean(pendingDeleteAnnouncement)}
        onClose={() => {
          setShowDeleteAnnouncementModal(false);
          setPendingDeleteAnnouncement(null);
        }}
        onConfirm={confirmDeleteAnnouncement}
        title="Delete Announcement"
        message={pendingDeleteAnnouncement
          ? `Are you sure you want to delete ${pendingDeleteAnnouncement.title}? This action cannot be undone.`
          : "Are you sure you want to delete this announcement? This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* ••••• CREATE / EDIT ANNOUNCEMENT MODAL ••••• */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Megaphone className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {isEditingAnnouncement ? "Edit Announcement" : "Create Announcement"}
                  </h3>
                  <p className="text-xs text-gray-500">Post updates and news directly to student dashboards</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Announcement Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Midterm Examination Guidelines"
                  value={annForm.title}
                  onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-55/50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Message / Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  placeholder="Write your announcement details here..."
                  value={annForm.content}
                  onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-55/50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Reference Link (Optional)
                </label>
                <input
                  type="url"
                  placeholder="e.g. https://classroom.google.com/..."
                  value={annForm.link_url}
                  onChange={(e) => setAnnForm({ ...annForm, link_url: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-55/50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Attachments (Optional)
                </label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:bg-green-50/10 transition-colors cursor-pointer relative">
                  <Upload className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-650 mb-1">Click to select files from your computer</p>
                  <p className="text-[10px] text-gray-400">PDF, DOCX, Images, and ZIP (Max 15MB)</p>
                  <input
                    type="file"
                    multiple
                    ref={annFileRef}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAnnFiles(files);
                      setAnnFileNames(files.map((file) => file.name));
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                {annFileNames.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {annFileNames.map((name, i) => (
                      <div key={i} className="flex items-center justify-between bg-green-50/40 border border-green-100 rounded-lg px-3 py-1.5 text-xs text-green-800 font-medium">
                        <span className="truncate max-w-[300px]">{name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextFiles = Array.from(annFiles).filter((_, idx) => idx !== i);
                            setAnnFiles(nextFiles);
                            setAnnFileNames(nextFiles.map(f => f.name));
                          }}
                          className="text-red-500 hover:text-red-750 font-bold"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-150 pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800">Pin Announcement</span>
                    <span className="text-[10px] text-gray-550">Always keep this announcement at the top of the feed</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annForm.is_pinned}
                      onChange={(e) => setAnnForm({ ...annForm, is_pinned: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Publish Timing & Scheduling Option */}
                <div className="space-y-3 pt-2 border-t border-gray-150">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Publish Schedule & Timing
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAnnForm({ ...annForm, publishImmediately: true })}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        annForm.publishImmediately
                          ? "bg-white text-green-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Publish Now
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split("T")[0];
                        setAnnForm({
                          ...annForm,
                          publishImmediately: false,
                          scheduled_date: annForm.scheduled_date || today,
                          scheduled_time: annForm.scheduled_time || "08:00"
                        });
                      }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        !annForm.publishImmediately
                          ? "bg-white text-green-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Schedule Date & Time
                    </button>
                  </div>

                  {!annForm.publishImmediately && (
                    <div className="bg-green-50/40 border border-green-200 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center gap-2 text-xs font-bold text-green-900">
                        <Clock className="w-4 h-4 text-green-600" />
                        Set Target Date and Time for Broadcast
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-green-500" /> Publish Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            value={annForm.scheduled_date || new Date().toISOString().split("T")[0]}
                            onChange={(e) => setAnnForm({ ...annForm, scheduled_date: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 text-gray-900 rounded-xl focus:outline-none text-xs focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-green-500" /> Publish Time <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="time"
                            value={annForm.scheduled_time || "08:00"}
                            onChange={(e) => setAnnForm({ ...annForm, scheduled_time: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 text-gray-900 rounded-xl focus:outline-none text-xs focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>

                      {annForm.scheduled_date && (
                        <p className="text-[11px] text-green-700 font-medium">
                          📢 Scheduled for <strong>{annForm.scheduled_date}</strong> at <strong>{annForm.scheduled_time || "08:00"}</strong>.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex gap-3 shrink-0">
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-55 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnnouncement}
                disabled={isPostingAnnouncement}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isPostingAnnouncement ? "Saving..." : isEditingAnnouncement ? "Update Announcement" : "Post Announcement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ••••• ANNOUNCEMENT DETAIL VIEW MODAL ••••• */}
      {selectedAnnouncementDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Megaphone className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 truncate max-w-[320px]">
                    {selectedAnnouncementDetail.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    By {selectedAnnouncementDetail.author} &bull; {new Date(selectedAnnouncementDetail.datePosted).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnnouncementDetail(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {selectedAnnouncementDetail.isPinned && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold border border-green-200">
                  <Sparkles className="w-3.5 h-3.5 fill-green-600 text-green-600" />
                  Pinned Announcement
                </div>
              )}

              <div>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {selectedAnnouncementDetail.content}
                </p>
              </div>

              {selectedAnnouncementDetail.linkUrl && (
                <div className="bg-green-50/30 border border-green-100 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-green-800 uppercase tracking-wider">Reference Link</p>
                    <p className="text-xs text-gray-600 truncate mt-0.5">{selectedAnnouncementDetail.linkUrl}</p>
                  </div>
                  <a
                    href={selectedAnnouncementDetail.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-shrink-0 px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                  >
                    Open Link
                  </a>
                </div>
              )}

              {Array.isArray(selectedAnnouncementDetail.attachments) && selectedAnnouncementDetail.attachments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Attachments</h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {selectedAnnouncementDetail.attachments.map((attachment, idx) => {
                      const attachmentUrl = String(attachment?.fileUrl || attachment?.url || "").trim();
                      const attachmentName = String(attachment?.fileName || attachment?.name || `Attachment ${idx + 1}`).trim();
                      const attachmentKind = String(attachment?.kind || "document");

                      if (!attachmentUrl) return null;

                      return (
                        <div
                          key={`detail-att-${idx}`}
                          className="border border-gray-150 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-white rounded-lg border border-gray-100">
                              <File className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-800 truncate max-w-[280px]">
                                {attachmentName}
                              </p>
                              <p className="text-[10px] text-gray-400 capitalize">
                                {attachmentKind} File
                              </p>
                            </div>
                          </div>
                          <a
                            href={attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold shadow-sm transition-all"
                          >
                            <Download className="w-3.5 h-3.5 text-gray-500" />
                            Download
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex shrink-0">
              <button
                onClick={() => setSelectedAnnouncementDetail(null)}
                className="w-full px-4 py-2.5 bg-gray-105 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-150 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassDetail;


