import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { SectionDropdown } from "../../components/admin/SectionDropdown";
import { toast } from "sonner";
import { supabase } from "../../lib/supabaseClient";
import { adminApi } from "@/app/lib/adminApi";
import { GoogleSheetsImportModal } from "@/app/components/admin/GoogleSheetsImportModal";
import { useActivity } from "../../lib/ActivityContext";
import { useCachedFetch } from "@/app/hooks/useCachedFetch";
import { notifyAdmin } from "@/app/services/notificationService";
import { Search, UserPlus, Eye, Edit, Trash2, Download, X, Mail, Phone, Hash, CalendarDays, Users, Loader2, AlertTriangle, Sparkles, Upload, CheckSquare, Square, Key, User, CheckCircle2, BookOpen } from "lucide-react";

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

const formatSectionName = (secStr) => {
  const clean = String(secStr || "").trim();
  if (!clean || clean.toLowerCase() === "unassigned" || clean.toLowerCase() === "unassigned section" || clean.toLowerCase() === "unknown") return null;
  return clean.split(/\s+/).map(w => {
    if (/^[a-z]/.test(w)) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
    return w;
  }).join(" ");
};

const normalizeYearLevel = (rawVal) => {
  if (!rawVal) return null;
  const str = String(rawVal).trim();
  const numMatch = str.match(/\d+/);
  return numMatch ? numMatch[0] : str;
};

