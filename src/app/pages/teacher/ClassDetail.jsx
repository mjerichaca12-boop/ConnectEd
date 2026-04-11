import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { ConfirmDialog } from "@/app/components/ui/ConfirmDialog";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { supabase } from "@/app/lib/supabaseClient";
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
  getPriorityStyles,
  formatAnnouncementDate
} from "@/app/lib/teacherHelpers";
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
  Trash2,
  Calendar,
  AlertCircle,
  Bell,
} from "lucide-react";

const STORAGE_BUCKET = "class-materials";
const ASSIGNMENT_TABLE_CANDIDATES = ["assignments_activity", "class_assignments", "assignments", "teacher_assignments", "class_activities"];
const ANNOUNCEMENT_TABLE = "announcements";

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

  return {
    id: String(row?.id || ""),
    type: String(row?.type || row?.activity_type || row?.task_type || "assignment").trim().toLowerCase() === "activity" ? "activity" : "assignment",
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

const normalizeAnnouncementRecordLocal = (row) => {
  const fileName = String(row?.file_name || "").trim();
  const filePath = String(row?.file_path || "").trim();
  const fileUrl = String(row?.file_url || "").trim();

  return {
    id: String(row?.id || ""),
    title: String(row?.title || "").trim(),
    content: String(row?.content || "").trim(),
    priority: String(row?.priority || row?.announcement_priority || "Medium").trim() || "Medium",
    targetAudience: normalizeAudience(row?.target_audience || row?.audience || row?.targetAudience || "Students"),
    author: String(row?.author || row?.created_by_name || "").trim(),
    fileName,
    filePath,
    fileUrl,
    datePosted: row?.created_at || row?.date_posted || row?.updated_at || new Date().toISOString(),
    classCode: String(row?.subject || row?.class_code || "").trim(),
    className: String(row?.class_name || "").trim(),
    section: String(row?.section || "").trim()
  };
};

export function ClassDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("students");
  const [searchQuery, setSearchQuery] = useState("");

  // Class data from localStorage
  const [classData, setClassData] = useState(null);

  // Per-class lists from localStorage
  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Modal states
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);

  // Student assignment state
  const [teacherProfileId, setTeacherProfileId] = useState("");
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [studentPickerQuery, setStudentPickerQuery] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [isStudentSubmitting, setIsStudentSubmitting] = useState(false);
  const [stuError, setStuError] = useState("");
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [pendingDeleteStudent, setPendingDeleteStudent] = useState(null);

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
  const [asgSupportsFiles, setAsgSupportsFiles] = useState(false);
  const asgFileRef = useRef(null);

  // Assignment edit mode
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [asgOriginalFile, setAsgOriginalFile] = useState(null);

  // Assignment delete confirmation
  const [showDeleteAssignmentModal, setShowDeleteAssignmentModal] = useState(false);
  const [pendingDeleteAssignment, setPendingDeleteAssignment] = useState(null);
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);

  // Announcement form
  const [annForm, setAnnForm] = useState({ title: "", content: "", priority: "Medium" });
  const [annFile, setAnnFile] = useState(null);
  const [annFileName, setAnnFileName] = useState("");
  const [annOriginalFile, setAnnOriginalFile] = useState({ fileName: "", filePath: "", fileUrl: "" });
  const [announcementTable, setAnnouncementTable] = useState(ANNOUNCEMENT_TABLE);
  const [announcementColumns, setAnnouncementColumns] = useState([]);
  const [annError, setAnnError] = useState("");
  const [annSuccess, setAnnSuccess] = useState("");
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [showDeleteAnnouncementModal, setShowDeleteAnnouncementModal] = useState(false);
  const [pendingDeleteAnnouncement, setPendingDeleteAnnouncement] = useState(null);
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

  const syncStudentsIntoClassData = (students) => {
    setAssignedStudents(students);
    setClassData((current) => {
      if (!current) return current;
      return {
        ...current,
        students,
        studentCount: students.length
      };
    });
  };

  const loadAssignedStudents = async (teacherId, subjectId) => {
    if (!supabase || !teacherId || !subjectId) {
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

    const studentIds = [...new Set((assignmentRows ?? []).map((row) => String(row.student_id || "")).filter(Boolean))];

    if (studentIds.length === 0) {
      syncStudentsIntoClassData([]);
      return;
    }

    const { data: studentRows, error: studentError } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, email, lrn, year_level, phone, status")
      .eq("role", "student")
      .in("id", studentIds);

    if (studentError) {
      console.error("Failed to load student records:", studentError);
      syncStudentsIntoClassData([]);
      return;
    }

    const studentById = new Map((studentRows ?? []).map((student) => [String(student.id), student]));
    const mapped = (assignmentRows ?? []).map((row) => {
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
  };

  const loadAvailableStudents = async () => {
    if (!supabase) {
      setAvailableStudents([]);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, middle_name, last_name, email, lrn, year_level, phone, status")
      .eq("role", "student")
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Failed to load students:", error);
      setAvailableStudents([]);
      return;
    }

    setAvailableStudents(data ?? []);
  };

  const resolveTeacherProfileId = async (email) => {
    if (!supabase || !email) return "";

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .eq("role", "teacher")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to resolve teacher profile:", error);
      return "";
    }

    return String(data?.id || "");
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
      "file_path",
      "subject",
      "section",
      "teacher_id",
      "created_by",
      "created_at"
    ];

    const detected = [];

    for (const columnName of candidates) {
      const { error } = await supabase.from("class_materials").select(columnName, { count: "exact", head: true });
      if (!error) {
        detected.push(columnName);
      }
    }

    setMaterialColumns(detected);
    return detected;
  };

  const getMaterialColumns = async () => {
    if (materialColumns.length > 0) {
      return materialColumns;
    }

    return resolveMaterialColumns();
  };

  const resolveAssignmentTable = async () => {
    if (!supabase) {
      return "";
    }

    for (const tableName of ASSIGNMENT_TABLE_CANDIDATES) {
      const { error } = await supabase.from(tableName).select("id", { count: "exact", head: true });
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
      const { error } = await supabase.from(assignmentTable).select("id", { count: "exact", head: true });
      if (!error) {
        return assignmentTable;
      }
    }

    return resolveAssignmentTable();
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

    const defaultColumns = [
      "id",
      "type",
      "activity_type",
      "task_type",
      "title",
      "name",
      "description",
      "instructions",
      "content",
      "due_date",
      "dueDate",
      "deadline",
      "max_points",
      "total_points",
      "maxPoints",
      "file_url",
      "file_name",
      "file_path",
      "course_id",
      "created_at",
      "updated_at",
      "updated_by"
    ];

    const { data, error } = await supabase.from(tableName).select("*").limit(1);
    if (error) {
      console.error("[ClassDetail] Failed to resolve assignment columns:", error);
      setAssignmentColumns(defaultColumns);
      setAsgSupportsFiles(defaultColumns.includes("file_url") || defaultColumns.includes("file_name") || defaultColumns.includes("file_path"));
      return defaultColumns;
    }

    const detected = data && data.length > 0 ? Object.keys(data[0]) : defaultColumns;

    setAssignmentColumns(detected);
    const supportsFiles = detected.includes("file_url") || detected.includes("file_name") || detected.includes("file_path");
    setAsgSupportsFiles(supportsFiles);
    return detected;
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

    const { error } = await supabase.from(ANNOUNCEMENT_TABLE).select("id", { count: "exact", head: true });
    if (error) {
      console.error("[ClassDetail] Announcements table check failed:", error);
      return "";
    }

    setAnnouncementTable(ANNOUNCEMENT_TABLE);
    return ANNOUNCEMENT_TABLE;
  };

  const getAnnouncementTableName = async () => {
    if (!supabase) {
      return "";
    }

    if (announcementTable) {
      const { error } = await supabase.from(ANNOUNCEMENT_TABLE).select("id", { count: "exact", head: true });
      if (!error) {
        return ANNOUNCEMENT_TABLE;
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
      "title",
      "content",
      "priority",
      "target_audience",
      "author",
      "created_by",
      "created_by_name",
      "created_at",
      "updated_at",
      "subject",
      "class_code",
      "class_name",
      "class_id",
      "course_id",
      "subject_id",
      "section",
      "file_url",
      "file_name",
      "file_path"
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

  const fetchClassAnnouncements = async (resolvedTeacherId, currentClassData) => {
    if (!supabase || !resolvedTeacherId) {
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

    if (ownerColumn) {
      query = query.eq(ownerColumn, resolvedTeacherId);
    }

    let { data, error } = await query;

    if (error && isColumnMissingError(error)) {
      query = supabase.from(tableName).select("*");
      if (ownerColumn) {
        query = query.eq(ownerColumn, resolvedTeacherId);
      }
      const fallback = await query;
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("[ClassDetail] Failed to fetch announcements:", error);
      setAnnError("Unable to load announcements from database.");
      setAnnouncements([]);
      return;
    }

    const classCode = String(currentClassData?.code || "").trim();
    const classSection = String(currentClassData?.section || "").trim();
    const classId = String(id || "").trim();

    const filtered = (data ?? []).filter((row) => {
      const rowClassId = String(row?.class_id || row?.course_id || row?.subject_id || "").trim();
      const rowSubject = String(row?.subject || row?.class_code || "").trim();
      const rowSection = String(row?.section || "").trim();

      if (rowClassId) {
        return !classId || rowClassId === classId;
      }

      const subjectMatches = !classCode || !rowSubject || rowSubject === classCode;
      const sectionMatches = !classSection || !rowSection || rowSection === classSection;
      return subjectMatches && sectionMatches;
    });

    setAnnouncements(filtered.map(normalizeAnnouncementRecordLocal));
  };

  const fetchClassAssignments = async (resolvedTeacherId, currentClassData) => {
    if (!supabase || !resolvedTeacherId) {
      setAssignments([]);
      return;
    }

    const tableName = await getAssignmentTableName();
    if (!tableName) {
      setAssignments([]);
      return;
    }

    const columns = await getAssignmentColumns(tableName);
    const ownerColumn = resolveColumnName(columns, ["created_by", "teacher_id"]);

    let query = supabase.from(tableName).select("*");
    const orderColumn = columns.includes("created_at")
      ? "created_at"
      : columns.includes("due_date")
        ? "due_date"
        : columns.includes("dueDate")
          ? "dueDate"
          : columns.includes("deadline")
            ? "deadline"
            : "";
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: false });
    }

    if (ownerColumn) {
      query = query.eq(ownerColumn, resolvedTeacherId);
    }

    let { data, error } = await query;

    if (error && isColumnMissingError(error)) {
      query = supabase.from(tableName).select("*");
      if (ownerColumn) {
        query = query.eq(ownerColumn, resolvedTeacherId);
      }
      const fallback = await query;
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("[ClassDetail] Failed to fetch assignments:", error);
      setAsgError("Unable to load assignments from database.");
      setAssignments([]);
      return;
    }

    const classCode = String(currentClassData?.code || "").trim();
    const classSection = String(currentClassData?.section || "").trim();
    const classId = String(id || "").trim();

    const filtered = (data ?? []).filter((row) => {
      const rowCourseId = String(row?.course_id || row?.subject_id || row?.class_id || "").trim();
      const rowSubject = String(row?.subject || row?.class_code || "").trim();
      const rowSection = String(row?.section || "").trim();

      if (rowCourseId) {
        return !classId || rowCourseId === classId;
      }

      const subjectMatches = !classCode || !rowSubject || rowSubject === classCode;
      const sectionMatches = !classSection || !rowSection || rowSection === classSection;
      return subjectMatches && sectionMatches;
    });

    setAssignments(filtered.map(normalizeAssignmentRecord));
  };

  const fetchClassMaterials = async (resolvedTeacherId, currentClassData) => {
    if (!supabase || !resolvedTeacherId) {
      setMaterials([]);
      return;
    }

    const columns = await getMaterialColumns();
    const ownerColumn = resolveColumnName(columns, ["teacher_id", "created_by"]);

    let query = supabase
      .from("class_materials")
      .select("*")
      .order("created_at", { ascending: false });

    if (ownerColumn) {
      query = query.eq(ownerColumn, resolvedTeacherId);
    }

    let { data, error } = await query;

    if (error && isColumnMissingError(error)) {
      query = supabase.from("class_materials").select("*");
      if (ownerColumn) {
        query = query.eq(ownerColumn, resolvedTeacherId);
      }
      const fallback = await query;
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("[ClassDetail] Failed to fetch class materials:", error);
      setMatError("Unable to load class materials from database.");
      setMaterials([]);
      return;
    }

    const classCode = String(currentClassData?.code || "").trim();
    const classSection = String(currentClassData?.section || "").trim();

    const filtered = (data ?? []).filter((row) => {
      const rowSubject = String(row?.subject || "").trim();
      const rowSection = String(row?.section || "").trim();

      const subjectMatches = !classCode || !rowSubject || rowSubject === classCode;
      const sectionMatches = !classSection || !rowSection || rowSection === classSection;
      return subjectMatches && sectionMatches;
    });

    setMaterials(filtered.map(normalizeMaterialRecord));
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) { navigate("/login"); return; }
      const user = JSON.parse(userData);
      if (user.role !== "teacher") { navigate("/login"); return; }
      setTeacherName(user.name);

      const saved = localStorage.getItem("teacher_classes");
      let foundClass = null;
      if (saved) {
        const all = JSON.parse(saved);
        const found = all.find((c) => c.id === id);
        foundClass = found || null;
        if (isMounted) {
          setClassData(found || null);
        }
      }

      const resolvedTeacherId = await resolveTeacherProfileId(user.email);
      if (isMounted) {
        setTeacherProfileId(resolvedTeacherId);
      }

      await resolveMaterialColumns();
      const assignmentTableName = await resolveAssignmentTable();
      if (assignmentTableName) {
        await resolveAssignmentColumns(assignmentTableName);
      }
      const announcementTableName = await resolveAnnouncementTable();
      if (announcementTableName) {
        await resolveAnnouncementColumns(announcementTableName);
      }

      await Promise.all([
        loadAvailableStudents(),
        loadAssignedStudents(resolvedTeacherId, id),
        fetchClassMaterials(resolvedTeacherId, foundClass),
        fetchClassAssignments(resolvedTeacherId, foundClass),
        fetchClassAnnouncements(resolvedTeacherId, foundClass)
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
      .channel(`teacher-class-students-${teacherProfileId}-${id}`)
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
      table: "class_materials"
    };

    if (ownerColumn) {
      config.filter = `${ownerColumn}=eq.${teacherProfileId}`;
    }

    const channel = supabase
      .channel(`class-detail-materials-${teacherProfileId}-${id}`)
      .on("postgres_changes", config, () => {
        fetchClassMaterials(teacherProfileId, classData);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      .channel(`class-detail-assignments-${teacherProfileId}-${id}`)
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

    const config = {
      event: "*",
      schema: "public",
      table: announcementTable
    };

    if (ownerColumn) {
      config.filter = `${ownerColumn}=eq.${teacherProfileId}`;
    }

    const channel = supabase
      .channel(`class-detail-announcements-${teacherProfileId}-${id}-${announcementTable}`)
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

  const handleOpenStudentModal = () => {
    setSelectedStudentIds([]);
    setStudentPickerQuery("");
    setStuError("");
    setShowStudentModal(true);
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

    setIsStudentSubmitting(true);
    setStuError("");

    try {
      const payload = selectedStudents.map((student) => ({
        teacher_id: teacherProfileId,
        student_id: student.id,
        subject_id: id,
        section: String(classData?.section || "").trim() || null,
        status: "Active"
      }));

      const { error } = await supabase
        .from("teacher_student_assignments")
        .insert(payload);

      if (error) {
        if (error.code === "23505") {
          setStuError("One or more selected students are already assigned to this class.");
          return;
        }

        throw error;
      }

      await loadAssignedStudents(teacherProfileId, id);
      setSelectedStudentIds([]);
      setShowStudentModal(false);
    } catch (error) {
      setStuError(error instanceof Error ? error.message : "Unable to add student.");
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
    } catch (error) {
      setStuError(error instanceof Error ? error.message : "Unable to remove student.");
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
      setMatError("Supabase client is not configured.");
      return;
    }

    if (!teacherProfileId) {
      setMatError("Teacher profile could not be resolved.");
      return;
    }

    setIsUploadingMaterial(true);
    setMatError("");
    setMatSuccess("");

    try {
      const uploadedFiles = [];

      for (const file of matFiles) {
        const timestamp = Date.now();
        const storedFileName = `${timestamp}_${sanitizeFileName(file.name)}`;
        const storagePath = `${teacherProfileId}/${storedFileName}`;

        console.log("[ClassDetail] Material upload selected file:", file);

        const uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, { upsert: false });
        console.log("[ClassDetail] Storage upload response:", uploadResult);

        if (uploadResult.error) {
          console.error("[ClassDetail] Storage upload failed:", uploadResult.error);
          if (["401", "403"].includes(String(uploadResult.error?.statusCode || uploadResult.error?.status || ""))) {
            console.warn("[ClassDetail] Storage permissions may be blocking upload. Verify bucket policies for class-materials.");
          }
          setMatError(`File upload failed: ${uploadResult.error.message || "Unknown error"}`);

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

      const fileNamesValue = JSON.stringify(uploadedFiles.map((item) => item.fileName));
      const filePathsValue = JSON.stringify(uploadedFiles.map((item) => item.filePath));
      const fileUrlsValue = JSON.stringify(uploadedFiles.map((item) => item.fileUrl));

      const columns = await getMaterialColumns();
      const payload = {
        title,
        description: String(matForm.description || "").trim() || null,
        file_type: fileType,
        file_url: fileUrlsValue,
        file_name: fileNamesValue
      };

      if (columns.includes("file_path")) {
        payload.file_path = filePathsValue;
      }

      if (columns.includes("subject")) {
        payload.subject = String(classData?.code || "").trim() || null;
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

      if (columns.includes("created_at")) {
        payload.created_at = new Date().toISOString();
      }

      console.log("[ClassDetail] DB insert payload:", payload);

      const insertResult = await supabase.from("class_materials").insert(payload).select("*").single();
      console.log("[ClassDetail] DB insert response:", insertResult);

      if (insertResult.error) {
        console.error("[ClassDetail] DB insert failed:", insertResult.error);
        if (["401", "403"].includes(String(insertResult.error?.code || insertResult.error?.status || ""))) {
          console.warn("[ClassDetail] Database permissions may be blocking insert. Verify RLS policies for class_materials.");
        }
        setMatError(`Failed to save material record: ${insertResult.error.message || "Unknown error"}`);

        if (uploadedFiles.length > 0) {
          const rollbackResult = await supabase.storage.from(STORAGE_BUCKET).remove(uploadedFiles.map((item) => item.filePath));
          if (rollbackResult.error) {
            console.error("[ClassDetail] Rollback file delete failed:", rollbackResult.error);
          }
        }
        return;
      }

      if (insertResult.data) {
        const normalized = normalizeMaterialRecord(insertResult.data);
        setMaterials((current) => [normalized, ...current]);
      }

      await fetchClassMaterials(teacherProfileId, classData);
      setMatSuccess("Material uploaded successfully.");
      resetMaterialForm(true);
      setShowMaterialModal(false);
    } catch (error) {
      console.error("[ClassDetail] Unexpected upload flow error:", error);
      setMatError(error instanceof Error ? error.message : "Unexpected error while uploading material.");
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

      const { error } = await supabase.from("class_materials").delete().eq("id", materialId);

      if (error) {
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
        throw error;
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
        file_url: fileUrlsValue,
        file_name: fileNamesValue
      };

      if (columns.includes("file_path")) {
        payload.file_path = filePathsValue;
      }

      if (columns.includes("subject")) {
        payload.subject = String(classData?.code || "").trim() || null;
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
    setAsgForm({ title: "", description: "", type: "assignment", dueDate: "", maxPoints: "100" });
    setAsgFiles([]);
    setAsgFileNames([]);
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

  const uploadAssignmentFiles = async (files) => {
    const uploadedFiles = [];

    for (const file of files) {
      const timestamp = Date.now();
      const storedFileName = `${timestamp}_${sanitizeFileName(file.name)}`;
      const uploadedPath = `assignments/${teacherProfileId}/${storedFileName}`;

      const uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(uploadedPath, file, { upsert: false });
      if (uploadResult.error) {
        console.error("[ClassDetail] Assignment file upload failed:", uploadResult.error);
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

    if (!teacherProfileId) {
      setAsgError("Teacher profile could not be resolved.");
      return;
    }

    const tableName = await getAssignmentTableName();
    if (!tableName) {
      setAsgError("Assignment table is not available.");
      return;
    }

    setIsPostingAssignment(true);
    setAsgError("");
    setAsgSuccess("");

    try {
      const columns = await getAssignmentColumns(tableName);
      const uploadedFiles = asgFiles.length > 0 ? await uploadAssignmentFiles(asgFiles) : [];
      const fileNamesValue = JSON.stringify(uploadedFiles.map((item) => item.fileName));
      const filePathsValue = JSON.stringify(uploadedFiles.map((item) => item.filePath));
      const fileUrlsValue = JSON.stringify(uploadedFiles.map((item) => item.fileUrl));

      const payload = {};

      const typeColumn = resolveColumnName(columns, ["type", "activity_type", "task_type"]);
      const titleColumn = resolveColumnName(columns, ["title", "name"]);
      const descriptionColumn = resolveColumnName(columns, ["description", "instructions", "content"]);
      const dueDateColumn = resolveColumnName(columns, ["due_date", "dueDate", "deadline"]);
      const maxPointsColumn = resolveColumnName(columns, ["max_points", "total_points", "maxPoints"]);

      if (typeColumn) payload[typeColumn] = assignmentType;
      if (titleColumn) payload[titleColumn] = title;
      if (descriptionColumn) payload[descriptionColumn] = String(asgForm.description || "").trim() || null;
      if (dueDateColumn) payload[dueDateColumn] = dueDate;
      if (maxPointsColumn) payload[maxPointsColumn] = Number(asgForm.maxPoints || 100) || 100;

      if (columns.includes("file_url")) payload.file_url = fileUrlsValue;
      if (columns.includes("file_name")) payload.file_name = fileNamesValue;
      if (columns.includes("file_path")) payload.file_path = filePathsValue;

      if (columns.includes("subject")) payload.subject = String(classData?.code || "").trim() || null;
      if (columns.includes("class_code")) payload.class_code = String(classData?.code || "").trim() || null;
      if (columns.includes("class_name")) payload.class_name = String(classData?.name || "").trim() || null;
      if (columns.includes("section")) payload.section = String(classData?.section || "").trim() || null;
      if (columns.includes("course_id")) payload.course_id = id;
      if (columns.includes("subject_id")) payload.subject_id = id;

      if (columns.includes("created_by")) payload.created_by = teacherProfileId;
      if (columns.includes("teacher_id")) payload.teacher_id = teacherProfileId;
      if (columns.includes("author")) payload.author = teacherName;
      if (columns.includes("teacher_name")) payload.teacher_name = teacherName;
      if (columns.includes("created_at")) payload.created_at = new Date().toISOString();

      const insertResult = await supabase.from(tableName).insert(payload).select("*").single();

      if (insertResult.error) {
        console.error("[ClassDetail] Assignment insert failed:", insertResult.error);

        if (uploadedFiles.length > 0) {
          await removeAssignmentFilesFromStorage(uploadedFiles.map((item) => item.filePath));
        }

        setAsgError(`Failed to save assignment: ${insertResult.error.message || "Unknown error"}`);
        return;
      }

      await fetchClassAssignments(teacherProfileId, classData);
      setAsgSuccess("Assignment/Activity saved successfully.");
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

    const tableName = await getAssignmentTableName();
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
      const uploadedFiles = replacingFiles ? await uploadAssignmentFiles(asgFiles) : [];
      const nextFileNames = replacingFiles ? uploadedFiles.map((item) => item.fileName) : existingFileNames;
      const nextFilePaths = replacingFiles ? uploadedFiles.map((item) => item.filePath) : existingFilePaths;
      const nextFileUrls = replacingFiles ? uploadedFiles.map((item) => item.fileUrl) : existingFileUrls;
      const fileNamesValue = JSON.stringify(nextFileNames);
      const filePathsValue = JSON.stringify(nextFilePaths);
      const fileUrlsValue = JSON.stringify(nextFileUrls);

      const payload = {};

      const typeColumn = resolveColumnName(columns, ["type", "activity_type", "task_type"]);
      const titleColumn = resolveColumnName(columns, ["title", "name"]);
      const descriptionColumn = resolveColumnName(columns, ["description", "instructions", "content"]);
      const dueDateColumn = resolveColumnName(columns, ["due_date", "dueDate", "deadline"]);
      const maxPointsColumn = resolveColumnName(columns, ["max_points", "total_points", "maxPoints"]);

      if (typeColumn) payload[typeColumn] = assignmentType;
      if (titleColumn) payload[titleColumn] = title;
      if (descriptionColumn) payload[descriptionColumn] = String(asgForm.description || "").trim() || null;
      if (dueDateColumn) payload[dueDateColumn] = dueDate;
      if (maxPointsColumn) payload[maxPointsColumn] = Number(asgForm.maxPoints || 100) || 100;

      if (columns.includes("file_url")) payload.file_url = fileUrlsValue;
      if (columns.includes("file_name")) payload.file_name = fileNamesValue;
      if (columns.includes("file_path")) payload.file_path = filePathsValue;
      if (columns.includes("updated_at")) payload.updated_at = new Date().toISOString();
      if (columns.includes("updated_by")) payload.updated_by = teacherProfileId;

      const updateResult = await supabase.from(tableName).update(payload).eq("id", editingAssignmentId).select("*").single();

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
    setAnnForm({ title: "", content: "", priority: "Medium" });
    setAnnFile(null);
    setAnnFileName("");
    setAnnOriginalFile({ fileName: "", filePath: "", fileUrl: "" });
    setIsEditingAnnouncement(false);
    setEditingAnnouncementId(null);
    if (!preserveMessages) {
      setAnnError("");
      setAnnSuccess("");
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

    setIsEditingAnnouncement(true);
    setEditingAnnouncementId(announcement.id);
    setAnnForm({
      title: announcement.title || "",
      content: announcement.content || "",
      priority: announcement.priority || "Medium"
    });
    setAnnOriginalFile({
      fileName: announcement.fileName || "",
      filePath: announcement.filePath || "",
      fileUrl: announcement.fileUrl || ""
    });
    setAnnFile(null);
    setAnnFileName(announcement.fileName || "");
    setAnnError("");
    setAnnSuccess("");
    if (annFileRef.current) {
      annFileRef.current.value = "";
    }
    setShowAnnouncementModal(true);
  };

  const removeAnnouncementFilesFromStorage = async (filePaths) => {
    const uniquePaths = [...new Set(parseStoredFileList(filePaths))];
    if (uniquePaths.length === 0 || !supabase) return;

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(uniquePaths);
    if (error && !isStorageNotFoundError(error)) {
      throw new Error(error.message || "Unable to remove file from storage.");
    }
  };

  const uploadAnnouncementFile = async (file) => {
    if (!supabase || !teacherProfileId || !file) return null;

    const timestamp = Date.now();
    const storedFileName = `${timestamp}_${sanitizeFileName(file.name)}`;
    const uploadedPath = `announcements/${teacherProfileId}/${storedFileName}`;

    const uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(uploadedPath, file, { upsert: false });
    if (uploadResult.error) {
      throw new Error(uploadResult.error.message || "Unable to upload file.");
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(uploadedPath);
    const fileUrl = String(data?.publicUrl || "").trim();
    if (!fileUrl) {
      await removeAnnouncementFilesFromStorage(uploadedPath);
      throw new Error("Unable to generate file URL.");
    }

    return {
      fileName: storedFileName,
      filePath: uploadedPath,
      fileUrl
    };
  };

  const handleSaveAnnouncement = async () => {
    const title = String(annForm.title || "").trim();
    const content = String(annForm.content || "").trim();
    const priority = String(annForm.priority || "Medium").trim() || "Medium";

    if (!title) {
      setAnnError("Title is required.");
      return;
    }

    if (!supabase) {
      setAnnError("Supabase client is not configured.");
      return;
    }

    if (!teacherProfileId) {
      setAnnError("Teacher profile could not be resolved.");
      return;
    }

    const tableName = await getAnnouncementTableName();
    if (!tableName) {
      setAnnError("Announcements table is not available.");
      return;
    }

    setIsPostingAnnouncement(true);
    setAnnError("");
    setAnnSuccess("");

    const existingFile = annOriginalFile || { fileName: "", filePath: "", fileUrl: "" };

    try {
      const columns = await getAnnouncementColumns(tableName);
      const fileColumnsSupported = columns.includes("file_url") || columns.includes("file_name") || columns.includes("file_path");

      if (annFile && !fileColumnsSupported) {
        setAnnError("Current announcements table does not support attachments.");
        return;
      }

      const replacingFile = Boolean(annFile);
      const uploadedFile = replacingFile ? await uploadAnnouncementFile(annFile) : null;

      const titleColumn = resolveColumnName(columns, ["title", "subject", "name"]);
      const contentColumn = resolveColumnName(columns, ["content", "description", "message", "body"]);
      const priorityColumn = resolveColumnName(columns, ["priority", "announcement_priority", "importance", "priority_level"]);
      const audienceColumn = resolveColumnName(columns, ["target_audience", "audience", "targetAudience", "target_audience_type", "recipient_audience", "audience_type"]);

      const payload = {};

      if (titleColumn) payload[titleColumn] = title;
      if (contentColumn) payload[contentColumn] = content;
      if (priorityColumn) payload[priorityColumn] = priority;
      if (audienceColumn) payload[audienceColumn] = "Students";

      if (columns.includes("author")) payload.author = teacherName;
      if (columns.includes("created_by_name")) payload.created_by_name = teacherName;
      if (columns.includes("created_by")) payload.created_by = teacherProfileId;
      if (columns.includes("teacher_id")) payload.teacher_id = teacherProfileId;
      if (columns.includes("subject")) payload.subject = String(classData?.code || "").trim() || null;
      if (columns.includes("class_code")) payload.class_code = String(classData?.code || "").trim() || null;
      if (columns.includes("class_name")) payload.class_name = String(classData?.name || "").trim() || null;
      if (columns.includes("section")) payload.section = String(classData?.section || "").trim() || null;
      if (columns.includes("class_id")) payload.class_id = String(id || "").trim() || null;
      if (columns.includes("course_id")) payload.course_id = String(id || "").trim() || null;
      if (columns.includes("subject_id")) payload.subject_id = String(id || "").trim() || null;

      const nextFileName = replacingFile ? uploadedFile?.fileName || "" : existingFile.fileName;
      const nextFilePath = replacingFile ? uploadedFile?.filePath || "" : existingFile.filePath;
      const nextFileUrl = replacingFile ? uploadedFile?.fileUrl || "" : existingFile.fileUrl;

      if (columns.includes("file_name")) payload.file_name = nextFileName || null;
      if (columns.includes("file_path")) payload.file_path = nextFilePath || null;
      if (columns.includes("file_url")) payload.file_url = nextFileUrl || null;

      if (!isEditingAnnouncement && columns.includes("created_at")) {
        payload.created_at = new Date().toISOString();
      }
      if (columns.includes("updated_at")) {
        payload.updated_at = new Date().toISOString();
      }

      const writeResult = isEditingAnnouncement
        ? await supabase.from(tableName).update(payload).eq("id", editingAnnouncementId).select("*").single()
        : await supabase.from(tableName).insert(payload).select("*").single();

      if (writeResult.error) {
        if (uploadedFile?.filePath) {
          await removeAnnouncementFilesFromStorage(uploadedFile.filePath);
        }
        throw new Error(writeResult.error.message || "Failed to save announcement.");
      }

      let oldFileCleanupFailed = false;
      if (isEditingAnnouncement && replacingFile && existingFile.filePath) {
        try {
          await removeAnnouncementFilesFromStorage(existingFile.filePath);
        } catch (error) {
          oldFileCleanupFailed = true;
          console.error("[ClassDetail] Old announcement file cleanup failed:", error);
        }
      }

      if (writeResult.data) {
        const normalized = normalizeAnnouncementRecordLocal(writeResult.data);
        if (isEditingAnnouncement) {
          setAnnouncements((current) => current.map((item) => (String(item.id) === String(editingAnnouncementId) ? normalized : item)));
        } else {
          setAnnouncements((current) => [normalized, ...current]);
        }
      }

      await fetchClassAnnouncements(teacherProfileId, classData);
      if (oldFileCleanupFailed) {
        setAnnError("Announcement was saved, but old file cleanup failed. Please retry or contact admin.");
      }
      setAnnSuccess(isEditingAnnouncement ? "Announcement updated successfully." : "Announcement posted successfully.");
      resetAnnouncementForm(true);
      setShowAnnouncementModal(false);
    } catch (error) {
      console.error("[ClassDetail] Announcement save failed:", error);
      setAnnError(error instanceof Error ? error.message : "Unable to save announcement.");
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
      setAnnError("Announcements table is not available.");
      return;
    }

    const announcementId = String(targetAnnouncement.id);
    const previous = announcements;
    setAnnError("");
    setAnnSuccess("");
    setAnnouncements((current) => current.filter((item) => String(item.id) !== announcementId));

    const targetFilePath = String(targetAnnouncement.filePath || "").trim();
    let backup = null;

    try {
      if (targetFilePath) {
        const downloadResult = await supabase.storage.from(STORAGE_BUCKET).download(targetFilePath);
        if (downloadResult.error) {
          if (!isStorageNotFoundError(downloadResult.error)) {
            throw new Error(downloadResult.error.message || "Failed to prepare file deletion.");
          }
        } else {
          backup = { filePath: targetFilePath, blob: downloadResult.data };
        }

        await removeAnnouncementFilesFromStorage(targetFilePath);
      }

      const { error } = await supabase.from(tableName).delete().eq("id", announcementId);
      if (error) {
        if (backup?.blob) {
          const restoreResult = await supabase.storage.from(STORAGE_BUCKET).upload(backup.filePath, backup.blob, {
            upsert: true,
            contentType: backup.blob.type || "application/octet-stream"
          });
          if (restoreResult.error) {
            console.error("[ClassDetail] Failed to restore announcement file after DB delete failure:", restoreResult.error);
          }
        }
        throw new Error(error.message || "Failed to delete announcement.");
      }

      await fetchClassAnnouncements(teacherProfileId, classData);
      setAnnSuccess("Announcement deleted successfully.");
    } catch (error) {
      console.error("[ClassDetail] Announcement delete failed:", error);
      setAnnouncements(previous);
      setAnnError(error instanceof Error ? error.message : "Unable to delete announcement.");
    }
  };

  const confirmDeleteAnnouncement = async () => {
    await deleteAnnouncementRecord(pendingDeleteAnnouncement);
    setShowDeleteAnnouncementModal(false);
    setPendingDeleteAnnouncement(null);
  };

  const filteredStudents = assignedStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.yearLevel || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAvailableStudents = availableStudents
    .filter((student) => !assignedStudents.some((assigned) => String(assigned.id) === String(student.id)))
    .filter((student) => {
      const name = getStudentFullName(student).toLowerCase();
      const lrn = String(student.lrn || "").toLowerCase();
      const yearLevel = String(student.year_level || "").toLowerCase();
      const query = studentPickerQuery.toLowerCase();
      return name.includes(query) || lrn.includes(query) || yearLevel.includes(query);
    });

  const getDaysUntilDue = (dueDate) => {
    const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "Overdue", color: "text-red-600 bg-red-50" };
    if (diff === 0) return { label: "Due today", color: "text-orange-600 bg-orange-50" };
    if (diff === 1) return { label: "Due tomorrow", color: "text-yellow-600 bg-yellow-50" };
    return { label: `${diff} days left`, color: "text-emerald-600 bg-emerald-50" };
  };

  const getPriorityColor = (p) => {
    if (p === "High") return "bg-red-100 text-red-700";
    if (p === "Medium") return "bg-blue-100 text-blue-700";
    return "bg-white/5 text-gray-400";
  };

  const getFileIcon = (type = "PDF") => {
    const t = type.toUpperCase();
    if (t === "PDF") return <FileText className="w-5 h-5 text-red-500" />;
    if (t === "PPTX" || t === "PPT") return <File className="w-5 h-5 text-orange-500" />;
    if (t === "DOCX" || t === "DOC") return <File className="w-5 h-5 text-blue-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  if (loading) {
    return <LoadingScreen message="Loading class details..." />;
  }

  if (!classData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/20">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-300 mb-2">Class not found</h2>
          <button
            onClick={() => navigate("/teacher/classes")}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Back to Classes
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "students", label: "Students", icon: <Users className="w-4 h-4" /> },
    { id: "materials", label: "Materials", icon: <BookOpen className="w-4 h-4" /> },
    { id: "assignments", label: "Assignments & Activities", icon: <FileText className="w-4 h-4" /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top Bar */}
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Class Details</h2>
            <NotificationDropdown
              notifications={notificationList}
              onMarkAsRead={(id) =>
                setNotificationList((prev) =>
                  prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
                )
              }
              onNotificationsChange={setNotificationList}
            />
          </div>
        </div>

        <div className="p-6 space-y-6">
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

          <button
            onClick={() => navigate("/teacher/classes")}
            className="inline-flex items-center gap-2 px-4 py-2 border border-white/20 text-gray-300 rounded-lg hover:bg-white/5 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Classes
          </button>

          <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-6 text-white shadow-lg border border-emerald-300/30">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-emerald-100 font-medium">Assigned Class</p>
                <h3 className="text-3xl font-bold leading-tight">
                  {[String(classData?.name || "").trim(), String(classData?.section || "").trim()].filter(Boolean).join(" - ")
                    || String(classData?.name || classData?.section || "Section").trim()}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/10 border border-white/20 p-3">
                <div className="flex items-center gap-2 text-emerald-100 text-xs font-medium">
                  <Users className="w-3.5 h-3.5" />
                  Students
                </div>
                <p className="text-2xl font-semibold mt-1">{assignedStudents.length}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-3">
                <div className="flex items-center gap-2 text-emerald-100 text-xs font-medium">
                  <BookOpen className="w-3.5 h-3.5" />
                  Materials
                </div>
                <p className="text-2xl font-semibold mt-1">{materials.length}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-3">
                <div className="flex items-center gap-2 text-emerald-100 text-xs font-medium">
                  <FileText className="w-3.5 h-3.5" />
                  Assignments
                </div>
                <p className="text-2xl font-semibold mt-1">{assignments.length}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-3">
                <div className="flex items-center gap-2 text-emerald-100 text-xs font-medium">
                  <Megaphone className="w-3.5 h-3.5" />
                  Announcements
                </div>
                <p className="text-2xl font-semibold mt-1">{announcements.length}</p>
              </div>
            </div>
          </div>

          {/* Tabs + Content */}
          <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm overflow-hidden">
            {/* Tab Nav */}
            <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap border-b-2 ${
                    activeTab === tab.id
                      ? "border-emerald-600 text-emerald-600"
                      : "border-transparent text-gray-500 hover:text-emerald-600 hover:border-emerald-200"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ STUDENTS TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
              {activeTab === "students" && (
                <div>
                  <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Student List</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{assignedStudents.length} students enrolled</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search students..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        onClick={handleOpenStudentModal}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        Add Student
                      </button>
                    </div>
                  </div>
                  {filteredStudents.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl">
                      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users className="w-7 h-7 text-emerald-400" />
                      </div>
                      <h4 className="font-semibold text-gray-300 mb-1">No students enrolled yet</h4>
                      <p className="text-gray-500 text-sm mb-4">Add students to this class so they can access materials and assignments.</p>
                      <button
                        onClick={handleOpenStudentModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Add First Student
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-white/10 rounded-xl">
                      <table className="w-full">
                        <thead className="bg-black/20">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-gray-900/60 divide-y divide-white/10">
                          {filteredStudents.map((student) => (
                            <tr key={student.id} className="hover:bg-black/20 transition-colors">
                              <td className="px-6 py-4 text-sm font-medium text-emerald-600">{student.studentId}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                    {student.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-sm font-medium text-white">{student.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-xs text-gray-400">
                                {student.email && <div className="flex items-center gap-1 mb-0.5"><Mail className="w-3 h-3" />{student.email}</div>}
                                {student.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{student.phone}</div>}
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">{student.status ?? "Active"}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => requestDeleteStudent(student)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
              )}

              {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ MATERIALS TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
              {activeTab === "materials" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Class Materials</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Upload files visible to all enrolled students</p>
                      {matError && <p className="text-sm text-red-500 mt-2">{matError}</p>}
                      {matSuccess && <p className="text-sm text-emerald-500 mt-2">{matSuccess}</p>}
                    </div>
                    <button
                      onClick={openCreateMaterialModal}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Material
                    </button>
                  </div>

                  {materials.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl">
                      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-7 h-7 text-emerald-400" />
                      </div>
                      <h4 className="font-semibold text-gray-300 mb-1">No materials uploaded yet</h4>
                      <p className="text-gray-500 text-sm mb-4">Upload lecture notes, slides, or reference files for your students.</p>
                      <button
                        onClick={openCreateMaterialModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        Upload First Material
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {materials.map((mat) => (
                        <div
                          key={mat.id}
                          className="flex items-center gap-4 p-4 bg-black/20 rounded-xl border border-white/10 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                        >
                          <div className="w-10 h-10 bg-gray-900/60 rounded-lg flex items-center justify-center border border-white/10 flex-shrink-0">
                            {getFileIcon(mat.fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm">{mat.title}</p>
                            {mat.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{mat.description}</p>}
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span>{mat.fileType}</span>
                              <span>|</span>
                              <span>{new Date(mat.uploadDate).toLocaleDateString()}</span>
                              {Array.isArray(mat.attachments) && mat.attachments.length > 0 && (
                                <>
                                  <span>|</span>
                                  <span>{mat.attachments.length} file{mat.attachments.length === 1 ? "" : "s"}</span>
                                </>
                              )}
                            </div>
                            {Array.isArray(mat.attachments) && mat.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {mat.attachments.map((attachment, index) => (
                                  <a
                                    key={`${mat.id}-attachment-${index}`}
                                    href={attachment.fileUrl || attachment.filePath || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xs hover:bg-emerald-500/20"
                                  >
                                    <File className="w-3 h-3" />
                                    {attachment.fileName || `File ${index + 1}`}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditMaterialModal(mat)}
                              className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleDeleteMaterial(mat.id);
                              }}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ASSIGNMENTS & ACTIVITIES TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
              {activeTab === "assignments" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Assignments & Activities</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Post tasks for students to accomplish and submit</p>
                      {asgError && <p className="text-sm text-red-500 mt-2">{asgError}</p>}
                      {asgSuccess && <p className="text-sm text-emerald-500 mt-2">{asgSuccess}</p>}
                    </div>
                    <button
                      onClick={openCreateAssignmentModal}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create Task
                    </button>
                  </div>

                  {assignments.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl">
                      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-7 h-7 text-blue-400" />
                      </div>
                      <h4 className="font-semibold text-gray-300 mb-1">No assignments yet</h4>
                      <p className="text-gray-500 text-sm mb-4">Create assignments or activities for your students to complete.</p>
                      <button
                        onClick={openCreateAssignmentModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Create First Task
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {assignments.map((asg) => {
                        const due = getDaysUntilDue(asg.dueDate);
                        return (
                          <div key={asg.id} className="p-5 bg-gray-900/60 border border-white/10 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${asg.type === "activity" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                    {asg.type === "activity" ? "Activity" : "Assignment"}
                                  </span>
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${due.color}`}>
                                    {due.label}
                                  </span>
                                </div>
                                <h4 className="font-semibold text-white text-sm">{asg.title}</h4>
                                {asg.description && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{asg.description}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Due: {new Date(asg.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                  <span>Max Points: {asg.maxPoints}</span>
                                </div>
                                {Array.isArray(asg.attachments) && asg.attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {asg.attachments.map((attachment, index) => (
                                      <a
                                        key={`${asg.id}-attachment-${index}`}
                                        href={attachment.fileUrl || attachment.filePath || "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100"
                                      >
                                        <File className="w-3 h-3" />
                                        {attachment.fileName || `File ${index + 1}`}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openEditAssignmentModal(asg.id)}
                                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleDeleteAssignment(asg);
                                  }}
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ANNOUNCEMENTS TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
              {activeTab === "announcements" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Class Announcements</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Post updates visible to all students in this class</p>
                      {annError && <p className="text-sm text-red-500 mt-2">{annError}</p>}
                      {annSuccess && <p className="text-sm text-emerald-500 mt-2">{annSuccess}</p>}
                    </div>
                    <button
                      onClick={openCreateAnnouncementModal}
                      className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                    >
                      <Megaphone className="w-4 h-4" />
                      Post Announcement
                    </button>
                  </div>

                  {announcements.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl">
                      <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Megaphone className="w-7 h-7 text-purple-400" />
                      </div>
                      <h4 className="font-semibold text-gray-300 mb-1">No announcements yet</h4>
                      <p className="text-gray-500 text-sm mb-4">Post important updates, reminders, or news for your class.</p>
                      <button
                        onClick={openCreateAnnouncementModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                      >
                        <Megaphone className="w-4 h-4" />
                        Post First Announcement
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {announcements.map((ann) => (
                        <div key={ann.id} className="p-5 bg-gray-900/60 border border-white/10 rounded-xl hover:border-purple-200 hover:shadow-sm transition-all">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPriorityColor(ann.priority)}`}>
                                  {ann.priority} Priority
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(ann.datePosted).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                              </div>
                              <h4 className="font-semibold text-white text-sm">{ann.title}</h4>
                              <p className="text-sm text-gray-400 mt-2 whitespace-pre-line line-clamp-3">{ann.content}</p>
                              {ann.fileUrl && (
                                <a
                                  href={ann.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-300 text-xs font-medium hover:bg-purple-500/20"
                                >
                                  <File className="w-3 h-3" />
                                  {ann.fileName || "Attached file"}
                                </a>
                              )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditAnnouncementModal(ann)}
                                className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteAnnouncement(ann)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ UPLOAD MATERIAL MODAL ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/60 rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Upload className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{isEditingMaterial ? "Edit Class Material" : "Upload Class Material"}</h3>
                  <p className="text-sm text-gray-500">
                    {isEditingMaterial ? "Update details and attachment for this material" : `Visible to all students in ${classData.code}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowMaterialModal(false);
                  resetMaterialForm();
                }}
                className="p-2 hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 1 - Introduction"
                  value={matForm.title}
                  onChange={(e) => setMatForm({ ...matForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  placeholder="Optional short description..."
                  value={matForm.description}
                  onChange={(e) => setMatForm({ ...matForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">File Type</label>
                <select
                  value={matForm.fileType}
                  onChange={(e) => setMatForm({ ...matForm, fileType: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  {["PDF", "DOCX", "PPTX", "XLSX", "TXT", "ZIP", "Other"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Attach File</label>
                {isEditingMaterial && Array.isArray(matOriginalFiles.fileNames) && matOriginalFiles.fileNames.length > 0 && (
                  <div className="mb-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs text-gray-300 mb-1">Current files:</p>
                    <p className="text-xs text-emerald-300">{matOriginalFiles.fileNames.join(", ")}</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const selectedFiles = Array.from(e.target.files || []);
                    setMatFiles(selectedFiles);
                    setMatFileNames(selectedFiles.map((file) => file.name));
                    setMatError("");
                  }}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-emerald-500 cursor-pointer transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {matFileNames.length > 0
                      ? `${matFileNames.length} file${matFileNames.length === 1 ? "" : "s"} selected`
                      : "Click to select file(s)"}
                  </p>
                  {matFileNames.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{matFileNames.join(", ")}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX, ZIP (max 50MB)</p>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  setShowMaterialModal(false);
                  resetMaterialForm();
                }}
                className="flex-1 px-4 py-2.5 border border-white/20 text-gray-300 rounded-lg hover:bg-black/20 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={isEditingMaterial ? handleEditMaterial : handleAddMaterial}
                disabled={isUploadingMaterial}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUploadingMaterial ? (isEditingMaterial ? "Updating..." : "Uploading...") : (isEditingMaterial ? "Update Material" : "Upload Material")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ CREATE ASSIGNMENT MODAL ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/60 rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between sticky top-0 bg-gray-900/60 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isEditingAssignment ? "Edit Assignment / Activity" : "Create Assignment / Activity"}
                  </h3>
                  <p className="text-sm text-gray-500">{isEditingAssignment ? "Update the task details" : `Students in ${classData.code} will see this task`}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAssignmentModal(false);
                  resetAssignmentForm();
                }}
                className="p-2 hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Type</label>
                <div className="flex gap-3">
                  {["assignment", "activity"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setAsgForm({ ...asgForm, type: t })}
                      className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium capitalize transition-all ${asgForm.type === t ? "border-blue-600 bg-blue-50 text-blue-700" : "border-white/10 text-gray-400 hover:border-white/20"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Problem Set 1"
                  value={asgForm.title}
                  onChange={(e) => setAsgForm({ ...asgForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Instructions / Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe what students need to do..."
                  value={asgForm.description}
                  onChange={(e) => setAsgForm({ ...asgForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Due Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={asgForm.dueDate}
                    onChange={(e) => setAsgForm({ ...asgForm, dueDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Max Points</label>
                  <input
                    type="number"
                    value={asgForm.maxPoints}
                    onChange={(e) => setAsgForm({ ...asgForm, maxPoints: e.target.value })}
                    className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                {asgSupportsFiles ? (
                  <>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      {isEditingAssignment ? "Replace Reference File (Optional)" : "Attach Reference File (Optional)"}
                    </label>
                    {isEditingAssignment && Array.isArray(asgOriginalFile?.fileNames) && asgOriginalFile.fileNames.length > 0 && (
                      <div className="mb-3 p-2 bg-blue-50/10 border border-blue-500/20 rounded-lg">
                        <p className="text-xs text-gray-400">Current files:</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {asgOriginalFile.fileNames.map((fileName, index) => (
                            <span key={`${fileName}-${index}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                              <File className="w-3 h-3" />
                              {fileName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <input
                      ref={asgFileRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const selectedFiles = Array.from(e.target.files || []);
                        setAsgFiles(selectedFiles);
                        setAsgFileNames(selectedFiles.map((file) => file.name));
                        setAsgError("");
                      }}
                    />
                    <div
                      onClick={() => asgFileRef.current?.click()}
                      className="border-2 border-dashed border-white/20 rounded-xl p-5 text-center hover:border-blue-500 cursor-pointer transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">
                        {asgFileNames.length > 0
                          ? `${asgFileNames.length} file${asgFileNames.length === 1 ? "" : "s"} selected`
                          : "Click to attach files"}
                      </p>
                      {asgFileNames.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{asgFileNames.join(", ")}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                    <p className="text-xs text-amber-200">File attachments are not supported with the current database schema.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-white/10 px-6 py-4 flex gap-3 sticky bottom-0 bg-gray-900/60">
              <button
                onClick={() => {
                  setShowAssignmentModal(false);
                  resetAssignmentForm();
                }}
                className="flex-1 px-4 py-2.5 border border-white/20 text-gray-300 rounded-lg hover:bg-black/20 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={isEditingAssignment ? handleEditAssignment : handleAddAssignment}
                disabled={isPostingAssignment}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPostingAssignment ? (isEditingAssignment ? "Updating..." : "Saving...") : (isEditingAssignment ? "Update Task" : "Post Task")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ POST ANNOUNCEMENT MODAL ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/60 rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Megaphone className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{isEditingAnnouncement ? "Edit Announcement" : "Post Announcement"}</h3>
                  <p className="text-sm text-gray-500">{isEditingAnnouncement ? "Update this class announcement" : `All students in ${classData.code} will be notified`}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAnnouncementModal(false);
                  resetAnnouncementForm();
                }}
                className="p-2 hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Subject / Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Reminder: Quiz next Monday"
                  value={annForm.title}
                  onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Message</label>
                <textarea
                  rows={5}
                  placeholder="Write your announcement here..."
                  value={annForm.content}
                  onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Attachment (Optional)</label>
                {isEditingAnnouncement && annOriginalFile.fileName && (
                  <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <p className="text-xs text-gray-300 mb-1">Current file:</p>
                    <p className="text-xs text-purple-300">{annOriginalFile.fileName}</p>
                  </div>
                )}
                <input
                  ref={annFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    setAnnFile(selected);
                    setAnnFileName(selected ? selected.name : "");
                    setAnnError("");
                  }}
                />
                <div
                  onClick={() => annFileRef.current?.click()}
                  className="border-2 border-dashed border-white/20 rounded-xl p-4 text-center hover:border-purple-500 cursor-pointer transition-colors"
                >
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-sm text-gray-500">{annFileName || "Click to attach a file"}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Priority</label>
                <div className="flex gap-2">
                  {["Low", "Medium", "High"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setAnnForm({ ...annForm, priority: p })}
                      className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        annForm.priority === p
                          ? p === "High" ? "border-red-500 bg-red-50 text-red-700"
                            : p === "Medium" ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-400 bg-white/5 text-gray-300"
                          : "border-white/10 text-gray-400 hover:border-white/20"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  setShowAnnouncementModal(false);
                  resetAnnouncementForm();
                }}
                className="flex-1 px-4 py-2.5 border border-white/20 text-gray-300 rounded-lg hover:bg-black/20 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnnouncement}
                disabled={isPostingAnnouncement}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPostingAnnouncement
                  ? (isEditingAnnouncement ? "Updating..." : "Posting...")
                  : (isEditingAnnouncement ? "Update Announcement" : "Post Announcement")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ADD STUDENT MODAL ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/60 rounded-2xl max-w-3xl w-full shadow-2xl">
            <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Add Student</h3>
                  <p className="text-sm text-gray-500">Enroll a student in {classData.code} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â {classData.section}</p>
                </div>
              </div>
              <button onClick={() => setShowStudentModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {stuError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{stuError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Search Students</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by Name, ID, or Year Level"
                    value={studentPickerQuery}
                    onChange={(e) => setStudentPickerQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-black/20 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredAvailableStudents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No available students found.</td>
                      </tr>
                    ) : (
                      filteredAvailableStudents.map((student) => (
                        <tr
                          key={student.id}
                          className={`cursor-pointer transition-colors ${selectedStudentIds.includes(student.id) ? "bg-emerald-500/10" : "hover:bg-white/5"}`}
                          onClick={() => toggleStudentSelection(student.id)}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="accent-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-white">{getStudentFullName(student)}</td>
                          <td className="px-4 py-3 text-sm text-emerald-400">{student.lrn || "N/A"}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">{student.year_level || "N/A"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-white/10 px-6 py-4 flex gap-3">
              <button onClick={() => setShowStudentModal(false)} className="flex-1 px-4 py-2.5 border border-white/20 text-gray-300 rounded-lg hover:bg-black/20 text-sm font-medium">Cancel</button>
              <button onClick={handleAddStudent} disabled={isStudentSubmitting || selectedStudentIds.length === 0} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">{isStudentSubmitting ? "Adding..." : `Add Selected (${selectedStudentIds.length})`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassDetail;
