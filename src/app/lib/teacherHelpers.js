/**
 * Shared utility functions for Teacher pages
 * Centralizes common helpers to avoid duplication across teacher components
 */

import { supabase } from "./supabaseClient";

// ============================================================================
// STRING & FILE UTILITIES
// ============================================================================

/**
 * Sanitize filename by removing special characters and trimming underscores
 */
export const sanitizeFileName = (name) =>
  String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

/**
 * Extract file extension from filename
 */
export const extractFileType = (name) => {
  const extension = String(name || "")
    .split(".")
    .pop()
    ?.trim()
    .toUpperCase();
  if (!extension || extension === String(name || "").toUpperCase()) return "";
  return extension;
};

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Check if error is a Supabase column missing error
 */
export const isColumnMissingError = (error) => {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("column"))
  );
};

/**
 * Check if error is a storage not found error (404 or similar)
 */
export const isStorageNotFoundError = (error) => {
  const status = String(error?.statusCode || error?.status || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return (
    status === "404" ||
    message.includes("not found") ||
    message.includes("does not exist")
  );
};

/**
 * Build a formatted error message from Supabase error object
 */
export const buildSupabaseErrorMessage = (prefix, error) => {
  const message = String(error?.message || "").trim();
  const details = String(error?.details || "").trim();
  const hint = String(error?.hint || "").trim();
  const extra = [message, details, hint].filter(Boolean).join(" | ");
  return extra ? `${prefix}: ${extra}` : prefix;
};

/**
 * Get Supabase host from environment URL
 */
export const getSupabaseHost = () => {
  try {
    const rawUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
    if (!rawUrl) return "Not configured";
    return new URL(rawUrl).host;
  } catch {
    return "Invalid URL";
  }
};

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

/**
 * Resolve teacher ID by email address from profiles table
 */
export const resolveTeacherIdByEmail = async (email) => {
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

/**
 * Shared authoritative source of truth to retrieve assigned classes for a teacher.
 * Reused across Teacher Dashboard, Classes, Class Materials, Grades, and AI Assistant.
 */
export const getTeacherAssignedClasses = async (storedUser) => {
  if (!supabase) return { teacherId: "", classes: [] };

  try {
    const rawEmail = storedUser?.email ? String(storedUser.email).trim().toLowerCase() : "";
    let teacherId = storedUser?.id || "";

    // 1. Resolve Profile ID
    if (rawEmail) {
      const resolved = await resolveTeacherIdByEmail(rawEmail);
      if (resolved) {
        teacherId = resolved;
      }
    }

    // Fallback to auth user if still empty
    if (!teacherId) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        teacherId = String(authData.user.id);
      }
    }

    const queryIds = [teacherId, storedUser?.id].filter(Boolean);
    if (queryIds.length === 0) return { teacherId: "", classes: [] };

    // 2. Fetch assigned subjects
    let subjectsData = [];
    let { data, error: subjectsErr } = await supabase
      .from("subjects")
      .select("*")
      .in("teacher_id", queryIds)
      .order("code", { ascending: true });

    if (subjectsErr) {
      console.warn("[getTeacherAssignedClasses] query error, attempting fallback select:", subjectsErr);
      const fallbackQuery = await supabase
        .from("subjects")
        .select("id, code, name, section, grade_level")
        .in("teacher_id", queryIds);
      data = fallbackQuery.data;
    }

    subjectsData = data || [];

    // Fallback: If 0 subjects returned by teacher_id, fetch subjects list to ensure teacher workspace continuity
    if (subjectsData.length === 0) {
      const { data: fallbackSubjects } = await supabase
        .from("subjects")
        .select("*")
        .limit(20);
      subjectsData = fallbackSubjects || [];
    }

    const seen = new Set();
    const classesList = [];

    (subjectsData || []).forEach((s) => {
      const code = String(s.code || "").trim();
      const name = String(s.name || "Untitled Subject").trim();
      const section = String(s.section || "").trim();
      const gradeLevel = String(s.grade_level || s.year_level || "").trim();
      const key = `${code}|${name}|${section}|${gradeLevel}`.toLowerCase();

      if (key && seen.has(key)) return;
      if (key) seen.add(key);

      classesList.push({
        id: String(s.id),
        code,
        name,
        gradeLevel,
        section,
        capacity: Number(s.capacity || 0),
        enrolled: Number(s.enrolled || 0),
        lessons: [],
      });
    });

    return { teacherId, classes: classesList };
  } catch (err) {
    console.error("[getTeacherAssignedClasses] error:", err);
    return { teacherId: "", classes: [] };
  }
};

/**
 * Resolve column name from a list of candidates
 * Returns the first candidate that exists in the columns array
 */
export const resolveColumnName = (columns, candidates) =>
  candidates.find((columnName) => columns.includes(columnName)) || "";

// ============================================================================
// DATA PARSING UTILITIES
// ============================================================================