const splitFullName = (fullNameStr) => {
  const parts = String(fullNameStr || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
  const last_name = parts.pop();
  const first_name = parts.join(" ");
  return { first_name, last_name };
};

function StudentManagement() {
  const navigate = useNavigate();
  const { logActivity } = useActivity();
  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [resetSettings, setResetSettings] = useState({ forceChange: true, tempPassword: "" });
  const [studentFormData, setStudentFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    email: "",
    lrn: "",
    year_level: "",
    section: "",
    status: "Active"
  });
  const [editFormData, setEditFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    email: "",
    lrn: "",
    year_level: "",
    section: "",
    status: "Active"
  });
  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fetchError, setFetchError] = useState(null);
  const [gradeSectionsMap, setGradeSectionsMap] = useState({});

  // New state variables for Masterlist & Registration Requests
  const [masterlist, setMasterlist] = useState([]);
  const [activeTab, setActiveTab] = useState("Profiles"); // "Profiles", "Masterlist", or "RegistrationRequests"
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [registrationSubTab, setRegistrationSubTab] = useState("pending"); // "pending", "approved", "rejected"
  const [showViewRequestModal, setShowViewRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApproveRequestModal, setShowApproveRequestModal] = useState(false);
  const [showRejectRequestModal, setShowRejectRequestModal] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [selectedMasterlistIds, setSelectedMasterlistIds] = useState(new Set());
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [selectedPendingRequestIds, setSelectedPendingRequestIds] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showClearMasterlistConfirm, setShowClearMasterlistConfirm] = useState(false);
  const [isClearingMasterlist, setIsClearingMasterlist] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showImportPreviewModal, setShowImportPreviewModal] = useState(false);
  const [importPreviewSummary, setImportPreviewSummary] = useState({
    total: 0,
    valid: [],
    invalid: [],
    duplicates: []
  });
  const [previewTab, setPreviewTab] = useState("valid");
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false);

  const handleConfirmGoogleSheetsImport = async ({ validRecords }) => {
    if (!db) throw new Error("Supabase client not configured");

    const recordsToInsert = validRecords.map((r) => ({
      first_name: r.first_name,
      middle_name: r.middle_name || null,
      last_name: r.last_name,
      suffix: r.suffix || null,
      email: r.email,
      lrn: r.lrn,
      year_level: r.year_level || null,
      section: r.section || null,
      account_created: false
    }));

    const { error } = await adminApi.db("student_masterlist", "insert", {
      payload: recordsToInsert
    });
    if (error) throw error;

    toast.success(`Successfully imported ${recordsToInsert.length} student record(s) from Google Sheets to Masterlist!`, { duration: 6000 });

    const { data } = await db.from("student_masterlist").select("*").order("created_at", { ascending: false });
    if (data) setMasterlist(data);

    setActiveTab("Masterlist");
    await refreshStudents();
  };

  // Registration Requests Bulk Import States
  const [showRegistrationBulkImportModal, setShowRegistrationBulkImportModal] = useState(false);
  const [registrationImportText, setRegistrationImportText] = useState("");
  const [registrationImportSummary, setRegistrationImportSummary] = useState({
    total: 0,
    valid: [],
    invalid: [],
    duplicates: []
  });
  const [registrationImportTab, setRegistrationImportTab] = useState("valid");
  const [isSavingRegistrationImport, setIsSavingRegistrationImport] = useState(false);

  // Bulk Approval States
  const [showBulkApproveConfirmModal, setShowBulkApproveConfirmModal] = useState(false);
  const [showBulkApproveProgressModal, setShowBulkApproveProgressModal] = useState(false);
  const [bulkApproveProgress, setBulkApproveProgress] = useState({
    total: 0,
    current: 0,
    currentStudentName: ""
  });
  const [showBulkApproveResultsModal, setShowBulkApproveResultsModal] = useState(false);
  const [bulkApproveResultsSummary, setBulkApproveResultsSummary] = useState({
    total: 0,
    successCount: 0,
    emailSentCount: 0,
    emailFailedCount: 0,
    failures: []
  });

  // Batch account generation progress & results states
  const [showGenerationProgressModal, setShowGenerationProgressModal] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    total: 0,
    current: 0,
    percentage: 0,
    currentBatch: 0,
    totalBatches: 0
  });

  const [showGenerationResultsModal, setShowGenerationResultsModal] = useState(false);
  const [generationResultsSummary, setGenerationResultsSummary] = useState({
    total: 0,
    success: [],
    alreadyExists: [],
    failed: []
  });
  const [resultsTab, setResultsTab] = useState("success");

  // Masterlist to Registration Requests Creation States
  const [showMasterlistCreateRequestsModal, setShowMasterlistCreateRequestsModal] = useState(false);
  const [masterlistCreateSummary, setMasterlistCreateSummary] = useState({
    totalSelected: 0,
    ready: [],
    missingEmail: [],
    duplicates: []
  });
  const [masterlistCreateTab, setMasterlistCreateTab] = useState("ready");
  const [isCreatingMasterlistRequests, setIsCreatingMasterlistRequests] = useState(false);

  // Bulk section assignment states
  const [showBulkAssignSectionModal, setShowBulkAssignSectionModal] = useState(false);
  const [targetBulkSection, setTargetBulkSection] = useState("");
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [sectionCapacityInfo, setSectionCapacityInfo] = useState(null);
  const [isLoadingCapacity, setIsLoadingCapacity] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!showBulkAssignSectionModal || !targetBulkSection) {
      setSectionCapacityInfo(null);
      return;
    }

    let isMounted = true;
    const fetchCapacityInfo = async () => {
      setIsLoadingCapacity(true);
      try {
        const selectedSet = activeTab === "Profiles" ? selectedStudentIds : selectedMasterlistIds;
        const currentList = activeTab === "Profiles" ? students : masterlist;
        const selectedRows = currentList.filter(s => selectedSet.has(s.id));
        
        const firstGrade = selectedRows[0]?.year_level || "";
        const formattedGradeLevel = firstGrade ? `Grade ${firstGrade.replace(/\D/g, "")}` : "Grade 7";
        const targetNormGradeNum = formattedGradeLevel.replace(/\D/g, "");
        const cleanSection = formatSectionName(targetBulkSection);

        if (!cleanSection) {
          if (isMounted) {
            setSectionCapacityInfo(null);
            setIsLoadingCapacity(false);
          }
          return;
        }

        // Query subjects table for capacity
        const { data: subsData } = await adminApi.db("subjects", "select", {
          payload: "id, name, code, capacity, enrolled, grade_level, section"
        });

        const matchingSubs = (subsData || []).filter(s => {
          const sGradeNum = (s.grade_level || "").replace(/\D/g, "");
          const sSec = (s.section || "").trim().toLowerCase();
          return sGradeNum === targetNormGradeNum && sSec === cleanSection.toLowerCase();
        });

        let capacity = 0;
        if (matchingSubs.length > 0) {
          const caps = matchingSubs.map(s => Number(s.capacity || 0)).filter(c => c > 0);
          if (caps.length > 0) {
            capacity = Math.min(...caps);
          }
        }

        // Count enrolled profiles in this section (source of truth)
        const { count: profileEnrolledCount } = await db
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student")
          .ilike("section", cleanSection);

        const currentEnrolled = profileEnrolledCount || 0;

        // Calculate deduplicated student count
        const alreadyEnrolledCount = selectedRows.filter(s => {
          const studentSec = (s.section || "").trim().toLowerCase();
          return studentSec === cleanSection.toLowerCase();
        }).length;

        const newStudentsCount = selectedSet.size - alreadyEnrolledCount;
        const projectedEnrolled = currentEnrolled + newStudentsCount;
        const availableSlots = capacity > 0 ? Math.max(0, capacity - currentEnrolled) : "Unlimited";
        const isExceeded = capacity > 0 && projectedEnrolled > capacity;

        if (isMounted) {
          setSectionCapacityInfo({
            capacity,
            currentEnrolled,
            availableSlots,
            newStudentsCount,
            alreadyEnrolledCount,
            totalSelected: selectedSet.size,
            projectedEnrolled,
            isExceeded,
            cleanSection,
            formattedGradeLevel,
            matchingSubjects: matchingSubs
          });
        }
      } catch (err) {
        console.error("Error fetching capacity info:", err);
      } finally {
        if (isMounted) setIsLoadingCapacity(false);
      }
    };

    fetchCapacityInfo();

    return () => {
      isMounted = false;
    };
  }, [showBulkAssignSectionModal, targetBulkSection, selectedStudentIds, selectedMasterlistIds, activeTab, students, masterlist]);

  useEffect(() => {
    if (showAddModal || showEditModal || showViewModal || showDeleteConfirm || showImportPreviewModal || showGenerationProgressModal || showGenerationResultsModal || showBulkAssignSectionModal || showViewRequestModal || showApproveRequestModal || showRejectRequestModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAddModal, showEditModal, showViewModal, showDeleteConfirm, showImportPreviewModal, showGenerationProgressModal, showGenerationResultsModal, showBulkAssignSectionModal, showViewRequestModal, showApproveRequestModal, showRejectRequestModal]);

  useEffect(() => {
    if (students && students.length >= 0) {
      const validIds = new Set(students.map(s => s.id));
      setSelectedStudentIds(prev => {
        let changed = false;
        const next = new Set();
        for (const id of prev) {
          if (validIds.has(id)) next.add(id);
          else changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, [students]);

  useEffect(() => {
    if (masterlist && masterlist.length >= 0) {
      const validIds = new Set(masterlist.map(m => m.id));
      setSelectedMasterlistIds(prev => {
        let changed = false;
        const next = new Set();
        for (const id of prev) {
          if (validIds.has(id)) next.add(id);
          else changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, [masterlist]);

  useEffect(() => {
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
  }, [navigate]);

  const fetchRegistrationRequests = useCallback(async () => {
    try {
      const res = await adminApi.db("pending_account_requests", "select", {
        payload: "*",
        eq: { column: "request_type", value: "student" },
        order: { column: "created_at", options: { ascending: false } }
      });
      if (res.error) {
        console.error("Error fetching registration requests via adminApi:", res.error);
        return [];
      }
      return res.data || [];
    } catch (err) {
      console.error("Fetch registration requests exception:", err);
      return [];
    }
  }, []);

  const fetchStudentsData = useCallback(async () => {
    if (!db) return null;
    let profilesRes = await adminApi.db("profiles", "select", {
      payload: "*",
      eq: { column: "role", value: "student" },
      order: { column: "created_at", options: { ascending: false } }
    });

    const [masterlistRes, requestsData] = await Promise.all([
      adminApi.db("student_masterlist", "select", {
        payload: "*",
        order: { column: "created_at", options: { ascending: false } }
      }),
      fetchRegistrationRequests()
    ]);

    if (profilesRes.error) {
      throw new Error(profilesRes.error.message);
    }

    return {
      students: profilesRes.data ?? [],
      masterlist: masterlistRes.data ?? [],
      registrationRequests: requestsData ?? []
    };
  }, [fetchRegistrationRequests]);

  const { data: cachedStudentsData, loading: isCachedLoading } = useCachedFetch("admin_students_data", fetchStudentsData);

  useEffect(() => {
    if (cachedStudentsData) {
      setStudents(cachedStudentsData.students || []);
      setMasterlist(cachedStudentsData.masterlist || []);
      setRegistrationRequests(cachedStudentsData.registrationRequests || []);
      setLoading(false);
    } else {
      setLoading(isCachedLoading);
    }
  }, [cachedStudentsData, isCachedLoading]);

  useEffect(() => {
    if (activeTab === "RegistrationRequests") {
      fetchRegistrationRequests().then((reqs) => {
        if (Array.isArray(reqs)) {
          setRegistrationRequests(reqs);
        }
      });
    }
  }, [activeTab, fetchRegistrationRequests]);

  // Realtime subscription for student data, registrations, and masterlist
  useEffect(() => {
    if (!db) return;

    const channel = db
      .channel("admin-students-realtime-v1")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_account_requests" },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new?.request_type === "student") {
            toast.info("New student registration received");
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
          if (payload.new?.role === "student" || payload.old?.role === "student") {
            refreshStudents();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_masterlist" },
        () => {
          refreshStudents();
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [fetchRegistrationRequests]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const refreshStudents = async () => {
    if (!db) return;

    let profilesRes = await adminApi.db("profiles", "select", {
      payload: "*",
      eq: { column: "role", value: "student" },
      order: { column: "created_at", options: { ascending: false } }
    });

    const [masterlistRes, gradeSectionsRes, requestsData] = await Promise.all([
      adminApi.db("student_masterlist", "select", {
        payload: "*",
        order: { column: "created_at", options: { ascending: false } }
      }),
      adminApi.db("grade_sections", "select", { payload: "*" }),
      fetchRegistrationRequests()
    ]);

    if (profilesRes.error) {
      throw new Error(profilesRes.error.message);
    }

    const fetchedProfiles = profilesRes.data ?? [];
    setStudents(fetchedProfiles);
    setRegistrationRequests(requestsData ?? []);

    // Auto-backfill missing usernames for existing student profiles efficiently
    const missingUsernameStudents = fetchedProfiles.filter(s => !s.username);
    if (missingUsernameStudents.length > 0) {
      (async () => {
        const usedUsernames = new Set(fetchedProfiles.map(p => p.username).filter(Boolean));
        let updatedAny = false;
        
        // Process in batches of 5 to avoid sequential N+1 network waterfall
        const BATCH_SIZE = 5;
        for (let i = 0; i < missingUsernameStudents.length; i += BATCH_SIZE) {
          const chunk = missingUsernameStudents.slice(i, i + BATCH_SIZE);
          await Promise.all(chunk.map(async (s) => {
            const firstInitial = (s.first_name || "").charAt(0).toLowerCase().replace(/[^a-z]/g, "");
            const lastNameLow = (s.last_name || "").trim().toLowerCase().replace(/[^a-z]/g, "");
            const baseUsername = (firstInitial + lastNameLow) || "student";
            let genUsername = `${baseUsername}01`;
            let suffix = 1;
            while (usedUsernames.has(genUsername)) {
              suffix++;
              genUsername = `${baseUsername}${suffix.toString().padStart(2, "0")}`;
            }
            usedUsernames.add(genUsername);

            const { error: updErr } = await adminApi.db("profiles", "update", {
              payload: { username: genUsername },
              eq: { column: "id", value: s.id }
            });
            if (!updErr) updatedAny = true;
          }));
        }

        if (updatedAny) {
          const { data: updatedProfiles } = await adminApi.db("profiles", "select", {
            payload: "id, username, first_name, middle_name, last_name, email, lrn, year_level, section, status, role, created_at",
            eq: { column: "role", value: "student" },
            order: { column: "created_at", options: { ascending: false } }
          });
          if (updatedProfiles) setStudents(updatedProfiles);
        }
      })();
    }

    // Auto-backfill missing sections/year_levels from masterlist or teacher_student_assignments
    const missingSectionStudents = fetchedProfiles.filter(s => !s.section || !s.year_level);
    if (missingSectionStudents.length > 0) {
      (async () => {
        let updatedSectionAny = false;
        const masterlistData = masterlistRes.data ?? [];
        const masterlistByLrn = new Map((masterlistData).filter(m => m.lrn).map(m => [m.lrn, m]));

        const missingIds = missingSectionStudents.map(s => s.id);
        const { data: assignData } = db ? await db
          .from("teacher_student_assignments")
          .select("student_id, section, subjects(grade_level, section)")
          .in("student_id", missingIds) : { data: [] };

        const assignByStudentId = new Map();
        (assignData || []).forEach(a => {
          const sec = a.section || a.subjects?.section;
          const gr = a.subjects?.grade_level;
          if (sec && !assignByStudentId.has(a.student_id)) {
            assignByStudentId.set(a.student_id, { section: sec, grade_level: gr });
          }
        });

        for (const s of missingSectionStudents) {
          const mRecord = s.lrn ? masterlistByLrn.get(s.lrn) : null;
          const aRecord = assignByStudentId.get(s.id);

          const targetSection = (mRecord?.section || aRecord?.section) ? formatSectionName(mRecord?.section || aRecord?.section) : null;
          const targetGrade = (mRecord?.year_level || aRecord?.grade_level) ? normalizeYearLevel(mRecord?.year_level || aRecord?.grade_level) : null;

          const pPayload = {};
          if (!s.section && targetSection) pPayload.section = targetSection;
          if (!s.year_level && targetGrade) pPayload.year_level = targetGrade;

          if (Object.keys(pPayload).length > 0) {
            const { error: updErr } = await adminApi.db("profiles", "update", {
              payload: pPayload,
              eq: { column: "id", value: s.id }
            });
            if (!updErr) updatedSectionAny = true;
          }
        }

        if (updatedSectionAny) {
          const { data: updatedProfiles } = await adminApi.db("profiles", "select", {
            payload: "id, username, first_name, middle_name, last_name, email, lrn, year_level, section, status, role, created_at",
            eq: { column: "role", value: "student" },
            order: { column: "created_at", options: { ascending: false } }
          });
          if (updatedProfiles) setStudents(updatedProfiles);
        }
      })();
    }

    if (!masterlistRes.error) {
      setMasterlist(masterlistRes.data ?? []);
    }
    
    if (!gradeSectionsRes.error && gradeSectionsRes.data) {
      const map = {};
      gradeSectionsRes.data.forEach(row => {
        if (!map[row.grade_level]) map[row.grade_level] = [];
        map[row.grade_level].push(row.section_name);
      });
      setGradeSectionsMap(map);
    }
  };

  const getFullName = (student) => [student.first_name, student.middle_name, student.last_name, student.suffix].filter(Boolean).join(" ");

  const getDisplayUsername = (student) => {
    if (student?.username) return student.username;
    if (student?.email && !student.email.endsWith("@students.connected") && !student.email.endsWith("@temp.local")) {
      const prefix = student.email.split("@")[0];
      if (prefix && !/^\d+$/.test(prefix)) return prefix;
    }
    const firstInitial = (student?.first_name || "").charAt(0).toLowerCase().replace(/[^a-z0-9]/g, "");
    const lastNameClean = (student?.last_name || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (firstInitial && lastNameClean) {
      return `${firstInitial}${lastNameClean}01`;
    }
    return "student01";
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };


  const normalizeLrn = (value) => value.replace(/\D/g, "").slice(0, 12);
  const normalizeYearLevel = (value) => value.replace(/\D/g, "").slice(0, 2);

  const validateAddField = (field, value, formData) => {
    const trimmedValue = typeof value === "string" ? value.trim() : value;

    switch (field) {
      case "first_name":
        if (!trimmedValue) return "First name is required";
        if (!/^[A-Za-z\s.\-]+$/.test(trimmedValue)) return "First name must contain letters only";
        return "";
      case "last_name":
        if (!trimmedValue) return "Last name is required";
        if (!/^[A-Za-z\s.\-]+$/.test(trimmedValue)) return "Last name must contain letters only";
        return "";
      case "email":
        if (!trimmedValue) return "Email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) return "Invalid email format";
        return "";
      case "lrn":
        if (!trimmedValue) return "LRN is required";
        if (!/^\d+$/.test(String(trimmedValue))) return "LRN must contain numbers only";
        if (String(trimmedValue).length !== 12) return "LRN must be exactly 12 digits";
        return "";
      case "year_level":
        if (!trimmedValue) return "Year level is required";
        if (!/^\d+$/.test(String(trimmedValue))) return "Year level must be a valid number";
        if (String(trimmedValue).length > 2) return "Year level must be at most 2 digits";
        return "";

      case "section":
        return "";
      case "status":
        if (!trimmedValue) return "Status is required";
        return "";
      default:
        return "";
    }
  };

  const handleAddStudentFieldChange = (field, value) => {
    setStudentFormData((current) => {
      const nextValue = field === "lrn" ? normalizeLrn(value) : field === "year_level" ? normalizeYearLevel(value) : value;
      const nextFormData = { ...current, [field]: nextValue };
      if (field === "year_level") {
        nextFormData.section = ""; // Automatically clear the selected Section if the Grade Level changes.
      }
      const fieldError = validateAddField(field, nextValue, nextFormData);

      setFormErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };

        if (fieldError) {
          nextErrors[field] = fieldError;
        } else {
          delete nextErrors[field];
        }

        return nextErrors;
      });

      return nextFormData;
    });
  };

  const handleEditFieldChange = (field, value) => {
    setEditFormData((current) => {
      const nextValue = field === "lrn" ? normalizeLrn(value) : field === "year_level" ? normalizeYearLevel(value) : value;
      const nextFormData = { ...current, [field]: nextValue };
      if (field === "year_level") {
        nextFormData.section = "";
      }
      const fieldError = validateAddField(field, nextValue, nextFormData);

      setEditFormErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };

        if (fieldError) {
          nextErrors[field] = fieldError;
        } else {
          delete nextErrors[field];
        }

        return nextErrors;
      });

      return nextFormData;
    });
  };

  const buildPayload = (formData) => {
    const payload = {
      first_name: formData.first_name.trim(),
      middle_name: formData.middle_name.trim() || null,
      last_name: formData.last_name.trim(),
      email: formData.email.trim().toLowerCase(),
      lrn: normalizeLrn(formData.lrn),
      year_level: normalizeYearLevel(formData.year_level),
      section: formData.section?.trim() || null,
      status: formData.status,
      role: "student"
    };
    if (formData.suffix?.trim()) {
      payload.suffix = formData.suffix.trim();
    }
    return payload;
  };

  const validateStudentForm = async (formData, excludeId = null) => {
    const errors = {};

    const fieldNames = ["first_name", "last_name", "email", "lrn", "year_level", "status"];

    fieldNames.forEach((field) => {
      const fieldError = validateAddField(field, formData[field], formData);
      if (fieldError) errors[field] = fieldError;
    });

    if (Object.keys(errors).length > 0) {
      return errors;
    }

    if (!db) {
      errors.form = "Supabase client is not configured.";
      return errors;
    }

    const trimmedLrn = normalizeLrn(formData.lrn);
    const trimmedEmail = (formData.email || "").trim().toLowerCase();

    // 1. Check profiles table for duplicate LRN or Email
    let lrnQuery = db.from("profiles").select("id").eq("lrn", trimmedLrn);
    if (excludeId) lrnQuery = lrnQuery.neq("id", excludeId);
    const lrnResult = await lrnQuery;

    if (lrnResult.data && lrnResult.data.length > 0) {
      errors.lrn = "LRN is already registered to a student account";
      return errors;
    }

    let emailQuery = db.from("profiles").select("id").ilike("email", trimmedEmail);
    if (excludeId) emailQuery = emailQuery.neq("id", excludeId);
    const emailResult = await emailQuery;

    if (emailResult.data && emailResult.data.length > 0) {
      errors.email = "Email address is already registered to an account";
      return errors;
    }

    // 2. Check pending_account_requests table for duplicate LRN or Email
    if (!excludeId) {
      const pendingLrnRes = await db.from("pending_account_requests").select("id").eq("lrn", trimmedLrn).eq("status", "pending").limit(1);
      if (pendingLrnRes.data && pendingLrnRes.data.length > 0) {
        errors.lrn = "A pending registration request already exists for this LRN";
        return errors;
      }

      const pendingEmailRes = await db.from("pending_account_requests").select("id").ilike("email", trimmedEmail).eq("status", "pending").limit(1);
      if (pendingEmailRes.data && pendingEmailRes.data.length > 0) {
        errors.email = "A pending registration request already exists for this email address";
        return errors;
      }
    }

    if (formData.section && formData.year_level) {
      const cleanSec = formatSectionName(formData.section);
      const normGrade = normalizeYearLevel(formData.year_level);
      if (cleanSec && normGrade) {
        const originalStudent = excludeId ? students.find(s => s.id === excludeId) : null;
        const isSameSection = originalStudent && (originalStudent.section || "").trim().toLowerCase() === cleanSec.toLowerCase();

        if (!isSameSection) {
          const { data: subsData } = await adminApi.db("subjects", "select", {
            payload: "capacity, grade_level, section"
          });

          const matchingSubs = (subsData || []).filter(s => {
            const sGradeNum = (s.grade_level || "").replace(/\D/g, "");
            const sSec = (s.section || "").trim().toLowerCase();
            return sGradeNum === normGrade && sSec === cleanSec.toLowerCase();
          });

          let capacity = 0;
          if (matchingSubs.length > 0) {
            const caps = matchingSubs.map(s => Number(s.capacity || 0)).filter(c => c > 0);
            if (caps.length > 0) capacity = Math.min(...caps);
          }

          if (capacity > 0) {
            const { count: enrolledCount } = await db
              .from("profiles")
              .select("id", { count: "exact", head: true })
              .eq("role", "student")
              .ilike("section", cleanSec);

            if ((enrolledCount || 0) >= capacity) {
              errors.section = `Section ${cleanSec} is at full capacity (${enrolledCount}/${capacity} students).`;
            }
          }
        }
      }
    }

    return errors;
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const validationErrors = await validateStudentForm(studentFormData);
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (!db) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const externalRequestId = `admin-student-${timestamp}-${randomStr}`;

      const requestPayload = {
        request_type: "student",
        first_name: studentFormData.first_name.trim(),
        middle_name: studentFormData.middle_name.trim() || null,
        last_name: studentFormData.last_name.trim(),
        suffix: studentFormData.suffix.trim() || null,
        email: studentFormData.email.trim().toLowerCase(),
        lrn: normalizeLrn(studentFormData.lrn),
        grade_level: normalizeYearLevel(studentFormData.year_level),
        section: formatSectionName(studentFormData.section) || null,
        status: "pending",
        source: "admin",
        external_request_id: externalRequestId
      };

      const { data, error } = await adminApi.db("pending_account_requests", "insert", {
        payload: requestPayload,
        single: true
      });

      if (error) {
        throw new Error(error.message || "Failed to create student registration request.");
      }

      const studentName = [studentFormData.first_name, studentFormData.middle_name, studentFormData.last_name, studentFormData.suffix].filter(Boolean).join(" ");
      logActivity({
        actionType: "submitted_registration_request",
        entityType: "student",
        entityId: externalRequestId,
        entityName: studentName,
        details: { email: studentFormData.email, source: "admin" },
        timestamp: new Date().toISOString()
      });

      notifyAdmin({
        type: "account",
        title: "New Student Registration Request",
        message: `Admin added a new student registration request for ${studentName}`,
        relatedId: data?.id || externalRequestId,
        relatedType: "pending_account_requests",
        path: "/admin/students"
      });

      setStudentFormData({
        first_name: "",
        middle_name: "",
        last_name: "",
        suffix: "",
        email: "",
        lrn: "",
        year_level: "",
        section: "",
        status: "Active"
      });
      setFormErrors({});
      setShowAddModal(false);
      setActiveTab("RegistrationRequests");
      setRegistrationSubTab("pending");

      toast.success("Student registration request submitted! The student has been queued for admin approval.", { duration: 5000 });

      const reqs = await fetchRegistrationRequests();
      if (Array.isArray(reqs)) setRegistrationRequests(reqs);
    } catch (error) {
      console.error("Add student registration request error:", error);
      const errMsg = error?.message || (typeof error === "string" ? error : "Unable to submit student registration request.");
      toast.error(errMsg);
      setFormErrors((current) => ({
        ...current,
        form: errMsg
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!selectedStudent) return;

    const validationErrors = await validateStudentForm(editFormData, selectedStudent.id);
    setEditFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (!db) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await adminApi.updateProfile(
        selectedStudent.id,
        buildPayload(editFormData)
      );

      if (error) {
        throw error;
      }

      if (data) {
        setStudents((current) => current.map((student) => (student.id === data.id ? data : student)));
        setSelectedStudent(data);
        const studentName = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ");
        logActivity({
          actionType: "updated",
          entityType: "student",
          entityId: data.id,
          entityName: studentName,
          details: { email: data.email, lrn: data.lrn, section: data.section },
          timestamp: new Date().toISOString()
        });
        notifyAdmin({
          type: "account",
          title: "Student Account Updated",
          message: `Student account updated for ${studentName}`,
          relatedId: data.id,
          relatedType: "profiles",
          path: "/admin/students"
        });
      }

      setEditFormData({
        first_name: "",
        middle_name: "",
        last_name: "",
        email: "",
        lrn: "",
        year_level: "",

        section: "",
        status: "Active"
      });
      setEditFormErrors({});
      setShowEditModal(false);
      toast.success("Student account updated successfully.");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unable to update student.";
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- CSV Import Helpers & Dictionary Mapping ---
  const HEADER_MAPPINGS = {
    lrn: ["lrn", "student_lrn", "student lrn", "id_number", "id number"],
    first_name: ["first_name", "first name", "firstname", "first", "given_name", "given name"],
    last_name: ["last_name", "last name", "lastname", "last", "surname", "family_name", "family name"],
    middle_name: ["middle_name", "middle name", "middlename", "middle", "middle_initial", "middle initial"],
    suffix: ["suffix", "name_extension", "name extension", "extension", "ext"],
    full_name: ["full_name", "full name", "fullname", "student name", "student_name", "name"],
    year_level: ["year_level", "year level", "yearlevel", "year", "grade", "grade_level", "grade level", "level"],
    section: ["section", "section_name", "section name", "class_section", "class section"],
    email: ["email", "email_address", "email address"]
  };

  const normalizeHeaderKey = (headerStr) => {
    return String(headerStr || "").toLowerCase().trim().replace(/[\s\-_]+/g, "");
  };

  const matchHeaderField = (rawHeader) => {
    const norm = normalizeHeaderKey(rawHeader);
    for (const [field, aliases] of Object.entries(HEADER_MAPPINGS)) {
      if (aliases.some(alias => normalizeHeaderKey(alias) === norm)) {
        return field;
      }
    }
    return null;
  };

  const splitFullName = (fullNameStr) => {
    const clean = String(fullNameStr || "").trim();
    if (!clean) return { first_name: "", last_name: "" };
    const parts = clean.split(/\s+/);
    if (parts.length === 1) {
      return { first_name: parts[0], last_name: parts[0] };
    }
    return {
      first_name: parts[0],
      last_name: parts.slice(1).join(" ")
    };
  };

  const parseCsvText = (text) => {
    const lines = text.split(/\r?\n/);
    const rows = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const cells = [];
      let insideQuotes = false;
      let currentCell = "";
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          cells.push(currentCell.trim().replace(/^"+|"+$/g, ''));
          currentCell = "";
        } else {
          currentCell += char;
        }
      }
      cells.push(currentCell.trim().replace(/^"+|"+$/g, ''));
      if (cells.some(c => c !== "")) {
        rows.push(cells);
      }
    }
    return rows;
  };

  const downloadCsvTemplate = () => {
    const csvContent = "lrn,first_name,last_name,year_level,section\n120000000001,Juan,Dela Cruz,10,Emerald\n120000000002,Maria,Santos,10,Diamond";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "Student_Masterlist_Import_Template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV template downloaded.");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Invalid file format. Please upload a CSV file.");
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = parseCsvText(text);

        if (rows.length < 2) {
          toast.error("CSV file is empty or missing data rows.");
          setIsImporting(false);
          return;
        }

        const rawHeaders = rows[0];
        const headerMap = {};
        rawHeaders.forEach((h, idx) => {
          const field = matchHeaderField(h);
          if (field) headerMap[field] = idx;
        });

        const hasLrn = headerMap.lrn !== undefined;
        const hasNames = (headerMap.first_name !== undefined && headerMap.last_name !== undefined) || headerMap.full_name !== undefined;
        const hasGradeLevel = headerMap.year_level !== undefined;

        if (!hasLrn || !hasNames || !hasGradeLevel) {
          const missing = [];
          if (!hasLrn) missing.push("LRN");
          if (!hasNames) missing.push("First Name & Last Name (or Full Name)");
          if (!hasGradeLevel) missing.push("Grade Level (Year Level)");

          toast.error(`Invalid CSV format: Missing required column(s): ${missing.join(", ")}.`, { duration: 7000 });
          setIsImporting(false);
          return;
        }

        const [{ data: existingMasterlist }, { data: existingProfiles }, { data: existingGradeSections }] = await Promise.all([
          db ? db.from("student_masterlist").select("lrn") : { data: [] },
          adminApi.db("profiles", "select", { payload: "id, lrn, email", eq: { column: "role", value: "student" } }),
          adminApi.db("grade_sections", "select", { payload: "*" })
        ]);

        const existingMasterlistData = existingMasterlist || [];
        const existingProfilesData = existingProfiles || [];

        const dbLrnSet = new Set([
          ...existingMasterlistData.map(r => r.lrn),
          ...existingProfilesData.map(p => p.lrn)
        ].filter(Boolean));

        const dbEmailSet = new Set([
          ...existingProfilesData.map(p => p.email?.toLowerCase())
        ].filter(Boolean));

        const existingGradeSectionKeySet = new Set(
          (existingGradeSections || []).map(gs => `${String(gs.grade_level).replace(/\D/g, "")}_${String(gs.section_name).trim().toLowerCase()}`)
        );

        const validRecords = [];
        const missingEmailRecords = [];
        const alreadyExistingRecords = [];
        const invalidRecords = [];
        const duplicateRecords = [];
        const fileLrnSet = new Set();
        const sectionBreakdown = {};
        const newGradeSectionsToCreate = [];
        const addedSectionKeySet = new Set();

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          const rowNum = i + 1;

          if (!cols || cols.length === 0 || cols.every(c => !c || !c.trim())) {
            continue; // Skip blank rows
          }

          let rawLrn = (cols[headerMap.lrn] || "").trim();
          let cleanLrn = rawLrn.replace(/\D/g, "");

          // Check for scientific notation e.g. 1.23456789012E+11
          if (/^\d+(\.\d+)?[eE]\+\d+$/.test(rawLrn)) {
            try {
              const num = Number(rawLrn);
              if (!isNaN(num)) {
                const fullStr = num.toLocaleString('fullwide', { useGrouping: false });
                if (/^\d{12}$/.test(fullStr)) {
                  cleanLrn = fullStr;
                }
              }
            } catch (e) {}
          }

          let firstName = "";
          let lastName = "";
          let middleName = headerMap.middle_name !== undefined ? (cols[headerMap.middle_name] || "").trim() : null;

          if (headerMap.first_name !== undefined && headerMap.last_name !== undefined) {
            firstName = (cols[headerMap.first_name] || "").trim();
            lastName = (cols[headerMap.last_name] || "").trim();
          } else if (headerMap.full_name !== undefined) {
            const split = splitFullName(cols[headerMap.full_name]);
            firstName = split.first_name;
            lastName = split.last_name;
          }

          const rawYearLevel = headerMap.year_level !== undefined ? (cols[headerMap.year_level] || "").trim() : "";
          const yearLevel = rawYearLevel ? normalizeYearLevel(rawYearLevel) : null;

          const rawSection = headerMap.section !== undefined ? (cols[headerMap.section] || "").trim() : "";
          const section = rawSection ? formatSectionName(rawSection) : null;
          const email = headerMap.email !== undefined ? (cols[headerMap.email] || "").trim() : null;

          const fullNameDisplay = [firstName, lastName].filter(Boolean).join(" ") || "N/A";

          // LRN Validation (12-digit numeric)
          if (!cleanLrn || cleanLrn.length !== 12) {
            invalidRecords.push({
              rowNum,
              lrn: rawLrn || "Empty",
              name: fullNameDisplay,
              reason: `Row ${rowNum}: Invalid LRN (${rawLrn || "empty"}). Must contain exactly 12 numeric digits.`
            });
            continue;
          }

          if (!firstName || !lastName) {
            invalidRecords.push({
              rowNum,
              lrn: cleanLrn,
              name: fullNameDisplay,
              reason: `Row ${rowNum}: Missing student first or last name.`
            });
            continue;
          }

          if (!yearLevel) {
            invalidRecords.push({
              rowNum,
              lrn: cleanLrn,
              name: fullNameDisplay,
              reason: `Row ${rowNum}: Missing or invalid Grade Level.`
            });
            continue;
          }

          // Email Input Validation (Email is mandatory for account creation & credentials notification)
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            missingEmailRecords.push({
              rowNum,
              lrn: cleanLrn,
              fullName: fullNameDisplay,
              name: fullNameDisplay,
              email: email || "Missing",
              reason: !email ? "Missing email address." : `Invalid email address format (${email}).`
            });
            continue;
          }

          if (fileLrnSet.has(cleanLrn)) {
            duplicateRecords.push({
              rowNum,
              lrn: cleanLrn,
              name: fullNameDisplay,
              reason: `Row ${rowNum}: Duplicate LRN in uploaded CSV file (${cleanLrn}).`
            });
            continue;
          }
          fileLrnSet.add(cleanLrn);

          if (dbLrnSet.has(cleanLrn)) {
            alreadyExistingRecords.push({
              rowNum,
              lrn: cleanLrn,
              name: fullNameDisplay,
              reason: `Row ${rowNum}: Student with LRN ${cleanLrn} already exists in database.`
            });
            continue;
          }

          if (email && dbEmailSet.has(email.toLowerCase())) {
            alreadyExistingRecords.push({
              rowNum,
              lrn: cleanLrn,
              name: fullNameDisplay,
              reason: `Row ${rowNum}: Email ${email} already exists in database.`
            });
            continue;
          }

          validRecords.push({
            rowNum,
            lrn: cleanLrn,
            first_name: firstName,
            last_name: lastName,
            middle_name: middleName || null,
            year_level: yearLevel || null,
            section: section || null,
            email: email || null,
            account_created: false
          });

          const ylKey = yearLevel || "Unassigned";
          const secKey = section || "Unassigned";
          if (!sectionBreakdown[ylKey]) sectionBreakdown[ylKey] = {};
          sectionBreakdown[ylKey][secKey] = (sectionBreakdown[ylKey][secKey] || 0) + 1;

          if (yearLevel && section) {
            const key = `${yearLevel}_${section.toLowerCase()}`;
            if (!existingGradeSectionKeySet.has(key) && !addedSectionKeySet.has(key)) {
              addedSectionKeySet.add(key);
              newGradeSectionsToCreate.push({
                grade_level: yearLevel,
                section_name: section
              });
            }
          }
        }

        const totalRows = validRecords.length + missingEmailRecords.length + alreadyExistingRecords.length + invalidRecords.length + duplicateRecords.length;

        if (totalRows === 0) {
          toast.error("No data rows found in CSV file.");
          setIsImporting(false);
          return;
        }

        setImportPreviewSummary({
          total: totalRows,
          valid: validRecords,
          missingEmail: missingEmailRecords,
          alreadyExisting: alreadyExistingRecords,
          invalid: invalidRecords,
          duplicates: duplicateRecords,
          sectionBreakdown,
          newGradeSectionsToCreate,
          hasSectionColumn: headerMap.section !== undefined
        });
        setPreviewTab(validRecords.length > 0 ? "valid" : (missingEmailRecords.length > 0 ? "missingEmail" : (alreadyExistingRecords.length > 0 ? "alreadyExisting" : (duplicateRecords.length > 0 ? "duplicates" : "invalid"))));
        setShowImportPreviewModal(true);
      } catch (err) {
        toast.error(err.message || "Failed to process CSV file.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (importPreviewSummary.valid.length === 0) {
      toast.error("No valid records to import.");
      return;
    }

    setIsSavingImport(true);
    try {
      if (!db) throw new Error("Supabase client not configured");

      // 1. Auto-create any missing sections in grade_sections table
      if (importPreviewSummary.newGradeSectionsToCreate && importPreviewSummary.newGradeSectionsToCreate.length > 0) {
        for (const gs of importPreviewSummary.newGradeSectionsToCreate) {
          try {
            await adminApi.db("grade_sections", "insert", { payload: gs });
          } catch (secErr) {
            console.warn("[handleConfirmImport] Auto section insertion warning:", secErr);
          }
        }
      }

      // 2. Insert valid student masterlist records
      const recordsToInsert = importPreviewSummary.valid.map(({ rowNum, email, ...record }) => record);

      const { error } = await db.from("student_masterlist").insert(recordsToInsert);
      if (error) throw error;

      if (!importPreviewSummary.hasSectionColumn) {
        toast.success(`Successfully imported ${recordsToInsert.length} students to masterlist! Select students to assign sections in bulk.`, { duration: 6000 });
      } else {
        toast.success(`Successfully imported ${recordsToInsert.length} students to masterlist.`);
      }

      const { data } = await db.from("student_masterlist").select("*").order("created_at", { ascending: false });
      if (data) setMasterlist(data);

      setShowImportPreviewModal(false);
      await refreshStudents();
    } catch (err) {
      toast.error(err.message || "Failed to insert masterlist records.");
    } finally {
      setIsSavingImport(false);
    }
  };

  const handleOpenBulkAssignSectionModal = () => {
    const selectedSet = activeTab === "Profiles" ? selectedStudentIds : selectedMasterlistIds;
    if (selectedSet.size === 0) {
      toast.error("Please select at least one student.");
      return;
    }

    const currentList = activeTab === "Profiles" ? students : masterlist;
    const selectedRows = currentList.filter(s => selectedSet.has(s.id));

    if (activeTab === "Masterlist") {
      const pendingAccountRows = selectedRows.filter(s => !s.account_created);
      if (pendingAccountRows.length > 0) {
        toast.warning(
          `Section assignment is only available AFTER student accounts have been generated (${pendingAccountRows.length} selected student(s) pending account creation). Please click 'Generate Accounts' first.`,
          { duration: 6000 }
        );
        return;
      }
    }

    const uniqueGradeLevels = Array.from(new Set(selectedRows.map(s => s.year_level).filter(Boolean)));

    if (uniqueGradeLevels.length > 1) {
      toast.warning(
        `Selected students belong to multiple grade levels (${uniqueGradeLevels.map(g => `Grade ${g}`).join(", ")}). Please filter by Grade Level first to assign sections per grade level.`,
        { duration: 6000 }
      );
      return;
    }

    setTargetBulkSection("");
    setShowBulkAssignSectionModal(true);
  };

  const handleConfirmBulkAssignSection = async () => {
    const selectedSet = activeTab === "Profiles" ? selectedStudentIds : selectedMasterlistIds;
    if (selectedSet.size === 0) {
      toast.error("No students selected.");
      return;
    }

    const cleanSection = formatSectionName(targetBulkSection);
    if (!cleanSection) {
      toast.error("Please select or enter a valid section name.");
      return;
    }

    if (sectionCapacityInfo?.isExceeded) {
      toast.error(`Cannot assign section: Capacity for Section ${cleanSection} will be exceeded (${sectionCapacityInfo.projectedEnrolled}/${sectionCapacityInfo.capacity}).`);
      return;
    }

    setIsBulkAssigning(true);
    try {
      const selectedIds = Array.from(selectedSet);
      const isMasterlist = activeTab !== "Profiles";

      const res = await adminApi.bulkAssignSection({
        gradeLevel: sectionCapacityInfo?.formattedGradeLevel || "Grade 7",
        targetSection: cleanSection,
        studentIds: selectedIds,
        isMasterlist
      });

      if (res.error) {
        throw new Error(res.error.message || "Failed to assign section.");
      }

      if (isMasterlist) {
        toast.success(`Successfully assigned ${selectedIds.length} masterlist record(s) to Section ${cleanSection}.`);
        setSelectedMasterlistIds(new Set());
      } else {
        toast.success(`Successfully assigned ${selectedIds.length} student(s) to Section ${cleanSection}.`);
        setSelectedStudentIds(new Set());
      }

      setShowBulkAssignSectionModal(false);
      setTargetBulkSection("");
      setSectionCapacityInfo(null);
      await refreshStudents();
    } catch (err) {
      console.error("Bulk section assignment error:", err);
      toast.error(err.message || "Failed to assign section to selected students.");
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleGenerateAccounts = async (specificIds = null) => {
    const idsToProcess = Array.isArray(specificIds) ? new Set(specificIds) : selectedMasterlistIds;
    const selected = masterlist.filter(m => idsToProcess.has(m.id) && !m.account_created);
    if (selected.length === 0) return;

    setIsGenerating(true);
    setShowGenerationProgressModal(true);
    setGenerationProgress({
      total: selected.length,
      current: 0,
      percentage: 0,
      currentBatch: 0,
      totalBatches: 0
    });

    const BATCH_SIZE = 50; // Optimized batch size for Vercel & Supabase
    const batches = [];
    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      batches.push(selected.slice(i, i + BATCH_SIZE));
    }

    setGenerationProgress(prev => ({
      ...prev,
      totalBatches: batches.length
    }));

    const allResults = {
      total: selected.length,
      success: [],
      alreadyExists: [],
      failed: []
    };

    let processedCount = 0;

    for (let bIndex = 0; bIndex < batches.length; bIndex++) {
      const batch = batches[bIndex];
      setGenerationProgress(prev => ({
        ...prev,
        currentBatch: bIndex + 1
      }));

      try {
        const { data, error } = await adminApi.batchGenerateAccounts(batch);
        if (error) throw error;

        if (data?.results && Array.isArray(data.results)) {
          data.results.forEach(res => {
            if (res.status === "success") {
              allResults.success.push(res);
            } else if (res.status === "already_exists") {
              allResults.alreadyExists.push(res);
            } else {
              allResults.failed.push(res);
            }
          });
        }
      } catch (err) {
        console.error(`[handleGenerateAccounts] Batch ${bIndex + 1} error:`, err);
        batch.forEach(student => {
          allResults.failed.push({
            id: student.id,
            lrn: student.lrn,
            name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "N/A",
            status: "failed",
            reason: err.message || "Batch network error"
          });
        });
      }

      processedCount += batch.length;
      const pct = Math.round((processedCount / selected.length) * 100);
      setGenerationProgress(prev => ({
        ...prev,
        current: processedCount,
        percentage: pct
      }));

      // Short delay for UI responsiveness
      await new Promise(r => setTimeout(r, 40));
    }

    setIsGenerating(false);
    setShowGenerationProgressModal(false);
    setSelectedMasterlistIds(new Set());

    setGenerationResultsSummary(allResults);
    setResultsTab(allResults.success.length > 0 ? "success" : (allResults.alreadyExists.length > 0 ? "alreadyExists" : "failed"));
    setShowGenerationResultsModal(true);

    await refreshStudents();
  };

  const getMasterlistStudentAccountStatus = useCallback((masterlistStudent) => {
    const normLrn = masterlistStudent.lrn ? String(masterlistStudent.lrn).replace(/\D/g, "") : "";
    const normEmail = masterlistStudent.email ? String(masterlistStudent.email).trim().toLowerCase() : "";

    // 1. Check enrolled profiles
    const isEnrolled = students.some(s => 
      (normLrn && s.lrn && String(s.lrn).replace(/\D/g, "") === normLrn) ||
      (normEmail && s.email && String(s.email).trim().toLowerCase() === normEmail)
    );

    if (isEnrolled || masterlistStudent.account_created) {
      return { label: "Account Created", badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }

    // 2. Check pending_account_requests
    const matchingReq = registrationRequests.find(r => 
      (normLrn && r.lrn && String(r.lrn).replace(/\D/g, "") === normLrn) ||
      (normEmail && r.email && String(r.email).trim().toLowerCase() === normEmail)
    );

    if (matchingReq) {
      if (matchingReq.status === "pending") {
        return { label: "Registration Pending", badgeStyle: "bg-blue-50 text-blue-700 border-blue-200" };
      }
      if (matchingReq.status === "approved") {
        return { label: "Approved", badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      }
      if (matchingReq.status === "rejected") {
        return { label: "Rejected", badgeStyle: "bg-red-50 text-red-700 border-red-200" };
      }
    }

    // 3. Check for missing email
    if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      return { label: "Missing Email", badgeStyle: "bg-amber-50 text-amber-700 border-amber-200" };
    }

    // 4. Default state
    return { label: "Not Requested", badgeStyle: "bg-gray-100 text-gray-700 border-gray-200" };
  }, [students, registrationRequests]);

  const handlePrepareMasterlistRegistrationRequests = () => {
    const selectedRows = masterlist.filter(m => selectedMasterlistIds.has(m.id));
    if (selectedRows.length === 0) {
      toast.error("Please select at least one student from the masterlist.");
      return;
    }

    const ready = [];
    const missingEmail = [];
    const duplicates = [];

    const existingPendingLrnSet = new Set(
      registrationRequests
        .filter(r => r.status === "pending" || r.status === "approved")
        .map(r => r.lrn ? String(r.lrn).replace(/\D/g, "") : null)
        .filter(Boolean)
    );
    const existingPendingEmailSet = new Set(
      registrationRequests
        .filter(r => r.status === "pending" || r.status === "approved")
        .map(r => r.email ? String(r.email).trim().toLowerCase() : null)
        .filter(Boolean)
    );
    const existingProfileLrnSet = new Set(
      students.map(s => s.lrn ? String(s.lrn).replace(/\D/g, "") : null).filter(Boolean)
    );
    const existingProfileEmailSet = new Set(
      students.map(s => s.email ? String(s.email).trim().toLowerCase() : null).filter(Boolean)
    );

    selectedRows.forEach(student => {
      const email = student.email ? String(student.email).trim().toLowerCase() : "";
      const lrn = student.lrn ? String(student.lrn).replace(/\D/g, "") : "";
      const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        missingEmail.push({ ...student, fullName, reason: "Missing or invalid email address" });
        return;
      }

      const isDuplicate =
        (lrn && (existingPendingLrnSet.has(lrn) || existingProfileLrnSet.has(lrn))) ||
        (email && (existingPendingEmailSet.has(email) || existingProfileEmailSet.has(email)));

      if (isDuplicate) {
        duplicates.push({ ...student, fullName, reason: "Pending/approved request or account already exists" });
        return;
      }

      ready.push({ ...student, fullName, email, lrn });
    });

    setMasterlistCreateSummary({
      totalSelected: selectedRows.length,
      ready,
      missingEmail,
      duplicates
    });
    setMasterlistCreateTab(ready.length > 0 ? "ready" : (missingEmail.length > 0 ? "missingEmail" : "duplicates"));
    setShowMasterlistCreateRequestsModal(true);
  };

  const handleConfirmCreateMasterlistRegistrationRequests = async () => {
    const { ready } = masterlistCreateSummary;
    if (ready.length === 0) {
      toast.error("No eligible students to create registration requests.");
      return;
    }

    setIsCreatingMasterlistRequests(true);
    try {
      const recordsToInsert = ready.map(student => ({
        request_type: "student",
        first_name: student.first_name?.trim() || "",
        middle_name: student.middle_name?.trim() || null,
        last_name: student.last_name?.trim() || "",
        suffix: student.suffix?.trim() || null,
        email: student.email,
        lrn: student.lrn,
        grade_level: normalizeYearLevel(student.year_level || student.grade_level) || "7",
        section: formatSectionName(student.section) || null,
        status: "pending",
        source: "masterlist",
        external_request_id: `masterlist-student-${student.lrn}`
      }));

      const { error } = await adminApi.db("pending_account_requests", "insert", {
        payload: recordsToInsert
      });

      if (error) throw error;

      toast.success(`Successfully created ${recordsToInsert.length} registration request(s) from masterlist!`, { duration: 5000 });
      setShowMasterlistCreateRequestsModal(false);
      setSelectedMasterlistIds(new Set());

      const reqs = await fetchRegistrationRequests();
      if (Array.isArray(reqs)) setRegistrationRequests(reqs);
      await refreshStudents();
    } catch (err) {
      console.error("Create registration requests error:", err);
      toast.error(err.message || "Failed to create registration requests.");
    } finally {
      setIsCreatingMasterlistRequests(false);
    }
  };

  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setShowViewModal(true);
  };

  const handleEditStudent = (student) => {
    setSelectedStudent(student);
    setEditFormData({
      first_name: student.first_name ?? "",
      middle_name: student.middle_name ?? "",
      last_name: student.last_name ?? "",
      suffix: student.suffix ?? "",
      email: student.email ?? "",
      lrn: student.lrn ?? "",
      year_level: student.year_level ?? "",

      section: student.section ?? "",
      status: student.status ?? "Active"
    });
    setShowEditModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setStudentFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      suffix: "",
      email: "",
      lrn: "",
      year_level: "",

      section: "",
      status: "Active",
      password: ""
    });
    setFormErrors({});
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedStudent(null);
    setEditFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      suffix: "",
      email: "",
      lrn: "",
      year_level: "",

      section: "",
      status: "Active"
    });
    setEditFormErrors({});
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setSelectedStudent(null);
  };

  const handlePromptDeleteStudent = (student) => {
    setStudentToDelete(student);
    setShowDeleteConfirm(true);
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;

    const studentId = studentToDelete.id;
    const studentName = getFullName(studentToDelete) || "this student";
    const previousStudents = students;

    if (!db) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setErrorMessage("");
    setStudents((currentStudents) => currentStudents.filter((student) => student.id !== studentId));
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
    setSelectedMasterlistIds((prev) => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });

    if (selectedStudent?.id === studentId) {
      setSelectedStudent(null);
      setShowViewModal(false);
    }

    if (showEditModal && editFormData.email === studentToDelete.email) {
      setShowEditModal(false);
      setEditFormErrors({});
    }

    setStudentToDelete(null);

    try {
      const cleanupTables = [
        { name: "notifications", col: "user_id" },
        { name: "password_reset_logs", col: "user_id" },
        { name: "conversation_participants", col: "profile_id" },
        { name: "conversation_reads", col: "user_id" },
        { name: "messages", col: "sender_id" },
        { name: "teacher_student_grades", col: "student_id" },
        { name: "teacher_assessment_submissions", col: "student_id" },
        { name: "teacher_assessment_grades", col: "student_id" },
      ];

      for (const table of cleanupTables) {
        await adminApi.db(table.name, "delete", { eq: { column: table.col, value: studentId } });
      }

      const { error } = await adminApi.db("profiles", "delete", { eq: { column: "id", value: studentId } });

      if (error) {
        throw new Error(error.message);
      }

      try {
        await adminApi.deleteUser(studentId);
      } catch (e) {
        console.error("Non-fatal: Failed to delete auth user", e);
      }

      logActivity({
        actionType: "deleted",
        entityType: "student",
        entityId: studentId,
        entityName: studentName,
        details: { email: studentToDelete.email, lrn: studentToDelete.lrn },
        timestamp: new Date().toISOString()
      });
      await refreshStudents();
      toast.success(`${studentName} deleted successfully`);
    } catch (err) {
      setStudents(previousStudents);
      const errMsg = err instanceof Error ? err.message : "Unable to delete student.";
      toast.error(errMsg);
    }
  };

  const toggleStudentSelection = (id) => {
    setSelectedStudentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleAllStudents = (filteredIds) => {
    if (selectedStudentIds.size === filteredIds.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredIds));
    }
  };

  const handleBulkDeleteStudents = async () => {
    if (selectedStudentIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const idsToDelete = Array.from(selectedStudentIds);
      const idsSet = new Set(idsToDelete);

      const res = await adminApi.bulkDeleteStudents(idsToDelete);
      if (res.error) {
        throw res.error;
      }

      const successCount = res.data?.count || idsToDelete.length;

      logActivity({
        actionType: "deleted",
        entityType: "student",
        entityName: `${successCount} students`,
        details: { action: "bulk_delete", student_ids: idsToDelete },
        timestamp: new Date().toISOString()
      });

      // Optimistically update local state for instant UI responsiveness
      setStudents(prev => prev.filter(s => !idsSet.has(s.id)));
      setSelectedStudentIds(new Set());
      setShowBulkDeleteConfirm(false);

      toast.success(`Successfully deleted ${successCount} student(s).`);
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast.error(err.message || "Unable to bulk delete students.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleClearMasterlist = async () => {
    setIsClearingMasterlist(true);
    try {
      const { error } = await db.from("student_masterlist").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      
      logActivity({
        actionType: "deleted",
        entityType: "masterlist",
        entityName: "All Imported Masterlist Records",
        details: { action: "clear_masterlist" },
        timestamp: new Date().toISOString()
      });
      
      toast.success("Imported Masterlist cleared successfully.");
      setMasterlist([]);
      setSelectedMasterlistIds(new Set());
      setShowClearMasterlistConfirm(false);
    } catch (err) {
      console.error("Clear masterlist error:", err);
      toast.error(err.message || "Unable to clear masterlist.");
    } finally {
      setIsClearingMasterlist(false);
    }
  };

  const handlePromptResetPassword = (student) => {
    setSelectedStudent(student);
    setResetSettings({
      forceChange: true,
      tempPassword: generateTempPassword()
    });
    setShowResetPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!selectedStudent) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { error: authError } = await adminApi.updateUserById(selectedStudent.id, {
        password: resetSettings.tempPassword
      });

      if (authError) {
        if (authError.message?.includes("User not found") || authError.status === 404) {
          // Fallback: If auth user was never created (due to past bugs), create it now linking the same ID
          const { error: createError } = await adminApi.createUser({
             id: selectedStudent.id,
             email: selectedStudent.email || `${selectedStudent.lrn}@students.connected`,
             password: resetSettings.tempPassword,
             email_confirm: true
          });
          if (createError) throw createError;
        } else {
          throw authError;
        }
      }

      const { error: profileError } = await adminApi.updateProfile(selectedStudent.id, {
        must_change_password: resetSettings.forceChange,
        last_password_reset: new Date().toISOString()
      });

      if (profileError) throw profileError;

      const { error: logError } = await db.from("password_reset_logs").insert({
        user_id: selectedStudent.id,
        reset_by: JSON.parse(localStorage.getItem("currentUser")).id,
        temporary_password_generated: true
      });

      if (logError) console.error("Failed to log password reset:", logError);

      await db.from("notifications").insert({
        user_id: selectedStudent.id,
        title: "Password Reset",
        message: `Your password has been reset by the administrator. Temporary Password: ${resetSettings.tempPassword}. You will be required to change your password after login.`,
        type: "system"
      });

      toast.success("Temporary password generated and saved.");
      setShowResetPasswordModal(false);
    } catch (err) {
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [statusFilter, setStatusFilter] = useState("all");
  const [yearLevelFilter, setYearLevelFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  // Optional course filter
  const [courseFilter, setCourseFilter] = useState("all");

  const availableYearLevels = useMemo(() => {
    return Array.from(new Set([...students, ...masterlist].map(s => s.year_level).filter(Boolean)))
      .filter(yl => {
        const clean = String(yl).trim().toLowerCase();
        return clean !== "11" && clean !== "grade 11" && clean !== "grade11" && clean !== "year 11" && clean !== "year11";
      })
      .sort((a, b) => {
        const numA = parseInt(String(a).replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(String(b).replace(/\D/g, ""), 10) || 0;
        return numA - numB || String(a).localeCompare(String(b));
      });
  }, [students, masterlist]);

  const availableSections = useMemo(() => {
    return Array.from(new Set(
      [...students, ...masterlist]
        .filter(s => yearLevelFilter === "all" || s.year_level === yearLevelFilter)
        .map(s => s.section)
        .filter(Boolean)
    )).sort();
  }, [students, masterlist, yearLevelFilter]);

  const availableCourses = useMemo(() => {
    return Array.from(new Set([...students, ...masterlist].map(s => s.course).filter(Boolean))).sort();
  }, [students, masterlist]);

  const filteredStudents = useMemo(() => {
    const search = (searchQuery || "").toLowerCase().trim();
    return students.filter(student => {
      const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !search || fullName.includes(search) || 
        String(student.username || "").toLowerCase().includes(search) || 
        String(student.lrn || "").toLowerCase().includes(search);

      const matchesYearLevel = yearLevelFilter === "all" || student.year_level === yearLevelFilter;
      const matchesSection = sectionFilter === "all" || student.section === sectionFilter;
      const matchesCourse = courseFilter === "all" || student.course === courseFilter;
      const matchesStatus = statusFilter === "all" || student.status === statusFilter;

      return matchesSearch && matchesYearLevel && matchesSection && matchesCourse && matchesStatus;
    });
  }, [students, searchQuery, yearLevelFilter, sectionFilter, courseFilter, statusFilter]);

  const filteredMasterlist = useMemo(() => {
    const search = (searchQuery || "").toLowerCase().trim();
    return masterlist.filter(student => {
      const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !search || fullName.includes(search) || 
        String(student.username || "").toLowerCase().includes(search) || 
        String(student.lrn || "").toLowerCase().includes(search);

      const matchesYearLevel = yearLevelFilter === "all" || student.year_level === yearLevelFilter;
      const matchesSection = sectionFilter === "all" || student.section === sectionFilter;
      const matchesCourse = courseFilter === "all" || student.course === courseFilter;

      return matchesSearch && matchesYearLevel && matchesSection && matchesCourse;
    });
  }, [masterlist, searchQuery, yearLevelFilter, sectionFilter, courseFilter]);

  const filteredRegistrationRequests = useMemo(() => {
    return registrationRequests.filter((req) => {
      if (req.status !== registrationSubTab) return false;

      if (yearLevelFilter !== "all") {
        const normReqGrade = normalizeYearLevel(req.year_level);
        const normFilterGrade = normalizeYearLevel(yearLevelFilter);
        if (normReqGrade !== normFilterGrade) return false;
      }

      if (sectionFilter !== "all") {
        const cleanReqSec = formatSectionName(req.section);
        const cleanFilterSec = formatSectionName(sectionFilter);
        if ((cleanReqSec || "").toLowerCase() !== (cleanFilterSec || "").toLowerCase()) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${req.first_name || ""} ${req.middle_name || ""} ${req.last_name || ""} ${req.suffix || ""}`.toLowerCase();
        const email = (req.email || "").toLowerCase();
        const lrn = (req.lrn || "").toLowerCase();
        return fullName.includes(q) || email.includes(q) || lrn.includes(q);
      }

      return true;
    });
  }, [registrationRequests, registrationSubTab, yearLevelFilter, sectionFilter, searchQuery]);

  const handleApproveRegistrationRequest = async () => {
    if (!selectedRequest) return;
    setIsProcessingRequest(true);
    try {
      const userData = localStorage.getItem("currentUser");
      const adminUser = userData ? JSON.parse(userData) : null;
      const adminId = adminUser?.id;

      const res = await adminApi.approveStudentRegistration({
        request_id: selectedRequest.id,
        requestId: selectedRequest.id,
        adminId
      });

      if (res.error) {
        throw new Error(res.error.message || res.error || "Failed to approve registration request.");
      }

      const isEmailSent = Boolean(res.emailSent || res.email_sent || res.data?.emailSent || res.data?.email_sent);
      const emailNotice = res.emailNotice || res.data?.emailNotice;
      const studentFullName = `${selectedRequest.first_name || ""} ${selectedRequest.last_name || ""}`.trim();

      if (isEmailSent) {
        toast.success(`Registration request approved for ${studentFullName}. Account created & credentials emailed!`);
      } else {
        toast.warning(`Account created for ${studentFullName}, but email failed: ${emailNotice || "Check Resend domain setup."}`);
      }
      setShowApproveRequestModal(false);
      setShowViewRequestModal(false);
      setSelectedRequest(null);
      await refreshStudents();
    } catch (err) {
      console.error("Approve registration error:", err);
      toast.error(err.message || "Failed to approve student registration.");
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

      const res = await adminApi.rejectStudentRegistration({
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
      const studentFullName = `${selectedRequest.first_name || ""} ${selectedRequest.last_name || ""}`.trim();

      if (isEmailSent) {
        toast.success(`Registration request rejected for ${studentFullName}. Student notified by email.`);
      } else {
        toast.warning(`Request rejected for ${studentFullName}, but email failed: ${emailNotice || "Check Resend domain setup."}`);
      }
      setShowRejectRequestModal(false);
      setShowViewRequestModal(false);
      setSelectedRequest(null);
      setRejectionReasonInput("");
      await refreshStudents();
    } catch (err) {
      console.error("Reject registration error:", err);
      toast.error(err.message || "Failed to reject student registration.");
    } finally {
      setIsProcessingRequest(false);
    }
  };

  // ==========================================
  // BULK REGISTRATION REQUESTS IMPORT LOGIC
  // ==========================================
  const processRegistrationImportText = async (rawText) => {
    if (!rawText || !rawText.trim()) {
      toast.error("No import data provided.");
      return;
    }

    setIsImporting(true);
    try {
      const rows = parseCsvText(rawText);
      if (rows.length < 2) {
        toast.error("Import data is empty or missing header row.");
        setIsImporting(false);
        return;
      }

      const rawHeaders = rows[0];
      const headerMap = {};
      rawHeaders.forEach((h, idx) => {
        const field = matchHeaderField(h);
        if (field) headerMap[field] = idx;
      });

      const hasLrn = headerMap.lrn !== undefined;
      const hasNames = (headerMap.first_name !== undefined && headerMap.last_name !== undefined) || headerMap.full_name !== undefined;
      const hasEmail = headerMap.email !== undefined;

      if (!hasLrn || !hasNames || !hasEmail) {
        const missing = [];
        if (!hasLrn) missing.push("LRN");
        if (!hasNames) missing.push("First Name & Last Name (or Full Name)");
        if (!hasEmail) missing.push("Email Address");
        toast.error(`Invalid import format: Missing required column(s): ${missing.join(", ")}.`, { duration: 7000 });
        setIsImporting(false);
        return;
      }

      const [{ data: existingProfiles }, { data: existingPending }] = await Promise.all([
        adminApi.db("profiles", "select", { payload: "id, lrn, email", eq: { column: "role", value: "student" } }),
        adminApi.db("pending_account_requests", "select", { payload: "id, lrn, email, external_request_id" })
      ]);

      const existingProfilesData = existingProfiles || [];
      const existingPendingData = existingPending || [];

      const dbLrnSet = new Set([
        ...existingProfilesData.map(p => p.lrn),
        ...existingPendingData.map(r => r.lrn)
      ].filter(Boolean));

      const dbEmailSet = new Set([
        ...existingProfilesData.map(p => p.email?.toLowerCase()),
        ...existingPendingData.map(r => r.email?.toLowerCase())
      ].filter(Boolean));

      const validRecords = [];
      const duplicateRecords = [];
      const invalidRecords = [];
      const fileLrnSet = new Set();
      const fileEmailSet = new Set();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row.every(cell => !cell || !cell.trim())) continue;

        const rowNum = i + 1;
        const lrnVal = headerMap.lrn !== undefined ? (row[headerMap.lrn] || "").trim() : "";
        const cleanLrn = lrnVal.replace(/\D/g, "");

        let firstName = "";
        let lastName = "";
        let middleName = headerMap.middle_name !== undefined ? (row[headerMap.middle_name] || "").trim() : "";
        let suffix = headerMap.suffix !== undefined ? (row[headerMap.suffix] || "").trim() : "";

        if (headerMap.first_name !== undefined && headerMap.last_name !== undefined) {
          firstName = (row[headerMap.first_name] || "").trim();
          lastName = (row[headerMap.last_name] || "").trim();
        } else if (headerMap.full_name !== undefined) {
          const split = splitFullName(row[headerMap.full_name]);
          firstName = split.first_name;
          lastName = split.last_name;
        }

        const email = headerMap.email !== undefined ? (row[headerMap.email] || "").trim().toLowerCase() : "";
        const rawGrade = headerMap.year_level !== undefined ? (row[headerMap.year_level] || "").trim() : "";
        const gradeLevel = normalizeYearLevel(rawGrade);
        const section = headerMap.section !== undefined ? formatSectionName(row[headerMap.section]) : null;

        const fullNameDisplay = [firstName, middleName, lastName, suffix].filter(Boolean).join(" ") || `Row ${rowNum}`;

        if (!cleanLrn || cleanLrn.length !== 12) {
          invalidRecords.push({
            rowNum,
            name: fullNameDisplay,
            email,
            lrn: lrnVal,
            reason: `Row ${rowNum}: LRN must be exactly 12 digits (got '${lrnVal}').`
          });
          continue;
        }

        if (!firstName || !lastName) {
          invalidRecords.push({
            rowNum,
            name: fullNameDisplay,
            email,
            lrn: cleanLrn,
            reason: `Row ${rowNum}: First name and last name are required.`
          });
          continue;
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          invalidRecords.push({
            rowNum,
            name: fullNameDisplay,
            email,
            lrn: cleanLrn,
            reason: `Row ${rowNum}: Valid email address is required (got '${email}').`
          });
          continue;
        }

        if (fileLrnSet.has(cleanLrn)) {
          duplicateRecords.push({
            rowNum,
            name: fullNameDisplay,
            email,
            lrn: cleanLrn,
            reason: `Row ${rowNum}: Duplicate LRN in import file (${cleanLrn}).`
          });
          continue;
        }
        fileLrnSet.add(cleanLrn);

        if (fileEmailSet.has(email)) {
          duplicateRecords.push({
            rowNum,
            name: fullNameDisplay,
            email,
            lrn: cleanLrn,
            reason: `Row ${rowNum}: Duplicate Email in import file (${email}).`
          });
          continue;
        }
        fileEmailSet.add(email);

        if (dbLrnSet.has(cleanLrn)) {
          duplicateRecords.push({
            rowNum,
            name: fullNameDisplay,
            email,
            lrn: cleanLrn,
            reason: `Row ${rowNum}: LRN ${cleanLrn} already exists in database or pending requests.`
          });
          continue;
        }

        if (dbEmailSet.has(email)) {
          duplicateRecords.push({
            rowNum,
            name: fullNameDisplay,
            email,
            lrn: cleanLrn,
            reason: `Row ${rowNum}: Email ${email} already exists in database or pending requests.`
          });
          continue;
        }

        validRecords.push({
          request_type: "student",
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          suffix: suffix || null,
          email,
          lrn: cleanLrn,
          grade_level: gradeLevel || "7",
          section: section || null,
          status: "pending",
          source: "bulk_import",
          external_request_id: `bulk-student-${cleanLrn}`
        });
      }

      const totalRows = validRecords.length + duplicateRecords.length + invalidRecords.length;

      if (totalRows === 0) {
        toast.error("No valid data rows found.");
        setIsImporting(false);
        return;
      }

      setRegistrationImportSummary({
        total: totalRows,
        valid: validRecords,
        duplicates: duplicateRecords,
        invalid: invalidRecords
      });
      setRegistrationImportTab(validRecords.length > 0 ? "valid" : (duplicateRecords.length > 0 ? "duplicates" : "invalid"));
      setShowRegistrationBulkImportModal(true);
    } catch (err) {
      toast.error(err.message || "Failed to process import data.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmRegistrationImport = async () => {
    if (registrationImportSummary.valid.length === 0) {
      toast.error("No valid records to import.");
      return;
    }

    setIsSavingRegistrationImport(true);
    try {
      const recordsToInsert = registrationImportSummary.valid;
      const { error } = await adminApi.db("pending_account_requests", "insert", {
        payload: recordsToInsert
      });

      if (error) throw error;

      toast.success(`Successfully imported ${recordsToInsert.length} student registration request(s) into pending list!`, { duration: 6000 });
      setShowRegistrationBulkImportModal(false);
      setRegistrationImportText("");

      setActiveTab("RegistrationRequests");
      setRegistrationSubTab("pending");
      const reqs = await fetchRegistrationRequests();
      if (Array.isArray(reqs)) setRegistrationRequests(reqs);
    } catch (err) {
      toast.error(err.message || "Failed to import registration requests.");
    } finally {
      setIsSavingRegistrationImport(false);
    }
  };

  // ==========================================
  // BULK APPROVAL LOGIC (CONTROLLED CONCURRENCY)
  // ==========================================
  const handleConfirmBulkApproval = async () => {
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
      currentStudentName: ""
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
          const studentName = [req.first_name, req.middle_name, req.last_name].filter(Boolean).join(" ");
          
          setBulkApproveProgress({
            total: pendingReqs.length,
            current: currentIdx,
            currentStudentName: studentName
          });

          try {
            const res = await adminApi.approveStudentRegistration({
              request_id: req.id,
              reviewer_id: adminId
            });

            if (res.error) {
              summary.failures.push({
                id: req.id,
                name: studentName,
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
                  name: studentName,
                  email: req.email,
                  error: res.emailNotice || res.notice || "Account created, but credentials email failed to send."
                });
              }
            }
          } catch (err) {
            summary.failures.push({
              id: req.id,
              name: studentName,
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

    fetchRegistrationRequests().then(reqs => {
      if (Array.isArray(reqs)) setRegistrationRequests(reqs);
    });
    fetchStudentsData().then(data => {
      if (data) {
        setStudents(data.students || []);
        setMasterlist(data.masterlist || []);
      }
    });
  };

  const handleExportToCSV = () => {
    const yearContext = yearFilter !== "All" ? `Grade${yearFilter}` : "AllGrades";
    const sectionContext = sectionFilter !== "All" ? `Section_${String(sectionFilter).replace(/[^a-zA-Z0-9_\-]/g, "_")}` : "AllSections";
    const dateStr = new Date().toISOString().split("T")[0];

    if (activeTab === "Profiles") {
      const headers = ["Full Name", "Username", "LRN", "Year Level", "Section", "Status", "Created At"];
      const rows = filteredStudents.map((student) => [
        getFullName(student),
        student.username,
        student.lrn || "",
        student.year_level || "",
        student.section || "",
        student.status || "",
        formatDate(student.created_at)
      ]);
      const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.setAttribute("href", URL.createObjectURL(blob));
      link.setAttribute("download", `Student_Records_${yearContext}_${sectionContext}_${dateStr}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ["Full Name", "LRN", "Year Level", "Section", "Account Created", "Created At"];
      const rows = filteredMasterlist.map((student) => [
        [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
        student.lrn || "",
        student.year_level || "",
        student.section || "",
        student.account_created ? "Yes" : "No",
        formatDate(student.created_at)
      ]);
      const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.setAttribute("href", URL.createObjectURL(blob));
      link.setAttribute("download", `Student_Masterlist_${yearContext}_${sectionContext}_${dateStr}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
              <NotificationDropdown />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div data-tour="students-header" className="relative rounded-2xl p-8 text-gray-900 shadow-lg overflow-hidden bg-white border border-gray-200">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-emerald-600" />
              <div className="flex-1 bg-teal-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 via-emerald-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4 flex items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-green-600">Student Management</h1>
                <p className="text-gray-600">Student records are up to date.</p>
              </div>
              <div className="flex items-center gap-3">
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button data-tour="students-import-btn" onClick={() => setShowGoogleSheetsModal(true)} disabled={isImporting} className="flex items-center gap-2 px-6 py-3 bg-white text-green-600 border border-green-200 rounded-xl hover:bg-green-50 transition-colors font-semibold shadow-sm cursor-pointer disabled:opacity-50">
                  {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  {isImporting ? "Importing..." : "Import Masterlists"}
                </button>
                <button onClick={downloadCsvTemplate} type="button" className="flex items-center gap-2 px-4 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold shadow-sm cursor-pointer" title="Download CSV Template">
                  <Download className="w-4 h-4 text-gray-500" />
                  CSV Template
                </button>
                <button data-tour="students-add-btn" onClick={() => { setStudentFormData((f) => ({ ...f, password: generateTempPassword() })); setShowAddModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold shadow-lg shadow-green-600/20 cursor-pointer">
                  <UserPlus className="w-5 h-5" />
                  Add Student
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-green-600 inline-block" /> : students.length}
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Newest Registration</p>
              <p className="text-lg font-semibold text-green-600">
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-green-600 inline-block" /> : (students[0] ? getFullName(students[0]) : "No students yet")}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {loading ? "Loading..." : (students[0] ? formatDate(students[0].created_at) : "Add the first student to get started")}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("Profiles")}
              className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "Profiles"
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Enrolled Students
            </button>
            <button
              data-tour="students-masterlist-tab"
              onClick={() => setActiveTab("Masterlist")}
              className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "Masterlist"
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Masterlist
            </button>
            <button
              onClick={() => {
                setActiveTab("RegistrationRequests");
                fetchRegistrationRequests().then((reqs) => {
                  if (Array.isArray(reqs)) setRegistrationRequests(reqs);
                });
              }}
              className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
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

          <div data-tour="students-filters" className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                {activeTab === "Profiles" && (
                  <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                    {["all", "Active", "Disabled"].map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          statusFilter === status
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
                {activeTab === "RegistrationRequests" && (
                  <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                    {["pending", "approved", "rejected"].map((subStatus) => (
                      <button
                        key={subStatus}
                        onClick={() => setRegistrationSubTab(subStatus)}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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
                )}
                
                <div className="flex flex-wrap gap-3 w-full md:w-auto flex-1">
                  <div className="flex-1 md:flex-none min-w-[180px]">
                    <CustomSelect
                      value={yearLevelFilter}
                      onChange={(val) => {
                        setYearLevelFilter(val);
                        setSectionFilter("all"); // reset section when year level changes
                      }}
                      options={[
                        { value: "all", label: "All Year Levels" },
                        ...availableYearLevels.map(yl => ({ value: yl, label: yl }))
                      ]}
                      placeholder="All Year Levels"
                    />
                  </div>

                  <div className="flex-1 md:flex-none min-w-[180px]">
                    <CustomSelect
                      value={sectionFilter}
                      onChange={(val) => setSectionFilter(val)}
                      disabled={yearLevelFilter === "all" || availableSections.length === 0}
                      options={[
                        { value: "all", label: "All Sections" },
                        ...availableSections.map(sec => ({ value: sec, label: sec }))
                      ]}
                      placeholder="All Sections"
                    />
                  </div>

                  {availableCourses.length > 0 && (
                    <div className="flex-1 md:flex-none min-w-[180px]">
                      <CustomSelect
                        value={courseFilter}
                        onChange={(val) => setCourseFilter(val)}
                        options={[
                          { value: "all", label: "All Courses" },
                          ...availableCourses.map(c => ({ value: c, label: c }))
                        ]}
                        placeholder="All Courses"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div data-tour="students-search" className="flex-1 relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                  <input type="text" placeholder="Search by name, username, or LRN..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500/50" />
                </div>
                <button data-tour="students-export-btn" onClick={handleExportToCSV} className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-900 rounded-xl hover:bg-white/20 transition-colors border border-gray-200 w-full md:w-auto justify-center">
                  <Download className="w-4 h-4" />
                  Export
                </button>

              {activeTab === "Profiles" && (
                <>
                  {selectedStudentIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleOpenBulkAssignSectionModal}
                      className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center"
                    >
                      <BookOpen className="w-4 h-4" />
                      Assign Section ({selectedStudentIds.size})
                    </button>
                  )}
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={selectedStudentIds.size === 0 || isBulkDeleting}
                    className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center disabled:opacity-50"
                  >
                    {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {isBulkDeleting ? "Deleting..." : `Delete Selected (${selectedStudentIds.size})`}
                  </button>
                </>
              )}

              {activeTab === "Masterlist" && (() => {
                const selectedRows = masterlist.filter(m => selectedMasterlistIds.has(m.id));
                const newCount = selectedRows.filter(m => !m.account_created).length;
                const createdCount = selectedRows.filter(m => m.account_created).length;

                return (
                  <>
                    {selectedMasterlistIds.size > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={handlePrepareMasterlistRegistrationRequests}
                          disabled={isCreatingMasterlistRequests}
                          className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center cursor-pointer disabled:opacity-50"
                        >
                          {isCreatingMasterlistRequests ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          Create Registration Requests ({selectedMasterlistIds.size})
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateAccounts}
                          disabled={isGenerating || newCount === 0}
                          className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {isGenerating ? "Generating..." : `Generate Accounts (${newCount})`}
                        </button>
                      </>
                    )}
                    {masterlist.length > 0 && (
                      <button
                        onClick={() => setShowClearMasterlistConfirm(true)}
                        disabled={isClearingMasterlist}
                        className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center disabled:opacity-50 cursor-pointer"
                      >
                        {isClearingMasterlist ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {isClearingMasterlist ? "Clearing..." : "Clear Imported Masterlist"}
                      </button>
                    )}
                  </>
                );
              })()}

              {activeTab === "RegistrationRequests" && (
                <>
                  {registrationSubTab === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setRegistrationImportText(""); setShowRegistrationBulkImportModal(true); }}
                        className="flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        Import Students
                      </button>
                      {selectedPendingRequestIds.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowBulkApproveConfirmModal(true)}
                          className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve Selected ({selectedPendingRequestIds.size})
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>



          <div data-tour="students-table" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-16 text-center">
                <Loader2 className="w-10 h-10 text-green-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-medium">
                  {activeTab === "Profiles"
                    ? "Loading enrolled students..."
                    : activeTab === "Masterlist"
                    ? "Loading masterlist records..."
                    : "Loading registration requests..."}
                </p>
              </div>
            ) : fetchError ? (
              <div className="p-16 text-center">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                <p className="text-gray-800 font-semibold mb-1">Unable to load student data</p>
                <p className="text-gray-500 text-sm mb-4">{fetchError}</p>
                <button
                  onClick={() => { setLoading(true); setFetchError(null); refreshStudents(); }}
                  className="px-4 py-2 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-sm cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  {activeTab === "Profiles" && filteredStudents.length > 0 && (
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-5 text-left w-12">
                            <button
                              onClick={() => toggleAllStudents(filteredStudents.map(s => s.id))}
                              className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors"
                            >
                              {selectedStudentIds.size > 0 && selectedStudentIds.size === filteredStudents.length ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                            </button>
                          </th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Full Name</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Username</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/6">LRN</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/6">Year Level</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created At</th>
                          <th data-tour="students-actions" className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          const grouped = {};
                          filteredStudents.forEach(student => {
                            const year = student.year_level ? `Grade ${student.year_level.replace(/\D/g, '')}` : "Unassigned Year";
                            const rawSec = (student.section && student.section !== "Unassigned Section") ? student.section : "Unassigned";
                            const section = rawSec;
                            if (!grouped[year]) grouped[year] = {};
                            if (!grouped[year][section]) grouped[year][section] = [];
                            grouped[year][section].push(student);
                          });
                          const rows = [];
                          let firstStudentRowFound = false;
                          Object.keys(grouped).sort((a, b) => {
                            const numA = parseInt(a.replace(/\D/g, '')) || 0;
                            const numB = parseInt(b.replace(/\D/g, '')) || 0;
                            return numA - numB || a.localeCompare(b);
                          }).forEach(year => {
                            Object.keys(grouped[year]).sort().forEach(section => {
                              const groupStudents = grouped[year][section];
                              rows.push(
                                <tr key={`group-${year}-${section}`} className="bg-gray-50/80 border-y border-gray-200">
                                  <td colSpan="100%" className="px-6 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-gray-800">{year}</span>
                                      <span className="text-gray-400">•</span>
                                      <span className="font-semibold text-gray-700">{section === "Unassigned" ? "Unassigned" : (section.toLowerCase().includes('section') ? section : `Section ${section}`)}</span>
                                      <span className="text-xs bg-white border border-gray-200 px-2.5 py-0.5 rounded-full text-gray-500 ml-2 shadow-sm">
                                        {groupStudents.length} student{groupStudents.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                              groupStudents.forEach((student) => {
                                const isFirstRow = !firstStudentRowFound;
                                if (isFirstRow) firstStudentRowFound = true;
                                rows.push(
                                  <tr
                                    key={student.id}
                                    data-tour={isFirstRow ? "students-row" : undefined}
                                    className={`hover:bg-gray-50 transition-colors group ${selectedStudentIds.has(student.id) ? "bg-blue-50/50" : ""}`}
                                  >
                                    <td className="px-6 py-5 text-left align-middle">
                                      <button
                                        onClick={() => toggleStudentSelection(student.id)}
                                        className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors"
                                      >
                                        {selectedStudentIds.has(student.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                                      </button>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                      <p className="font-semibold text-gray-900 truncate">{getFullName(student)}</p>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                      <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <User className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                        <div className="truncate max-w-[200px]">{getDisplayUsername(student)}</div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-gray-600 align-middle">
                                      <div className="flex items-center gap-2">
                                        <Hash className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                        <span className="truncate">{student.lrn || "-"}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                      <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Hash className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                        <span className="truncate">{student.year_level || "-"}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                      <span
                                        data-tour={isFirstRow ? "students-status-badge" : undefined}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${
                                          student.status === "Disabled"
                                            ? "bg-red-50 text-red-500 border-red-200"
                                            : "bg-green-50 text-green-600 border-green-200"
                                        }`}
                                      >
                                        {student.status || "Active"}
                                      </span>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-gray-500 align-middle whitespace-nowrap">{formatDate(student.created_at)}</td>
                                    <td
                                      data-tour={isFirstRow ? "students-actions" : undefined}
                                      className="px-6 py-5 text-right align-middle"
                                    >
                                      <div className="flex items-center justify-end gap-1.5 transition-opacity">
                                        <button onClick={() => handleViewStudent(student)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View">
                                          <Eye className="w-4 h-4 text-gray-600" />
                                        </button>
                                        <button onClick={() => handleEditStudent(student)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                                          <Edit className="w-4 h-4 text-blue-500" />
                                        </button>
                                        <button onClick={() => handlePromptDeleteStudent(student)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                          <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            });
                          });
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  )}

                  {activeTab === "Masterlist" && filteredMasterlist.length > 0 && (
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                            <button 
                              onClick={() => {
                                if (selectedMasterlistIds.size === filteredMasterlist.length) {
                                  setSelectedMasterlistIds(new Set());
                                } else {
                                  setSelectedMasterlistIds(new Set(filteredMasterlist.map(m => m.id)));
                                }
                              }}
                              className="text-gray-500 hover:text-blue-600 transition-colors"
                            >
                              {selectedMasterlistIds.size > 0 && selectedMasterlistIds.size === filteredMasterlist.length ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                            </button>
                          </th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Full Name</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">LRN</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/6">Year Level</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/6">Section</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Account Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          const grouped = {};
                          filteredMasterlist.forEach(student => {
                            const year = student.year_level ? `Grade ${student.year_level.replace(/\D/g, '')}` : "Unassigned Year";
                            const rawSec = (student.section && student.section !== "Unassigned Section") ? student.section : "Unassigned";
                            const section = rawSec;
                            if (!grouped[year]) grouped[year] = {};
                            if (!grouped[year][section]) grouped[year][section] = [];
                            grouped[year][section].push(student);
                          });
                          const rows = [];
                          Object.keys(grouped).sort((a, b) => {
                            const numA = parseInt(a.replace(/\D/g, '')) || 0;
                            const numB = parseInt(b.replace(/\D/g, '')) || 0;
                            return numA - numB || a.localeCompare(b);
                          }).forEach(year => {
                            Object.keys(grouped[year]).sort().forEach(section => {
                              const groupStudents = grouped[year][section];
                              rows.push(
                                <tr key={`group-${year}-${section}`} className="bg-gray-50/80 border-y border-gray-200">
                                  <td colSpan="100%" className="px-6 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-gray-800">{year}</span>
                                      <span className="text-gray-400">•</span>
                                      <span className="font-semibold text-gray-700">{section === "Unassigned" ? "Unassigned" : (section.toLowerCase().includes('section') ? section : `Section ${section}`)}</span>
                                      <span className="text-xs bg-white border border-gray-200 px-2.5 py-0.5 rounded-full text-gray-500 ml-2 shadow-sm">
                                        {groupStudents.length} student{groupStudents.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                              groupStudents.forEach((student) => {
                                rows.push(
                                  <tr key={student.id} className={`hover:bg-gray-50 transition-colors group ${selectedMasterlistIds.has(student.id) ? "bg-blue-50/50" : ""}`}>
                                    <td className="px-6 py-5 align-middle">
                                      <button
                                        onClick={() => {
                                          const newSet = new Set(selectedMasterlistIds);
                                          if (newSet.has(student.id)) newSet.delete(student.id);
                                          else newSet.add(student.id);
                                          setSelectedMasterlistIds(newSet);
                                        }}
                                        className="text-gray-500 hover:text-blue-600 transition-colors"
                                      >
                                        {selectedMasterlistIds.has(student.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                                      </button>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                      <p className="font-semibold text-gray-900 truncate">{[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")}</p>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-gray-600 align-middle">
                                      <span className="truncate">{student.lrn || "-"}</span>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-gray-600 align-middle">
                                      <span className="truncate">{student.year_level || "-"}</span>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-gray-600 align-middle">
                                      <span className="truncate">{student.section || "Unassigned"}</span>
                                    </td>
                                     <td className="px-6 py-5 text-right align-middle">
                                       {(() => {
                                         const statusInfo = getMasterlistStudentAccountStatus(student);
                                         return (
                                           <div className="flex items-center justify-end gap-2">
                                             <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${statusInfo.badgeStyle}`}>
                                               {statusInfo.label}
                                             </span>
                                           </div>
                                         );
                                       })()}
                                     </td>
                                  </tr>
                                );
                              });
                            });
                          });
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  )}

                  {activeTab === "RegistrationRequests" && filteredRegistrationRequests.length > 0 && (
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
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Name</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">LRN</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade & Section</th>
                          <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
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
                            <td className="px-6 py-5 text-sm text-gray-600 align-middle">
                              <span className="truncate">{req.lrn || "-"}</span>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-600 align-middle">
                              <span className="truncate">
                                Grade {req.grade_level || req.year_level || "-"} {req.section ? `• ${req.section}` : ""}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-sm align-middle whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                                req.source === "admin"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : req.source === "masterlist"
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : req.source === "bulk_import"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}>
                                {req.source === "admin" ? "Admin Added" : req.source === "masterlist" ? "Masterlist" : req.source === "bulk_import" ? "Bulk Import" : "Google Form"}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-500 align-middle whitespace-nowrap">
                              {formatDate(req.created_at || req.submitted_at)}
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

                {activeTab === "Profiles" && filteredStudents.length === 0 && (
                  <div className="p-16 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No students found.</p>
                  </div>
                )}
                {activeTab === "Masterlist" && filteredMasterlist.length === 0 && (
                  <div className="p-16 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No masterlist records found. Import a CSV to get started.</p>
                  </div>
                )}
                {activeTab === "RegistrationRequests" && filteredRegistrationRequests.length === 0 && (
                  <div className="p-16 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No student registration requests found.</p>
                    <p className="text-gray-400 text-sm mt-1">Requests submitted via the student registration Google Form will appear here.</p>
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
              <h3 className="text-xl font-semibold text-gray-900">Add New Student</h3>
              <button onClick={handleCloseAddModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddStudent}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input type="text" value={studentFormData.first_name} onChange={(e) => handleAddStudentFieldChange("first_name", e.target.value)} placeholder="Enter first name" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.first_name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.first_name && <p className="text-red-500 text-sm mt-1">{formErrors.first_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                    <input type="text" value={studentFormData.middle_name} onChange={(e) => handleAddStudentFieldChange("middle_name", e.target.value)} placeholder="Enter middle name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input type="text" value={studentFormData.last_name} onChange={(e) => handleAddStudentFieldChange("last_name", e.target.value)} placeholder="Enter last name" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.last_name ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.last_name && <p className="text-red-500 text-sm mt-1">{formErrors.last_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name Extension / Suffix</label>
                    <input type="text" value={studentFormData.suffix} onChange={(e) => handleAddStudentFieldChange("suffix", e.target.value)} placeholder="e.g. Jr., Sr., II, III" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email Address <span className="text-red-500">*</span></label>
                    <input type="email" value={studentFormData.email} onChange={(e) => handleAddStudentFieldChange("email", e.target.value)} placeholder="student@example.com" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.email ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.email && <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">LRN <span className="text-red-500">*</span></label>
                    <input type="text" value={studentFormData.lrn} onChange={(e) => handleAddStudentFieldChange("lrn", e.target.value)} inputMode="numeric" maxLength={12} placeholder="12-digit LRN" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.lrn ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.lrn && <p className="text-red-500 text-sm mt-1">{formErrors.lrn}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Year Level <span className="text-red-500">*</span></label>
                    <CustomSelect
                      value={studentFormData.year_level}
                      onChange={(value) => handleAddStudentFieldChange("year_level", value)}
                      options={[
                        { value: "7", label: "Year 7" },
                        { value: "8", label: "Year 8" },
                        { value: "9", label: "Year 9" },
                        { value: "10", label: "Year 10" },
                      ]}
                      placeholder="Select year level"
                      className="w-full"
                    />
                    {formErrors.year_level && <p className="text-red-500 text-sm mt-1">{formErrors.year_level}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Section</label>
                    <SectionDropdown
                      value={studentFormData.section}
                      onChange={(value) => handleAddStudentFieldChange("section", value)}
                      gradeLevel={studentFormData.year_level ? `Grade ${studentFormData.year_level}` : ""}
                      className="w-full"
                    />
                    {formErrors.section && <p className="text-red-500 text-sm mt-1">{formErrors.section}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <CustomSelect
                      value={studentFormData.status}
                      onChange={(value) => handleAddStudentFieldChange("status", value)}
                      options={[
                        { value: "Active", label: "Active" },
                        { value: "Disabled", label: "Disabled" },
                      ]}
                      placeholder="Select status"
                      className="w-full"
                    />
                    {formErrors.status && <p className="text-red-500 text-sm mt-1">{formErrors.status}</p>}
                  </div>
                </div>
                {formErrors.form && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formErrors.form}
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                  <button onClick={handleCloseAddModal} type="button" className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? "Adding..." : "Add Student"}
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
              <h3 className="text-xl font-semibold text-gray-900">Edit Student</h3>
              <button onClick={handleCloseEditModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateStudent}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input type="text" value={editFormData.first_name} onChange={(e) => handleEditFieldChange("first_name", e.target.value)} placeholder="Enter first name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {editFormErrors.first_name && <p className="text-red-500 text-sm mt-1">{editFormErrors.first_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                    <input type="text" value={editFormData.middle_name} onChange={(e) => handleEditFieldChange("middle_name", e.target.value)} placeholder="Enter middle name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input type="text" value={editFormData.last_name} onChange={(e) => handleEditFieldChange("last_name", e.target.value)} placeholder="Enter last name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {editFormErrors.last_name && <p className="text-red-500 text-sm mt-1">{editFormErrors.last_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name Extension / Suffix</label>
                    <input type="text" value={editFormData.suffix || ""} onChange={(e) => handleEditFieldChange("suffix", e.target.value)} placeholder="e.g. Jr., Sr., II, III" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">LRN</label>
                    <input type="text" value={editFormData.lrn} onChange={(e) => {
                      const nextValue = normalizeLrn(e.target.value);
                      setEditFormData({ ...editFormData, lrn: nextValue });
                      setEditFormErrors((currentErrors) => {
                        const nextErrors = { ...currentErrors };
                        const fieldError = validateAddField("lrn", nextValue);

                        if (fieldError) {
                          nextErrors.lrn = fieldError;
                        } else {
                          delete nextErrors.lrn;
                        }

                        return nextErrors;
                      });
                    }} inputMode="numeric" maxLength={12} placeholder="12-digit LRN" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {editFormErrors.lrn && <p className="text-red-500 text-sm mt-1">{editFormErrors.lrn}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Year Level</label>
                    <CustomSelect
                      value={editFormData.year_level}
                      onChange={(value) => {
                        const nextFormData = { ...editFormData, year_level: value, section: "" };
                        setEditFormData(nextFormData);
                        setEditFormErrors((currentErrors) => {
                          const nextErrors = { ...currentErrors };
                          const fieldError = validateAddField("year_level", value, nextFormData);

                          if (fieldError) {
                            nextErrors.year_level = fieldError;
                          } else {
                            delete nextErrors.year_level;
                          }

                          return nextErrors;
                        });
                      }}
                      options={[
                        { value: "7", label: "Year 7" },
                        { value: "8", label: "Year 8" },
                        { value: "9", label: "Year 9" },
                        { value: "10", label: "Year 10" },
                      ]}
                      placeholder="Select year level"
                      className="w-full"
                    />
                    {editFormErrors.year_level && <p className="text-red-500 text-sm mt-1">{editFormErrors.year_level}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Section</label>
                    <SectionDropdown
                      value={editFormData.section}
                      onChange={(value) => handleEditFieldChange("section", value)}
                      gradeLevel={editFormData.year_level ? `Grade ${editFormData.year_level}` : ""}
                      className="w-full"
                    />
                    {editFormErrors.section && <p className="text-red-500 text-sm mt-1">{editFormErrors.section}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <CustomSelect
                      value={editFormData.status}
                      onChange={(value) => setEditFormData({ ...editFormData, status: value })}
                      options={[
                        { value: "Active", label: "Active" },
                        { value: "Disabled", label: "Disabled" },
                      ]}
                      placeholder="Select status"
                      className="w-full"
                    />
                    {editFormErrors.status && <p className="text-red-500 text-sm mt-1">{editFormErrors.status}</p>}
                  </div>
                </div>
                {editFormErrors.form && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {editFormErrors.form}
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                  <button onClick={handleCloseEditModal} type="button" className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? "Updating..." : "Update Student"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Student Details</h3>
              <button onClick={handleCloseViewModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
                <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-teal-600 rounded-full flex items-center justify-center text-gray-900 text-2xl font-bold">
                  {getFullName(selectedStudent).charAt(0) || "S"}
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-gray-900">{getFullName(selectedStudent)}</h4>
                  <p className="text-gray-600">{selectedStudent.email}</p>
                  <p className="text-gray-500 text-sm">LRN: {selectedStudent.lrn || "Not set"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{selectedStudent.email}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">LRN</label>
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{selectedStudent.lrn || "Not set"}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{selectedStudent.status || "Active"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Year Level</label>
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{selectedStudent.year_level || "Not set"}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Section</label>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{selectedStudent.section || "Not set"}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Created At</label>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">
                        {new Date(selectedStudent.created_at).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-150">
                <button onClick={handleCloseViewModal} className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer">
                  Close
                </button>
                <button
                  onClick={() => {
                    handleCloseViewModal();
                    handleEditStudent(selectedStudent);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  <Edit className="w-4 h-4" />
                  Edit Student
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setStudentToDelete(null);
        }}
        onConfirm={handleDeleteStudent}
        title="Delete Student"
        message={studentToDelete ? `Are you sure you want to permanently delete ${getFullName(studentToDelete) || "this student"}? This action cannot be undone.` : "Are you sure you want to permanently delete this student? This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDeleteStudents}
        title="Delete Selected Students"
        message={`Are you sure you want to permanently delete ${selectedStudentIds.size} selected student(s)? This action cannot be undone.`}
        confirmText="Delete All Selected"
        cancelText="Cancel"
        type="danger"
      />
      <ConfirmDialog
        isOpen={showClearMasterlistConfirm}
        onClose={() => setShowClearMasterlistConfirm(false)}
        onConfirm={handleClearMasterlist}
        title="Clear Imported Masterlist"
        message="Are you sure you want to permanently delete ALL imported masterlist records? This action cannot be undone and will affect any pending accounts."
        confirmText="Clear Masterlist"
        cancelText="Cancel"
        type="danger"
      />

      {showImportPreviewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Import Student Masterlist</h3>
                <p className="text-xs text-gray-500 mt-1">Review parsed student records before creating registration requests</p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportPreviewModal(false)}
                disabled={isSavingImport}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">TOTAL PARSED</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{importPreviewSummary.total}</p>
                </div>
                <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-300">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">READY</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{importPreviewSummary.valid.length}</p>
                </div>
                <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-300">
                  <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">MISSING EMAIL</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{importPreviewSummary.missingEmail?.length || 0}</p>
                </div>
                <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-300">
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">DUPLICATES</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{(importPreviewSummary.duplicates?.length || 0) + (importPreviewSummary.alreadyExisting?.length || 0)}</p>
                </div>
              </div>

              {importPreviewSummary.sectionBreakdown && Object.keys(importPreviewSummary.sectionBreakdown).length > 0 && (
                <div className="bg-blue-50/40 border border-blue-200 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Detected Grade Level & Section Breakdown</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(importPreviewSummary.sectionBreakdown)
                      .sort(([a], [b]) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0))
                      .map(([grade, secs]) => (
                        <div key={grade} className="bg-white border border-blue-100 rounded-xl p-2.5 shadow-xs text-xs">
                          <p className="font-bold text-blue-800 uppercase tracking-wide text-[11px]">
                            {grade.toLowerCase().includes("grade") || grade === "Unassigned" ? grade : `Grade ${grade}`}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {Object.entries(secs).map(([secName, count]) => (
                              <li key={secName} className="text-[11px] text-slate-600 flex justify-between">
                                <span>{secName}</span>
                                <span className="font-bold text-slate-900">{count} student{count !== 1 ? 's' : ''}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex border-b border-gray-200 gap-6 px-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab("valid")}
                  className={`pb-2.5 text-xs font-bold transition-all relative ${
                    previewTab === "valid" ? "text-emerald-700" : "text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  Ready ({importPreviewSummary.valid.length})
                  {previewTab === "valid" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
                  )}
                </button>
                {importPreviewSummary.missingEmail?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewTab("missingEmail")}
                    className={`pb-2.5 text-xs font-bold transition-all relative ${
                      previewTab === "missingEmail" ? "text-amber-700" : "text-slate-500 hover:text-slate-700 font-medium"
                    }`}
                  >
                    Missing Email ({importPreviewSummary.missingEmail.length})
                    {previewTab === "missingEmail" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 rounded-full" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewTab("duplicates")}
                  className={`pb-2.5 text-xs font-bold transition-all relative ${
                    previewTab === "duplicates" ? "text-blue-700" : "text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  Duplicates ({(importPreviewSummary.duplicates?.length || 0) + (importPreviewSummary.alreadyExisting?.length || 0)})
                  {previewTab === "duplicates" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
                {importPreviewSummary.invalid?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewTab("invalid")}
                    className={`pb-2.5 text-xs font-bold transition-all relative ${
                      previewTab === "invalid" ? "text-red-700" : "text-slate-500 hover:text-slate-700 font-medium"
                    }`}
                  >
                    Invalid ({importPreviewSummary.invalid.length})
                    {previewTab === "invalid" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full" />
                    )}
                  </button>
                )}
              </div>

              {previewTab === "valid" && (
                <div className="max-h-56 overflow-y-auto border border-emerald-300 rounded-2xl divide-y divide-emerald-100 bg-white">
                  {importPreviewSummary.valid.length === 0 ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No ready records found.</p>
                  ) : (
                    importPreviewSummary.valid.map((r, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-emerald-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {[r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ")}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {r.email || "No Email"} • LRN: {r.lrn} {r.year_level ? `• Grade ${r.year_level}` : ""} {r.section ? `(${r.section})` : ""}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-md font-semibold text-xs shrink-0">
                          Ready
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {previewTab === "missingEmail" && (
                <div className="max-h-56 overflow-y-auto border border-amber-300 rounded-2xl divide-y divide-amber-100 bg-white">
                  {(!importPreviewSummary.missingEmail || importPreviewSummary.missingEmail.length === 0) ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No missing email records.</p>
                  ) : (
                    importPreviewSummary.missingEmail.map((r, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-amber-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{r.fullName || `${r.first_name} ${r.last_name}`}</p>
                          <p className="text-xs text-amber-700 mt-0.5 font-normal">{r.reason || "Missing email address"}</p>
                        </div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 font-semibold rounded-md text-xs shrink-0">
                          Missing Email
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {previewTab === "duplicates" && (
                <div className="max-h-56 overflow-y-auto border border-blue-300 rounded-2xl divide-y divide-blue-100 bg-white">
                  {[...(importPreviewSummary.duplicates || []), ...(importPreviewSummary.alreadyExisting || [])].length === 0 ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No duplicate records.</p>
                  ) : (
                    [...(importPreviewSummary.duplicates || []), ...(importPreviewSummary.alreadyExisting || [])].map((d, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-blue-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{d.name || d.fullName || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Student'}</p>
                          <p className="text-xs text-blue-700 mt-0.5 font-normal">{d.reason || "Duplicate record"}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 font-semibold rounded-md text-xs shrink-0">
                          Duplicate
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {previewTab === "invalid" && (
                <div className="max-h-56 overflow-y-auto border border-red-300 rounded-2xl divide-y divide-red-100 bg-white">
                  {(!importPreviewSummary.invalid || importPreviewSummary.invalid.length === 0) ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No invalid records.</p>
                  ) : (
                    importPreviewSummary.invalid.map((inv, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-red-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{inv.name || inv.fullName || `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || 'Student'}</p>
                          <p className="text-xs text-red-700 mt-0.5 font-normal">{inv.reason || "Invalid format"}</p>
                        </div>
                        <span className="px-3 py-1 bg-red-100 text-red-800 font-semibold rounded-md text-xs shrink-0">
                          Invalid
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    const csvContent = "First Name,Middle Name,Last Name,Suffix,Email,LRN,Grade Level,Section\nJuan,D,Dela Cruz,,juan.delacruz@student.edu.ph,123456789012,7,Rizal\nMaria,S,Santos,,maria.santos@student.edu.ph,123456789013,7,Bonifacio";
                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", "student_masterlist_template.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportPreviewModal(false)}
                    disabled={isSavingImport}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isSavingImport || importPreviewSummary.valid.length === 0}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSavingImport && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSavingImport ? "Importing..." : `Confirm & Create ${importPreviewSummary.valid.length} Registration Request(s)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal during Account Generation */}
      {showGenerationProgressModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <UserPlus className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Generating Student Accounts...</h3>
              <p className="text-sm text-gray-500 mt-1">Please wait while accounts are created in optimized batches.</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-semibold text-gray-700">
                <span>Batch {generationProgress.currentBatch} of {generationProgress.totalBatches}</span>
                <span className="text-blue-600 font-bold">{generationProgress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300 rounded-full" 
                  style={{ width: `${generationProgress.percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 pt-1">
                {generationProgress.current} / {generationProgress.total} accounts processed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Account Generation Results Summary Modal */}
      {showGenerationResultsModal && generationResultsSummary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-100 rounded-xl text-green-600">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Account Generation Summary</h3>
                  <p className="text-sm text-gray-500">Bulk student account creation results</p>
                </div>
              </div>
              <button
                onClick={() => setShowGenerationResultsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Processed</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{generationResultsSummary.total}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Enrolled</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{generationResultsSummary.success.length}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Already Existed</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{generationResultsSummary.alreadyExists.length}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">Failed / Errors</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">{generationResultsSummary.failed.length}</p>
                </div>
              </div>

              <div className="flex gap-2 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setResultsTab("success")}
                  className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    resultsTab === "success" ? "border-emerald-600 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Newly Enrolled ({generationResultsSummary.success.length})
                </button>
                {generationResultsSummary.alreadyExists.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setResultsTab("alreadyExists")}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                      resultsTab === "alreadyExists" ? "border-amber-600 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Already Existed ({generationResultsSummary.alreadyExists.length})
                  </button>
                )}
                {generationResultsSummary.failed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setResultsTab("failed")}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                      resultsTab === "failed" ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Failed ({generationResultsSummary.failed.length})
                  </button>
                )}
              </div>

              {resultsTab === "success" && (
                <div>
                  {generationResultsSummary.success.length === 0 ? (
                    <p className="text-sm text-gray-500 italic py-4 text-center">No new accounts created in this run.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 sticky top-0">
                          <tr>
                            <th className="px-4 py-3">LRN</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Generated Username</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {generationResultsSummary.success.map((r, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 font-mono text-gray-900">{r.lrn}</td>
                              <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                              <td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">{r.username}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {resultsTab === "alreadyExists" && (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">LRN</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Username</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {generationResultsSummary.alreadyExists.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 font-mono text-gray-900">{r.lrn}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-600">{r.username || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {resultsTab === "failed" && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {generationResultsSummary.failed.map((f, idx) => (
                    <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{f.name} (LRN: {f.lrn}):</span> {f.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowGenerationResultsModal(false)}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Section Modal */}
      {showBulkAssignSectionModal && (() => {
        const selectedSet = activeTab === "Profiles" ? selectedStudentIds : selectedMasterlistIds;
        const currentList = activeTab === "Profiles" ? students : masterlist;
        const selectedRows = currentList.filter(s => selectedSet.has(s.id));
        const firstGrade = selectedRows[0]?.year_level || "";
        const formattedGradeLevel = firstGrade ? `Grade ${firstGrade.replace(/\D/g, "")}` : "Grade 7";

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Bulk Assign Section</h3>
                    <p className="text-xs text-gray-500">Assign section to {selectedSet.size} selected student(s)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBulkAssignSectionModal(false)}
                  className="p-2 hover:bg-black/5 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isBulkAssigning}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase">Grade Level</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{formattedGradeLevel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-semibold uppercase">Target Students</p>
                    <p className="text-base font-bold text-indigo-600 mt-0.5">{selectedSet.size} Selected</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Section</label>
                  <SectionDropdown
                    gradeLevel={formattedGradeLevel}
                    value={targetBulkSection}
                    onChange={setTargetBulkSection}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Or click the settings icon in the section dropdown to create a new section for {formattedGradeLevel}.
                  </p>
                </div>

                {/* Section Capacity Information & Validation Card */}
                {targetBulkSection && (
                  <div className="space-y-3">
                    {isLoadingCapacity ? (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Calculating section capacity...</span>
                      </div>
                    ) : sectionCapacityInfo ? (
                      <div className={`p-4 rounded-xl border transition-all ${
                        sectionCapacityInfo.isExceeded 
                          ? "bg-red-50 border-red-200 text-red-900" 
                          : sectionCapacityInfo.capacity > 0 && sectionCapacityInfo.projectedEnrolled / sectionCapacityInfo.capacity >= 0.8
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-indigo-50/60 border-indigo-100 text-indigo-950"
                      }`}>
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Capacity & Enrollment Status</span>
                          {sectionCapacityInfo.capacity === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Unlimited Slots
                            </span>
                          ) : sectionCapacityInfo.isExceeded ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              <AlertTriangle className="w-3.5 h-3.5" /> Exceeded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Available
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                          <div className="bg-white/80 p-2.5 rounded-lg border border-black/5">
                            <span className="text-gray-500 block font-medium">Current Enrolled</span>
                            <span className="text-sm font-bold text-gray-900">{sectionCapacityInfo.currentEnrolled}</span>
                          </div>
                          <div className="bg-white/80 p-2.5 rounded-lg border border-black/5">
                            <span className="text-gray-500 block font-medium">Max Capacity</span>
                            <span className="text-sm font-bold text-gray-900">
                              {sectionCapacityInfo.capacity === 0 ? "∞ (Unlimited)" : sectionCapacityInfo.capacity}
                            </span>
                          </div>
                          <div className="bg-white/80 p-2.5 rounded-lg border border-black/5">
                            <span className="text-gray-500 block font-medium">Available Slots</span>
                            <span className={`text-sm font-bold ${
                              sectionCapacityInfo.availableSlots === 0 && sectionCapacityInfo.capacity > 0 
                                ? "text-red-600" 
                                : "text-emerald-600"
                            }`}>
                              {sectionCapacityInfo.availableSlots}
                            </span>
                          </div>
                          <div className="bg-white/80 p-2.5 rounded-lg border border-black/5">
                            <span className="text-gray-500 block font-medium">Projected Total</span>
                            <span className={`text-sm font-bold ${sectionCapacityInfo.isExceeded ? "text-red-600" : "text-indigo-600"}`}>
                              {sectionCapacityInfo.projectedEnrolled}
                            </span>
                          </div>
                        </div>

                        {sectionCapacityInfo.alreadyEnrolledCount > 0 && (
                          <p className="text-[11px] text-gray-600 bg-white/60 p-2 rounded-md mb-2 border border-black/5">
                            💡 <strong>Note:</strong> {sectionCapacityInfo.alreadyEnrolledCount} of {sectionCapacityInfo.totalSelected} selected student(s) already belong to Section {sectionCapacityInfo.cleanSection}. Only {sectionCapacityInfo.newStudentsCount} new student(s) will consume capacity slots.
                          </p>
                        )}

                        {sectionCapacityInfo.capacity > 0 && (
                          <div className="space-y-1">
                            <div className="w-full bg-gray-200/80 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  sectionCapacityInfo.isExceeded 
                                    ? "bg-red-500" 
                                    : sectionCapacityInfo.projectedEnrolled / sectionCapacityInfo.capacity >= 0.8
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(100, (sectionCapacityInfo.projectedEnrolled / sectionCapacityInfo.capacity) * 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                              <span>0</span>
                              <span>{Math.round((sectionCapacityInfo.projectedEnrolled / sectionCapacityInfo.capacity) * 100)}% Used</span>
                              <span>{sectionCapacityInfo.capacity}</span>
                            </div>
                          </div>
                        )}

                        {sectionCapacityInfo.isExceeded && (
                          <div className="mt-3 p-2.5 bg-red-100/80 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-800">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Cannot Assign:</strong> Adding {sectionCapacityInfo.newStudentsCount} student(s) exceeds Section {sectionCapacityInfo.cleanSection}&apos;s capacity of {sectionCapacityInfo.capacity}. ({sectionCapacityInfo.availableSlots} slot(s) remaining).
                            </span>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkAssignSectionModal(false)}
                  disabled={isBulkAssigning}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkAssignSection}
                  disabled={isBulkAssigning || !targetBulkSection || isLoadingCapacity || sectionCapacityInfo?.isExceeded}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isBulkAssigning ? "Assigning..." : `Assign to ${selectedSet.size} Student(s)`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showViewRequestModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white">
              <h3 className="text-xl font-semibold text-gray-900">Registration Request Details</h3>
              <button onClick={() => { setShowViewRequestModal(false); setSelectedRequest(null); }} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Status</span>
                  <p className="text-lg font-bold capitalize mt-0.5 text-gray-900">{selectedRequest.status}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  selectedRequest.status === "approved" ? "bg-green-100 text-green-800" :
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
                <div>
                  <span className="text-gray-500 font-medium">LRN</span>
                  <p className="font-semibold text-gray-900">{selectedRequest.lrn || "-"}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Grade Level & Section</span>
                  <p className="font-semibold text-gray-900">Grade {selectedRequest.year_level || "-"} {selectedRequest.section ? `• ${selectedRequest.section}` : ""}</p>
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
                      Approve Student
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">Approve Student Registration?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will create a new login account and profile for <span className="font-bold text-gray-900">{selectedRequest.first_name} {selectedRequest.last_name}</span>. An email with temporary login credentials will automatically be sent to <span className="font-semibold text-green-700">{selectedRequest.email}</span>.
            </p>
            
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 mb-6 text-xs space-y-1 text-gray-700">
              <div><span className="font-semibold">LRN:</span> {selectedRequest.lrn}</div>
              <div><span className="font-semibold">Grade & Section:</span> Grade {selectedRequest.year_level} - {selectedRequest.section}</div>
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

      {/* BULK REGISTRATION REQUESTS IMPORT MODAL */}
      {showRegistrationBulkImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Import Student Registration Requests</h3>
                <p className="text-xs text-gray-500 mt-1">Upload CSV or paste student data. Rows will be queued into pending registration requests.</p>
              </div>
              <button onClick={() => setShowRegistrationBulkImportModal(false)} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Paste Spreadsheet Data (CSV / Tab-Delimited)</label>
                <textarea
                  rows={4}
                  value={registrationImportText}
                  onChange={(e) => setRegistrationImportText(e.target.value)}
                  placeholder="Paste rows with headers: First Name, Middle Name, Last Name, Email, LRN, Grade Level, Section..."
                  className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">Or choose a CSV file:</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const text = evt.target.result;
                          setRegistrationImportText(text);
                          processRegistrationImportText(text);
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                  />
                </div>
                {registrationImportText.trim() && (
                  <button
                    type="button"
                    onClick={() => processRegistrationImportText(registrationImportText)}
                    disabled={isImporting}
                    className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Analyze & Preview Data
                  </button>
                )}
              </div>

              {registrationImportSummary.total > 0 && (
                <div className="space-y-5 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">TOTAL PARSED</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">{registrationImportSummary.total}</p>
                    </div>
                    <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-300">
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">READY</p>
                      <p className="text-2xl font-bold text-emerald-600 mt-1">{registrationImportSummary.valid.length}</p>
                    </div>
                    <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-300">
                      <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">MISSING EMAIL</p>
                      <p className="text-2xl font-bold text-amber-700 mt-1">{registrationImportSummary.missingEmail?.length || 0}</p>
                    </div>
                    <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-300">
                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">DUPLICATES</p>
                      <p className="text-2xl font-bold text-blue-600 mt-1">{registrationImportSummary.duplicates.length}</p>
                    </div>
                  </div>

                  <div className="flex border-b border-gray-200 gap-6 px-1">
                    <button
                      type="button"
                      onClick={() => setRegistrationImportTab("valid")}
                      className={`pb-2.5 text-xs font-bold transition-all relative ${
                        registrationImportTab === "valid" ? "text-emerald-700" : "text-slate-500 hover:text-slate-700 font-medium"
                      }`}
                    >
                      Ready ({registrationImportSummary.valid.length})
                      {registrationImportTab === "valid" && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegistrationImportTab("duplicates")}
                      className={`pb-2.5 text-xs font-bold transition-all relative ${
                        registrationImportTab === "duplicates" ? "text-blue-700" : "text-slate-500 hover:text-slate-700 font-medium"
                      }`}
                    >
                      Duplicates ({registrationImportSummary.duplicates.length})
                      {registrationImportTab === "duplicates" && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                      )}
                    </button>
                    {registrationImportSummary.invalid.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRegistrationImportTab("invalid")}
                        className={`pb-2.5 text-xs font-bold transition-all relative ${
                          registrationImportTab === "invalid" ? "text-red-700" : "text-slate-500 hover:text-slate-700 font-medium"
                        }`}
                      >
                        Invalid ({registrationImportSummary.invalid.length})
                        {registrationImportTab === "invalid" && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full" />
                        )}
                      </button>
                    )}
                  </div>

                  {registrationImportTab === "valid" && (
                    <div className="max-h-56 overflow-y-auto border border-emerald-300 rounded-2xl divide-y divide-emerald-100 bg-white">
                      {registrationImportSummary.valid.length === 0 ? (
                        <p className="p-6 text-slate-500 text-center text-xs">No ready records found.</p>
                      ) : (
                        registrationImportSummary.valid.map((r, idx) => (
                          <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-emerald-50/30 transition-colors">
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{r.first_name} {r.last_name}</p>
                              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                {r.email} • LRN: {r.lrn} • Grade {r.grade_level} {r.section ? `(${r.section})` : ""}
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-md font-semibold text-xs shrink-0">
                              Ready
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {registrationImportTab === "duplicates" && (
                    <div className="max-h-56 overflow-y-auto border border-blue-300 rounded-2xl divide-y divide-blue-100 bg-white">
                      {registrationImportSummary.duplicates.length === 0 ? (
                        <p className="p-6 text-slate-500 text-center text-xs">No duplicate records.</p>
                      ) : (
                        registrationImportSummary.duplicates.map((d, idx) => (
                          <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-blue-50/30 transition-colors">
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{d.name || `${d.first_name} ${d.last_name}`}</p>
                              <p className="text-xs text-blue-700 mt-0.5 font-normal">{d.reason || "Duplicate record"}</p>
                            </div>
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 font-semibold rounded-md text-xs shrink-0">
                              Duplicate
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {registrationImportTab === "invalid" && (
                    <div className="max-h-56 overflow-y-auto border border-red-300 rounded-2xl divide-y divide-red-100 bg-white">
                      {registrationImportSummary.invalid.length === 0 ? (
                        <p className="p-6 text-slate-500 text-center text-xs">No invalid records.</p>
                      ) : (
                        registrationImportSummary.invalid.map((inv, idx) => (
                          <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-red-50/30 transition-colors">
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{inv.name || `${inv.first_name} ${inv.last_name}`}</p>
                              <p className="text-xs text-red-700 mt-0.5 font-normal">{inv.reason || "Invalid format"}</p>
                            </div>
                            <span className="px-3 py-1 bg-red-100 text-red-800 font-semibold rounded-md text-xs shrink-0">
                              Invalid
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRegistrationBulkImportModal(false)}
                disabled={isSavingRegistrationImport}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegistrationImport}
                disabled={isSavingRegistrationImport || registrationImportSummary.valid.length === 0}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSavingRegistrationImport && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSavingRegistrationImport ? "Importing..." : `Confirm & Create ${registrationImportSummary.valid.length} Registration Request(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MASTERLIST CREATE REGISTRATION REQUESTS MODAL */}
      {showMasterlistCreateRequestsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Import Student Masterlist</h3>
                <p className="text-xs text-gray-500 mt-1">Review parsed student records before creating registration requests</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterlistCreateRequestsModal(false)}
                disabled={isCreatingMasterlistRequests}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">TOTAL PARSED</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{masterlistCreateSummary.totalSelected}</p>
                </div>
                <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-300">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">READY</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{masterlistCreateSummary.ready.length}</p>
                </div>
                <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-300">
                  <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">MISSING EMAIL</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{masterlistCreateSummary.missingEmail.length}</p>
                </div>
                <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-300">
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">DUPLICATES</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{masterlistCreateSummary.duplicates.length}</p>
                </div>
              </div>

              <div className="flex border-b border-gray-200 gap-6 px-1">
                <button
                  type="button"
                  onClick={() => setMasterlistCreateTab("ready")}
                  className={`pb-2.5 text-xs font-bold transition-all relative ${
                    masterlistCreateTab === "ready" ? "text-emerald-700" : "text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  Ready ({masterlistCreateSummary.ready.length})
                  {masterlistCreateTab === "ready" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMasterlistCreateTab("missingEmail")}
                  className={`pb-2.5 text-xs font-bold transition-all relative ${
                    masterlistCreateTab === "missingEmail" ? "text-amber-700" : "text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  Missing Email ({masterlistCreateSummary.missingEmail.length})
                  {masterlistCreateTab === "missingEmail" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMasterlistCreateTab("duplicates")}
                  className={`pb-2.5 text-xs font-bold transition-all relative ${
                    masterlistCreateTab === "duplicates" ? "text-blue-700" : "text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  Duplicates ({masterlistCreateSummary.duplicates.length})
                  {masterlistCreateTab === "duplicates" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
              </div>

              {masterlistCreateTab === "ready" && (
                <div className="max-h-56 overflow-y-auto border border-emerald-300 rounded-2xl divide-y divide-emerald-100 bg-white">
                  {masterlistCreateSummary.ready.length === 0 ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No ready records to create requests.</p>
                  ) : (
                    masterlistCreateSummary.ready.map((s, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-emerald-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{s.fullName}</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {s.email} • LRN: {s.lrn} • Grade {s.year_level || s.grade_level || "7"} {s.section ? `(${s.section})` : ""}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-md font-semibold text-xs shrink-0">
                          Ready
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {masterlistCreateTab === "missingEmail" && (
                <div className="max-h-56 overflow-y-auto border border-amber-300 rounded-2xl divide-y divide-amber-100 bg-white">
                  {masterlistCreateSummary.missingEmail.length === 0 ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No missing email rows.</p>
                  ) : (
                    masterlistCreateSummary.missingEmail.map((m, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-amber-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{m.fullName}</p>
                          <p className="text-xs text-amber-700 mt-0.5 font-normal">Missing email address (LRN: {m.lrn || "N/A"})</p>
                        </div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 font-semibold rounded-md text-xs shrink-0">
                          Missing Email
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {masterlistCreateTab === "duplicates" && (
                <div className="max-h-56 overflow-y-auto border border-blue-300 rounded-2xl divide-y divide-blue-100 bg-white">
                  {masterlistCreateSummary.duplicates.length === 0 ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No duplicate rows.</p>
                  ) : (
                    masterlistCreateSummary.duplicates.map((d, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-blue-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{d.fullName}</p>
                          <p className="text-xs text-blue-700 mt-0.5 font-normal">{d.reason || "Duplicate record"}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 font-semibold rounded-md text-xs shrink-0">
                          Duplicate
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    const csvContent = "First Name,Middle Name,Last Name,Suffix,Email,LRN,Grade Level,Section\nJuan,D,Dela Cruz,,juan.delacruz@student.edu.ph,123456789012,7,Rizal\nMaria,S,Santos,,maria.santos@student.edu.ph,123456789013,7,Bonifacio";
                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", "student_masterlist_template.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMasterlistCreateRequestsModal(false)}
                    disabled={isCreatingMasterlistRequests}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCreateMasterlistRegistrationRequests}
                    disabled={isCreatingMasterlistRequests || masterlistCreateSummary.ready.length === 0}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isCreatingMasterlistRequests && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isCreatingMasterlistRequests ? "Creating..." : `Confirm & Create ${masterlistCreateSummary.ready.length} Registration Request(s)`}
                  </button>
                </div>
              </div>
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">Approve Selected Registration Requests?</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to approve <span className="font-bold text-gray-900">{selectedPendingRequestIds.size}</span> pending student registration request(s).
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
                onClick={handleConfirmBulkApproval}
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
            <h3 className="text-lg font-bold text-gray-900 mb-1">Creating Accounts & Sending Emails</h3>
            <p className="text-xs text-gray-500 mb-4">
              Processing request <span className="font-semibold text-gray-900">{bulkApproveProgress.current}</span> of <span className="font-semibold text-gray-900">{bulkApproveProgress.total}</span>
            </p>
            {bulkApproveProgress.currentStudentName && (
              <p className="text-xs font-mono text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-100 inline-block truncate max-w-full">
                Processing: {bulkApproveProgress.currentStudentName}
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
              <h3 className="text-lg font-bold text-gray-900">Bulk Approval Summary</h3>
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

      <GoogleSheetsImportModal
        isOpen={showGoogleSheetsModal}
        onClose={() => setShowGoogleSheetsModal(false)}
        type="student"
        onConfirmImport={handleConfirmGoogleSheetsImport}
        onTriggerFileUpload={() => fileInputRef.current?.click()}
        existingDbRecords={masterlist}
        existingPendingRequests={registrationRequests}
      />
    </div>
  );
}

export { StudentManagement };
