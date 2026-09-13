import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { SectionDropdown } from "../../components/admin/SectionDropdown";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { toast } from "sonner";
import { supabase } from "../../lib/supabaseClient";
import { adminApi } from "@/app/lib/adminApi";
import { useActivity } from "../../lib/ActivityContext";
import { useCachedFetch } from "@/app/hooks/useCachedFetch";
import { notifyAdmin } from "@/app/services/notificationService";
import {
  Search,
  UserPlus,
  Eye,
  Edit,
  Trash2,
  BookOpen,
  Download,
  Upload,
  FileText,
  X,
  Mail,
  Phone,
  User,
  AlertTriangle,
  Loader2,
  CalendarDays,
  Users,
  Sparkles,
  Key,
  CheckSquare,
  MinusSquare,
  Square,
  CheckCircle2
} from "lucide-react";

const db = supabase;
const generateUUID = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
};
const generateTempPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const splitFullName = (fullNameStr) => {
  const parts = String(fullNameStr || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
  const last_name = parts.pop();
  const first_name = parts.join(" ");
  return { first_name, last_name };
};


const emptyTeacherForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  employee_id: "",
  email: "",
  phone: "",
  grade_level: "",
  subjects: [],
  status: "Active",
  password: ""
};
const emptyAssignForm = {
  assignGradeLevel: "",
  assignSection: ""
};

const getApiErrorMessage = (error, fallback = "Request failed.") => {
  if (!error) return fallback;
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object") {
    const message = "message" in error ? String(error.message || "").trim() : "";
    const details = "details" in error ? String(error.details || "").trim() : "";
    const hint = "hint" in error ? String(error.hint || "").trim() : "";

    if (message && details) return `${message} (${details})`;
    if (message) return message;
    if (details) return details;
    if (hint) return hint;
  }

  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
};

