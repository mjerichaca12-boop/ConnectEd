import { useEffect, useState } from "react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { supabase, supabaseAdmin } from "../../lib/supabaseClient";
import { useActivity } from "../../lib/ActivityContext";
import { parseStoredFileList, sanitizeFileName } from "../../lib/teacherHelpers";
import {
  AlertTriangle,
  Edit,
  Loader2,
  Megaphone,
  Plus,
  File,
  Paperclip,
  School,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

const emptyForm = {
  title: "",
  content: "",
  targetAudience: "",
  category: "General",
  priority: ""
};

const emptyTouchedFields = {
  title: false,
  content: false,
  targetAudience: false,
  category: false,
  priority: false
};

const announcementTableCandidates = ["announcements", "school_announcements"];
const ANNOUNCEMENT_ATTACHMENT_BUCKET = "message-attachments";
const MAX_ANNOUNCEMENT_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const ANNOUNCEMENT_FILE_ACCEPT = "image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt";
let announcementAttachmentsTableStatus = "unknown";

const ALLOWED_AUDIENCES = ["School-wide", "Students", "Teacher"];
const ALLOWED_PRIORITIES = ["Low", "Medium", "High"];
const ALLOWED_CATEGORIES = ["General", "Lesson Plan", "Task", "School Info"];

const audienceOptions = [
  { value: "School-wide", label: "School-wide" },
  { value: "Students", label: "Students" },
  { value: "Teacher", label: "Teacher" }
];

const priorityOptions = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" }
];

const categoryOptions = [
  { value: "General", label: "General" },
  { value: "Lesson Plan", label: "Lesson Plan" },
  { value: "Task", label: "Task" },
  { value: "School Info", label: "School Info" }
];

const normalizeAudience = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "student" || normalized === "students") return "Students";
  if (normalized === "teacher" || normalized === "teachers") return "Teacher";
  if (normalized === "schoolwide" || normalized === "school wide") return "School-wide";
  if (ALLOWED_AUDIENCES.includes(value)) return value;
  return "School-wide";
};

const normalizePriority = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "low") return "Low";
  if (normalized === "medium") return "Medium";
  if (normalized === "high") return "High";
  if (ALLOWED_PRIORITIES.includes(value)) return value;
  return "Medium";
};

const toDatabaseAudience = (value) => normalizeAudience(value);

const toDatabaseAudienceType = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "student" || normalized === "students") return "student";
  if (normalized === "teacher" || normalized === "teachers") return "teacher";
  return "school";
};

const audienceLabelFromType = (audienceType) => {
  if (audienceType === "student") return "Students";
  if (audienceType === "teacher") return "Teacher";
  return "School-wide";
};

const toDatabasePriority = (value) => normalizePriority(value);

const isAllowedAudience = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  return ALLOWED_AUDIENCES.includes(value) || normalized === "student" || normalized === "students" || normalized === "teacher" || normalized === "teachers" || normalized === "schoolwide" || normalized === "school wide";
};

const isAllowedPriority = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ALLOWED_PRIORITIES.includes(value) || normalized === "low" || normalized === "medium" || normalized === "high";
};

const formatAudienceLabel = (audience) => {
  return normalizeAudience(audience || "School-wide");
};

const formatPriorityLabel = (priority) => {
  return normalizePriority(priority || "Medium");
};

const normalizeTimestamp = (row) => row?.created_at || row?.date_posted || row?.datePosted || row?.timestamp || row?.updated_at || new Date().toISOString();

const extractMissingColumnFromSupabaseError = (error) => {
  const message = String(error?.message || "");
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match ? String(match[1] || "").trim() : "";
};

const getPriorityRank = (priority) => {
  const normalized = String(priority ?? "").trim().toLowerCase();
  if (normalized === "high") return 0;
  if (normalized === "medium") return 1;
  if (normalized === "low") return 2;
  return 1;
};

const getAnnouncementAttachmentKind = (fileType, fileName, fileUrl) => {
  const normalizedType = String(fileType || "").trim().toLowerCase();
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const normalizedUrl = String(fileUrl || "").trim().toLowerCase();

  if (normalizedType.startsWith("image/")) return "image";
  if (normalizedType.startsWith("video/")) return "video";

  const source = normalizedName || normalizedUrl;
  const extensionMatch = source.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "";

  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(extension)) return "image";
  if (["mp4", "webm", "ogg", "mov", "m4v"].includes(extension)) return "video";
  if (normalizedUrl) return "document";

  return "";
};

const buildAnnouncementAttachments = (row, attachmentRows = []) => {
  if (Array.isArray(attachmentRows) && attachmentRows.length > 0) {
    const attachments = attachmentRows
      .map((attachment, index) => {
        const fileName = String(attachment?.file_name || `File ${index + 1}`).trim();
        const fileUrl = String(attachment?.file_url || "").trim();
        const filePath = String(attachment?.file_path || "").trim();
        const fileType = String(attachment?.file_type || "").trim();

        return {
          fileName,
          fileUrl,
          filePath,
          fileType,
          kind: getAnnouncementAttachmentKind(fileType, fileName, fileUrl)
        };
      })
      .filter((attachment) => attachment.fileName || attachment.fileUrl || attachment.filePath);

    return {
      fileNames: attachments.map((attachment) => attachment.fileName),
      fileUrls: attachments.map((attachment) => attachment.fileUrl),
      filePaths: attachments.map((attachment) => attachment.filePath),
      fileTypes: attachments.map((attachment) => attachment.fileType),
      attachments
    };
  }

  const fileNames = parseStoredFileList(row?.file_name);
  const fileUrls = parseStoredFileList(row?.file_url);
  const filePaths = parseStoredFileList(row?.file_path);
  const fileTypes = parseStoredFileList(row?.file_type);
  const totalCount = Math.max(fileNames.length, fileUrls.length, filePaths.length, fileTypes.length);

  const attachments = Array.from({ length: totalCount }, (_, index) => {
    const fileName = fileNames[index] || `File ${index + 1}`;
    const fileUrl = fileUrls[index] || "";
    const filePath = filePaths[index] || "";
    const fileType = fileTypes[index] || "";

    return {
      fileName,
      fileUrl,
      filePath,
      fileType,
      kind: getAnnouncementAttachmentKind(fileType, fileName, fileUrl)
    };
  }).filter((attachment) => attachment.fileName || attachment.fileUrl || attachment.filePath);

  return { fileNames, fileUrls, filePaths, fileTypes, attachments };
};

const normalizeAnnouncement = (row, attachmentRows = []) => {
  const attachments = buildAnnouncementAttachments(row, attachmentRows);
  const audienceType = toDatabaseAudienceType(
    row?.audience_type ??
    row?.target_audience ??
    row?.targetAudience ??
    row?.audience ??
    row?.target_audience_type ??
    row?.recipient_audience ??
    "school"
  );

  return {
    id: String(row?.id ?? ""),
    title: String(row?.title ?? "").trim(),
    content: String(row?.content ?? "").trim(),
    targetAudience: row?.audience_type != null
      ? audienceLabelFromType(audienceType)
      : normalizeAudience(
          row?.target_audience ??
          row?.targetAudience ??
          row?.audience ??
          row?.target_audience_type ??
          row?.recipient_audience ??
          row?.audience_type ??
          "School-wide"
        ),
    audienceType,
    category: row?.category || "General",
    priority: normalizePriority(
      row?.priority ??
      row?.announcement_priority ??
      row?.importance ??
      row?.priority_level ??
      "Medium"
    ),
    createdAt: normalizeTimestamp(row),
    author: row?.author || row?.created_by_name || row?.created_by || "Admin Office",
    ...attachments,
    fileName: attachments.fileNames[0] || "",
    fileUrl: attachments.fileUrls[0] || "",
    filePath: attachments.filePaths[0] || "",
    fileType: attachments.fileTypes[0] || ""
  };
};