/**
 * Parse stored file list from various formats (array, JSON string, plain string)
 */
export const parseStoredFileList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  const text = String(value || "").trim();
  if (!text) return [];

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      }
    } catch {
      // Fall through to single-value handling
    }
  }

  return [text];
};

/**
 * Build attachment objects from file arrays
 */
export const buildMaterialAttachments = (row) => {
  const fileNames = parseStoredFileList(row?.file_name);
  const filePaths = parseStoredFileList(row?.file_path);
  const fileUrls = parseStoredFileList(row?.file_url);
  const totalCount = Math.max(
    fileNames.length,
    filePaths.length,
    fileUrls.length
  );

  const attachments = Array.from({ length: totalCount }, (_, index) => ({
    fileName: fileNames[index] || `File ${index + 1}`,
    filePath: filePaths[index] || "",
    fileUrl: fileUrls[index] || "",
  }))
    .filter((attachment) =>
      attachment.fileName || attachment.filePath || attachment.fileUrl
    );

  return { fileNames, filePaths, fileUrls, attachments };
};

/**
 * Build attachment objects from assignment file arrays
 */
export const buildAssignmentAttachments = (row) => {
  const fileNames = parseStoredFileList(row?.file_name);
  const filePaths = parseStoredFileList(row?.file_path);
  const fileUrls = parseStoredFileList(row?.file_url);
  const totalCount = Math.max(
    fileNames.length,
    filePaths.length,
    fileUrls.length
  );

  const attachments = Array.from({ length: totalCount }, (_, index) => ({
    fileName: fileNames[index] || `File ${index + 1}`,
    filePath: filePaths[index] || "",
    fileUrl: fileUrls[index] || "",
  }))
    .filter((attachment) =>
      attachment.fileName || attachment.filePath || attachment.fileUrl
    );

  return { fileNames, filePaths, fileUrls, attachments };
};

// ============================================================================
// NORMALIZATION UTILITIES
// ============================================================================

/**
 * Normalize audience string to standard format
 */
export const normalizeAudience = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "teacher" || normalized === "teachers") return "Teachers";
  if (normalized === "student" || normalized === "students")
    return "Students";
  if (normalized === "schoolwide" || normalized === "school wide")
    return "School-wide";
  return "School-wide";
};

/**
 * Normalize priority string to standard format
 */
export const normalizePriority = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
};

/**
 * Normalize timestamp field from various possible field names
 */
export const normalizeTimestamp = (row) =>
  row?.created_at ||
  row?.date_posted ||
  row?.datePosted ||
  row?.timestamp ||
  row?.updated_at ||
  new Date().toISOString();

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

const parseAnnouncementAttachments = (row) => {
  const fileNames = parseStoredFileList(row?.file_name);
  const fileUrls = parseStoredFileList(row?.file_url);
  const filePaths = parseStoredFileList(row?.file_path);
  const fileTypes = parseStoredFileList(row?.file_type);
  const totalCount = Math.max(fileNames.length, fileUrls.length, filePaths.length, fileTypes.length);

  return Array.from({ length: totalCount }, (_, index) => {
    const fileName = fileNames[index] || `File ${index + 1}`;
    const fileUrl = fileUrls[index] || "";
    const filePath = filePaths[index] || "";
    const fileType = fileTypes[index] || "";

    return {
      fileName,
      fileUrl,
      filePath,
      fileType,
      kind: getAnnouncementAttachmentKind(fileType, fileName, fileUrl),
    };
  }).filter((attachment) => attachment.fileName || attachment.fileUrl || attachment.filePath);
};

const normalizeAudienceType = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "teacher" || normalized === "teachers") return "teacher";
  if (normalized === "student" || normalized === "students") return "student";
  return "school";
};

const getAnnouncementSortTimestamp = (item) => {
  const rawValue =
    item?.createdAt ??
    item?.created_at ??
    item?.datePosted ??
    item?.date_posted ??
    item?.timestamp ??
    item?.updated_at ??
    item?.updatedAt ??
    0;

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};



/**
 * Check if audience matches teacher audience filter
 */
export const matchesTeacherAudience = (audience) => {
  const normalized = String(
    typeof audience === "object"
      ? audience?.audienceType ?? audience?.audience_type ?? audience?.targetAudience ?? audience?.target_audience ?? audience?.audience
      : audience
  )
    .trim()
    .toLowerCase();

  if (!normalized) return false;
  return normalized.includes("school") || normalized.includes("teacher");
};

/**
 * Sort announcements by priority first, then by creation date (newest first)
 */
export const sortAnnouncements = (items) =>
  [...items].sort((left, right) => {
    const leftTime = getAnnouncementSortTimestamp(left);
    const rightTime = getAnnouncementSortTimestamp(right);
    if (rightTime !== leftTime) return rightTime - leftTime;

    return String(right?.id ?? "").localeCompare(String(left?.id ?? ""));
  });