function TeacherManagement() {
  const navigate = useNavigate();
  const { logActivity } = useActivity();
  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [resetSettings, setResetSettings] = useState({ forceChange: true, tempPassword: "" });
  const [teacherToAssign, setTeacherToAssign] = useState(null);
  const [teacherFormData, setTeacherFormData] = useState(emptyTeacherForm);
  const [editFormData, setEditFormData] = useState(emptyTeacherForm);
  const [assignFormData, setAssignFormData] = useState(emptyAssignForm);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});
  const [assignFormErrors, setAssignFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [gradeSectionsMap, setGradeSectionsMap] = useState({});
  const [loadingSectionsMap, setLoadingSectionsMap] = useState({});
  const [fetchError, setFetchError] = useState(null);
  
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const [activeTab, setActiveTab] = useState("Roster");
  const [registrationSubTab, setRegistrationSubTab] = useState("pending");
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showViewRequestModal, setShowViewRequestModal] = useState(false);
  const [showApproveRequestModal, setShowApproveRequestModal] = useState(false);
  const [showRejectRequestModal, setShowRejectRequestModal] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);

  // Teacher Bulk Registration Request States
  const [selectedPendingRequestIds, setSelectedPendingRequestIds] = useState(new Set());
  const [showBulkApproveConfirmModal, setShowBulkApproveConfirmModal] = useState(false);
  const [showBulkApproveProgressModal, setShowBulkApproveProgressModal] = useState(false);
  const [bulkApproveProgress, setBulkApproveProgress] = useState({ total: 0, current: 0, currentTeacherName: "" });
  const [showBulkApproveResultsModal, setShowBulkApproveResultsModal] = useState(false);
  const [bulkApproveResultsSummary, setBulkApproveResultsSummary] = useState({ total: 0, successCount: 0, emailSentCount: 0, emailFailedCount: 0, failures: [] });

  const [showTeacherCreateRequestsModal, setShowTeacherCreateRequestsModal] = useState(false);
  const [teacherCreateSummary, setTeacherCreateSummary] = useState({ totalSelected: 0, ready: [], missingEmail: [], duplicates: [] });
  const [teacherCreateTab, setTeacherCreateTab] = useState("ready");
  const [isCreatingTeacherRequests, setIsCreatingTeacherRequests] = useState(false);

  // Teacher CSV / File Import States
  const teacherFileInputRef = useRef(null);
  const [showTeacherImportModal, setShowTeacherImportModal] = useState(false);
  const [teacherImportSummary, setTeacherImportSummary] = useState({
    total: 0,
    valid: [],
    missingEmail: [],
    duplicates: [],
    invalid: []
  });
  const [teacherImportTab, setTeacherImportTab] = useState("valid");
  const [isSavingTeacherImport, setIsSavingTeacherImport] = useState(false);
  const [isImportingTeachers, setIsImportingTeachers] = useState(false);

  const handleDownloadTeacherSampleCsv = () => {
    const headers = ["First Name", "Middle Name", "Last Name", "Suffix", "Email Address", "Employee ID"];
    const sampleRows = [
      ["Maria", "Santos", "Dela Cruz", "", "maria.delacruz@school.edu.ph", "EMP-2026-001"],
      ["Juan", "Carlos", "Reyes", "Jr.", "juan.reyes@school.edu.ph", "EMP-2026-002"],
      ["Elena", "", "Bautista", "", "elena.bautista@school.edu.ph", "EMP-2026-003"]
    ];
    const csvContent = [headers.join(","), ...sampleRows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "Teacher_Registration_Import_Template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTeacherFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingTeachers(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        if (typeof text !== "string") throw new Error("Could not read file content");
        processTeacherCsvText(text);
      } catch (err) {
        toast.error(err.message || "Failed to process CSV file.");
      } finally {
        setIsImportingTeachers(false);
        if (teacherFileInputRef.current) teacherFileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const processTeacherCsvText = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) {
      toast.error("The file is empty.");
      return;
    }

    const parseLine = (line) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaderCols = parseLine(lines[0]);
    const normHeader = rawHeaderCols.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

    const headerMap = {};
    normHeader.forEach((h, idx) => {
      if (h.includes("first") || h === "fname" || h === "given") headerMap.first_name = idx;
      else if (h.includes("middle") || h === "mname") headerMap.middle_name = idx;
      else if (h.includes("last") || h === "lname" || h === "surname") headerMap.last_name = idx;
      else if (h.includes("suffix") || h === "ext") headerMap.suffix = idx;
      else if (h.includes("email") || h.includes("mail")) headerMap.email = idx;
      else if (h.includes("employee") || h.includes("empid") || h === "id" || h.includes("identification")) headerMap.employee_id = idx;
      else if (h.includes("name") || h.includes("teacher")) headerMap.full_name = idx;
    });

    const dbEmailSet = new Set(teachers.map(t => (t.email || "").toLowerCase().trim()).filter(Boolean));
    const dbEmpIdSet = new Set(teachers.map(t => (t.employee_id || t.lrn || "").toLowerCase().trim()).filter(Boolean));

    (registrationRequests || []).forEach(r => {
      if (r.email) dbEmailSet.add(r.email.toLowerCase().trim());
      const emp = r.employee_id || r.lrn;
      if (emp) dbEmpIdSet.add(emp.toLowerCase().trim());
    });

    const validRecords = [];
    const missingEmailRecords = [];
    const duplicateRecords = [];
    const invalidRecords = [];
    const fileEmailSet = new Set();
    const fileEmpIdSet = new Set();

    let hasHeader = headerMap.first_name !== undefined || headerMap.last_name !== undefined || headerMap.email !== undefined || headerMap.full_name !== undefined;
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (!cols || cols.length === 0 || cols.every(c => !c || !c.trim())) continue;

      let firstName = headerMap.first_name !== undefined ? cols[headerMap.first_name] : "";
      let lastName = headerMap.last_name !== undefined ? cols[headerMap.last_name] : "";
      let middleName = headerMap.middle_name !== undefined ? cols[headerMap.middle_name] : "";
      let suffix = headerMap.suffix !== undefined ? cols[headerMap.suffix] : "";
      let email = headerMap.email !== undefined ? cols[headerMap.email] : "";
      let empId = headerMap.employee_id !== undefined ? cols[headerMap.employee_id] : "";

      if (!hasHeader) {
        firstName = cols[0] || "";
        middleName = cols[1] || "";
        lastName = cols[2] || "";
        suffix = cols[3] || "";
        email = cols[4] || "";
        empId = cols[5] || "";
      }

      if ((!firstName || !lastName) && headerMap.full_name !== undefined && cols[headerMap.full_name]) {
        const split = splitFullName(cols[headerMap.full_name]);
        firstName = split.first_name;
        lastName = split.last_name;
      }

      firstName = (firstName || "").trim();
      lastName = (lastName || "").trim();
      middleName = (middleName || "").trim();
      suffix = (suffix || "").trim();
      email = (email || "").trim();
      empId = (empId || "").trim();

      const rowNum = i + 1;
      const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(" ") || "N/A";

      if (!firstName || !lastName) {
        invalidRecords.push({
          rowNum,
          fullName,
          email,
          empId,
          reason: "Missing teacher first or last name."
        });
        continue;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        missingEmailRecords.push({
          rowNum,
          fullName,
          email: email || "Missing",
          empId,
          reason: !email ? "Missing email address" : "Invalid email address format"
        });
        continue;
      }

      const emailLow = email.toLowerCase();
      const empIdLow = empId.toLowerCase();

      if (fileEmailSet.has(emailLow) || (empIdLow && fileEmpIdSet.has(empIdLow))) {
        duplicateRecords.push({
          rowNum,
          fullName,
          email,
          empId,
          reason: "Duplicate email or employee ID in file."
        });
        continue;
      }

      if (dbEmailSet.has(emailLow)) {
        duplicateRecords.push({
          rowNum,
          fullName,
          email,
          empId,
          reason: `Email ${email} already exists in database or pending requests.`
        });
        continue;
      }

      if (empIdLow && dbEmpIdSet.has(empIdLow)) {
        duplicateRecords.push({
          rowNum,
          fullName,
          email,
          empId,
          reason: `Employee ID ${empId} already exists in database or pending requests.`
        });
        continue;
      }

      fileEmailSet.add(emailLow);
      if (empIdLow) fileEmpIdSet.add(empIdLow);

      validRecords.push({
        rowNum,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        suffix: suffix || null,
        email,
        employee_id: empId || null,
        fullName
      });
    }

    const total = validRecords.length + missingEmailRecords.length + duplicateRecords.length + invalidRecords.length;
    if (total === 0) {
      toast.error("No valid records found in CSV content.");
      return;
    }

    setTeacherImportSummary({
      total,
      valid: validRecords,
      missingEmail: missingEmailRecords,
      duplicates: duplicateRecords,
      invalid: invalidRecords
    });

    setTeacherImportTab(validRecords.length > 0 ? "valid" : (missingEmailRecords.length > 0 ? "missingEmail" : "duplicates"));
    setShowTeacherImportModal(true);
  };

  const handleConfirmTeacherImport = async () => {
    if (teacherImportSummary.valid.length === 0) {
      toast.error("No valid teacher records to import.");
      return;
    }

    setIsSavingTeacherImport(true);
    try {
      const recordsToInsert = teacherImportSummary.valid.map(r => ({
        request_type: "teacher",
        first_name: r.first_name,
        middle_name: r.middle_name || null,
        last_name: r.last_name,
        suffix: r.suffix || null,
        email: r.email,
        employee_id: r.employee_id || null,
        lrn: r.employee_id || null,
        status: "pending",
        source: "masterlist"
      }));

      const { error } = await db.from("pending_account_requests").insert(recordsToInsert);
      if (error) throw error;

      toast.success(`Successfully imported ${recordsToInsert.length} teacher registration request(s)!`, { duration: 5000 });

      setShowTeacherImportModal(false);
      await fetchRegistrationRequests();
      setActiveTab("RegistrationRequests");
      setRegistrationSubTab("pending");
    } catch (err) {
      console.error("Error importing teacher registration requests:", err);
      toast.error(getApiErrorMessage(err, "Failed to import teacher registration requests."));
    } finally {
      setIsSavingTeacherImport(false);
    }
  };

  useEffect(() => {
    if (showAddModal || showEditModal || showViewModal || showAssignModal || showDeleteConfirm || showResetPasswordModal || showViewRequestModal || showApproveRequestModal || showRejectRequestModal || showTeacherImportModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAddModal, showEditModal, showViewModal, showAssignModal, showDeleteConfirm, showResetPasswordModal, showViewRequestModal, showApproveRequestModal, showRejectRequestModal, showTeacherImportModal]);

  const isLettersOnly = (value) => /^[A-Za-z\s.\-]+$/.test(value);
  const isValidAssignedClass = (value) => /^[A-Za-z0-9][A-Za-z0-9\s./-]*$/.test(value);
  const composeTeacherName = (formData) => [formData.first_name, formData.middle_name, formData.last_name, formData.suffix].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
  const formatTeacherFullName = (teacher) => {
    if (!teacher) return "Unknown teacher";

    const firstName = String(teacher.first_name ?? "").trim();
    const middleName = String(teacher.middle_name ?? "").trim();
    const lastName = String(teacher.last_name ?? "").trim();
    const suffix = String(teacher.suffix ?? "").trim();
    const combined = [firstName, middleName, lastName, suffix].filter(Boolean).join(" ").trim();

    if (combined) return combined;

    const fullNameFallbacks = [
      teacher.full_name,
      teacher.display_name,
      teacher.teacher_name,
      teacher.name
    ];

    for (const fallback of fullNameFallbacks) {
      const normalized = String(fallback ?? "").trim();
      if (normalized) {
        return normalized;
      }
    }

    const emailPrefix = String(teacher.email ?? "").trim().split("@")[0];
    return emailPrefix || "Unknown teacher";
  };
  const getTeacherName = (teacher) => formatTeacherFullName(teacher);
  const normalizeTeacherStatus = (status) => {
    const normalized = String(status ?? "").trim().toLowerCase();
    return normalized === "inactive" ? "Inactive" : "Active";
  };
  const isTeacherActive = (status) => normalizeTeacherStatus(status) === "Active";
  const getSubjectLabel = (subjectId) => {
    const subject = availableSubjects.find((item) => item.id === subjectId);
    if (!subject) return null;
    return `${subject.code} - ${subject.name} (${subject.grade_level || "No grade assigned"} - ${subject.section || "All Sections"})`;
  };
  const splitTeacherName = (teacherOrName) => {
    if (typeof teacherOrName === "object" && teacherOrName !== null) {
      return {
        first_name: teacherOrName.first_name || "",
        middle_name: teacherOrName.middle_name || "",
        last_name: teacherOrName.last_name || "",
        suffix: teacherOrName.suffix || ""
      };
    }
    const fullName = String(teacherOrName ?? "").trim();
    const parts = fullName.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return { first_name: "", middle_name: "", last_name: "", suffix: "" };
    }

    if (parts.length === 1) {
      return { first_name: parts[0], middle_name: "", last_name: "", suffix: "" };
    }

    return {
      first_name: parts[0],
      middle_name: parts.slice(1, -1).join(" "),
      last_name: parts[parts.length - 1],
      suffix: ""
    };
  };
  const normalizePhone = (value) => value.replace(/\D/g, "").slice(0, 11);
  const normalizeGradeForCompare = (value) => {
    if (!value) return "";
    const v = String(value || "").trim().toLowerCase();
    const digits = v.match(/([0-9]{1,2})/);
    if (digits) return `grade ${digits[1]}`;
    return v.replace(/grade|year|level|\s+/g, " ").trim();
  };
  const normalizeGradeLevel = (value) => {
    const v = String(value || "").trim();
    if (!v) return "";
    const digits = v.match(/\d+/);
    if (digits) return String(digits[0]);
    return v.toLowerCase().replace(/grade|year|level|\s+/g, "").trim();
  };

  const extractGradeFromText = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    const labeled = text.match(/(?:grade|year)\s*([0-9]{1,2})/i);
    if (labeled) return labeled[1];
    const numericOnly = text.match(/^([1-9]|1[0-2])$/);
    if (numericOnly) return numericOnly[1];
    const digits = text.match(/\d{1,2}/);
    if (digits) return digits[0];
    return "";
  };

  const loadSectionsForGrade = useCallback(async (gradeLevel) => {
    if (!gradeLevel) return;
    const normGrade = normalizeGradeLevel(gradeLevel);
    if (!normGrade) return;

    setLoadingSectionsMap((prev) => ({ ...prev, [normGrade]: true }));
    try {
      const { data } = await adminApi.db("grade_sections", "select", {
        eq: { column: "grade_level", value: normGrade }
      });
      const dbSections = (data || []).map((s) => s.section_name).filter(Boolean);
      const subjectSections = availableSubjects
        .filter((s) => normalizeGradeLevel(s.grade_level) === normGrade && s.section)
        .map((s) => s.section)
        .filter(Boolean);

      const merged = [...new Set([...dbSections, ...subjectSections])].sort();
      setGradeSectionsMap((prev) => ({ ...prev, [normGrade]: merged }));
    } catch (err) {
      console.error("[TeacherManagement] Error loading sections for grade:", err);
    } finally {
      setLoadingSectionsMap((prev) => ({ ...prev, [normGrade]: false }));
    }
  }, [availableSubjects]);

  const resolveSubjectId = useCallback((subjectCode, section, gradeLevel) => {
    if (!subjectCode) return "";
    const normGrade = normalizeGradeLevel(gradeLevel);
    const codeLow = String(subjectCode).toLowerCase().trim();
    const secLow = String(section || "").toLowerCase().trim();

    const exactMatch = availableSubjects.find((s) => {
      const sGrade = normalizeGradeLevel(s.grade_level);
      const sCode = String(s.code || s.name || s.id).toLowerCase().trim();
      const sSec = String(s.section || "").toLowerCase().trim();
      return sGrade === normGrade && (sCode === codeLow || String(s.id).toLowerCase() === codeLow) && sSec === secLow;
    });
    if (exactMatch) return exactMatch.id;

    const codeMatch = availableSubjects.find((s) => {
      const sGrade = normalizeGradeLevel(s.grade_level);
      const sCode = String(s.code || s.name || s.id).toLowerCase().trim();
      return sGrade === normGrade && (sCode === codeLow || String(s.id).toLowerCase() === codeLow);
    });
    if (codeMatch) return codeMatch.id;

    const idMatch = availableSubjects.find((s) => String(s.id) === String(subjectCode));
    if (idMatch) return idMatch.id;

    return subjectCode;
  }, [availableSubjects]);
  const normalizeSubjects = (value) => {
    let rawArray = [];
    if (Array.isArray(value)) {
      rawArray = value;
    } else if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) rawArray = parsed;
        else rawArray = value.replace(/[{}]/g, "").split(",");
      } catch {
        rawArray = value.replace(/[{}]/g, "").split(",");
      }
    } else if (value && typeof value === "object") {
      rawArray = [value];
    }

    return rawArray
      .map((item) => {
        if (item && typeof item === "object") {
          return String(item.subjectId || item.value || item.id || item.code || item.name || "").trim();
        }
        return String(item || "").trim();
      })
      .filter((item) => {
        if (!item) return false;
        const low = item.toLowerCase();
        return low !== "null" && low !== "undefined" && low !== "select teacher" && low !== "select subject" && low !== "[object object]";
      });
  };
  const normalizeAssignedClasses = (value) => {
    if (Array.isArray(value)) {
      return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
    }

    if (typeof value === "string") {
      return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
    }

    return [];
  };
  const formatAssignedClasses = (value) => normalizeAssignedClasses(value).join(", ");
  const hasAssignedClass = (value, className) => normalizeAssignedClasses(value).some((entry) => entry.toLowerCase() === String(className || "").trim().toLowerCase());
  const formatSubjects = (subjects) => normalizeSubjects(subjects).map(getSubjectLabel).filter(Boolean).join(", ");
  const getTeacherAssignments = (teacher) => {
    const assignedClasses = normalizeAssignedClasses(teacher.assigned_class);
    const teacherGrade = teacher.grade_level || teacher.year_level || "";
    const teacherSubjects = normalizeSubjects(teacher.subjects);

    const subjectEntries = teacherSubjects.map((subjectId) => {
      const subject = availableSubjects.find((item) => String(item.id) === String(subjectId) || String(item.code || "").toLowerCase() === String(subjectId).toLowerCase());
      const subjGrade = subject?.grade_level || teacherGrade;
      const subjSection = subject?.section;
      const fullLabel = subjGrade ? (subjSection ? `${subjGrade} - ${subjSection}` : subjGrade) : (subjSection || teacherGrade);
      return {
        subjectLabel: getSubjectLabel(subjectId),
        gradeLevel: fullLabel
      };
    });

    const classEntries = assignedClasses.map((className) => ({
      classLabel: className,
      gradeLevel: className.toLowerCase().includes("grade") ? className : (teacherGrade ? `${teacherGrade} - ${className}` : className)
    }));

    const allGradeLevels = [...new Set([
      ...subjectEntries.map(s => s.gradeLevel),
      ...classEntries.map(c => c.gradeLevel)
    ].filter(Boolean))];

    if (allGradeLevels.length === 0 && teacherGrade) {
      allGradeLevels.push(teacherGrade);
    }

    const maxLen = Math.max(classEntries.length, subjectEntries.length, allGradeLevels.length, 1);
    const result = [];

    for (let i = 0; i < maxLen; i += 1) {
      result.push({
        classLabel: allGradeLevels[i] || classEntries[i]?.classLabel || teacherGrade || "",
        subjectLabel: subjectEntries[i]?.subjectLabel || "",
        gradeLevel: allGradeLevels[i] || subjectEntries[i]?.gradeLevel || classEntries[i]?.gradeLevel || teacherGrade
      });
    }

    return result;
  };
  const validateTeacherField = (field, value, formData) => {
    const nextValue = String(value ?? "");
    switch (field) {
      case "first_name":
        if (!nextValue.trim()) return "First name is required";
        if (!isLettersOnly(nextValue.trim())) return "First name can only contain letters";
        return "";
      case "middle_name":
        if (!nextValue.trim()) return "";
        if (!isLettersOnly(nextValue.trim())) return "Middle name can only contain letters";
        return "";
      case "last_name":
        if (!nextValue.trim()) return "Last name is required";
        if (!isLettersOnly(nextValue.trim())) return "Last name can only contain letters";
        return "";
      case "suffix":
        if (!nextValue.trim()) return "";
        if (!/^[A-Za-z0-9\s.\-]+$/.test(nextValue.trim())) return "Suffix can only contain letters, numbers, and periods";
        return "";
      case "employee_id":
        return "";
      case "email":
        if (!nextValue.trim()) return "Email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextValue.trim().toLowerCase())) return "Invalid email format";
        return "";
      case "phone": {
        const normalized = normalizePhone(nextValue);
        if (!normalized) return "Phone number is required";
        if (normalized.length !== 11) return "Phone number must be exactly 11 digits";
        return "";
      }
      case "subjects":
        if (normalizeSubjects(value).length === 0 && (!Array.isArray(value) || value.length === 0)) return "At least one subject & section assignment is required";
        return "";
      case "status":
        return nextValue ? "" : "Status is required";
      case "assigned_class": {
        const assignedClass = nextValue.trim();
        if (!assignedClass) return "";
        if (!isValidAssignedClass(assignedClass)) return "Assigned class or section is invalid";
        return "";
      }
      case "grade_level": {
        if (!nextValue || !String(nextValue).trim()) return "Grade level is required";
        return "";
      }
      default:
        return "";
    }
  };

  const updateTeacherField = (setData, setErrors, formData, field, value) => {
    let nextValue = field === "phone" ? normalizePhone(value) : value;
    const nextFormData = { ...formData, [field]: nextValue };

    if (field === "grade_level") {
      const newGradeNorm = normalizeGradeLevel(value);
      if (value) {
        loadSectionsForGrade(value);
      }

      const currentRows = Array.isArray(nextFormData.subjects) ? nextFormData.subjects : [];
      const revalidatedRows = currentRows.map((row) => {
        if (!row || typeof row !== "object") {
          return { id: generateUUID(), subjectId: "", subjectCode: "", section: "" };
        }

        const subj = availableSubjects.find(
          (s) => String(s.id) === String(row.subjectId) || String(s.code || "").toLowerCase() === String(row.subjectCode || "").toLowerCase()
        );
        const subjGradeNorm = normalizeGradeLevel(subj?.grade_level || "");

        if (subjGradeNorm && subjGradeNorm !== newGradeNorm) {
          return { ...row, subjectId: "", subjectCode: "", section: "" };
        }

        const validSections = gradeSectionsMap[newGradeNorm] || [];
        if (row.section && validSections.length > 0 && !validSections.includes(row.section)) {
          return { ...row, section: "" };
        }

        return row;
      });

      nextFormData.subjects = revalidatedRows;
    }

    const nextError = validateTeacherField(field, nextFormData[field], nextFormData);

    setData(nextFormData);
    setErrors((current) => {
      const updatedErrors = { ...current };
      if (nextError) {
        updatedErrors[field] = nextError;
      } else {
        delete updatedErrors[field];
      }

      if (field === "grade_level") {
        const subjErr = validateTeacherField("subjects", nextFormData.subjects, nextFormData);
        if (subjErr) updatedErrors.subjects = subjErr;
        else delete updatedErrors.subjects;
      }
      return updatedErrors;
    });
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const fetchSubjects = async () => {
    if (!db) {
      throw new Error("Supabase client is not configured.");
    }

    const { data, error } = await db
      .from("subjects")
      .select("*")
      .order("code", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const activeSubjects = (data ?? []).filter((s) => String(s.status || "Active").toLowerCase() !== "archived");
    setAvailableSubjects(activeSubjects);
    console.log("[TeacherManagement] fetched active subjects:", activeSubjects.map((s) => ({ id: s.id, code: s.code, name: s.name, grade_level: s.grade_level, year_level: s.year_level, grade: s.grade, year: s.year, section: s.section })));
  };

  const refreshTeacherSubjectsFromDatabase = async (teacherIds) => {
    if (!db) {
      throw new Error("Supabase client is not configured.");
    }

    const uniqueTeacherIds = [...new Set(normalizeSubjects(teacherIds))];
    if (uniqueTeacherIds.length === 0) {
      return;
    }

    const { data: subjectRows, error: subjectError } = await db
      .from("subjects")
      .select("id, teacher_id, grade_level, section, status")
      .in("teacher_id", uniqueTeacherIds);

    if (subjectError) {
      throw new Error(subjectError.message);
    }

    await Promise.all(uniqueTeacherIds.map(async (teacherId) => {
      const teacherSubjectRows = (subjectRows ?? [])
        .filter((subject) => String(subject.teacher_id) === String(teacherId) && String(subject.status || "Active").toLowerCase() !== "archived");
      const assignedSubjectIds = [...new Set(teacherSubjectRows.map((subject) => String(subject.id || "").trim()).filter(Boolean))];
      const assignedSectionsList = [...new Set(teacherSubjectRows.map((s) => s.section).filter(Boolean))];
      const assignedGradeLevels = [...new Set(teacherSubjectRows.map((s) => s.grade_level).filter(Boolean))];

      const profilePayload = {
        subjects: assignedSubjectIds,
        assigned_class: assignedSectionsList.join(", ") || null
      };

      if (assignedGradeLevels.length > 0) {
        profilePayload.year_level = assignedGradeLevels[0];
      }

      console.log("[TeacherManagement] refreshing teacher subjects", {
        teacherId,
        profilePayload
      });

      const { error: updateError } = await adminApi.updateProfile(teacherId, profilePayload);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }));
  };

  const syncTeacherSubjectAssignments = async ({ teacherId, previousSubjectIds = [], nextSubjectIds = [] }) => {
    if (!db) {
      throw new Error("Supabase client is not configured.");
    }

    const previousIds = [...new Set(normalizeSubjects(previousSubjectIds))];
    const nextIds = [...new Set(normalizeSubjects(nextSubjectIds))];
    const addSubjectIds = nextIds.filter((id) => !previousIds.includes(id));

    const { data: dbTeacherSubjs } = await db
      .from("subjects")
      .select("id, teacher_id")
      .eq("teacher_id", teacherId);

    const dbAssignedIds = (dbTeacherSubjs ?? []).map((s) => s.id);
    const removeSubjectIds = [...new Set([
      ...previousIds.filter((id) => !nextIds.includes(id)),
      ...dbAssignedIds.filter((id) => !nextIds.includes(id))
    ])];

    const affectedSubjectIds = [...new Set([...previousIds, ...nextIds, ...dbAssignedIds])];

    if (affectedSubjectIds.length === 0) {
      await refreshTeacherSubjectsFromDatabase([teacherId]);
      return { affectedTeacherIds: [teacherId] };
    }

    const { data: currentSubjects, error: subjectFetchError } = await db
      .from("subjects")
      .select("id, teacher_id")
      .in("id", affectedSubjectIds);

    if (subjectFetchError) {
      throw new Error(subjectFetchError.message);
    }

    const snapshot = new Map((currentSubjects ?? []).map((subject) => {
      const t = String(subject.teacher_id || "").trim();
      const cleanTeacherId = (!t || t.toLowerCase() === "null" || t.toLowerCase() === "undefined") ? null : t;
      return [subject.id, cleanTeacherId];
    }));
    const displacedTeacherIds = new Set();

    if (addSubjectIds.length > 0) {
      try {
        const { data: teacherRow } = await db.from("profiles").select("year_level").eq("id", teacherId).maybeSingle();
        const teacherGradeNorm = normalizeGradeLevel(String(teacherRow?.year_level || ""));

        if (teacherGradeNorm) {
          const { data: subjectsToAdd } = await db.from("subjects").select("id, grade_level").in("id", addSubjectIds);
          const mismatch = (subjectsToAdd ?? []).some((s) => {
            const subjGradeRaw = String(s?.grade_level || "").trim();
            return subjGradeRaw && normalizeGradeLevel(subjGradeRaw) !== teacherGradeNorm;
          });
          if (mismatch) {
            throw new Error("One or more subjects being assigned do not match the teacher's grade level.");
          }
        }
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to validate subject grade parity.");
      }
    }

    try {
      if (addSubjectIds.length > 0) {
        console.log("[TeacherManagement] assigning subjects", { teacherId, addSubjectIds });
        const { error: assignError } = await adminApi.db("subjects", "update", {
          payload: { teacher_id: teacherId },
          in: { column: "id", value: addSubjectIds }
        });

        if (assignError) {
          throw new Error(assignError.message);
        }

        await adminApi.db("teacher_student_assignments", "update", {
          payload: { teacher_id: teacherId },
          in: { column: "subject_id", value: addSubjectIds }
        }).catch(() => {});
      }

      if (removeSubjectIds.length > 0) {
        console.log("[TeacherManagement] removing subjects", { teacherId, removeSubjectIds });
        const { error: removeError } = await adminApi.db("subjects", "update", {
          payload: { teacher_id: null },
          in: { column: "id", value: removeSubjectIds }
        });

        if (removeError) {
          throw new Error(removeError.message);
        }

        await adminApi.db("teacher_student_assignments", "update", {
          payload: { teacher_id: null },
          in: { column: "subject_id", value: removeSubjectIds }
        }).catch(() => {});
      }

      (currentSubjects ?? []).forEach((subject) => {
        if (nextIds.includes(subject.id) && subject.teacher_id && String(subject.teacher_id) !== String(teacherId)) {
          displacedTeacherIds.add(subject.teacher_id);
        }
      });

      await refreshTeacherSubjectsFromDatabase([teacherId, ...displacedTeacherIds]);
      return { affectedTeacherIds: [teacherId, ...displacedTeacherIds] };
    } catch (error) {
      await Promise.all((currentSubjects ?? []).map(async (subject) => {
        const { error: restoreError } = await adminApi.db("subjects", "update", {
          payload: { teacher_id: snapshot.get(subject.id) ?? null },
          eq: { column: "id", value: subject.id }
        });

        if (restoreError) {
          throw new Error(restoreError.message);
        }
      }));

      throw error instanceof Error ? error : new Error("Unable to synchronize teacher subjects.");
    }
  };

  const fetchTeachers = async () => {
    if (!db) {
      throw new Error("Supabase client is not configured.");
    }

    let { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("role", "teacher")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    setTeachers((data ?? []).map((teacher) => {
      const dbTeacherSubjs = availableSubjects.filter((s) => String(s.teacher_id || "") === String(teacher.id) && String(s.status || "Active").toLowerCase() !== "archived");
      const dbSubjIds = dbTeacherSubjs.map((s) => s.id);
      const dbSections = [...new Set(dbTeacherSubjs.map((s) => s.section).filter(Boolean))].join(", ");
      const mergedSubjects = [...new Set([...normalizeSubjects(teacher.subjects), ...dbSubjIds])];
      const mergedClass = teacher.assigned_class || dbSections || "";
      const mergedGrade = teacher.grade_level || teacher.year_level || dbTeacherSubjs[0]?.grade_level || "";

      return {
        ...teacher,
        display_name: formatTeacherFullName(teacher),
        status: normalizeTeacherStatus(teacher.status),
        subjects: mergedSubjects,
        assigned_class: mergedClass,
        grade_level: mergedGrade
      };
    }));
  };

  const validateTeacherForm = async (formData, excludeId = null, options = {}) => {
    const { requireSubjects = false } = options;
    const errors = {};
    const trimmedFirstName = String(formData.first_name || "").trim();
    const trimmedMiddleName = String(formData.middle_name || "").trim();
    const trimmedLastName = String(formData.last_name || "").trim();
    const trimmedEmail = String(formData.email || "").trim().toLowerCase();
    const normalizedPhone = normalizePhone(formData.phone || "");

    const rawRows = Array.isArray(formData.subjects) ? formData.subjects : [];
    const assignmentRows = rawRows.map((item) => {
      if (item && typeof item === "object") {
        return {
          subjectId: item.subjectId || "",
          subjectCode: item.subjectCode || "",
          section: item.section || ""
        };
      }
      return { subjectId: String(item || ""), subjectCode: String(item || ""), section: "" };
    });

    const normalizedSubjects = assignmentRows
      .map((r) => r.subjectCode || r.subjectId)
      .filter(Boolean);

    const assignedClassList = rawRows
      .map((r) => (typeof r === "object" ? r.section : ""))
      .filter(Boolean);
    const assignedClass = formData.assigned_class
      ? String(formData.assigned_class).trim()
      : [...new Set(assignedClassList)].join(", ");

    if (requireSubjects && assignmentRows.length === 0) {
      errors.subjects = "At least one subject & section assignment is required.";
    }

    const normGrade = normalizeGradeLevel(formData.grade_level);
    const availableSectionsForGrade = gradeSectionsMap[normGrade] || [];
    const seenCombos = new Set();

    for (let i = 0; i < assignmentRows.length; i++) {
      const row = assignmentRows[i];
      if (row.subjectCode && !row.section && availableSectionsForGrade.length > 0) {
        errors.subjects = `Assignment #${i + 1}: Please select a Section for the assigned Subject.`;
        break;
      }
      if (!row.subjectCode && row.section) {
        errors.subjects = `Assignment #${i + 1}: Please select a Subject for Section "${row.section}".`;
        break;
      }

      if (row.subjectCode) {
        const comboKey = `${row.subjectCode.toLowerCase()}___${(row.section || "").toLowerCase()}`;
        if (seenCombos.has(comboKey)) {
          errors.subjects = `Duplicate assignment: Subject and Section "${row.section || 'All'}" is assigned more than once.`;
          break;
        }
        seenCombos.add(comboKey);

        const valLow = String(row.subjectCode || row.subjectId).toLowerCase().trim();
        const matchedSubj = availableSubjects.find((s) => {
          const sGrade = normalizeGradeLevel(s.grade_level);
          const sCode = String(s.code || s.name || s.id).toLowerCase().trim();
          return sGrade === normGrade && (sCode === valLow || String(s.id).toLowerCase() === valLow);
        });

        if (matchedSubj && matchedSubj.section && row.section) {
          const defSecLow = String(matchedSubj.section).toLowerCase().trim();
          const rowSecLow = String(row.section).toLowerCase().trim();
          if (defSecLow !== rowSecLow) {
            errors.subjects = `Subject "${matchedSubj.code || matchedSubj.name}" is defined only for Section "${matchedSubj.section}".`;
            break;
          }
        }

        const resolvedSubjId = resolveSubjectId(row.subjectCode || row.subjectId, row.section, formData.grade_level);
        const subjObj = availableSubjects.find((s) => String(s.id) === String(resolvedSubjId));
        if (subjObj && subjObj.teacher_id && String(subjObj.teacher_id) !== String(excludeId || "")) {
          const conflictingTeacher = teachers.find((t) => String(t.id) === String(subjObj.teacher_id));
          
          if (conflictingTeacher) {
            const confGradeNorm = normalizeGradeLevel(conflictingTeacher.grade_level || conflictingTeacher.year_level || "");
            const confSubjs = normalizeSubjects(conflictingTeacher.subjects);
            const subjGradeNorm = normalizeGradeLevel(subjObj.grade_level || "");

            if ((confGradeNorm && subjGradeNorm && confGradeNorm !== subjGradeNorm) ||
                (confSubjs.length > 0 && !confSubjs.includes(subjObj.id) && !confSubjs.includes(subjObj.code))) {
              adminApi.db("subjects", "update", { payload: { teacher_id: null }, eq: { column: "id", value: subjObj.id } }).catch(() => {});
              subjObj.teacher_id = null;
            } else {
              const teacherName = getTeacherName(conflictingTeacher);
              errors.subjects = `Subject "${subjObj.code || subjObj.name}" (${subjObj.section || 'All'}) is already assigned to ${teacherName}.`;
              break;
            }
          }
        }
      }
    }

    if (!formData.status) {
      errors.status = "Status is required";
    }

    const trimmedSuffix = (formData.suffix || "").trim();
    if (trimmedSuffix && !/^[A-Za-z0-9\s.\-]+$/.test(trimmedSuffix)) {
      errors.suffix = "Suffix can only contain letters, numbers, and periods";
    }

    const trimmedEmpId = (formData.employee_id || "").trim();

    if (assignedClass && !isValidAssignedClass(assignedClass)) {
      errors.assigned_class = "Assigned class or section is invalid";
    }

    if (formData.grade_level && normalizedSubjects.length > 0) {
      try {
        const teacherGradeNorm = normalizeGradeLevel(formData.grade_level);
        const mismatch = normalizedSubjects.some((subjRef) => {
          const subj = availableSubjects.find((s) =>
            String(s.id) === String(subjRef) ||
            String(s.code || "").toLowerCase() === String(subjRef).toLowerCase() ||
            `${s.code} - ${s.name} (${s.section || "All Sections"})`.toLowerCase() === String(subjRef).toLowerCase()
          );
          if (!subj) return false;
          if (excludeId && String(subj.teacher_id || "") === String(excludeId)) return false;
          const subjGradeRaw = String(subj.grade_level || "").trim();
          return subjGradeRaw && normalizeGradeLevel(subjGradeRaw) !== teacherGradeNorm;
        });

        if (mismatch) {
          errors.subjects = "One or more selected subjects do not match the teacher's grade level.";
        }
      } catch (err) {
        console.warn("Grade mismatch check error:", err);
      }
    }

    if (Object.keys(errors).length > 0) {
      return errors;
    }

    if (!db) {
      errors.form = "Supabase client is not configured.";
      return errors;
    }

    if (trimmedEmpId) {
      try {
        let empQuery = db.from("profiles").select("id").eq("employee_id", trimmedEmpId).limit(1);
        if (excludeId) empQuery = empQuery.neq("id", excludeId);
        const empResult = await empQuery;
        if (!empResult.error && empResult.data && empResult.data.length > 0) {
          errors.employee_id = "Employee ID / Identification already exists";
        } else if (empResult.error && (empResult.error.message?.includes("employee_id") || empResult.error.message?.includes("schema cache") || empResult.error.code === "42703")) {
          let lrnQuery = db.from("profiles").select("id").eq("lrn", trimmedEmpId).eq("role", "teacher").limit(1);
          if (excludeId) lrnQuery = lrnQuery.neq("id", excludeId);
          const lrnResult = await lrnQuery;
          if (!lrnResult.error && lrnResult.data && lrnResult.data.length > 0) {
            errors.employee_id = "Employee ID / Identification already exists";
          }
        }
      } catch (e) {
        console.warn("Employee ID uniqueness check error:", e);
      }
    }

    if (!trimmedEmail) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    } else if (trimmedEmail) {
      try {
        let emailQuery = db.from("profiles").select("id").ilike("email", trimmedEmail).limit(1);
        if (excludeId) emailQuery = emailQuery.neq("id", excludeId);
        const emailResult = await emailQuery;

        if (emailResult.data && emailResult.data.length > 0) {
          errors.email = "An account with this email address already exists.";
        } else {
          let pendingEmailQuery = db.from("pending_account_requests").select("id").ilike("email", trimmedEmail).eq("status", "pending").limit(1);
          if (excludeId) pendingEmailQuery = pendingEmailQuery.neq("id", excludeId);
          const pendingResult = await pendingEmailQuery;
          if (pendingResult.data && pendingResult.data.length > 0) {
            errors.email = "A pending registration request with this email address already exists.";
          }
        }
      } catch (e) {
        console.warn("Email uniqueness check error:", e);
      }
    }

    return errors;
  };

  const fetchRegistrationRequests = useCallback(async () => {
    try {
      const res = await adminApi.db("pending_account_requests", "select", {
        payload: "*",
        eq: { column: "request_type", value: "teacher" },
        order: { column: "created_at", options: { ascending: false } }
      });
      if (res.error) {
        console.error("Error fetching teacher registration requests via adminApi:", res.error);
        return [];
      }
      return res.data || [];
    } catch (err) {
      console.error("Fetch teacher registration requests exception:", err);
      return [];
    }
  }, []);

  const fetchTeachersData = useCallback(async () => {
    if (!db) return null;
    let teachersRes = await db.from("profiles").select("*").eq("role", "teacher").order("created_at", { ascending: false });

    const [subjectsRes, requestsData] = await Promise.all([
      db.from("subjects").select("*").order("code", { ascending: true }),
      fetchRegistrationRequests()
    ]);
    const allSubjects = (subjectsRes.data ?? []).filter((s) => String(s.status || "Active").toLowerCase() !== "archived");

    if (teachersRes.error) throw new Error(teachersRes.error.message);

    const formattedTeachers = (teachersRes.data ?? []).map((teacher) => {
      const dbTeacherSubjs = allSubjects.filter((s) => String(s.teacher_id || "") === String(teacher.id));
      const dbSubjIds = dbTeacherSubjs.map((s) => s.id);
      const dbSections = [...new Set(dbTeacherSubjs.map((s) => s.section).filter(Boolean))].join(", ");
      const mergedSubjects = [...new Set([...normalizeSubjects(teacher.subjects), ...dbSubjIds])];
      const mergedClass = teacher.assigned_class || dbSections || "";
      const mergedGrade = teacher.grade_level || teacher.year_level || dbTeacherSubjs[0]?.grade_level || "";

      return {
        ...teacher,
        display_name: formatTeacherFullName(teacher),
        status: normalizeTeacherStatus(teacher.status),
        subjects: mergedSubjects,
        assigned_class: mergedClass,
        grade_level: mergedGrade
      };
    });

    return {
      teachers: formattedTeachers,
      subjects: allSubjects,
      registrationRequests: requestsData ?? []
    };
  }, [fetchRegistrationRequests]);

  const { data: cachedTeachersData, loading: isCachedLoading } = useCachedFetch("admin_teachers_data", fetchTeachersData);

  useEffect(() => {
    if (cachedTeachersData) {
      setTeachers(cachedTeachersData.teachers || []);
      setAvailableSubjects(cachedTeachersData.subjects || []);
      setRegistrationRequests(cachedTeachersData.registrationRequests || []);
      setLoading(false);
    } else {
      setLoading(isCachedLoading);
    }
  }, [cachedTeachersData, isCachedLoading]);

  useEffect(() => {
    if (activeTab === "RegistrationRequests") {
      fetchRegistrationRequests().then((reqs) => {
        if (Array.isArray(reqs)) {
          setRegistrationRequests(reqs);
        }
      });
    }
  }, [activeTab, fetchRegistrationRequests]);

  // Realtime subscription for teacher data, registrations, and subjects
  useEffect(() => {
    if (!db) return;

    const channel = db
      .channel("admin-teachers-realtime-v1")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_account_requests" },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new?.request_type === "teacher") {
            toast.info("New teacher registration received");
          }
          fetchRegistrationRequests().then((reqs) => {
            if (Array.isArray(reqs)) setRegistrationRequests(reqs);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.new?.role === "teacher" || payload.old?.role === "teacher") {
            refreshTeachers();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subjects" },
        () => {
          refreshTeachers();
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [fetchRegistrationRequests]);

  const refreshTeachers = async () => {
    if (!db) return;
    try {
      setFetchError(null);
      const [teachersRes, subjectsRes, requestsData] = await Promise.all([
        db.from("profiles").select("*").eq("role", "teacher").order("created_at", { ascending: false }),
        db.from("subjects").select("*").order("code", { ascending: true }),
        fetchRegistrationRequests()
      ]);

      if (teachersRes.error) throw new Error(teachersRes.error.message);

      const data = teachersRes.data ?? [];
      const allSubjects = (subjectsRes.data ?? []).filter((s) => String(s.status || "Active").toLowerCase() !== "archived");
      setAvailableSubjects(allSubjects);
      setRegistrationRequests(requestsData ?? []);
      const formattedTeachers = data.map((teacher) => {
        const dbTeacherSubjs = allSubjects.filter((s) => String(s.teacher_id || "") === String(teacher.id));
        const dbSubjIds = dbTeacherSubjs.map((s) => s.id);
        const dbSections = [...new Set(dbTeacherSubjs.map((s) => s.section).filter(Boolean))].join(", ");
        const mergedSubjects = [...new Set([...normalizeSubjects(teacher.subjects), ...dbSubjIds])];
        const mergedClass = teacher.assigned_class || dbSections || "";
        const mergedGrade = teacher.grade_level || teacher.year_level || dbTeacherSubjs[0]?.grade_level || "";
        return {
          ...teacher,
          display_name: formatTeacherFullName(teacher),
          status: normalizeTeacherStatus(teacher.status),
          subjects: mergedSubjects,
          assigned_class: mergedClass,
          grade_level: mergedGrade
        };
      });
      setTeachers(formattedTeachers);
    } catch (err) {
      console.error("refreshTeachers error:", err);
      setFetchError(err.message || "Failed to fetch teacher data.");
    }
  };

  const filteredRegistrationRequests = useMemo(() => {
    return registrationRequests.filter((req) => {
      if (req.status !== registrationSubTab) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${req.first_name || ""} ${req.middle_name || ""} ${req.last_name || ""} ${req.suffix || ""}`.toLowerCase();
        const email = (req.email || "").toLowerCase();
        const empId = (req.employee_id || req.lrn || "").toLowerCase();
        return fullName.includes(q) || email.includes(q) || empId.includes(q);
      }

      return true;
    });
  }, [registrationRequests, registrationSubTab, searchQuery]);

  const handleApproveRegistrationRequest = async () => {
    if (!selectedRequest) return;
    setIsProcessingRequest(true);
    try {
      const userData = localStorage.getItem("currentUser");
      const adminUser = userData ? JSON.parse(userData) : null;
      const adminId = adminUser?.id;

      const res = await adminApi.approveTeacherRegistration({
        request_id: selectedRequest.id,
        requestId: selectedRequest.id,
        adminId
      });

      if (res.error) {
        throw new Error(res.error.message || res.error || "Failed to approve registration request.");
      }

      const isEmailSent = Boolean(res.emailSent || res.email_sent || res.data?.emailSent || res.data?.email_sent);
      const emailNotice = res.emailNotice || res.data?.emailNotice;
      const teacherFullName = `${selectedRequest.first_name || ""} ${selectedRequest.last_name || ""}`.trim();

      if (isEmailSent) {
        toast.success(`Teacher registration approved for ${teacherFullName}. Account created & credentials emailed!`);
      } else {
        toast.warning(`Teacher registration approved for ${teacherFullName}, but email failed: ${emailNotice || "Check Resend domain setup."}`);
      }
      setShowApproveRequestModal(false);
      setShowViewRequestModal(false);
      setSelectedRequest(null);
      await refreshTeachers();
    } catch (err) {
      console.error("Approve registration error:", err);
      toast.error(err.message || "Failed to approve teacher registration.");
    } finally {
      setIsProcessingRequest(false);
    }
  };

  const handleRejectRegistrationRequest = async () => {
    if (!selectedRequest) return;
    setIsProcessingRequest(true);
    try {
      const userData = localStorage.getItem("currentUser");
      const adminUser = userData ? JSON.parse(userData) : null;
      const adminId = adminUser?.id;

      const res = await adminApi.rejectTeacherRegistration({
        request_id: selectedRequest.id,
        requestId: selectedRequest.id,
        adminId,
        rejection_reason: rejectionReasonInput.trim(),
        rejectionReason: rejectionReasonInput.trim()
      });

      if (res.error) {
        throw new Error(res.error.message || res.error || "Failed to reject registration request.");
      }

      const isEmailSent = Boolean(res.emailSent || res.email_sent || res.data?.emailSent || res.data?.email_sent);
      const emailNotice = res.emailNotice || res.data?.emailNotice;
      const teacherFullName = `${selectedRequest.first_name || ""} ${selectedRequest.last_name || ""}`.trim();

      if (isEmailSent) {
        toast.success(`Teacher registration rejected for ${teacherFullName}. Teacher notified by email.`);
      } else {
        toast.warning(`Teacher registration rejected for ${teacherFullName}, but email failed: ${emailNotice || "Check Resend domain setup."}`);
      }
      setShowRejectRequestModal(false);
      setShowViewRequestModal(false);
      setSelectedRequest(null);
      setRejectionReasonInput("");
      await refreshTeachers();
    } catch (err) {
      console.error("Reject registration error:", err);
      toast.error(err.message || "Failed to reject teacher registration.");
    } finally {
      setIsProcessingRequest(false);
    }
  };

  const handlePrepareTeacherRegistrationRequests = () => {
    const selectedRows = teachers.filter(t => selectedTeacherIds.has(t.id));
    if (selectedRows.length === 0) {
      toast.error("Please select at least one teacher.");
      return;
    }

    const ready = [];
    const missingEmail = [];
    const duplicates = [];

    const existingPendingEmailSet = new Set(
      registrationRequests
        .filter(r => r.status === "pending" || r.status === "approved")
        .map(r => r.email ? String(r.email).trim().toLowerCase() : null)
        .filter(Boolean)
    );
    const existingPendingEmpIdSet = new Set(
      registrationRequests
        .filter(r => r.status === "pending" || r.status === "approved")
        .map(r => (r.employee_id || r.lrn) ? String(r.employee_id || r.lrn).trim().toLowerCase() : null)
        .filter(Boolean)
    );
    const existingProfileEmailSet = new Set(
      teachers.map(t => t.email ? String(t.email).trim().toLowerCase() : null).filter(Boolean)
    );

    selectedRows.forEach(teacher => {
      const email = teacher.email ? String(teacher.email).trim().toLowerCase() : "";
      const empId = (teacher.employee_id || teacher.lrn) ? String(teacher.employee_id || teacher.lrn).trim().toLowerCase() : "";
      const fullName = formatTeacherFullName(teacher);

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        missingEmail.push({ ...teacher, fullName, reason: "Missing or invalid email address" });
        return;
      }

      const isDuplicate =
        (email && (existingPendingEmailSet.has(email) || existingProfileEmailSet.has(email))) ||
        (empId && existingPendingEmpIdSet.has(empId));

      if (isDuplicate) {
        duplicates.push({ ...teacher, fullName, reason: "Pending/approved request or account already exists" });
        return;
      }

      ready.push({ ...teacher, fullName, email, empId });
    });

    setTeacherCreateSummary({
      totalSelected: selectedRows.length,
      ready,
      missingEmail,
      duplicates
    });
    setTeacherCreateTab(ready.length > 0 ? "ready" : (missingEmail.length > 0 ? "missingEmail" : "duplicates"));
    setShowTeacherCreateRequestsModal(true);
  };

  const handleConfirmCreateTeacherRegistrationRequests = async () => {
    const { ready } = teacherCreateSummary;
    if (ready.length === 0) {
      toast.error("No eligible teachers to create registration requests.");
      return;
    }

    setIsCreatingTeacherRequests(true);
    try {
      const recordsToInsert = ready.map(teacher => {
        const { first_name, middle_name, last_name, suffix } = splitTeacherName(teacher);
        return {
          request_type: "teacher",
          first_name: first_name || teacher.first_name || "Teacher",
          middle_name: middle_name || teacher.middle_name || null,
          last_name: last_name || teacher.last_name || "Account",
          suffix: suffix || teacher.suffix || null,
          email: teacher.email,
          employee_id: teacher.empId || null,
          lrn: teacher.empId || null,
          grade_level: teacher.grade_level || null,
          section: teacher.assigned_class || null,
          subjects: Array.isArray(teacher.subjects) && teacher.subjects.length > 0 ? teacher.subjects : null,
          status: "pending",
          source: "masterlist",
          external_request_id: `masterlist-teacher-${teacher.email}`
        };
      });

      const { error } = await adminApi.db("pending_account_requests", "insert", {
        payload: recordsToInsert
      });

      if (error) throw error;

      toast.success(`Successfully created ${recordsToInsert.length} teacher registration request(s)!`, { duration: 5000 });
      setShowTeacherCreateRequestsModal(false);
      setSelectedTeacherIds(new Set());

      setActiveTab("RegistrationRequests");
      setRegistrationSubTab("pending");
      await refreshTeachers();
    } catch (err) {
      console.error("Create teacher registration requests error:", err);
      toast.error(err.message || "Failed to create teacher registration requests.");
    } finally {
      setIsCreatingTeacherRequests(false);
    }
  };

  const handleConfirmBulkTeacherApproval = async () => {
    setShowBulkApproveConfirmModal(false);
    const pendingReqs = registrationRequests.filter(r => r.status === "pending" && selectedPendingRequestIds.has(r.id));
    
    if (pendingReqs.length === 0) {
      toast.error("No pending registration requests selected for approval.");
      return;
    }

    const userData = localStorage.getItem("currentUser");
    const adminUser = userData ? JSON.parse(userData) : null;
    const adminId = adminUser?.id;

    setShowBulkApproveProgressModal(true);
    setBulkApproveProgress({
      total: pendingReqs.length,
      current: 0,
      currentTeacherName: ""
    });

    const summary = {
      total: pendingReqs.length,
      successCount: 0,
      emailSentCount: 0,
      emailFailedCount: 0,
      failures: []
    };

    const BATCH_SIZE = 3;
    for (let i = 0; i < pendingReqs.length; i += BATCH_SIZE) {
      const batch = pendingReqs.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (req, bIdx) => {
          const currentIdx = i + bIdx + 1;
          const teacherName = [req.first_name, req.middle_name, req.last_name].filter(Boolean).join(" ");
          
          setBulkApproveProgress({
            total: pendingReqs.length,
            current: currentIdx,
            currentTeacherName: teacherName
          });

          try {
            const res = await adminApi.approveTeacherRegistration({
              request_id: req.id,
              reviewer_id: adminId
            });

            if (res.error) {
              summary.failures.push({
                id: req.id,
                name: teacherName,
                email: req.email,
                error: res.error.message || "Failed to approve registration"
              });
            } else {
              summary.successCount++;
              if (res.emailSent || res.email_sent) {
                summary.emailSentCount++;
              } else {
                summary.emailFailedCount++;
                summary.failures.push({
                  id: req.id,
                  name: teacherName,
                  email: req.email,
                  error: res.emailNotice || res.notice || "Account created, but credentials email failed to send."
                });
              }
            }
          } catch (err) {
            summary.failures.push({
              id: req.id,
              name: teacherName,
              email: req.email,
              error: err.message || "Unexpected exception during approval"
            });
          }
        })
      );
    }

    setShowBulkApproveProgressModal(false);
    setBulkApproveResultsSummary(summary);
    setShowBulkApproveResultsModal(true);
    setSelectedPendingRequestIds(new Set());

    await refreshTeachers();
  };

  useEffect(() => {
    if (teachers && teachers.length >= 0) {
      const validIds = new Set(teachers.map(t => t.id));
      setSelectedTeacherIds(prev => {
        let changed = false;
        const next = new Set();
        for (const id of prev) {
          if (validIds.has(id)) next.add(id);
          else changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, [teachers]);

  useEffect(() => {
    let isMounted = true;

    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return () => {
        isMounted = false;
      };
    }

    const user = JSON.parse(userData);
    if (user.role !== "admin") {
      navigate("/login");
      return () => {
        isMounted = false;
      };
    }

    setAdminName(user.name);
    setIsAdmin(true);

    const channel = supabase
      ? supabase
          .channel("admin-teacher-profiles-realtime-v1")
          .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async (payload) => {
            if (payload?.new?.role !== "teacher" && payload?.old?.role !== "teacher") {
              return;
            }

            try {
              await Promise.all([fetchTeachers(), fetchSubjects()]);
              if (isMounted) {
                setErrorMessage("");
              }
            } catch (error) {
              if (isMounted) {
                setErrorMessage(error instanceof Error ? error.message : "Unable to refresh teachers.");
              }
            }
          })
          .subscribe()
      : null;

    const subjectsChannel = supabase
      ? supabase
          .channel("admin-teacher-subjects-realtime-v1")
          .on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, async () => {
            try {
              await fetchSubjects();
            } catch (error) {
              if (isMounted) {
                setErrorMessage(error instanceof Error ? error.message : "Unable to refresh subjects.");
              }
            }
          })
          .subscribe()
      : null;

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (subjectsChannel) {
        supabase.removeChannel(subjectsChannel);
      }
    };
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const resetAddModal = () => {
    setShowAddModal(false);
    setTeacherFormData(emptyTeacherForm);
    setFormErrors({});
  };

  const resetEditModal = () => {
    setShowEditModal(false);
    setSelectedTeacher(null);
    setEditFormData(emptyTeacherForm);
    setEditFormErrors({});
  };

  const resetAssignModal = () => {
    setShowAssignModal(false);
    setTeacherToAssign(null);
    setAssignFormData(emptyAssignForm);
    setAssignFormErrors({});
  };

  const handleViewTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    setShowViewModal(true);
  };

  const handleEditTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    const { first_name, middle_name, last_name, suffix } = splitTeacherName(teacher);
    const teacherGrade = teacher.grade_level || teacher.year_level || "";
    const teacherSubjectIds = normalizeSubjects(teacher.subjects);
    const assignedClasses = normalizeAssignedClasses(teacher.assigned_class);

    const parsedRows = teacherSubjectIds.map((subjId, idx) => {
      const subj = availableSubjects.find(
        (s) => String(s.id) === String(subjId) || String(s.code || "").toLowerCase() === String(subjId).toLowerCase()
      );
      const sectionName = subj?.section || assignedClasses[idx] || assignedClasses[0] || "";
      return {
        id: generateUUID(),
        subjectId: subj?.id || subjId,
        subjectCode: subj?.code || subj?.name || subjId,
        section: sectionName
      };
    });

    setEditFormData({
      first_name,
      middle_name,
      last_name,
      suffix,
      employee_id: teacher.employee_id || teacher.lrn || "",
      email: teacher.email ?? "",
      phone: teacher.phone ?? "",
      grade_level: teacherGrade,
      subjects: parsedRows,
      status: teacher.status ?? "Active"
    });
    setEditFormErrors({});
    if (teacherGrade) {
      loadSectionsForGrade(teacherGrade);
    }
    setShowEditModal(true);
  };

  const handleToggleTeacherSelection = (teacherId) => {
    const newSelection = new Set(selectedTeacherIds);
    if (newSelection.has(teacherId)) {
      newSelection.delete(teacherId);
    } else {
      newSelection.add(teacherId);
    }
    setSelectedTeacherIds(newSelection);
  };

  const handleSelectAllTeachers = () => {
    const allSelected = filteredTeachers.length > 0 && filteredTeachers.every((t) => selectedTeacherIds.has(t.id));
    const newSelection = new Set(selectedTeacherIds);
    if (allSelected) {
      filteredTeachers.forEach((t) => newSelection.delete(t.id));
    } else {
      filteredTeachers.forEach((t) => newSelection.add(t.id));
    }
    setSelectedTeacherIds(newSelection);
  };

  const handleBulkDeleteTeachers = async () => {
    if (selectedTeacherIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const idsToDelete = Array.from(selectedTeacherIds);
      
      const { error } = await adminApi.bulkDeleteTeachers(idsToDelete);
      if (error) throw error;

      setShowBulkDeleteConfirm(false);
      setSelectedTeacherIds(new Set());
      await fetchTeachers();
      await fetchSubjects();

      toast.success(`Successfully deleted ${idsToDelete.length} teacher(s).`);
    } catch (err) {
      console.error(err);
      toast.error("An error occurred during bulk deletion: " + (err.message || "Unknown error"));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handlePromptDeleteTeacher = (teacher) => {
    setTeacherToDelete(teacher);
    setShowDeleteConfirm(true);
  };

  const handlePromptAssignClass = (teacher) => {
    setTeacherToAssign(teacher);
    setAssignFormData({ assigned_class: "" });
    setAssignFormErrors({});
    setShowAssignModal(true);
  };

  const filteredTeachers = teachers.filter((teacher) => {
    const search = (searchQuery || "").toLowerCase();
    const assignments = getTeacherAssignments(teacher);
    const subjectText = assignments.map((item) => item.subjectLabel).join(" ").toLowerCase();
    const sectionText = assignments.map((item) => item.classLabel).join(" ").toLowerCase();
    const matchesSearch =
      getTeacherName(teacher).toLowerCase().includes(search) ||
      String(teacher.email || "").toLowerCase().includes(search) ||
      String(teacher.employee_id || teacher.lrn || "").toLowerCase().includes(search) ||
      subjectText.includes(search) ||
      sectionText.includes(search);
    const matchesFilter = filterStatus === "all" || normalizeTeacherStatus(teacher.status).toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleAddTeacher = async (event) => {
    event.preventDefault();

    const validationErrors = await validateTeacherForm(teacherFormData);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    if (!db) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    let createdTeacherId = "";

    try {
      const rawAddRows = Array.isArray(teacherFormData.subjects) ? teacherFormData.subjects : [];
      const selectedSubjectIds = [...new Set(rawAddRows
        .map((row) => resolveSubjectId(row.subjectCode || row.subjectId, row.section, teacherFormData.grade_level))
        .filter(Boolean))];

      const addSectionsList = rawAddRows.map((r) => r.section).filter(Boolean);
      const addFormattedClass = [...new Set(addSectionsList)].join(", ");
      
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const externalRequestId = `admin-teacher-${timestamp}-${randomStr}`;

      const requestPayload = {
        request_type: "teacher",
        first_name: teacherFormData.first_name.trim(),
        middle_name: teacherFormData.middle_name.trim() || null,
        last_name: teacherFormData.last_name.trim(),
        suffix: teacherFormData.suffix.trim() || null,
        email: teacherFormData.email.trim().toLowerCase(),
        employee_id: teacherFormData.employee_id.trim() || null,
        phone: normalizePhone(teacherFormData.phone) || null,
        grade_level: teacherFormData.grade_level?.trim() || null,
        section: addFormattedClass || null,
        subjects: selectedSubjectIds.length > 0 ? selectedSubjectIds : null,
        lrn: teacherFormData.employee_id.trim() || null,
        status: "pending",
        source: "admin",
        external_request_id: externalRequestId
      };

      const { data, error } = await adminApi.db("pending_account_requests", "insert", {
        payload: requestPayload,
        single: true
      });

      if (error) {
        throw new Error(error.message || "Failed to create teacher registration request.");
      }

      const teacherName = composeTeacherName(teacherFormData);
      logActivity({
        actionType: "submitted_registration_request",
        entityType: "teacher",
        entityId: externalRequestId,
        entityName: teacherName,
        details: { email: teacherFormData.email, source: "admin" },
        timestamp: new Date().toISOString()
      });

      notifyAdmin({
        type: "registration",
        title: "Teacher Registration Request Submitted",
        message: `Admin submitted a pending teacher registration for ${teacherName}`,
        relatedId: externalRequestId,
        relatedType: "pending_account_requests",
        path: "/admin/teachers"
      });

      toast.success(`Registration request for ${teacherName} submitted. It is now pending approval in Registration Requests.`, { duration: 6000 });
      resetAddModal();

      await fetchRegistrationRequests().then((reqs) => {
        if (Array.isArray(reqs)) setRegistrationRequests(reqs);
      });

      setActiveTab("RegistrationRequests");
      setRegistrationSubTab("pending");
    } catch (error) {
      console.error("Add teacher request error:", error);
      const errMsg = error?.message || (typeof error === 'string' ? error : "Unable to submit teacher request.");
      toast.error(errMsg);
      setFormErrors((prev) => ({ ...prev, form: errMsg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTeacher = async (event) => {
    event.preventDefault();

    if (!selectedTeacher) return;

    const validationErrors = await validateTeacherForm(editFormData, selectedTeacher.id, { requireSubjects: true });
    if (Object.keys(validationErrors).length > 0) {
      setEditFormErrors(validationErrors);
      return;
    }

    if (!db) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    let updateSucceeded = false;

    try {
      const previousSubjectIds = normalizeSubjects(selectedTeacher.subjects);
      const rawEditRows = Array.isArray(editFormData.subjects) ? editFormData.subjects : [];
      const nextSubjectIds = [...new Set(rawEditRows
        .map((row) => resolveSubjectId(row.subjectCode || row.subjectId, row.section, editFormData.grade_level))
        .filter(Boolean))];

      const editSectionsList = rawEditRows.map((r) => r.section).filter(Boolean);
      const editFormattedClass = [...new Set(editSectionsList)].join(", ");
      const fullName = composeTeacherName(editFormData);
      const payload = {
        first_name: editFormData.first_name.trim(),
        middle_name: editFormData.middle_name.trim() || null,
        last_name: editFormData.last_name.trim() || null,
        suffix: editFormData.suffix.trim() || null,
        employee_id: editFormData.employee_id.trim() || null,
        email: editFormData.email.trim().toLowerCase(),
        phone: normalizePhone(editFormData.phone),
        status: normalizeTeacherStatus(editFormData.status),
        year_level: editFormData.grade_level?.trim() || null,
        assigned_class: editFormattedClass || null
      };
      if (!editFormData.suffix.trim()) delete payload.suffix;
      if (!editFormData.employee_id.trim()) delete payload.employee_id;

      const supportsYearLevel = Object.prototype.hasOwnProperty.call(selectedTeacher || {}, "year_level") || Object.prototype.hasOwnProperty.call(selectedTeacher || {}, "grade_level");
      if (!supportsYearLevel) {
        delete payload.year_level;
      }

      if (selectedTeacher.role !== "teacher") {
        throw new Error("Only teacher profiles can be updated.");
      }

      if (!selectedTeacher.id) {
        throw new Error("Teacher ID is missing.");
      }

      let { data, error } = await adminApi.updateProfile(selectedTeacher.id, payload);

      if (error && (error.message?.includes("assigned_class_unique") || error.message?.includes("profiles_teacher_assigned_class_unique") || error.code === "23505")) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.assigned_class;
        const retryRes = await adminApi.updateProfile(selectedTeacher.id, fallbackPayload);
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error) {
        throw error;
      }

      updateSucceeded = true;

      const nextTeacher = { 
        ...data, 
        grade_level: data.grade_level || data.year_level || "",
        subjects: normalizeSubjects(data.subjects) 
      };
      const nextTeacherName = getTeacherName(nextTeacher);
      await syncTeacherSubjectAssignments({
        teacherId: nextTeacher.id,
        previousSubjectIds,
        nextSubjectIds
      });

      await Promise.allSettled([fetchTeachers(), fetchSubjects()]);

      const previousSet = new Set(previousSubjectIds);
      const nextSet = new Set(nextSubjectIds);
      const addedSubjects = nextSubjectIds.filter((subjectId) => !previousSet.has(subjectId));
      const removedSubjects = previousSubjectIds.filter((subjectId) => !nextSet.has(subjectId));
      const subjectActionType = addedSubjects.length > 0 && removedSubjects.length === 0
        ? "assigned_subject_to_teacher"
        : removedSubjects.length > 0 && addedSubjects.length === 0
          ? "removed_subject_from_teacher"
          : addedSubjects.length > 0 || removedSubjects.length > 0
            ? "updated_teacher_subject_assignment"
            : "updated";

      logActivity({
        actionType: subjectActionType,
        entityType: "teacher",
        entityId: nextTeacher.id,
        entityName: nextTeacherName,
        details: {
          subjects: formatSubjects(nextSubjectIds),
          addedSubjects: formatSubjects(addedSubjects),
          removedSubjects: formatSubjects(removedSubjects),
          email: nextTeacher.email,
          phone: nextTeacher.phone
        },
        timestamp: nextTeacher.updated_at || new Date().toISOString()
      });

      notifyAdmin({
        type: "teacher",
        title: "Teacher Account Updated",
        message: `Teacher account updated for ${nextTeacherName}`,
        relatedId: nextTeacher.id,
        relatedType: "profiles",
        path: "/admin/teachers"
      });

      toast.success(`${nextTeacherName} updated successfully`);
      resetEditModal();
    } catch (error) {
      if (updateSucceeded) {
        try {
          const previousSubjectIds = normalizeSubjects(selectedTeacher.subjects);
          await adminApi.updateProfile(selectedTeacher.id, {
                first_name: selectedTeacher.first_name ?? "",
                middle_name: selectedTeacher.middle_name ?? null,
                last_name: selectedTeacher.last_name ?? null,
                email: selectedTeacher.email ?? "",
                phone: selectedTeacher.phone ?? "",
                subjects: previousSubjectIds,
                status: selectedTeacher.status ?? "Active"
            });

          await syncTeacherSubjectAssignments({
            teacherId: selectedTeacher.id,
            previousSubjectIds: normalizeSubjects(editFormData.subjects),
            nextSubjectIds: previousSubjectIds
          });

          await Promise.allSettled([fetchTeachers(), fetchSubjects()]);
        } catch {
        }
      }

      const errMsg = getApiErrorMessage(error, "Unable to update teacher.");
      console.error("Update teacher error:", error);
      setErrorMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeacher = async () => {
    if (!teacherToDelete) return;

    if (!db) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    const teacherId = teacherToDelete.id;
    const teacherName = getTeacherName(teacherToDelete);
    const previousTeachers = teachers;

    setTeachers((current) => current.filter((teacher) => teacher.id !== teacherId));
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      next.delete(teacherId);
      return next;
    });
    setSelectedTeacher((current) => (current?.id === teacherId ? null : current));
    setShowViewModal(false);
    setShowEditModal(false);
    setTeacherToDelete(null);

    try {
      const subjectIdsToRelease = normalizeSubjects(teacherToDelete.subjects);

      const { error } = await adminApi.bulkDeleteTeachers([teacherId]);
      if (error) {
        throw error;
      }

      if (subjectIdsToRelease.length > 0) {
        logActivity({
          actionType: "removed_subject_from_teacher",
          entityType: "teacher",
          entityId: teacherId,
          entityName: teacherName,
          details: { subjects: formatSubjects(subjectIdsToRelease) },
          timestamp: new Date().toISOString()
        });
      }

      await Promise.allSettled([fetchTeachers(), fetchSubjects()]);

      logActivity({
        actionType: "deleted",
        entityType: "teacher",
        entityId: teacherId,
        entityName: teacherName,
        details: { email: teacherToDelete.email },
        timestamp: new Date().toISOString()
      });
      toast.success(`${teacherName} deleted successfully`);
    } catch (error) {
      setTeachers(previousTeachers);
      const errMsg = error instanceof Error ? error.message : "Unable to delete teacher.";
      toast.error(errMsg);
    }
  };

  const handlePromptResetPassword = (teacher) => {
    setSelectedTeacher(teacher);
    setResetSettings({
      forceChange: true,
      tempPassword: generateTempPassword()
    });
    setShowResetPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!selectedTeacher) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { error: authError } = await adminApi.updateUserById(selectedTeacher.id, {
        password: resetSettings.tempPassword
      });

      if (authError) throw authError;

      const { error: profileError } = await adminApi.updateProfile(selectedTeacher.id, {
        must_change_password: resetSettings.forceChange,
        last_password_reset: new Date().toISOString()
      });

      if (profileError) throw profileError;

      const { error: logError } = await adminApi.db("password_reset_logs", "insert", {
        payload: {
          user_id: selectedTeacher.id,
          reset_by: JSON.parse(localStorage.getItem("currentUser")).id,
          temporary_password_generated: true
        }
      });

      if (logError) console.error("Failed to log password reset:", logError);

      await adminApi.db("notifications", "insert", {
        payload: {
          user_id: selectedTeacher.id,
          title: "Password Reset",
          message: `Your password has been reset by the administrator. Temporary Password: ${resetSettings.tempPassword}. You will be required to change your password after login.`,
          type: "system"
        }
      });

      toast.success("Temporary password generated and saved.");
      setShowResetPasswordModal(false);
    } catch (err) {
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignClass = async (event) => {
    event.preventDefault();

    if (!isAdmin) {
      setAssignFormErrors({ form: "Only admins can assign classes." });
      return;
    }

    if (!teacherToAssign) return;

    const gradeLevel = assignFormData.assignGradeLevel;
    const section = assignFormData.assignSection;
    if (!gradeLevel || !section) {
      setAssignFormErrors({ form: "Grade level and section are required" });
      return;
    }

    const assignedClass = `${gradeLevel} - ${section}`;

    if (!db) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const currentClasses = normalizeAssignedClasses(teacherToAssign.assigned_class);
      if (currentClasses.some((entry) => entry.toLowerCase() === assignedClass.toLowerCase())) {
        setAssignFormErrors({ assigned_class: "This class is already assigned to this teacher." });
        return;
      }

      const nextAssignedClass = [...currentClasses, assignedClass].join(", ");

      const { error } = await adminApi.updateProfile(teacherToAssign.id, { assigned_class: nextAssignedClass });

      if (error) {
        throw new Error(error.message || "Failed to update teacher profile");
      }

      const updatedTeacher = {
        ...teacherToAssign,
        assigned_class: nextAssignedClass,
        updated_at: new Date().toISOString(),
        display_name: formatTeacherFullName(teacherToAssign),
        subjects: normalizeSubjects(teacherToAssign.subjects)
      };
      setTeachers((current) => current.map((teacher) => (teacher.id === updatedTeacher.id ? updatedTeacher : teacher)));
      const updatedTeacherName = getTeacherName(updatedTeacher);
      logActivity({
        actionType: "assigned_class",
        entityType: "teacher",
        entityId: updatedTeacher.id,
        entityName: updatedTeacherName,
        details: { assignedClass: assignedClass, allAssignedClasses: nextAssignedClass },
        timestamp: updatedTeacher.updated_at || new Date().toISOString()
      });
      toast.success(`Added ${assignedClass} to ${updatedTeacherName}`);
      resetAssignModal();
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        setAssignFormErrors({ assigned_class: "That class is already assigned to another teacher." });
      } else {
        const errMsg = error instanceof Error ? error.message : "Unable to assign class.";
        toast.error(errMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportToCSV = () => {
    const statusContext = statusFilter !== "All" ? String(statusFilter).replace(/[^a-zA-Z0-9_\-]/g, "_") : "AllStatus";
    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `Teacher_Masterlist_${statusContext}_${dateStr}.csv`;

    const headers = ["Teacher ID", "Teacher Name", "Assigned Subject", "Assigned Class/Section", "Status"];
    const rows = filteredTeachers.map((teacher) => [
      teacher.id,
      getTeacherName(teacher),
      getTeacherAssignments(teacher).length > 0 ? getTeacherAssignments(teacher).map((item) => item.subjectLabel).join(" | ") : "No assignments yet.",
      getTeacherAssignments(teacher).length > 0 ? getTeacherAssignments(teacher).map((item) => item.classLabel).join(" | ") : "No assignments yet.",
      normalizeTeacherStatus(teacher.status)
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSubjectSectionAssignments = (formData, setFormData, errors, setErrors) => {
    const normGrade = normalizeGradeLevel(formData.grade_level);
    const subjectsForGrade = availableSubjects.filter(
      (s) => normalizeGradeLevel(s.grade_level || "") === normGrade
    );

    const uniqueSubjectOptionsMap = new Map();
    subjectsForGrade.forEach((s) => {
      const key = s.code || s.name || s.id;
      if (!uniqueSubjectOptionsMap.has(key)) {
        const label = s.code && s.name && s.code !== s.name ? `${s.code} - ${s.name}` : (s.name || s.code);
        uniqueSubjectOptionsMap.set(key, { value: key, label });
      }
    });
    const subjectOptions = Array.from(uniqueSubjectOptionsMap.values());

    const sectionsForGrade = gradeSectionsMap[normGrade] || [];
    const sectionOptions = sectionsForGrade.map((sec) => ({ value: sec, label: sec }));

    const isSectionsLoading = !!loadingSectionsMap[normGrade];
    const rows = Array.isArray(formData.subjects) ? formData.subjects : [];

    return (
      <div className="md:col-span-2 space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Subject & Section Assignments</label>
          <button
            type="button"
            onClick={() => {
              if (!formData.grade_level) {
                toast.error("Please select a Grade Level first.");
                return;
              }
              const selectedSubjectKeys = new Set(
                rows.map((r) => r.subjectCode || r.subjectId).filter(Boolean)
              );
              if (subjectOptions.length > 0 && selectedSubjectKeys.size >= subjectOptions.length) {
                toast.info("All available subjects for this grade level have already been added.");
                return;
              }
              const newRow = { id: generateUUID(), subjectId: "", subjectCode: "", section: "" };
              updateTeacherField(setFormData, setErrors, formData, "subjects", [...rows, newRow]);
            }}
            className="text-xs font-semibold text-green-600 hover:text-green-700 flex items-center gap-1 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg border border-green-200 transition-colors cursor-pointer"
          >
            + Add Subject & Section
          </button>
        </div>

        {!formData.grade_level ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center text-sm text-amber-700">
            Please select a <strong>Grade Level</strong> first to assign subjects & sections.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-sm text-gray-500">
            No subject & section assignments added yet. Click <strong>"+ Add Subject & Section"</strong> above to add one.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const selectedInOtherRows = new Set(
                rows
                  .filter((_, i) => i !== idx)
                  .map((r) => r.subjectCode || r.subjectId)
                  .filter(Boolean)
              );
              const rowSubjectOptions = subjectOptions.filter(
                (opt) => !selectedInOtherRows.has(opt.value)
              );

              let rowSectionOptions = sectionOptions;
              const valLow = String(row.subjectCode || row.subjectId || "").toLowerCase().trim();
              if (valLow) {
                const matchedSubjects = subjectsForGrade.filter((s) => {
                  const sCode = String(s.code || s.name || s.id).toLowerCase().trim();
                  return sCode === valLow || String(s.id).toLowerCase() === valLow;
                });
                const definedSections = [...new Set(matchedSubjects.map((s) => s.section).filter(Boolean))];
                if (definedSections.length > 0) {
                  rowSectionOptions = definedSections.map((sec) => ({ value: sec, label: sec }));
                }
              }

              return (
                <div key={row.id || idx} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl relative group shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-10">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
                      <CustomSelect
                        value={row.subjectCode || row.subjectId || ""}
                        onChange={(val) => {
                          const updatedRows = [...rows];
                          const matchedSubjs = subjectsForGrade.filter((s) => {
                            const sCode = String(s.code || s.name || s.id).toLowerCase().trim();
                            return sCode === String(val).toLowerCase().trim() || String(s.id).toLowerCase() === String(val).toLowerCase().trim();
                          });
                          const definedSecs = [...new Set(matchedSubjs.map((s) => s.section).filter(Boolean))];
                          let targetSec = updatedRows[idx].section || "";
                          if (definedSecs.length > 0 && (!targetSec || !definedSecs.includes(targetSec))) {
                            targetSec = definedSecs[0];
                          }

                          const resolvedId = resolveSubjectId(val, targetSec, formData.grade_level);
                          updatedRows[idx] = {
                            ...updatedRows[idx],
                            subjectCode: val,
                            section: targetSec,
                            subjectId: resolvedId
                          };
                          updateTeacherField(setFormData, setErrors, formData, "subjects", updatedRows);
                        }}
                        options={rowSubjectOptions}
                        placeholder={
                          subjectOptions.length === 0
                            ? "No subjects available for this grade."
                            : rowSubjectOptions.length === 0
                            ? "No remaining subjects available."
                            : "Select Subject"
                        }
                        disabled={subjectOptions.length === 0 || rowSubjectOptions.length === 0}
                        icon={<BookOpen className="w-4 h-4" />}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Section</label>
                      <CustomSelect
                        value={row.section || ""}
                        onChange={(val) => {
                          const updatedRows = [...rows];
                          const resolvedId = resolveSubjectId(updatedRows[idx].subjectCode, val, formData.grade_level);
                          updatedRows[idx] = {
                            ...updatedRows[idx],
                            section: val,
                            subjectId: resolvedId
                          };
                          updateTeacherField(setFormData, setErrors, formData, "subjects", updatedRows);
                        }}
                        options={rowSectionOptions}
                        placeholder={
                          isSectionsLoading
                            ? "Loading sections..."
                            : rowSectionOptions.length === 0
                            ? "No sections available for this grade."
                            : "Select Section"
                        }
                        disabled={isSectionsLoading || rowSectionOptions.length === 0}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const updatedRows = rows.filter((_, i) => i !== idx);
                      updateTeacherField(setFormData, setErrors, formData, "subjects", updatedRows);
                    }}
                    className="absolute top-3.5 right-3 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove assignment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {errors.subjects && <p className="text-red-500 text-sm mt-1">{errors.subjects}</p>}
      </div>
    );
  };

  const activeCount = teachers.filter((teacher) => isTeacherActive(teacher.status)).length;
  const inactiveCount = teachers.length - activeCount;
  const assignedCount = teachers.reduce((count, teacher) => count + getTeacherAssignments(teacher).length, 0);



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
              <NotificationDropdown />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div data-tour="teachers-header" className="relative rounded-2xl p-8 text-gray-900 shadow-lg overflow-hidden bg-white border border-gray-200">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-emerald-600" />
              <div className="flex-1 bg-teal-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 via-emerald-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4 flex items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-green-600">Teacher Management</h1>
                <p className="text-gray-600">Teacher records are up to date</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <input
                  type="file"
                  ref={teacherFileInputRef}
                  onChange={handleTeacherFileUpload}
                  accept=".csv, .xlsx, .xls, .txt"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleDownloadTeacherSampleCsv}
                  className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold shadow-sm cursor-pointer text-sm"
                  title="Download Sample CSV Template"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                  Sample CSV
                </button>
                <button
                  type="button"
                  onClick={() => teacherFileInputRef.current?.click()}
                  disabled={isImportingTeachers}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors font-semibold shadow-sm cursor-pointer text-sm disabled:opacity-50"
                >
                  {isImportingTeachers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-emerald-600" />}
                  {isImportingTeachers ? "Importing..." : "Import Teachers"}
                </button>
                <button data-tour="teachers-add-btn" onClick={() => { setTeacherFormData((f) => ({ ...f, password: generateTempPassword() })); setShowAddModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold shadow-lg shadow-green-600/20 shadow-sm cursor-pointer text-sm">
                  <UserPlus className="w-5 h-5" />
                  Add Teacher
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Total Teachers</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : teachers.length}
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Active Teachers</p>
              <p className="text-3xl font-bold text-green-600">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : activeCount}
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Assigned Classes</p>
              <p className="text-3xl font-bold text-green-600">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : assignedCount}
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Inactive Teachers</p>
              <p className="text-3xl font-bold text-red-500">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : inactiveCount}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("Roster")}
              className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === "Roster"
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Teacher Roster
            </button>
            <button
              onClick={() => {
                setActiveTab("RegistrationRequests");
                fetchRegistrationRequests().then((reqs) => {
                  if (Array.isArray(reqs)) setRegistrationRequests(reqs);
                });
              }}
              className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === "RegistrationRequests"
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Registration Requests
              {registrationRequests.filter(r => r.status === "pending").length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full font-bold">
                  {registrationRequests.filter(r => r.status === "pending").length}
                </span>
              )}
            </button>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              {activeTab === "Roster" && (
                <div data-tour="teachers-search" className="flex-1 relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                  <input
                    type="text"
                    placeholder="Search by teacher, subject, or class/section..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              )}

              {activeTab === "RegistrationRequests" && (
                <>
                  <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                    {["pending", "approved", "rejected"].map((subStatus) => (
                      <button
                        key={subStatus}
                        onClick={() => setRegistrationSubTab(subStatus)}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                          registrationSubTab === subStatus
                            ? "bg-white text-green-600 shadow-sm font-bold"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {subStatus.charAt(0).toUpperCase() + subStatus.slice(1)}
                        {subStatus === "pending" && registrationRequests.filter(r => r.status === "pending").length > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full">
                            {registrationRequests.filter(r => r.status === "pending").length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 relative w-full flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                      <input
                        type="text"
                        placeholder="Search registration requests by name, email, or employee ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => teacherFileInputRef.current?.click()}
                      disabled={isImportingTeachers}
                      className="px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"
                      title="Import Teachers CSV"
                    >
                      {isImportingTeachers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-emerald-600" />}
                      <span>Import CSV</span>
                    </button>
                  </div>
                </>
              )}

              {activeTab === "Roster" && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-sm">Status</span>
                  <CustomSelect
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                      { value: "all", label: "All Status" },
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" }
                    ]}
                    icon={<User className="w-5 h-5" />}
                    className="min-w-[160px]"
                  />
                </div>
              )}
              {activeTab === "Roster" && selectedTeacherIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrepareTeacherRegistrationRequests}
                    disabled={isCreatingTeacherRequests}
                    className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingTeacherRequests ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Create Registration Requests ({selectedTeacherIds.size})
                  </button>
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={isBulkDeleting}
                    className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors border border-red-600 font-semibold shadow-sm w-full md:w-auto justify-center disabled:opacity-50"
                  >
                    {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {isBulkDeleting ? "Deleting..." : `Delete Selected (${selectedTeacherIds.size})`}
                  </button>
                </>
              )}
              {activeTab === "RegistrationRequests" && registrationSubTab === "pending" && selectedPendingRequestIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBulkApproveConfirmModal(true)}
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Selected ({selectedPendingRequestIds.size})
                </button>
              )}
              {activeTab === "Roster" && (
                <button onClick={handleExportToCSV} className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-900 rounded-xl hover:bg-white/20 transition-colors border border-gray-200 cursor-pointer">
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {/* Teacher Table Container */}
          <div data-tour="teachers-table" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Loading teachers...</p>
              </div>
            ) : fetchError ? (
              <div className="p-12 text-center">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <p className="text-gray-900 font-semibold mb-1">Failed to load teacher data</p>
                <p className="text-sm text-gray-500 mb-4">{fetchError}</p>
                <button
                  onClick={() => { setLoading(true); setFetchError(null); refreshTeachers().finally(() => setLoading(false)); }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  {activeTab === "Roster" && (
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr className="border-b border-gray-200">
                          <th className="px-6 py-5 text-left w-1/4">
                            <div className="flex items-center gap-2">
                              {(() => {
                                const allFilteredSelected = filteredTeachers.length > 0 && filteredTeachers.every((t) => selectedTeacherIds.has(t.id));
                                const someFilteredSelected = filteredTeachers.some((t) => selectedTeacherIds.has(t.id)) && !allFilteredSelected;
                                return (
                                  <button
                                    type="button"
                                    onClick={handleSelectAllTeachers}
                                    className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors"
                                    title="Select All Teachers"
                                  >
                                    {allFilteredSelected ? (
                                      <CheckSquare className="w-5 h-5 text-blue-600" />
                                    ) : someFilteredSelected ? (
                                      <MinusSquare className="w-5 h-5 text-blue-600" />
                                    ) : (
                                      <Square className="w-5 h-5 text-gray-400" />
                                    )}
                                  </button>
                                );
                              })()}
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">FULL NAME</span>
                            </div>
                          </th>
                          <th className="px-6 py-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Contact Details</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Assigned Subjects</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Assigned Grade Level</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created At</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredTeachers.map((teacher) => {
                          const assignments = getTeacherAssignments(teacher);
                          
                          const renderBadges = (items, type) => {
                            if (!items || items.length === 0) {
                              return <span className="text-gray-400 text-sm italic">None</span>;
                            }
                            
                            const isSubject = type === 'subject';
                            let uniqueLabels = [];
                            if (isSubject) {
                              uniqueLabels = items.map(item => item.subjectLabel);
                            } else {
                              uniqueLabels = [...new Set(items.map(item => item.classLabel))];
                            }
                            
                            const finalLabels = [...new Set(uniqueLabels.filter(Boolean))];
                            
                            if (finalLabels.length === 0) return <span className="text-gray-400 text-sm italic">None</span>;

                            const limit = 2;
                            const bgClass = isSubject ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-indigo-50 text-indigo-700 border-indigo-200/60';
                            
                            const displayedLabels = finalLabels.slice(0, limit);
                            const hiddenLabels = finalLabels.slice(limit);
                            const hiddenCount = hiddenLabels.length;
                            
                            return (
                              <div className="flex flex-wrap gap-2 items-center">
                                {displayedLabels.map((label, idx) => (
                                  <span key={idx} className={`px-2.5 py-1 rounded-md text-xs font-medium border shadow-sm ${bgClass}`}>
                                    {label}
                                  </span>
                                ))}
                                {hiddenCount > 0 && (
                                  <details className="relative group/badge">
                                    <summary className="list-none px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 text-gray-600 shadow-sm">
                                      +{hiddenCount} More
                                    </summary>
                                    <div className="absolute z-10 left-0 mt-2 p-2 bg-white rounded-lg border border-gray-200 shadow-xl flex flex-col gap-1.5 min-w-[120px] max-w-[200px] max-h-[200px] overflow-y-auto">
                                      <div className="text-xs font-bold text-gray-500 uppercase mb-1 px-1">{isSubject ? 'All Subjects' : 'All Classes'}</div>
                                      {finalLabels.map((label, idx) => (
                                        <span key={idx} className={`px-2.5 py-1 rounded-md text-xs font-medium border ${bgClass}`}>
                                          {label}
                                        </span>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            );
                          };

                          return (
                            <tr key={teacher.id} className="hover:bg-gray-50 transition-colors group">
                              <td className="px-6 py-5 whitespace-nowrap align-middle">
                                  <div className="flex items-center gap-4">
                                    <button
                                      onClick={() => handleToggleTeacherSelection(teacher.id)}
                                      className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors"
                                    >
                                      {selectedTeacherIds.has(teacher.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shadow-sm shrink-0">
                                      {getTeacherName(teacher).charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-gray-900 truncate">{getTeacherName(teacher)}</div>
                                    </div>
                                  </div>
                              </td>
                              <td className="px-6 py-5 text-sm text-gray-600 align-middle">
                                <div className="truncate max-w-[200px]">{teacher.email || "-"}</div>
                              </td>
                              <td className="px-6 py-5 align-middle">
                                {renderBadges(assignments, 'subject')}
                              </td>
                              <td className="px-6 py-5 align-middle">
                                {renderBadges(assignments, 'class')}
                              </td>
                              <td className="px-6 py-5 align-middle">
                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${isTeacherActive(teacher.status) ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-500 border-red-200"}`}>
                                  {normalizeTeacherStatus(teacher.status)}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-sm text-gray-500 align-middle whitespace-nowrap">
                                {formatDate(teacher.created_at)}
                              </td>
                              <td data-tour="teachers-actions" className="px-6 py-5 text-right align-middle">
                                <div className="flex items-center justify-end gap-1.5 transition-opacity">
                                  <button onClick={() => handleViewTeacher(teacher)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" title="View">
                                    <Eye className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <button data-tour="teachers-assignments-btn" onClick={() => handleEditTeacher(teacher)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" title="Edit">
                                    <Edit className="w-4 h-4 text-blue-500" />
                                  </button>
                                  <button onClick={() => handlePromptDeleteTeacher(teacher)} className="p-2 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Delete">
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {activeTab === "RegistrationRequests" && (
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {registrationSubTab === "pending" && (
                            <th className="px-6 py-5 text-left w-12">
                              <button
                                onClick={() => {
                                  const pendingReqs = filteredRegistrationRequests.filter(r => r.status === "pending");
                                  if (selectedPendingRequestIds.size === pendingReqs.length && pendingReqs.length > 0) {
                                    setSelectedPendingRequestIds(new Set());
                                  } else {
                                    setSelectedPendingRequestIds(new Set(pendingReqs.map(r => r.id)));
                                  }
                                }}
                                className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors"
                              >
                                {selectedPendingRequestIds.size > 0 && selectedPendingRequestIds.size === filteredRegistrationRequests.filter(r => r.status === "pending").length ? (
                                  <CheckSquare className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            </th>
                          )}
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Teacher Name</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee ID</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted Date</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredRegistrationRequests.map((req) => (
                          <tr key={req.id} className={`hover:bg-gray-50 transition-colors ${selectedPendingRequestIds.has(req.id) ? "bg-blue-50/50" : ""}`}>
                            {registrationSubTab === "pending" && (
                              <td className="px-6 py-5 text-left align-middle">
                                <button
                                  onClick={() => {
                                    const newSet = new Set(selectedPendingRequestIds);
                                    if (newSet.has(req.id)) newSet.delete(req.id);
                                    else newSet.add(req.id);
                                    setSelectedPendingRequestIds(newSet);
                                  }}
                                  className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors"
                                >
                                  {selectedPendingRequestIds.has(req.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                                </button>
                              </td>
                            )}
                            <td className="px-6 py-5 align-middle">
                              <p className="font-semibold text-gray-900 truncate">
                                {[req.first_name, req.middle_name, req.last_name, req.suffix].filter(Boolean).join(" ")}
                              </p>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-600 align-middle">
                              <span className="truncate">{req.email || "-"}</span>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-600 align-middle whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                                req.source === "admin"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : req.source === "masterlist"
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}>
                                {req.source === "admin" ? "Admin Added" : req.source === "masterlist" ? "Masterlist" : "Google Form"}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-600 align-middle">
                              <span className="truncate">{req.employee_id || req.lrn || "-"}</span>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-500 align-middle whitespace-nowrap">
                              {formatDate(req.created_at)}
                            </td>
                            <td className="px-6 py-5 align-middle">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${
                                req.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : req.status === "rejected"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right align-middle">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => { setSelectedRequest(req); setShowViewRequestModal(true); }}
                                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 flex items-center gap-1 text-xs font-medium border border-gray-200 cursor-pointer"
                                  title="View Request Details"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </button>
                                {req.status === "pending" && (
                                  <>
                                    <button
                                      onClick={() => { setSelectedRequest(req); setShowApproveRequestModal(true); }}
                                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => { setSelectedRequest(req); setRejectionReasonInput(""); setShowRejectRequestModal(true); }}
                                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {activeTab === "Roster" && filteredTeachers.length === 0 && (
                  <div className="p-16 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No teachers found.</p>
                  </div>
                )}
                {activeTab === "RegistrationRequests" && filteredRegistrationRequests.length === 0 && (
                  <div className="p-16 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No registration requests found under "{registrationSubTab}".</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Add New Teacher</h3>
              <button onClick={resetAddModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddTeacher}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={teacherFormData.first_name}
                      onChange={(e) => updateTeacherField(setTeacherFormData, setFormErrors, teacherFormData, "first_name", e.target.value)}
                      placeholder="Enter first name"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.first_name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {formErrors.first_name && <p className="text-red-500 text-sm mt-1">{formErrors.first_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                    <input
                      type="text"
                      value={teacherFormData.middle_name}
                      onChange={(e) => updateTeacherField(setTeacherFormData, setFormErrors, teacherFormData, "middle_name", e.target.value)}
                      placeholder="Enter middle name, if any"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.middle_name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {formErrors.middle_name && <p className="text-red-500 text-sm mt-1">{formErrors.middle_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={teacherFormData.last_name}
                      onChange={(e) => updateTeacherField(setTeacherFormData, setFormErrors, teacherFormData, "last_name", e.target.value)}
                      placeholder="Enter last name"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.last_name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {formErrors.last_name && <p className="text-red-500 text-sm mt-1">{formErrors.last_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name Extension / Suffix</label>
                    <input
                      type="text"
                      value={teacherFormData.suffix}
                      onChange={(e) => updateTeacherField(setTeacherFormData, setFormErrors, teacherFormData, "suffix", e.target.value)}
                      placeholder="e.g. Jr., Sr., II, III"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.suffix ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {formErrors.suffix && <p className="text-red-500 text-sm mt-1">{formErrors.suffix}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={teacherFormData.email}
                      onChange={(e) => updateTeacherField(setTeacherFormData, setFormErrors, teacherFormData, "email", e.target.value)}
                      placeholder="teacher@example.com"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.email ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {formErrors.email && <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identification / Employee ID</label>
                    <input
                      type="text"
                      value={teacherFormData.employee_id}
                      onChange={(e) => updateTeacherField(setTeacherFormData, setFormErrors, teacherFormData, "employee_id", e.target.value)}
                      placeholder="Enter employee ID or identification"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.employee_id ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {formErrors.employee_id && <p className="text-red-500 text-sm mt-1">{formErrors.employee_id}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={teacherFormData.phone}
                      onChange={(e) => updateTeacherField(setTeacherFormData, setFormErrors, teacherFormData, "phone", e.target.value)}
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="11-digit phone number"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.phone ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {formErrors.phone && <p className="text-red-500 text-sm mt-1">{formErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                    <CustomSelect
                      value={teacherFormData.grade_level || ""}
                      onChange={(value) => updateTeacherField(setTeacherFormData, setFormErrors, teacherFormData, "grade_level", value)}
                      options={[
                        { value: "Grade 7", label: "Grade 7" },
                        { value: "Grade 8", label: "Grade 8" },
                        { value: "Grade 9", label: "Grade 9" },
                        { value: "Grade 10", label: "Grade 10" },
                      ]}
                      placeholder="Select grade"
                      className="min-w-[180px]"
                    />
                    {formErrors.grade_level && <p className="text-red-500 text-sm mt-1">{formErrors.grade_level}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <CustomSelect
                      value={teacherFormData.status}
                      onChange={(value) => updateTeacherField(setTeacherFormData, setFormErrors, teacherFormData, "status", value)}
                      options={[
                        { value: "Active", label: "Active" },
                        { value: "Inactive", label: "Inactive" }
                      ]}
                      icon={<User className="w-5 h-5" />}
                      className="min-w-[180px]"
                    />
                    {formErrors.status && <p className="text-red-500 text-sm mt-1">{formErrors.status}</p>}
                  </div>

                  {renderSubjectSectionAssignments(teacherFormData, setTeacherFormData, formErrors, setFormErrors)}
                </div>
                {formErrors.form && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formErrors.form}
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                  <button onClick={resetAddModal} type="button" className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? "Adding..." : "Add Teacher"}
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
              <h3 className="text-xl font-semibold text-gray-900">Edit Teacher</h3>
              <button onClick={resetEditModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateTeacher}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={editFormData.first_name}
                      onChange={(e) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "first_name", e.target.value)}
                      placeholder="Enter first name"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.first_name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {editFormErrors.first_name && <p className="text-red-500 text-sm mt-1">{editFormErrors.first_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                    <input
                      type="text"
                      value={editFormData.middle_name}
                      onChange={(e) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "middle_name", e.target.value)}
                      placeholder="Enter middle name, if any"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.middle_name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {editFormErrors.middle_name && <p className="text-red-500 text-sm mt-1">{editFormErrors.middle_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editFormData.last_name}
                      onChange={(e) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "last_name", e.target.value)}
                      placeholder="Enter last name"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.last_name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {editFormErrors.last_name && <p className="text-red-500 text-sm mt-1">{editFormErrors.last_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name Extension / Suffix</label>
                    <input
                      type="text"
                      value={editFormData.suffix}
                      onChange={(e) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "suffix", e.target.value)}
                      placeholder="e.g. Jr., Sr., II, III"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.suffix ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {editFormErrors.suffix && <p className="text-red-500 text-sm mt-1">{editFormErrors.suffix}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identification / Employee ID</label>
                    <input
                      type="text"
                      value={editFormData.employee_id}
                      onChange={(e) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "employee_id", e.target.value)}
                      placeholder="Enter employee ID or identification"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.employee_id ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {editFormErrors.employee_id && <p className="text-red-500 text-sm mt-1">{editFormErrors.employee_id}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "email", e.target.value)}
                      placeholder="teacher@example.com"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.email ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {editFormErrors.email && <p className="text-red-500 text-sm mt-1">{editFormErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "phone", e.target.value)}
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="11-digit phone number"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${editFormErrors.phone ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}
                    />
                    {editFormErrors.phone && <p className="text-red-500 text-sm mt-1">{editFormErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                    <CustomSelect
                      value={editFormData.grade_level || ""}
                      onChange={(value) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "grade_level", value)}
                      options={[
                        { value: "Grade 7", label: "Grade 7" },
                        { value: "Grade 8", label: "Grade 8" },
                        { value: "Grade 9", label: "Grade 9" },
                        { value: "Grade 10", label: "Grade 10" },
                      ]}
                      placeholder="Select grade"
                      className="min-w-[180px]"
                    />
                    {editFormErrors.grade_level && <p className="text-red-500 text-sm mt-1">{editFormErrors.grade_level}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <CustomSelect
                      value={editFormData.status}
                      onChange={(value) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "status", value)}
                      options={[
                        { value: "Active", label: "Active" },
                        { value: "Inactive", label: "Inactive" }
                      ]}
                      icon={<User className="w-5 h-5" />}
                      className="min-w-[180px]"
                    />
                    {editFormErrors.status && <p className="text-red-500 text-sm mt-1">{editFormErrors.status}</p>}
                  </div>

                  {renderSubjectSectionAssignments(editFormData, setEditFormData, editFormErrors, setEditFormErrors)}
                </div>
                {editFormErrors.form && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {editFormErrors.form}
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                  <button onClick={resetEditModal} type="button" className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? "Updating..." : "Update Teacher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && teacherToAssign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Add Class Assignment</h3>
                <p className="text-sm text-gray-500 whitespace-nowrap">{getTeacherName(teacherToAssign)}</p>
              </div>
              <button onClick={resetAssignModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleAssignClass} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Currently Assigned</label>
                <p className="text-sm text-gray-600">{formatAssignedClasses(teacherToAssign.assigned_class) || "No classes assigned yet"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                <CustomSelect
                  value={assignFormData.assignGradeLevel}
                  onChange={(value) => setAssignFormData({ ...assignFormData, assignGradeLevel: value, assignSection: "" })}
                  options={[
                    { value: "Grade 7", label: "Grade 7" },
                    { value: "Grade 8", label: "Grade 8" },
                    { value: "Grade 9", label: "Grade 9" },
                    { value: "Grade 10", label: "Grade 10" },
                  ]}
                  placeholder="Select Grade Level"
                  className="w-full mb-4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <SectionDropdown
                  value={assignFormData.assignSection}
                  onChange={(value) => setAssignFormData({ ...assignFormData, assignSection: value })}
                  gradeLevel={assignFormData.assignGradeLevel}
                  className="w-full"
                />
              </div>
              {assignFormErrors.form && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {assignFormErrors.form}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                <button onClick={resetAssignModal} type="button" className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? "Saving..." : "Add Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Teacher Details</h3>
              <button onClick={() => setShowViewModal(false)} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
                <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {getTeacherName(selectedTeacher).charAt(0) || "T"}
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-gray-900 whitespace-nowrap">{getTeacherName(selectedTeacher)}</h4>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${isTeacherActive(selectedTeacher.status) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {normalizeTeacherStatus(selectedTeacher.status)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Employee ID / Identification</label>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900 font-mono">{selectedTeacher.employee_id || selectedTeacher.lrn || "N/A"}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{selectedTeacher.email}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{selectedTeacher.phone}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Assigned Classes</label>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{getTeacherAssignments(selectedTeacher).length > 0 ? getTeacherAssignments(selectedTeacher).map((item) => item.classLabel).join(", ") : "No assignments yet."}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Created At</label>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{formatDate(selectedTeacher.created_at)}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Assigned Subjects</label>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const validSubjects = normalizeSubjects(selectedTeacher.subjects).filter(id => getSubjectLabel(id) !== null);
                        return validSubjects.length > 0 ? (
                          validSubjects.map((subjectId, idx) => (
                            <span key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                              <BookOpen className="w-4 h-4" />
                              {getSubjectLabel(subjectId)}
                            </span>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">No subjects assigned</p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-150">
                <button onClick={() => setShowViewModal(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">
                  Close
                </button>
                <button onClick={() => handlePromptAssignClass(selectedTeacher)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-sm">
                  <BookOpen className="w-4 h-4" />
                  Assign Class
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditTeacher(selectedTeacher);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  <Edit className="w-4 h-4" />
                  Edit Teacher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDeleteTeachers}
        title="Delete Selected Teachers"
        message={`Are you sure you want to permanently delete ${selectedTeacherIds.size} selected teacher(s)? This action cannot be undone.`}
        confirmText={isBulkDeleting ? "Deleting..." : "Delete All Selected"}
        cancelText="Cancel"
        type="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTeacherToDelete(null);
        }}
        onConfirm={handleDeleteTeacher}
        title="Delete Teacher"
        message={teacherToDelete ? `Are you sure you want to permanently delete ${getTeacherName(teacherToDelete)}? This action cannot be undone.` : "Are you sure you want to permanently delete this teacher? This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {showCredentialsModal && createdCredentials && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-gray-200 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Account Created Successfully</h3>
              <p className="text-sm text-gray-500 mt-2">
                Please save these credentials securely. They will only be shown this one time.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Teacher Name</p>
                <p className="font-semibold text-gray-900">{createdCredentials.name}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Identification / Employee ID</p>
                <p className="font-semibold text-gray-900 font-mono">{createdCredentials.employee_id || "N/A"}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Username</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-gray-900">{createdCredentials.username}</p>
                  <button onClick={() => { navigator.clipboard.writeText(createdCredentials.username); toast.success("Username copied!"); }} className="text-blue-600 hover:text-blue-800 text-sm font-medium cursor-pointer">Copy</button>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Temporary Password</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-gray-900">{createdCredentials.password}</p>
                  <button onClick={() => { navigator.clipboard.writeText(createdCredentials.password); toast.success("Password copied!"); }} className="text-blue-600 hover:text-blue-800 text-sm font-medium cursor-pointer">Copy</button>
                </div>
              </div>
              {createdCredentials.assignedSubjects && createdCredentials.assignedSubjects.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-sm font-medium text-gray-500 mb-2">Assigned Subjects & Sections</p>
                  <div className="flex flex-wrap gap-1.5">
                    {createdCredentials.assignedSubjects.map((label, idx) => (
                      <span key={idx} className="px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-md">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => {
                  setShowCredentialsModal(false);
                  setCreatedCredentials(null);
                }} 
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewRequestModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-900">Registration Request Details</h3>
              <button
                onClick={() => { setShowViewRequestModal(false); setSelectedRequest(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wider block">Request Status</span>
                  <span className="font-bold text-gray-900 text-lg uppercase">{selectedRequest.status}</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  selectedRequest.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                  selectedRequest.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {selectedRequest.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 font-medium">First Name</span>
                  <p className="font-semibold text-gray-900">{selectedRequest.first_name || "-"}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Middle Name</span>
                  <p className="font-semibold text-gray-900">{selectedRequest.middle_name || "-"}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Last Name</span>
                  <p className="font-semibold text-gray-900">{selectedRequest.last_name || "-"}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Suffix</span>
                  <p className="font-semibold text-gray-900">{selectedRequest.suffix || "-"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 font-medium">Email Address</span>
                  <p className="font-semibold text-gray-900">{selectedRequest.email || "-"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 font-medium">Employee ID / Identification</span>
                  <p className="font-semibold text-gray-900">{selectedRequest.employee_id || selectedRequest.lrn || "-"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 font-medium">Source</span>
                  <p className="font-semibold text-gray-900 flex items-center gap-2 mt-0.5">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                      selectedRequest.source === "admin"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-purple-50 text-purple-700 border-purple-200"
                    }`}>
                      {selectedRequest.source === "admin" ? "Admin Added" : "Google Form"}
                    </span>
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 font-medium">Submitted Date</span>
                  <p className="font-semibold text-gray-900">{formatDate(selectedRequest.created_at)}</p>
                </div>
                {selectedRequest.rejection_reason && (
                  <div className="col-span-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                    <span className="font-semibold block text-xs uppercase tracking-wider text-red-600">Rejection Reason</span>
                    <p className="mt-1 text-sm">{selectedRequest.rejection_reason}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setShowViewRequestModal(false); setSelectedRequest(null); }}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
                {selectedRequest.status === "pending" && (
                  <>
                    <button
                      onClick={() => { setShowRejectRequestModal(true); setRejectionReasonInput(""); }}
                      className="px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all cursor-pointer"
                    >
                      Reject Request
                    </button>
                    <button
                      onClick={() => { setShowApproveRequestModal(true); }}
                      className="px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all cursor-pointer"
                    >
                      Approve Teacher
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showApproveRequestModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Approve Teacher Registration?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will create a new login account and profile for <span className="font-bold text-gray-900">{selectedRequest.first_name} {selectedRequest.last_name}</span>. An email with temporary login credentials will automatically be sent to <span className="font-semibold text-green-700">{selectedRequest.email}</span>.
            </p>

            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 mb-6 text-xs space-y-1 text-gray-700">
              <div><span className="font-semibold">Email:</span> {selectedRequest.email}</div>
              <div><span className="font-semibold">Employee ID:</span> {selectedRequest.employee_id || "N/A"}</div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowApproveRequestModal(false)}
                disabled={isProcessingRequest}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveRegistrationRequest}
                disabled={isProcessingRequest}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isProcessingRequest && <Loader2 className="w-4 h-4 animate-spin" />}
                {isProcessingRequest ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectRequestModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Reject Registration Request?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to reject the registration request for <span className="font-bold text-gray-900">{selectedRequest.first_name} {selectedRequest.last_name}</span>?
            </p>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Rejection Reason (Optional)
              </label>
              <textarea
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Provide a reason for rejection..."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRejectRequestModal(false)}
                disabled={isProcessingRequest}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectRegistrationRequest}
                disabled={isProcessingRequest}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isProcessingRequest && <Loader2 className="w-4 h-4 animate-spin" />}
                {isProcessingRequest ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER CREATE REGISTRATION REQUESTS MODAL */}
      {showTeacherCreateRequestsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Create Registration Requests from Teacher Roster</h3>
                <p className="text-xs text-gray-500 mt-1">Staging teacher records for admin review</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTeacherCreateRequestsModal(false)}
                disabled={isCreatingTeacherRequests}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Selected</p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5">{teacherCreateSummary.totalSelected}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <p className="text-[10px] text-emerald-700 font-bold uppercase">Ready</p>
                  <p className="text-lg font-bold text-emerald-800 mt-0.5">{teacherCreateSummary.ready.length}</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <p className="text-[10px] text-amber-700 font-bold uppercase">Missing Email</p>
                  <p className="text-lg font-bold text-amber-800 mt-0.5">{teacherCreateSummary.missingEmail.length}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                  <p className="text-[10px] text-blue-700 font-bold uppercase">Duplicates</p>
                  <p className="text-lg font-bold text-blue-800 mt-0.5">{teacherCreateSummary.duplicates.length}</p>
                </div>
              </div>

              <div className="flex border-b border-gray-200 gap-2">
                <button
                  type="button"
                  onClick={() => setTeacherCreateTab("ready")}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 ${teacherCreateTab === "ready" ? "border-emerald-600 text-emerald-600" : "border-transparent text-gray-500"}`}
                >
                  Ready ({teacherCreateSummary.ready.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherCreateTab("missingEmail")}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 ${teacherCreateTab === "missingEmail" ? "border-amber-600 text-amber-600" : "border-transparent text-gray-500"}`}
                >
                  Missing Email ({teacherCreateSummary.missingEmail.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherCreateTab("duplicates")}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 ${teacherCreateTab === "duplicates" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}
                >
                  Duplicates ({teacherCreateSummary.duplicates.length})
                </button>
              </div>

              {teacherCreateTab === "ready" && (
                <div className="max-h-48 overflow-y-auto border rounded-xl divide-y text-xs">
                  {teacherCreateSummary.ready.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">No ready records to create requests.</p>
                  ) : (
                    teacherCreateSummary.ready.map((t, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <span className="font-bold text-gray-900">{t.fullName}</span>
                          <span className="text-gray-500 ml-2">{t.empId ? `(ID: ${t.empId})` : ""}</span>
                        </div>
                        <div className="text-right font-mono text-gray-600">
                          <span>{t.email}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {teacherCreateTab === "missingEmail" && (
                <div className="max-h-48 overflow-y-auto border rounded-xl divide-y text-xs text-amber-800 bg-amber-50/50">
                  {teacherCreateSummary.missingEmail.length === 0 ? (
                    <p className="p-4 text-amber-700 text-center">No missing email rows.</p>
                  ) : (
                    teacherCreateSummary.missingEmail.map((m, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center">
                        <span className="font-semibold">{m.fullName}</span>
                        <span className="text-amber-700 text-[11px]">Flagged: Missing Email</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {teacherCreateTab === "duplicates" && (
                <div className="max-h-48 overflow-y-auto border rounded-xl divide-y text-xs text-blue-800 bg-blue-50/50">
                  {teacherCreateSummary.duplicates.length === 0 ? (
                    <p className="p-4 text-blue-700 text-center">No duplicate rows.</p>
                  ) : (
                    teacherCreateSummary.duplicates.map((d, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center">
                        <span className="font-semibold">{d.fullName} ({d.email})</span>
                        <span className="text-blue-700 text-[11px]">{d.reason}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
              <button
                type="button"
                onClick={() => setShowTeacherCreateRequestsModal(false)}
                disabled={isCreatingTeacherRequests}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateTeacherRegistrationRequests}
                disabled={isCreatingTeacherRequests || teacherCreateSummary.ready.length === 0}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isCreatingTeacherRequests && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isCreatingTeacherRequests ? "Creating..." : `Create ${teacherCreateSummary.ready.length} Registration Request(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK APPROVAL CONFIRMATION MODAL */}
      {showBulkApproveConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Approve Selected Teacher Requests?</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to approve <span className="font-bold text-gray-900">{selectedPendingRequestIds.size}</span> pending teacher registration request(s).
            </p>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1 mb-6">
              <p>• Accounts will be created in Supabase Auth & profiles table.</p>
              <p>• Unique secure temporary passwords will be generated server-side.</p>
              <p>• Individual credential emails will be sent via Resend API.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBulkApproveConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkTeacherApproval}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm Bulk Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK APPROVAL PROGRESS MODAL */}
      {showBulkApproveProgressModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 text-center">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">Creating Teacher Accounts & Sending Emails</h3>
            <p className="text-xs text-gray-500 mb-4">
              Processing request <span className="font-semibold text-gray-900">{bulkApproveProgress.current}</span> of <span className="font-semibold text-gray-900">{bulkApproveProgress.total}</span>
            </p>
            {bulkApproveProgress.currentTeacherName && (
              <p className="text-xs font-mono text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-100 inline-block truncate max-w-full">
                Processing: {bulkApproveProgress.currentTeacherName}
              </p>
            )}
            <div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden">
              <div
                className="bg-emerald-600 h-2 transition-all duration-300"
                style={{ width: `${Math.round((bulkApproveProgress.current / (bulkApproveProgress.total || 1)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* BULK APPROVAL RESULTS MODAL */}
      {showBulkApproveResultsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-lg font-bold text-gray-900">Teacher Bulk Approval Summary</h3>
              <button onClick={() => setShowBulkApproveResultsModal(false)} type="button" className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center mb-6">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <p className="text-[10px] text-gray-500 font-bold uppercase">Processed</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{bulkApproveResultsSummary.total}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <p className="text-[10px] text-emerald-700 font-bold uppercase">Accounts</p>
                <p className="text-lg font-bold text-emerald-800 mt-0.5">{bulkApproveResultsSummary.successCount}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                <p className="text-[10px] text-blue-700 font-bold uppercase">Emails Sent</p>
                <p className="text-lg font-bold text-blue-800 mt-0.5">{bulkApproveResultsSummary.emailSentCount}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <p className="text-[10px] text-amber-700 font-bold uppercase">Email Failures</p>
                <p className="text-lg font-bold text-amber-800 mt-0.5">{bulkApproveResultsSummary.emailFailedCount}</p>
              </div>
            </div>

            {bulkApproveResultsSummary.failures.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Notice / Failures ({bulkApproveResultsSummary.failures.length})</p>
                <div className="max-h-48 overflow-y-auto border border-red-200 rounded-xl divide-y text-xs bg-red-50/40">
                  {bulkApproveResultsSummary.failures.map((f, idx) => (
                    <div key={idx} className="p-3">
                      <p className="font-semibold text-gray-900">{f.name} <span className="text-gray-500 font-normal">({f.email})</span></p>
                      <p className="text-red-700 text-[11px] mt-0.5">{f.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowBulkApproveResultsModal(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER IMPORT PREVIEW MODAL */}
      {showTeacherImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Import Teachers Masterlist</h3>
                <p className="text-xs text-gray-500 mt-1">Review parsed teacher records before creating registration requests</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTeacherImportModal(false)}
                disabled={isSavingTeacherImport}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Total Parsed</p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5">{teacherImportSummary.total}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <p className="text-[10px] text-emerald-700 font-bold uppercase">Ready</p>
                  <p className="text-lg font-bold text-emerald-800 mt-0.5">{teacherImportSummary.valid.length}</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <p className="text-[10px] text-amber-700 font-bold uppercase">Missing Email</p>
                  <p className="text-lg font-bold text-amber-800 mt-0.5">{teacherImportSummary.missingEmail.length}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                  <p className="text-[10px] text-blue-700 font-bold uppercase">Duplicates</p>
                  <p className="text-lg font-bold text-blue-800 mt-0.5">{teacherImportSummary.duplicates.length}</p>
                </div>
              </div>

              <div className="flex border-b border-gray-200 gap-2">
                <button
                  type="button"
                  onClick={() => setTeacherImportTab("valid")}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 ${teacherImportTab === "valid" ? "border-emerald-600 text-emerald-600" : "border-transparent text-gray-500"}`}
                >
                  Ready ({teacherImportSummary.valid.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherImportTab("missingEmail")}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 ${teacherImportTab === "missingEmail" ? "border-amber-600 text-amber-600" : "border-transparent text-gray-500"}`}
                >
                  Missing Email ({teacherImportSummary.missingEmail.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherImportTab("duplicates")}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 ${teacherImportTab === "duplicates" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}
                >
                  Duplicates ({teacherImportSummary.duplicates.length})
                </button>
                {teacherImportSummary.invalid.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTeacherImportTab("invalid")}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 ${teacherImportTab === "invalid" ? "border-red-600 text-red-600" : "border-transparent text-gray-500"}`}
                  >
                    Invalid ({teacherImportSummary.invalid.length})
                  </button>
                )}
              </div>

              {teacherImportTab === "valid" && (
                <div className="max-h-52 overflow-y-auto border rounded-xl divide-y text-xs">
                  {teacherImportSummary.valid.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">No ready records found.</p>
                  ) : (
                    teacherImportSummary.valid.map((t, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <span className="font-bold text-gray-900">{t.fullName}</span>
                          <span className="text-gray-500 ml-2">{t.employee_id ? `(ID: ${t.employee_id})` : ""}</span>
                        </div>
                        <div className="text-right font-mono text-gray-600">
                          <span>{t.email}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {teacherImportTab === "missingEmail" && (
                <div className="max-h-52 overflow-y-auto border border-amber-200 rounded-xl divide-y text-xs bg-amber-50/30">
                  {teacherImportSummary.missingEmail.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">No missing email records.</p>
                  ) : (
                    teacherImportSummary.missingEmail.map((t, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900">{t.fullName}</p>
                          <p className="text-amber-700 text-[11px] mt-0.5">{t.reason}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                          Missing Email
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {teacherImportTab === "duplicates" && (
                <div className="max-h-52 overflow-y-auto border border-blue-200 rounded-xl divide-y text-xs bg-blue-50/30">
                  {teacherImportSummary.duplicates.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">No duplicate records.</p>
                  ) : (
                    teacherImportSummary.duplicates.map((t, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900">{t.fullName} <span className="text-gray-500 font-normal">({t.email})</span></p>
                          <p className="text-blue-700 text-[11px] mt-0.5">{t.reason}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">
                          Duplicate
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {teacherImportTab === "invalid" && (
                <div className="max-h-52 overflow-y-auto border border-red-200 rounded-xl divide-y text-xs bg-red-50/30">
                  {teacherImportSummary.invalid.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">No invalid records.</p>
                  ) : (
                    teacherImportSummary.invalid.map((t, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900">{t.fullName}</p>
                          <p className="text-red-700 text-[11px] mt-0.5">{t.reason}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold text-[10px]">
                          Invalid
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleDownloadTeacherSampleCsv}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Sample CSV
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTeacherImportModal(false)}
                    disabled={isSavingTeacherImport}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTeacherImport}
                    disabled={isSavingTeacherImport || teacherImportSummary.valid.length === 0}
                    className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingTeacherImport && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {isSavingTeacherImport ? "Importing..." : `Confirm & Create ${teacherImportSummary.valid.length} Registration Request(s)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { TeacherManagement };
export default TeacherManagement;