const sortAnnouncements = (items) =>
  [...items].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || left?.created_at || 0).getTime();
    const rightTime = new Date(right?.createdAt || right?.created_at || 0).getTime();
    if (rightTime !== leftTime) return rightTime - leftTime; // Newest first

    const priorityDiff = getPriorityRank(left?.priority) - getPriorityRank(right?.priority);
    if (priorityDiff !== 0) return priorityDiff;

    return String(right?.id ?? "").localeCompare(String(left?.id ?? ""));
  });

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const resolveColumnName = (columns, candidates) => candidates.find((columnName) => columns.includes(columnName)) || "";

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const getAudienceStyles = (audience) => {
  const normalizedAudience = String(audience ?? "").toLowerCase();

  if (normalizedAudience.includes("school")) {
    return "bg-green-50 text-green-700 border-green-200";
  }

  if (normalizedAudience.includes("teacher")) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-blue-50 text-blue-700 border-blue-200";
};

const getPriorityStyles = (priority) => {
  const normalizedPriority = String(priority ?? "").toLowerCase();

  if (normalizedPriority === "high") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (normalizedPriority === "low") {
    return "bg-green-50 text-green-700 border-green-200";
  }

  return "bg-amber-50 text-amber-700 border-amber-200";
};

const getCategoryStyles = (category) => {
  const normalized = String(category ?? "").toLowerCase();
  if (normalized === "lesson plan") return "bg-purple-50 text-purple-700 border-purple-200";
  if (normalized === "task") return "bg-blue-50 text-blue-700 border-blue-200";
  if (normalized === "school info") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

const getAnnouncementValidationErrors = (data) => {
  const errors = {};
  const title = String(data?.title || "").trim();
  const content = String(data?.content || "").trim();
  const targetAudience = String(data?.targetAudience || "").trim();
  const category = String(data?.category || "").trim();
  const priority = String(data?.priority || "").trim();

  if (!title) {
    errors.title = "Title is required";
  } else if (title.length < 5) {
    errors.title = "Title must be at least 5 characters";
  } else if (title.length > 100) {
    errors.title = "Title must be at most 100 characters";
  }

  if (!content) {
    errors.content = "Content is required";
  } else if (content.length < 10) {
    errors.content = "Content must be at least 10 characters";
  }

  if (!targetAudience) {
    errors.targetAudience = "Target audience is required";
  } else if (!isAllowedAudience(targetAudience)) {
    errors.targetAudience = "Target audience must be school wide, student, or teacher";
  }

  if (!category) {
    errors.category = "Category is required";
  } else if (!ALLOWED_CATEGORIES.includes(category)) {
    errors.category = "Invalid category";
  }

  if (!priority) {
    errors.priority = "Priority is required";
  } else if (!isAllowedPriority(priority)) {
    errors.priority = "Priority must be low, medium, or high";
  }

  return errors;
};

const getVisibleErrors = (allErrors, touchedMap, submitAttempted) => {
  if (submitAttempted) {
    return allErrors;
  }

  return Object.fromEntries(
    Object.entries(allErrors).filter(([field]) => touchedMap[field])
  );
};

function AdminAnnouncements() {
  const navigate = useNavigate();
  const { logActivity } = useActivity();
  const announcementFileInputRef = useRef(null);

  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, announcementId: "", announcementTitle: "" });
  const [announcements, setAnnouncements] = useState([]);
  const [announcementTable, setAnnouncementTable] = useState("");
  const [announcementColumns, setAnnouncementColumns] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editFormData, setEditFormData] = useState(emptyForm);
  const [announcementFiles, setAnnouncementFiles] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});
  const [formTouched, setFormTouched] = useState(emptyTouchedFields);
  const [editFormTouched, setEditFormTouched] = useState(emptyTouchedFields);
  const [hasTriedCreateSubmit, setHasTriedCreateSubmit] = useState(false);
  const [hasTriedEditSubmit, setHasTriedEditSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetAnnouncementFileInput = () => {
    setAnnouncementFiles([]);
    if (announcementFileInputRef.current) {
      announcementFileInputRef.current.value = "";
    }
  };

  const isSupportedAnnouncementAttachment = (file) => {
    const mimeType = String(file?.type || "").toLowerCase();
    if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) {
      return true;
    }

    const fileName = String(file?.name || "").toLowerCase();
    const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
    return ["pdf", "doc", "docx", "ppt", "pptx", "txt"].includes(extension);
  };

  const buildAnnouncementAttachmentStoragePath = (announcementId, fileName) => {
    const uniqueId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `announcements/${String(announcementId || "").trim()}/${uniqueId}_${sanitizeFileName(fileName)}`;
  };

  const uploadAnnouncementAttachments = async (files, announcementId) => {
    if (!announcementId) {
      throw new Error("Announcement ID is required before uploading attachments.");
    }

    if (!files.length) return [];

    const uploaded = [];
    const user = getCurrentUser();
    const isAdmin = user?.role === "admin";
    const client = isAdmin && supabaseAdmin ? supabaseAdmin : supabase;

    try {
      for (const file of files) {
        if (file.size > MAX_ANNOUNCEMENT_ATTACHMENT_SIZE_BYTES) {
          throw new Error(`File ${file.name} is too large. Maximum allowed size is 20MB.`);
        }

        if (!isSupportedAnnouncementAttachment(file)) {
          throw new Error(`Unsupported file type: ${file.name}`);
        }

        const storagePath = buildAnnouncementAttachmentStoragePath(announcementId, file.name);
        const uploadResult = await client.storage.from(ANNOUNCEMENT_ATTACHMENT_BUCKET).upload(storagePath, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream"
        });

        if (uploadResult.error) {
          console.error("Announcement attachment upload failed:", uploadResult.error);
          throw uploadResult.error;
        }

        const { data } = client.storage.from(ANNOUNCEMENT_ATTACHMENT_BUCKET).getPublicUrl(storagePath);
        const fileUrl = String(data?.publicUrl || "").trim();

        if (!fileUrl) {
          throw new Error(`Unable to generate public URL for ${file.name}.`);
        }

        uploaded.push({
          fileName: file.name,
          filePath: storagePath,
          fileUrl,
          fileType: file.type || "application/octet-stream"
        });
      }

      return uploaded;
    } catch (error) {
      console.error("Announcement attachment processing failed:", error);
      if (uploaded.length > 0) {
        await client.storage.from(ANNOUNCEMENT_ATTACHMENT_BUCKET).remove(uploaded.map((item) => item.filePath)).catch(() => {
          // Ignore rollback cleanup failures.
        });
      }
      throw error;
    }
  };

  const applyCreateValidationState = (nextForm, nextTouched, nextSubmitAttempted) => {
    const allErrors = getAnnouncementValidationErrors(nextForm);
    setFormErrors(getVisibleErrors(allErrors, nextTouched, nextSubmitAttempted));
    return allErrors;
  };

  const applyEditValidationState = (nextForm, nextTouched, nextSubmitAttempted) => {
    const allErrors = getAnnouncementValidationErrors(nextForm);
    setEditFormErrors(getVisibleErrors(allErrors, nextTouched, nextSubmitAttempted));
    return allErrors;
  };

  const validateForm = (data, setErrors) => {
    const errors = getAnnouncementValidationErrors(data);
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateFieldChange = (field, value) => {
    const nextForm = {
      ...formData,
      [field]: value
    };
    
    // If audience changes to something other than Teacher, and category was a teacher-only category, reset it
    if (field === "targetAudience" && value !== "Teacher") {
      const teacherOnlyCategories = ["Lesson Plan", "Task", "School Info"];
      if (teacherOnlyCategories.includes(nextForm.category)) {
        nextForm.category = "General";
      }
    }
    
    setFormData(nextForm);
    applyCreateValidationState(nextForm, formTouched, hasTriedCreateSubmit);
  };

  const handleEditFieldChange = (field, value) => {
    const nextForm = {
      ...editFormData,
      [field]: value
    };
    
    // If audience changes to something other than Teacher, and category was a teacher-only category, reset it
    if (field === "targetAudience" && value !== "Teacher") {
      const teacherOnlyCategories = ["Lesson Plan", "Task", "School Info"];
      if (teacherOnlyCategories.includes(nextForm.category)) {
        nextForm.category = "General";
      }
    }
    
    setEditFormData(nextForm);
    applyEditValidationState(nextForm, editFormTouched, hasTriedEditSubmit);
  };

  const getFilteredCategoryOptions = (audience) => {
    if (audience === "Teacher") {
      return categoryOptions;
    }
    return categoryOptions.filter(opt => opt.value === "General");
  };

  const handleCreateFieldBlur = (field) => {
    const nextTouched = {
      ...formTouched,
      [field]: true
    };
    setFormTouched(nextTouched);
    applyCreateValidationState(formData, nextTouched, hasTriedCreateSubmit);
  };

  const handleEditFieldBlur = (field) => {
    const nextTouched = {
      ...editFormTouched,
      [field]: true
    };
    setEditFormTouched(nextTouched);
    applyEditValidationState(editFormData, nextTouched, hasTriedEditSubmit);
  };

  const handleOpenCreateModal = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setFormTouched(emptyTouchedFields);
    setHasTriedCreateSubmit(false);
    resetAnnouncementFileInput();
    setShowCreateModal(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const getAnnouncementTableName = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const tableName = "school_announcements";
    setAnnouncementTable(tableName);
    return tableName;
  };

  const loadAnnouncements = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const { data, error } = await supabase
      .from("school_announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    const attachmentRowsByAnnouncementId = await fetchAttachmentRowsByAnnouncementId("school_announcements", rows);

    return sortAnnouncements(rows.map((row) => {
      const rowId = String(row?.id ?? "");
      return normalizeAnnouncement(row, attachmentRowsByAnnouncementId.get(rowId) || []);
    }).filter((item) => item.id));
  };

  const getAnnouncementAttachmentTableName = (tableName) => (
    "announcement_attachments"
  );

  const getAnnouncementAttachmentForeignKey = (tableName) => (
    tableName === "school_announcements" ? "school_announcement_id" : "announcement_id"
  );

  const getAnnouncementColumns = async () => {
    if (announcementColumns.length > 0) {
      return announcementColumns;
    }

    const tableName = await getAnnouncementTableName();
    
    // Attempt dynamic detection
    try {
      const { data, error } = await supabase.from(tableName).select("*").limit(1);
      if (!error && data) {
        if (data.length > 0) {
          const detected = Object.keys(data[0]);
          setAnnouncementColumns(detected);
          return detected;
        }
      }
    } catch (err) {
      console.warn("Failed to detect columns dynamically:", err);
    }

    const fallbackColumns = [
      "id",
      "title",
      "content",
      "priority",
      "created_at",
      "updated_at",
      "author",
      "created_by",
      "created_by_name",
      "school_id",
      "target_audience",
      "audience_type",
      "announcement_priority",
      "importance",
      "priority_level",
      "date_posted",
      "datePosted",
      "timestamp"
    ];

    setAnnouncementColumns(fallbackColumns);
    return fallbackColumns;
  };

  const fetchAttachmentRowsByAnnouncementId = async (tableName, rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Map();
    }

    const attachmentTableName = getAnnouncementAttachmentTableName(tableName);
    const attachmentForeignKey = getAnnouncementAttachmentForeignKey(tableName);

    if (announcementAttachmentsTableStatus === "missing") {
      return new Map();
    }

    if (announcementAttachmentsTableStatus === "unknown") {
      const { error: checkError } = await supabase
        .from(attachmentTableName)
        .select("id", { head: true, count: "exact" })
        .limit(1);

      if (checkError) {
        announcementAttachmentsTableStatus = "missing";
        return new Map();
      }

      announcementAttachmentsTableStatus = "available";
    }

    const ids = rows
      .map((row) => String(row?.id || "").trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from(attachmentTableName)
      .select(`${attachmentForeignKey}, file_url, file_name, file_path, file_type, created_at`)
      .in(attachmentForeignKey, ids)
      .order("created_at", { ascending: true });

    if (error) {
      return new Map();
    }

    const grouped = new Map();

    for (const attachment of data ?? []) {
      const announcementId = String(attachment?.[attachmentForeignKey] ?? "");
      if (!announcementId) continue;

      const existing = grouped.get(announcementId) || [];
      existing.push(attachment);
      grouped.set(announcementId, existing);
    }

    return grouped;
  };

  const insertAnnouncementAttachmentRows = async (tableName, announcementId, attachments) => {
    if (!announcementId || !Array.isArray(attachments) || attachments.length === 0) {
      return true;
    }

    const attachmentTableName = getAnnouncementAttachmentTableName(tableName);
    const attachmentForeignKey = getAnnouncementAttachmentForeignKey(tableName);

    const resolveLinkedAnnouncementIdForSchoolAnnouncement = async (schoolAnnouncementId) => {
      const normalizedSchoolAnnouncementId = String(schoolAnnouncementId || "").trim();
      if (!normalizedSchoolAnnouncementId) {
        throw new Error("School announcement ID is required to save attachments.");
      }

      const existingLink = await supabase
        .from("announcement_attachments")
        .select("announcement_id")
        .eq("school_announcement_id", normalizedSchoolAnnouncementId)
        .not("announcement_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (existingLink.error) {
        console.error("Failed to resolve existing attachment link:", existingLink.error);
        throw new Error(existingLink.error.message || "Unable to resolve announcement attachment link.");
      }

      const linkedAnnouncementId = String(existingLink.data?.announcement_id || "").trim();
      if (linkedAnnouncementId) {
        return linkedAnnouncementId;
      }

      const schoolAnnouncementResult = await supabase
        .from("school_announcements")
        .select("*")
        .eq("id", normalizedSchoolAnnouncementId)
        .maybeSingle();

      if (schoolAnnouncementResult.error) {
        console.error("Failed to load school announcement for attachment linking:", schoolAnnouncementResult.error);
        throw new Error(schoolAnnouncementResult.error.message || "Unable to load school announcement for attachment linking.");
      }

      const source = schoolAnnouncementResult.data || {};
      const basePayloads = [
        {
          title: String(source.title || "Announcement").trim() || "Announcement",
          content: String(source.content || "Attachment").trim() || "Attachment",
          target_audience: normalizeAudience(source.target_audience || "School-wide"),
          audience_type: toDatabaseAudienceType(source.target_audience || "School-wide"),
          priority: normalizePriority(source.priority || "Medium"),
          author: String(source.author || source.created_by_name || "Admin Office").trim() || "Admin Office",
          created_by: isUuid(source.created_by) ? source.created_by : null,
          created_by_name: source.created_by_name || null,
          school_id: isUuid(source.school_id) ? source.school_id : null,
          created_at: source.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          title: String(source.title || "Announcement").trim() || "Announcement",
          content: String(source.content || "Attachment").trim() || "Attachment",
          target_audience: normalizeAudience(source.target_audience || "School-wide"),
          audience_type: toDatabaseAudienceType(source.target_audience || "School-wide"),
          priority: normalizePriority(source.priority || "Medium")
        },
        {
          title: String(source.title || "Announcement").trim() || "Announcement",
          content: String(source.content || "Attachment").trim() || "Attachment"
        }
      ];

      let lastError = null;
      for (const initialPayload of basePayloads) {
        const { data, error } = await supabase
          .from("announcements")
          .insert(initialPayload)
          .select("id")
          .maybeSingle();

        if (!error) {
          const createdLinkedAnnouncementId = String(data?.id || "").trim();
          if (!createdLinkedAnnouncementId) {
            throw new Error("Unable to create linked announcement for attachments.");
          }

          return createdLinkedAnnouncementId;
        }

        lastError = error;
      }

      console.error("Failed to create linked announcement record:", lastError);
      throw new Error(lastError?.message || "Unable to create linked announcement for attachments.");
    };

    let linkedAnnouncementId = "";
    if (tableName === "school_announcements") {
      linkedAnnouncementId = await resolveLinkedAnnouncementIdForSchoolAnnouncement(announcementId);
    }

    const payload = attachments.map((attachment, index) => {
      const fileName = String(attachment?.fileName || "").trim();
      const fileUrl = String(attachment?.fileUrl || "").trim();
      const filePath = String(attachment?.filePath || "").trim();
      const fileType = String(attachment?.fileType || "application/octet-stream").trim() || "application/octet-stream";

      if (!fileName || !fileUrl || !filePath) {
        throw new Error(`Attachment metadata is incomplete for file #${index + 1}.`);
      }

      return {
      ...(tableName === "school_announcements"
        ? { announcement_id: linkedAnnouncementId }
        : {}),
      [attachmentForeignKey]: announcementId,
      file_url: fileUrl,
      file_name: fileName,
      file_path: filePath,
      file_type: fileType
      };
    });

    if (payload.length === 0) {
      return true;
    }

    const user = getCurrentUser();
    const isAdmin = user?.role === "admin";
    const client = isAdmin && supabaseAdmin ? supabaseAdmin : supabase;
    const { error } = await client.from(attachmentTableName).insert(payload);

    if (error) {
      console.error("Announcement attachment database insert failed:", error);
      throw new Error(error.message || "Unable to save announcement attachments.");
    }

    announcementAttachmentsTableStatus = "available";
    return true;
  };

  const syncAnnouncementInlineAttachmentColumns = async (tableName, announcementId) => {
    const normalizedAnnouncementId = String(announcementId || "").trim();
    if (!normalizedAnnouncementId) {
      return;
    }

    const user = getCurrentUser();
    const isAdmin = user?.role === "admin";
    const client = isAdmin && supabaseAdmin ? supabaseAdmin : supabase;
    const attachmentForeignKey = getAnnouncementAttachmentForeignKey(tableName);
    const { data, error } = await client
      .from("announcement_attachments")
      .select("announcement_id, file_name, file_url, file_path, file_type, created_at")
      .eq(attachmentForeignKey, normalizedAnnouncementId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load attachments for inline sync:", error);
      return;
    }

    const attachmentRows = data || [];
    const fileNames = attachmentRows.map((row) => String(row?.file_name || "").trim()).filter(Boolean);
    const fileUrls = attachmentRows.map((row) => String(row?.file_url || "").trim()).filter(Boolean);
    const filePaths = attachmentRows.map((row) => String(row?.file_path || "").trim()).filter(Boolean);
    const fileTypes = attachmentRows.map((row) => String(row?.file_type || "").trim()).filter(Boolean);

    const updatePayload = {
      file_name: JSON.stringify(fileNames),
      file_url: JSON.stringify(fileUrls),
      file_path: JSON.stringify(filePaths),
      file_type: JSON.stringify(fileTypes)
    };

    const runInlineSync = async (targetTable, targetId) => {
      const normalizedTargetId = String(targetId || "").trim();
      if (!normalizedTargetId) {
        return;
      }

      const payload = { ...updatePayload };

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const payloadKeys = Object.keys(payload);
        if (payloadKeys.length === 0) {
          return;
        }

        const { error: updateError } = await supabase
          .from(targetTable)
          .update(payload)
          .eq("id", normalizedTargetId);

        if (!updateError) {
          return;
        }

        const missingColumn = extractMissingColumnFromSupabaseError(updateError);
        if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
          delete payload[missingColumn];
          continue;
        }

        console.error("Failed to sync inline announcement attachment columns:", updateError);
        return;
      }
    };

    await runInlineSync(tableName, normalizedAnnouncementId);

    if (tableName === "school_announcements") {
      const linkedAnnouncementIds = [...new Set(
        attachmentRows
          .map((row) => String(row?.announcement_id || "").trim())
          .filter(Boolean)
      )];

      for (const linkedAnnouncementId of linkedAnnouncementIds) {
        await runInlineSync("announcements", linkedAnnouncementId);
      }
    }
  };

  const addAttachmentColumnsToPayload = (payload, attachments, columns) => {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return payload;
    }

    const fileNames = attachments.map((item) => String(item.fileName || "").trim()).filter(Boolean);
    const fileUrls = attachments.map((item) => String(item.fileUrl || "").trim()).filter(Boolean);
    const filePaths = attachments.map((item) => String(item.filePath || "").trim()).filter(Boolean);
    const fileTypes = attachments.map((item) => String(item.fileType || "").trim()).filter(Boolean);

    if (columns.includes("file_name") && fileNames.length > 0) payload.file_name = JSON.stringify(fileNames);
    if (columns.includes("file_url") && fileUrls.length > 0) payload.file_url = JSON.stringify(fileUrls);
    if (columns.includes("file_path") && filePaths.length > 0) payload.file_path = JSON.stringify(filePaths);
    if (columns.includes("file_type") && fileTypes.length > 0) payload.file_type = JSON.stringify(fileTypes);

    return payload;
  };

  const buildCreatePayloads = (data, timestamp, columns, attachments = [], announcementId = "") => {
    const user = getCurrentUser();
    const targetAudience = toDatabaseAudience(data.targetAudience);
    const audienceType = toDatabaseAudienceType(data.targetAudience);
    const priority = toDatabasePriority(data.priority);
    const category = data.category || "General";

    const audienceCandidates = ["target_audience", "audience", "targetAudience", "target_audience_type", "recipient_audience"];
    const audienceTypeCandidates = ["audience_type", "audienceType", "target_audience_type"];
    const priorityCandidates = ["priority", "announcement_priority", "importance", "priority_level"];
    const audienceColumn = resolveColumnName(columns, audienceCandidates);
    const audienceTypeColumn = resolveColumnName(columns, audienceTypeCandidates);
    const priorityColumn = resolveColumnName(columns, priorityCandidates);
    const timestampColumn = resolveColumnName(columns, ["created_at", "date_posted", "datePosted", "timestamp"]);

    const metadata = {};

    if (timestampColumn) metadata[timestampColumn] = timestamp;

    if (columns.includes("author") && user?.name) metadata.author = user.name;
    if (columns.includes("created_by_name") && user?.name) metadata.created_by_name = user.name;
    if (columns.includes("created_by") && isUuid(user?.id)) metadata.created_by = user.id;
    if (columns.includes("createdBy") && isUuid(user?.id)) metadata.createdBy = user.id;
    if (columns.includes("author_id") && isUuid(user?.id)) metadata.author_id = user.id;
    if (columns.includes("school_id") && isUuid(user?.school_id || user?.schoolId)) metadata.school_id = user.school_id || user.schoolId;
    if (columns.includes("schoolId") && isUuid(user?.school_id || user?.schoolId)) metadata.schoolId = user.school_id || user.schoolId;

    const basePayload = {
      title: data.title.trim(),
      content: data.content.trim(),
      ...metadata
    };

    if (columns.includes("category")) {
      basePayload.category = category;
    }

    if (audienceColumn) basePayload[audienceColumn] = targetAudience;
    basePayload[priorityColumn || "priority"] = priority;

    if (announcementId && columns.includes("id")) {
      basePayload.id = announcementId;
    }

    addAttachmentColumnsToPayload(basePayload, attachments, columns);

    const strictPayload = {
      ...basePayload,
      ...(audienceTypeColumn ? { [audienceTypeColumn]: audienceType } : {})
    };

    return [strictPayload, basePayload];
  };

  const buildUpdatePayloads = (data, timestamp, columns, attachments = null) => {
    const targetAudience = toDatabaseAudience(data.targetAudience);
    const audienceType = toDatabaseAudienceType(data.targetAudience);
    const priority = toDatabasePriority(data.priority);
    const category = data.category || "General";
    const audienceCandidates = ["target_audience", "audience", "targetAudience", "target_audience_type", "recipient_audience"];
    const audienceTypeCandidates = ["audience_type", "audienceType", "target_audience_type"];
    const priorityCandidates = ["priority", "announcement_priority", "importance", "priority_level"];
    const audienceColumn = resolveColumnName(columns, audienceCandidates);
    const audienceTypeColumn = resolveColumnName(columns, audienceTypeCandidates);
    const priorityColumn = resolveColumnName(columns, priorityCandidates);
    const timestampColumn = resolveColumnName(columns, ["updated_at"]);

    const metadata = {};
    if (timestampColumn) metadata[timestampColumn] = timestamp;

    const basePayload = {
      title: data.title.trim(),
      content: data.content.trim(),
      ...metadata
    };

    if (columns.includes("category")) {
      basePayload.category = category;
    }

    if (audienceColumn) basePayload[audienceColumn] = targetAudience;
    basePayload[priorityColumn || "priority"] = priority;

    if (attachments) {
      addAttachmentColumnsToPayload(basePayload, attachments, columns);
    }

    const strictPayload = {
      ...basePayload,
      ...(audienceTypeColumn ? { [audienceTypeColumn]: audienceType } : {})
    };

    return [strictPayload, basePayload];
  };
  const writeAnnouncement = async (tableName, mode, payloads, id) => {
    let lastError = null;
    const attemptErrors = [];
    const user = getCurrentUser();
    const isAdmin = user?.role === "admin";
    const client = isAdmin && supabaseAdmin ? supabaseAdmin : supabase;

    for (let attemptIndex = 0; attemptIndex < payloads.length; attemptIndex += 1) {
      const payload = payloads[attemptIndex];
      if (mode === "insert") {
        const { data, error } = await client
          .from(tableName)
          .insert(payload)
          .select("id")
          .maybeSingle();

        if (!error) {
          return {
            payload,
            recordId: data?.id ?? null
          };
        }

        const fallbackInsert = await client.from(tableName).insert(payload);
        if (!fallbackInsert.error) {
          return {
            payload,
            recordId: null
          };
        }

        attemptErrors.push({
          attempt: attemptIndex + 1,
          mode,
          operation: "insert",
          payloadKeys: Object.keys(payload),
          error: {
            code: String((fallbackInsert.error || error)?.code || "").trim(),
            message: String((fallbackInsert.error || error)?.message || "").trim(),
            details: String((fallbackInsert.error || error)?.details || "").trim(),
            hint: String((fallbackInsert.error || error)?.hint || "").trim()
          }
        });

        lastError = fallbackInsert.error || error;
        continue;
      }

      const { error } = await client.from(tableName).update(payload).eq("id", id);

      if (!error) {
        return {
          payload,
          recordId: id ?? null
        };
      }

      attemptErrors.push({
        attempt: attemptIndex + 1,
        mode,
        operation: "update",
        payloadKeys: Object.keys(payload),
        error: {
          code: String(error?.code || "").trim(),
          message: String(error?.message || "").trim(),
          details: String(error?.details || "").trim(),
          hint: String(error?.hint || "").trim()
        }
      });

      lastError = error;
    }

    if (lastError?.message) {
      const details = [lastError.message, lastError.details, lastError.hint].filter(Boolean).join(" | ");
      const attemptSummary = attemptErrors.length > 0
        ? ` Attempts: ${JSON.stringify(attemptErrors)}`
        : "";
      throw new Error((details || "Unable to save announcement.") + attemptSummary);
    }

    throw new Error("Unable to save announcement.");
  };

  const refreshAnnouncements = async (tableName) => {
    const rows = await loadAnnouncements(tableName);
    setAnnouncements((current) => {
      const currentById = new Map(current.map((announcement) => [announcement.id, announcement]));
      const currentByContent = new Map(current.map((announcement) => [
        `${announcement.title}::${announcement.content}`,
        announcement
      ]));

      return sortAnnouncements(rows.map((announcement) => {
        const previous = currentById.get(announcement.id) || currentByContent.get(`${announcement.title}::${announcement.content}`);

        if (!previous) {
          return announcement;
        }

        return {
          ...previous,
          ...announcement,
          targetAudience: announcement.targetAudience || previous.targetAudience,
          priority: announcement.priority || previous.priority,
          createdAt: announcement.createdAt || previous.createdAt,
          author: announcement.author || previous.author,
          fileNames: announcement.fileNames?.length ? announcement.fileNames : previous.fileNames,
          fileUrls: announcement.fileUrls?.length ? announcement.fileUrls : previous.fileUrls,
          filePaths: announcement.filePaths?.length ? announcement.filePaths : previous.filePaths,
          fileTypes: announcement.fileTypes?.length ? announcement.fileTypes : previous.fileTypes,
          attachments: announcement.attachments?.length ? announcement.attachments : previous.attachments,
          fileName: announcement.fileName || previous.fileName,
          fileUrl: announcement.fileUrl || previous.fileUrl,
          filePath: announcement.filePath || previous.filePath,
          fileType: announcement.fileType || previous.fileType
        };
      }));
    });
    return rows;
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

        const tableName = await getAnnouncementTableName();
        const rows = await loadAnnouncements(tableName);

        if (isMounted) {
          setAnnouncements(rows);
          setErrorMessage("");
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load announcements.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!supabase || !announcementTable) {
      return undefined;
    }

    const channel = supabase
      .channel("admin-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: announcementTable }, async () => {
        try {
          await refreshAnnouncements(announcementTable);
        } catch {
          // Keep the current state if the refresh fails.
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [announcementTable]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const filteredAnnouncements = sortAnnouncements(announcements.filter((announcement) => {
    const query = searchQuery.toLowerCase();
    return [announcement.title, announcement.content, announcement.targetAudience, announcement.priority]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  }));

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setFormData(emptyForm);
    setFormErrors({});
    setFormTouched(emptyTouchedFields);
    setHasTriedCreateSubmit(false);
    resetAnnouncementFileInput();
  };

  const handleOpenEditModal = (announcement) => {
    setEditingAnnouncement(announcement);
    setEditFormData({
      title: announcement.title,
      content: announcement.content,
      targetAudience: normalizeAudience(announcement.targetAudience),
      priority: normalizePriority(announcement.priority)
    });
    setEditFormErrors({});
    setEditFormTouched(emptyTouchedFields);
    setHasTriedEditSubmit(false);
    resetAnnouncementFileInput();
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingAnnouncement(null);
    setEditFormErrors({});
    setEditFormTouched(emptyTouchedFields);
    setHasTriedEditSubmit(false);
    resetAnnouncementFileInput();
  };

  const handleAnnouncementFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);

    if (selectedFiles.length === 0) {
      setAnnouncementFiles([]);
      return;
    }

    const invalidFile = selectedFiles.find((file) => !isSupportedAnnouncementAttachment(file));
    if (invalidFile) {
      setErrorMessage(`Unsupported file type: ${invalidFile.name}`);
      resetAnnouncementFileInput();
      return;
    }

    const oversizedFile = selectedFiles.find((file) => file.size > MAX_ANNOUNCEMENT_ATTACHMENT_SIZE_BYTES);
    if (oversizedFile) {
      setErrorMessage(`File too large: ${oversizedFile.name}. Maximum size is 20MB.`);
      resetAnnouncementFileInput();
      return;
    }

    setAnnouncementFiles(selectedFiles);
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    setHasTriedCreateSubmit(true);
    const submissionErrors = applyCreateValidationState(formData, formTouched, true);
    if (Object.keys(submissionErrors).length > 0) {
      return;
    }

    if (!validateForm(formData, setFormErrors)) {
      return;
    }

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const tableName = await getAnnouncementTableName();
      const columns = await getAnnouncementColumns(tableName);
      const timestamp = new Date().toISOString();
      const writeResult = await writeAnnouncement(tableName, "insert", buildCreatePayloads(formData, timestamp, columns, []));
      const createdAnnouncementId = String(writeResult?.recordId ?? "").trim();

      if (announcementFiles.length > 0 && !createdAnnouncementId) {
        throw new Error("Announcement was created, but no announcement ID was returned for attachments.");
      }

      const uploadedAttachments = announcementFiles.length > 0
        ? await uploadAnnouncementAttachments(announcementFiles, createdAnnouncementId)
        : [];

      if (announcementFiles.length > 0 && uploadedAttachments.length === 0) {
        throw new Error("Unable to upload announcement attachments.");
      }

      if (uploadedAttachments.length > 0 && createdAnnouncementId) {
        const savedAttachments = await insertAnnouncementAttachmentRows(tableName, createdAnnouncementId, uploadedAttachments);
        if (!savedAttachments) {
          throw new Error("Announcement was created, but attachments could not be saved.");
        }

        await syncAnnouncementInlineAttachmentColumns(tableName, createdAnnouncementId);
      }

      const nextAnnouncement = {
        id: createdAnnouncementId || String(Date.now()),
        title: formData.title.trim(),
        content: formData.content.trim(),
        targetAudience: formData.targetAudience,
        audienceType: toDatabaseAudienceType(formData.targetAudience),
        priority: formData.priority,
        createdAt: timestamp,
        ...(uploadedAttachments.length > 0
          ? buildAnnouncementAttachments({
              file_name: JSON.stringify(uploadedAttachments.map((item) => item.fileName)),
              file_url: JSON.stringify(uploadedAttachments.map((item) => item.fileUrl)),
              file_path: JSON.stringify(uploadedAttachments.map((item) => item.filePath)),
              file_type: JSON.stringify(uploadedAttachments.map((item) => item.fileType))
            })
          : { fileNames: [], fileUrls: [], filePaths: [], fileTypes: [], attachments: [], fileName: "", fileUrl: "", filePath: "", fileType: "" })
      };

      setAnnouncements((current) => sortAnnouncements([
        nextAnnouncement,
        ...current.filter((announcement) => announcement.id !== nextAnnouncement.id)
      ]));

      await refreshAnnouncements(tableName);

      logActivity({
        actionType: "added_announcement",
        entityType: "announcement",
        entityId: nextAnnouncement.id,
        entityName: nextAnnouncement.title,
        timestamp: nextAnnouncement.createdAt
      });

      setShowCreateModal(false);
      setFormData(emptyForm);
      setFormErrors({});
      setFormTouched(emptyTouchedFields);
      setHasTriedCreateSubmit(false);
      resetAnnouncementFileInput();
      setAnnouncementFiles([]);
      setSuccessMessage("Announcement added successfully.");
    } catch (error) {
      console.error("Create announcement failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to add announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();

    if (!editingAnnouncement) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    setHasTriedEditSubmit(true);
    const submissionErrors = applyEditValidationState(editFormData, editFormTouched, true);
    if (Object.keys(submissionErrors).length > 0) {
      return;
    }

    if (!validateForm(editFormData, setEditFormErrors)) {
      return;
    }

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const tableName = await getAnnouncementTableName();
      const columns = await getAnnouncementColumns(tableName);
      const replacingFiles = announcementFiles.length > 0;
      const announcementId = String(editingAnnouncement.id || "").trim();
      const uploadedAttachments = replacingFiles ? await uploadAnnouncementAttachments(announcementFiles, announcementId) : [];

      if (replacingFiles && uploadedAttachments.length === 0) {
        throw new Error("Unable to upload announcement attachments.");
      }

      await writeAnnouncement(
        tableName,
        "update",
        buildUpdatePayloads(editFormData, new Date().toISOString(), columns, null),
        announcementId
      );

      if (replacingFiles && uploadedAttachments.length > 0) {
        await insertAnnouncementAttachmentRows(tableName, announcementId, uploadedAttachments);
        await syncAnnouncementInlineAttachmentColumns(tableName, announcementId);
      }

      setAnnouncements((current) => sortAnnouncements(current.map((announcement) => (
        announcement.id === editingAnnouncement.id
          ? {
              ...announcement,
              title: editFormData.title.trim(),
              content: editFormData.content.trim(),
              targetAudience: editFormData.targetAudience,
              audienceType: toDatabaseAudienceType(editFormData.targetAudience),
              priority: editFormData.priority,
              ...(uploadedAttachments.length > 0
                ? buildAnnouncementAttachments({
                    file_name: JSON.stringify(uploadedAttachments.map((item) => item.fileName)),
                    file_url: JSON.stringify(uploadedAttachments.map((item) => item.fileUrl)),
                    file_path: JSON.stringify(uploadedAttachments.map((item) => item.filePath)),
                    file_type: JSON.stringify(uploadedAttachments.map((item) => item.fileType))
                  })
                : { attachments: Array.isArray(editingAnnouncement.attachments) ? editingAnnouncement.attachments : [] })
            }
          : announcement
      ))));

      await refreshAnnouncements(tableName);

      setShowEditModal(false);
      setEditingAnnouncement(null);
      setEditFormErrors({});
      setEditFormTouched(emptyTouchedFields);
      setHasTriedEditSubmit(false);
      resetAnnouncementFileInput();
      setAnnouncementFiles([]);
      setSuccessMessage("Announcement updated successfully.");
    } catch (error) {
      console.error("Update announcement failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to update announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!deleteConfirm.announcementId) {
      return;
    }

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    const deletingAnnouncement = announcements.find((announcement) => announcement.id === deleteConfirm.announcementId);

    if (!deletingAnnouncement) {
      setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" });
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    const previousAnnouncements = announcements;
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== deleteConfirm.announcementId));
    setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" });

    try {
      const tableName = await getAnnouncementTableName();
      const attachmentTableName = getAnnouncementAttachmentTableName(tableName);
      const attachmentForeignKey = getAnnouncementAttachmentForeignKey(tableName);
      const normalizedAnnouncementId = String(deletingAnnouncement.id || "").trim();

      const { data: attachmentRows, error: attachmentFetchError } = await supabase
        .from(attachmentTableName)
        .select("id, file_path, announcement_id")
        .eq(attachmentForeignKey, normalizedAnnouncementId);

      if (attachmentFetchError) {
        throw new Error(attachmentFetchError.message || "Unable to load announcement attachments before delete.");
      }

      const oldFilePaths = [
        ...(Array.isArray(deletingAnnouncement.attachments)
          ? deletingAnnouncement.attachments.map((attachment) => String(attachment.filePath || "").trim()).filter(Boolean)
          : []),
        ...((attachmentRows || []).map((row) => String(row?.file_path || "").trim()).filter(Boolean))
      ];

      const uniqueFilePaths = [...new Set(oldFilePaths)];
      const user = getCurrentUser();
      const isAdmin = user?.role === "admin";
      const client = isAdmin && supabaseAdmin ? supabaseAdmin : supabase;

      if (uniqueFilePaths.length > 0) {
        await client.storage.from(ANNOUNCEMENT_ATTACHMENT_BUCKET).remove(uniqueFilePaths).catch(() => {
          // Continue with the delete even if file cleanup fails.
        });
      }

      const linkedAnnouncementIds = [...new Set(
        (attachmentRows || [])
          .map((row) => String(row?.announcement_id || "").trim())
          .filter(Boolean)
      )];

      const { error } = await client.from(tableName).delete().eq("id", deletingAnnouncement.id);

      if (error) {
        throw new Error(error.message);
      }

      const { error: attachmentCleanupError } = await client
        .from(attachmentTableName)
        .delete()
        .eq(attachmentForeignKey, normalizedAnnouncementId);

      if (attachmentCleanupError) {
        console.error("Failed to cleanup attachment rows after parent delete:", attachmentCleanupError);
      }

      if (tableName === "school_announcements" && linkedAnnouncementIds.length > 0) {
        const { error: linkedAnnouncementCleanupError } = await supabase
          .from("announcements")
          .delete()
          .in("id", linkedAnnouncementIds);

        if (linkedAnnouncementCleanupError) {
          console.error("Failed to cleanup linked announcements after delete:", linkedAnnouncementCleanupError);
        }
      }

      logActivity({
        actionType: "deleted_announcement",
        entityType: "announcement",
        entityId: deletingAnnouncement.id,
        entityName: deletingAnnouncement.title,
        timestamp: new Date().toISOString()
      });

      setSuccessMessage("Announcement deleted successfully.");
      void refreshAnnouncements(tableName).catch(() => {
        // Keep the optimistic UI if the refresh fails.
      });
    } catch (error) {
      setAnnouncements(previousAnnouncements);
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ConfirmDeleteDialog = () => {
    if (!deleteConfirm.isOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden">
          <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border bg-red-50 border-red-200">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-4 font-semibold text-gray-900">Delete Announcement</h3>
            </div>
            <button
              type="button"
              onClick={() => setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" })}
              className="text-gray-600 hover:text-gray-900 transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 bg-gray-50">
            <p className="text-gray-700 leading-relaxed">
              Are you sure you want to permanently delete {deleteConfirm.announcementTitle}? This action cannot be undone.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 rounded-b-2xl border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" })}
              className="px-6 py-2.5 text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAnnouncement}
              className="px-6 py-2.5 text-gray-900 rounded-xl transition-all duration-200 font-medium shadow-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </button>
          </div>
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
                <h2 className="text-lg font-bold text-gray-900">Announcements</h2>
              </div>
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) => setNotificationList((prev) => prev.map((notification) => (notification.id === id ? { ...notification, isRead: true } : notification)))}
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
            <div className="relative pl-4 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-green-600">Announcements</h1>
                <p className="text-gray-600">{announcements.length} published announcements</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleOpenCreateModal();
                }}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-gray-900 rounded-xl hover:bg-green-500 transition-colors font-semibold shadow-lg shadow-green-500/20"
              >
                <Plus className="w-5 h-5" />
                Create Announcement
              </button>
            </div>
          </div>

          {(errorMessage || successMessage) && (
            <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${errorMessage ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage || successMessage}</span>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
              <input
                type="text"
                placeholder="Search announcements..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500/50"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredAnnouncements.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
                <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600">No announcements found.</p>
              </div>
            ) : (
              filteredAnnouncements.map((announcement) => (
                <div key={announcement.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-green-300 transition-colors">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-start gap-3 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide border ${getCategoryStyles(announcement.category)}`}>
                            {announcement.category || "General"}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide border ${getPriorityStyles(announcement.priority)}`}>
                            {formatPriorityLabel(announcement.priority)}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-4 line-clamp-2 whitespace-pre-line">{announcement.content}</p>
                        {Array.isArray(announcement.attachments) && announcement.attachments.length > 0 && (
                          <div className="space-y-3 mb-4">
                            {announcement.attachments.map((attachment, index) => {
                              if (attachment.kind === "image") {
                                return (
                                  <a key={`${announcement.id}-attachment-${index}`} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="block">
                                    <img
                                      src={attachment.fileUrl}
                                      alt={attachment.fileName || "Announcement attachment"}
                                      className="max-h-80 w-full rounded-xl border border-gray-200 object-cover bg-gray-50"
                                    />
                                  </a>
                                );
                              }

                              if (attachment.kind === "video") {
                                return (
                                  <div key={`${announcement.id}-attachment-${index}`} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                                    <video controls src={attachment.fileUrl} className="w-full max-h-80 bg-black" />
                                  </div>
                                );
                              }

                              return (
                                <a
                                  key={`${announcement.id}-attachment-${index}`}
                                  href={attachment.fileUrl || attachment.filePath || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-300 text-xs font-medium hover:bg-purple-500/20"
                                >
                                  <File className="w-3 h-3" />
                                  {attachment.fileName || `File ${index + 1}`}
                                </a>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide border ${getAudienceStyles(announcement.targetAudience)}`}>
                            {String(announcement.targetAudience || "").toLowerCase().includes("school") ? <School className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {formatAudienceLabel(announcement.targetAudience)}
                          </span>
                          <span>Posted: {formatDate(announcement.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-4 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(announcement)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-green-600" />
                        </button>
                        <button
                          type="button"
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          onClick={() => setDeleteConfirm({ isOpen: true, announcementId: announcement.id, announcementTitle: announcement.title })}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <ConfirmDeleteDialog />

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Create Announcement</h3>
              <button onClick={handleCloseCreateModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleCreateAnnouncement} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(event) => handleCreateFieldChange("title", event.target.value)}
                    onBlur={() => handleCreateFieldBlur("title")}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${formErrors.title ? "border-red-500" : "border-gray-300"}`}
                    placeholder="Enter announcement title"
                  />
                  {formErrors.title && <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content <span className="text-red-500">*</span></label>
                  <textarea
                    value={formData.content}
                    onChange={(event) => handleCreateFieldChange("content", event.target.value)}
                    onBlur={() => handleCreateFieldBlur("content")}
                    rows={5}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none ${formErrors.content ? "border-red-500" : "border-gray-300"}`}
                    placeholder="Enter announcement content"
                  />
                  {formErrors.content && <p className="mt-1 text-sm text-red-600">{formErrors.content}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience <span className="text-red-500">*</span></label>
                  <CustomSelect
                    value={formData.targetAudience}
                    onChange={(value) => handleCreateFieldChange("targetAudience", value)}
                    onBlur={() => handleCreateFieldBlur("targetAudience")}
                    options={audienceOptions}
                    placeholder="Select audience"
                    icon={<Users className="w-5 h-5" />}
                    className={`w-full ${formErrors.targetAudience ? "border-red-500" : ""}`}
                  />
                  {formErrors.targetAudience && <p className="mt-1 text-sm text-red-600">{formErrors.targetAudience}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <CustomSelect
                    value={formData.category}
                    onChange={(value) => handleCreateFieldChange("category", value)}
                    onBlur={() => handleCreateFieldBlur("category")}
                    options={getFilteredCategoryOptions(formData.targetAudience)}
                    placeholder="Select category"
                    icon={<Megaphone className="w-5 h-5" />}
                    className={`w-full ${formErrors.category ? "border-red-500" : ""}`}
                  />
                  {formErrors.category && <p className="mt-1 text-sm text-red-600">{formErrors.category}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <CustomSelect
                    value={formData.priority}
                    onChange={(value) => handleCreateFieldChange("priority", value)}
                    onBlur={() => handleCreateFieldBlur("priority")}
                    options={priorityOptions}
                    placeholder="Select priority"
                    icon={<Megaphone className="w-5 h-5" />}
                    className={`w-full ${formErrors.priority ? "border-red-500" : ""}`}
                  />
                  {formErrors.priority && <p className="mt-1 text-sm text-red-600">{formErrors.priority}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attach Files</label>
                  <input
                    ref={announcementFileInputRef}
                    type="file"
                    multiple
                    accept={ANNOUNCEMENT_FILE_ACCEPT}
                    className="hidden"
                    onChange={handleAnnouncementFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => announcementFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-green-200 rounded-lg text-sm text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                    Choose files
                  </button>
                  {announcementFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-gray-500">Selected files:</p>
                      <div className="flex flex-wrap gap-2">
                        {announcementFiles.map((file) => (
                          <span key={file.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                            <Paperclip className="w-3 h-3" />
                            {file.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={handleCloseCreateModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    "Create Announcement"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Edit Announcement</h3>
              <button onClick={handleCloseEditModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(event) => handleEditFieldChange("title", event.target.value)}
                    onBlur={() => handleEditFieldBlur("title")}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${editFormErrors.title ? "border-red-500" : "border-gray-300"}`}
                    placeholder="Enter announcement title"
                  />
                  {editFormErrors.title && <p className="mt-1 text-sm text-red-600">{editFormErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content <span className="text-red-500">*</span></label>
                  <textarea
                    value={editFormData.content}
                    onChange={(event) => handleEditFieldChange("content", event.target.value)}
                    onBlur={() => handleEditFieldBlur("content")}
                    rows={5}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none ${editFormErrors.content ? "border-red-500" : "border-gray-300"}`}
                    placeholder="Enter announcement content"
                  />
                  {editFormErrors.content && <p className="mt-1 text-sm text-red-600">{editFormErrors.content}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience <span className="text-red-500">*</span></label>
                  <CustomSelect
                    value={editFormData.targetAudience}
                    onChange={(value) => handleEditFieldChange("targetAudience", value)}
                    onBlur={() => handleEditFieldBlur("targetAudience")}
                    options={audienceOptions}
                    placeholder="Select audience"
                    icon={<Users className="w-5 h-5" />}
                    className={`w-full ${editFormErrors.targetAudience ? "border-red-500" : ""}`}
                  />
                  {editFormErrors.targetAudience && <p className="mt-1 text-sm text-red-600">{editFormErrors.targetAudience}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <CustomSelect
                    value={editFormData.category}
                    onChange={(value) => handleEditFieldChange("category", value)}
                    onBlur={() => handleEditFieldBlur("category")}
                    options={getFilteredCategoryOptions(editFormData.targetAudience)}
                    placeholder="Select category"
                    icon={<Megaphone className="w-5 h-5" />}
                    className={`w-full ${editFormErrors.category ? "border-red-500" : ""}`}
                  />
                  {editFormErrors.category && <p className="mt-1 text-sm text-red-600">{editFormErrors.category}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <CustomSelect
                    value={editFormData.priority}
                    onChange={(value) => handleEditFieldChange("priority", value)}
                    onBlur={() => handleEditFieldBlur("priority")}
                    options={priorityOptions}
                    placeholder="Select priority"
                    icon={<Megaphone className="w-5 h-5" />}
                    className={`w-full ${editFormErrors.priority ? "border-red-500" : ""}`}
                  />
                  {editFormErrors.priority && <p className="mt-1 text-sm text-red-600">{editFormErrors.priority}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attach Files</label>
                  {Array.isArray(editingAnnouncement?.attachments) && editingAnnouncement.attachments.length > 0 && (
                    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-500">Current files:</p>
                      <div className="space-y-2">
                        {editingAnnouncement.attachments.map((attachment, index) => {
                          if (attachment.kind === "image") {
                            return (
                              <a key={`${editingAnnouncement.id}-current-${index}`} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="block">
                                <img
                                  src={attachment.fileUrl}
                                  alt={attachment.fileName || "Announcement attachment"}
                                  className="max-h-60 w-full rounded-lg border border-gray-200 object-cover bg-white"
                                />
                              </a>
                            );
                          }

                          if (attachment.kind === "video") {
                            return (
                              <div key={`${editingAnnouncement.id}-current-${index}`} className="overflow-hidden rounded-lg border border-gray-200 bg-black">
                                <video controls src={attachment.fileUrl} className="w-full max-h-60" />
                              </div>
                            );
                          }

                          return (
                            <a
                              key={`${editingAnnouncement.id}-current-${index}`}
                              href={attachment.fileUrl || attachment.filePath || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-gray-700 text-xs font-medium border border-gray-200 hover:bg-gray-50"
                            >
                              <File className="w-3 h-3" />
                              {attachment.fileName || `File ${index + 1}`}
                            </a>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-gray-500">Uploading new files will add to the current attachments.</p>
                    </div>
                  )}
                  <input
                    ref={announcementFileInputRef}
                    type="file"
                    multiple
                    accept={ANNOUNCEMENT_FILE_ACCEPT}
                    className="hidden"
                    onChange={handleAnnouncementFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => announcementFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-green-200 rounded-lg text-sm text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                    Choose files
                  </button>
                  {announcementFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-gray-500">Selected files:</p>
                      <div className="flex flex-wrap gap-2">
                        {announcementFiles.map((file) => (
                          <span key={file.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                            <Paperclip className="w-3 h-3" />
                            {file.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={handleCloseEditModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export { AdminAnnouncements };