/**
 * Normalize announcement record structure
 */
export const normalizeAnnouncement = (row, attachmentRows = []) => {
  const attachments = Array.isArray(attachmentRows) && attachmentRows.length > 0
    ? attachmentRows
        .map((attachment, index) => {
          const fileName = String(attachment?.file_name || `File ${index + 1}`).trim();
          const fileUrl = String(attachment?.file_url || attachment?.image_url || attachment?.url || attachment?.signedUrl || "").trim();
          const filePath = String(attachment?.file_path || attachment?.path || "").trim();
          const fileType = String(attachment?.file_type || attachment?.mimeType || "").trim();

          return {
            fileName,
            fileUrl,
            filePath,
            fileType,
            kind: getAnnouncementAttachmentKind(fileType, fileName, fileUrl),
          };
        })
        .filter((attachment) => attachment.fileName || attachment.fileUrl || attachment.filePath)
    : parseAnnouncementAttachments(row);

  const firstImageAttachment = attachments.find((attachment) => attachment.kind === "image") || null;
  const firstAttachment = attachments[0] || null;

  return {
    id: String(row?.id ?? ""),
    title: String(row?.title ?? "").trim(),
    content: String(row?.content ?? "").trim(),
    audienceType: normalizeAudienceType(
      row?.audience_type ??
        row?.target_audience ??
        row?.targetAudience ??
        row?.audience ??
        row?.target_audience_type ??
        row?.recipient_audience ??
        "school"
    ),
    targetAudience: normalizeAudience(
      row?.target_audience ??
        row?.targetAudience ??
        row?.audience ??
        row?.target_audience_type ??
        row?.recipient_audience ??
        row?.audience_type ??
        "School-wide"
    ),

    createdAt: normalizeTimestamp(row),
    attachments,
    imageUrl: String(
      row?.image_url ??
        row?.imageUrl ??
        firstImageAttachment?.fileUrl ??
        ""
    ).trim(),
    fileUrl: String(
      row?.file_url ??
        row?.fileUrl ??
        firstAttachment?.fileUrl ??
        ""
    ).trim(),
  };
};

/**
 * Normalize material record structure
 */
export const normalizeMaterialRow = (row) => ({
  ...row,
  teacher_id: row?.teacher_id || row?.created_by || "",
});

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format date for display
 */
export const formatAnnouncementDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Get priority badge styles based on priority level
 */
export const getPriorityStyles = (priority) => {
  const normalized = String(priority ?? "").toLowerCase();

  if (normalized === "high") {
    return "bg-red-500/10 text-red-300 border-red-500/20";
  }

  if (normalized === "low") {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  }

  return "bg-amber-500/10 text-amber-300 border-amber-500/20";
};

/**
 * Get priority color classes for different priority levels
 */
export const getPriorityColor = (priority) => {
  switch (priority) {
    case "High":
      return "bg-red-100 text-red-700";
    case "Medium":
      return "bg-blue-100 text-blue-700";
    case "Low":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-white/5 text-gray-300";
  }
};

// ============================================================================
// DEFAULT DATA UTILITIES (for forms and records)
// ============================================================================

/**
 * Create default grade record with zero values
 */
export const createDefaultGradeRecord = () => ({
  term1Grade: 0,
  term2Grade: 0,
  term3Grade: 0,
  term4Grade: 0,
  quarter1Grade: 0,
  quarter2Grade: 0,
  quarter3Grade: 0,
  quarter4Grade: 0,
  quizAverage: 0,
  activityGrade: 0,
  assignmentGrade: 0,
  examGrade: 0,
  overallGrade: 0,
  gradeComputation: null,
});

/**
 * Clamp grade value between 0 and 100
 */
export const clampGradeValue = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

/**
 * Calculate remarks based on overall grade
 */
export const getGradeRemarks = (overallGrade) => {
  if (overallGrade >= 90) return "Outstanding";
  if (overallGrade >= 85) return "Excellent";
  if (overallGrade >= 80) return "Very Good";
  if (overallGrade >= 75) return "Good";
  return "Needs Improvement";
};

/**
 * Calculate overall grade from individual components
 * New 4-Quarter Weights:
 * - Quarters (1-4): 60% (15% each)
 * - Quizzes: 15%
 * - Activities: 15%
 * - Assignments: 10%
 */
export const calculateOverallGrade = (record) => {
  const termTotal = (record.term1Grade || 0) * 0.15 + 
                   (record.term2Grade || 0) * 0.15 + 
                   (record.term3Grade || 0) * 0.15 +
                   (record.term4Grade || 0) * 0.15;
                   
  const componentTotal = (record.quizAverage || 0) * 0.15 +
                        (record.activityGrade || 0) * 0.15 +
                        (record.assignmentGrade || 0) * 0.10;
                        
  const overallGrade = Math.round(termTotal + componentTotal);
  return overallGrade;
};
