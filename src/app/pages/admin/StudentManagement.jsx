import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { SectionDropdown } from "../../components/admin/SectionDropdown";
import { toast } from "sonner";
import { adminNotifications } from "../../components/NotificationDefault";
import { supabase } from "../../lib/supabaseClient";
import { adminApi } from "@/app/lib/adminApi";
import { useActivity } from "../../lib/ActivityContext";
import { Search, UserPlus, Eye, Edit, Trash2, Download, X, Mail, Phone, Hash, CalendarDays, Users, Loader2, AlertTriangle, Sparkles, Upload, CheckSquare, Square, Key } from "lucide-react";
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

function StudentManagement() {
  const navigate = useNavigate();
  const { logActivity } = useActivity();
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState(adminNotifications);
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
    email: "",
    lrn: "",
    year_level: "",
    section: "",
    status: "Active",
    password: ""
  });
  const [editFormData, setEditFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
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
  const [gradeSectionsMap, setGradeSectionsMap] = useState({});

  // New state variables for Masterlist
  const [masterlist, setMasterlist] = useState([]);
  const [activeTab, setActiveTab] = useState("Profiles"); // "Profiles" or "Masterlist"
  const [selectedMasterlistIds, setSelectedMasterlistIds] = useState(new Set());
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showClearMasterlistConfirm, setShowClearMasterlistConfirm] = useState(false);
  const [isClearingMasterlist, setIsClearingMasterlist] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (showAddModal || showEditModal || showViewModal || showDeleteConfirm || showResetPasswordModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAddModal, showEditModal, showViewModal, showDeleteConfirm, showResetPasswordModal]);

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

  useEffect(() => {
    const loadStudents = async ({ showLoading = false } = {}) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        if (!db) {
          setErrorMessage("Supabase client is not configured.");
          return;
        }

        const [profilesRes, masterlistRes] = await Promise.all([
          adminApi.db("profiles", "select", {
            payload: "id, first_name, middle_name, last_name, email, lrn, year_level, section, status, role, created_at",
            eq: { column: "role", value: "student" },
            order: { column: "created_at", options: { ascending: false } }
          }),
          adminApi.db("student_masterlist", "select", {
            payload: "*",
            order: { column: "created_at", options: { ascending: false } }
          })
        ]);

        if (profilesRes.error) {
          setErrorMessage(profilesRes.error.message);
          setStudents([]);
          return;
        }

        setErrorMessage("");
        setStudents(profilesRes.data ?? []);
        if (!masterlistRes.error) {
          setMasterlist(masterlistRes.data ?? []);
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Unable to load students.");
        setStudents([]);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    };

    loadStudents({ showLoading: true });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const refreshStudents = async () => {
    if (!db) return;

    const [profilesRes, masterlistRes, gradeSectionsRes] = await Promise.all([
      adminApi.db("profiles", "select", {
        payload: "id, first_name, middle_name, last_name, email, lrn, year_level, section, status, role, created_at",
        eq: { column: "role", value: "student" },
        order: { column: "created_at", options: { ascending: false } }
      }),
      adminApi.db("student_masterlist", "select", {
        payload: "*",
        order: { column: "created_at", options: { ascending: false } }
      }),
      adminApi.db("grade_sections", "select", { payload: "*" })
    ]);

    if (profilesRes.error) {
      throw new Error(profilesRes.error.message);
    }

    setStudents(profilesRes.data ?? []);
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

  const getFullName = (student) => [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");

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
      if (field === "lrn") {
        nextFormData.email = `${nextValue.toLowerCase()}@students.connected`;
      }
      const fieldError = validateAddField(field, nextValue, nextFormData);

      setFormErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };

        if (fieldError) {
          nextErrors[field] = fieldError;
        } else {
          delete nextErrors[field];
        }

        if (field === "lrn") {
          const emailError = validateAddField("email", nextFormData.email, nextFormData);
          if (emailError) {
            nextErrors.email = emailError;
          } else {
            delete nextErrors.email;
          }
        }

        return nextErrors;
      });

      return nextFormData;
    });
  };

  const buildPayload = (formData) => ({
    first_name: formData.first_name.trim(),
    middle_name: formData.middle_name.trim() || null,
    last_name: formData.last_name.trim(),
    email: formData.email.trim().toLowerCase(),
    lrn: normalizeLrn(formData.lrn),
    year_level: normalizeYearLevel(formData.year_level),

    section: formData.section?.trim() || null,
    status: formData.status,
    role: "student"
  });

  const validateStudentForm = async (formData, excludeId = null) => {
    const errors = {};

    const fieldNames = ["first_name", "last_name", "email", "lrn", "year_level", "section", "status"];

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

    const emailOpts = {
      payload: "id",
      eq: { column: "email", value: formData.email.trim().toLowerCase() }
    };
    if (excludeId) emailOpts.neq = { column: "id", value: excludeId };

    const lrnOpts = {
      payload: "id",
      eq: { column: "lrn", value: normalizeLrn(formData.lrn) }
    };
    if (excludeId) lrnOpts.neq = { column: "id", value: excludeId };

    const [emailResult, lrnResult] = await Promise.all([
      adminApi.db("profiles", "select", emailOpts),
      adminApi.db("profiles", "select", lrnOpts)
    ]);

    if (emailResult.error) {
      errors.form = emailResult.error.message;
      return errors;
    }

    if (lrnResult.error) {
      errors.form = lrnResult.error.message;
      return errors;
    }

    if ((emailResult.data ?? []).length > 0) {
      errors.email = "Email already exists";
    }

    if ((lrnResult.data ?? []).length > 0) {
      errors.lrn = "LRN already exists";
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
      const email = studentFormData.email || `${studentFormData.lrn}@students.connected`;
      const tempPassword = studentFormData.password || generateUUID().slice(0, 8);
      
      let userId = generateUUID();
      
      const { data: authData, error: authError } = await adminApi.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true
      });
      
      if (authError) {
         if (authError.message?.includes("already exists") || authError.status === 422) {
            const { data: retryList } = await adminApi.listUsers();
            const retryUser = retryList?.users?.find(u => u.email === email);
            if (!retryUser) throw new Error("Email exists but user not found in fallback query.");
            userId = retryUser.id;
         } else {
            throw authError;
         }
      } else if (authData?.user) {
         userId = authData.user.id;
      }

      const { data, error } = await adminApi.db("profiles", "insert", {
        payload: { id: userId, ...buildPayload(studentFormData) },
        select: "id, first_name, middle_name, last_name, email, lrn, year_level, section, status, role, created_at",
        single: true
      });

      if (error) {
        throw error;
      }

      const savedPassword = studentFormData.password;
      if (data) {
        setStudents((current) => [data, ...current.filter((student) => student.id !== data.id)]);
        const studentName = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ");
        logActivity({
          actionType: "added",
          entityType: "student",
          entityId: data.id,
          entityName: studentName,
          details: { email: data.email, lrn: data.lrn, section: data.section },
          timestamp: data.created_at
        });
      }

      setStudentFormData({
        first_name: "",
        middle_name: "",
        last_name: "",
        email: "",
        lrn: "",
        year_level: "",

        section: "",
        status: "Active",
        password: ""
      });
      setFormErrors({});
      setShowAddModal(false);
      const tempMsg = savedPassword ? ` Temporary password: ${savedPassword}` : "";
      toast.success(`Student account added successfully.${tempMsg}`, { duration: 6000 });
    } catch (error) {
      console.error("Add student error:", error);
      const errMsg = error?.message || (typeof error === 'string' ? error : "Unable to add student.");
      toast.error(errMsg);
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

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').map(row => row.trim()).filter(Boolean);
        if (rows.length < 2) {
          toast.error("CSV file is empty or missing headers");
          setIsImporting(false);
          return;
        }

        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        const lrnIdx = headers.indexOf('lrn');
        const firstNameIdx = headers.indexOf('first_name');
        const lastNameIdx = headers.indexOf('last_name');
        const middleNameIdx = headers.indexOf('middle_name');
        const yearLevelIdx = headers.indexOf('year_level');
        const sectionIdx = headers.indexOf('section');

        if (lrnIdx === -1 || firstNameIdx === -1 || lastNameIdx === -1) {
          toast.error("CSV missing required headers: lrn, first_name, last_name");
          setIsImporting(false);
          return;
        }

        const records = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(',').map(c => c.trim());
          if (cols.length > lrnIdx && cols[lrnIdx]) {
             records.push({
               lrn: normalizeLrn(cols[lrnIdx]),
               first_name: cols[firstNameIdx],
               last_name: cols[lastNameIdx],
               middle_name: middleNameIdx !== -1 ? cols[middleNameIdx] : null,
               year_level: yearLevelIdx !== -1 ? normalizeYearLevel(cols[yearLevelIdx]) : null,
               section: sectionIdx !== -1 ? cols[sectionIdx] : null,
               account_created: false
             });
          }
        }

        if (records.length === 0) {
          toast.error("No valid records found in CSV");
          setIsImporting(false);
          return;
        }

        if (!db) throw new Error("Supabase client not configured");

        const { data: existing } = await db.from("student_masterlist").select("lrn");
        const existingLrns = new Set((existing || []).map(r => r.lrn));
        const newRecords = records.filter(r => !existingLrns.has(r.lrn));

        if (newRecords.length > 0) {
          const { error } = await db.from("student_masterlist").insert(newRecords);
          if (error) throw error;
          toast.success(`Successfully imported ${newRecords.length} students to masterlist.`);
          const { data } = await db.from("student_masterlist").select("*").order("created_at", { ascending: false });
          if (data) setMasterlist(data);
        } else {
          toast.info("All LRNs in the CSV already exist in the masterlist.");
        }
      } catch (err) {
        toast.error(err.message || "Failed to import CSV");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateAccounts = async (specificIds = null) => {
    const idsToProcess = Array.isArray(specificIds) ? new Set(specificIds) : selectedMasterlistIds;
    const selected = masterlist.filter(m => idsToProcess.has(m.id) && !m.account_created);
    if (selected.length === 0) return;

    setIsGenerating(true);
    let successCount = 0;
    let errorCount = 0;
    const processedLRNs = new Set(); // Added idempotency guard

    for (const student of selected) {
      try {
        const normalizedLRN = (student.lrn || "").trim();
        if (!normalizedLRN) {
           throw new Error("Student has an empty LRN.");
        }

        if (processedLRNs.has(normalizedLRN)) {
           continue; // skip duplicate LRN in the same batch immediately
        }
        processedLRNs.add(normalizedLRN);

        const firstNameLow = (student.first_name || "").trim().toLowerCase().replace(/\s+/g, "");
        const middleNameLow = (student.middle_name || "").trim().toLowerCase().replace(/\s+/g, "");
        const lastNameLow = (student.last_name || "").trim().toLowerCase().replace(/\s+/g, "");

        const tempPassword = `${firstNameLow}${middleNameLow}${lastNameLow}`;
        // Generate deterministic, unique email based on normalized LRN
        const email = `${normalizedLRN.toLowerCase()}@students.connected`;

        let userId = null;

        // 1. Pre-check if auth user already exists to prevent duplicate creation spam
        const { data: listData } = await adminApi.listUsers();
        const existingUser = listData?.users?.find(u => u.email === email);

        if (existingUser) {
           userId = existingUser.id;
        } else {
           // 2. Create auth user if not found
           const { data: authData, error: authError } = await adminApi.createUser({
             email,
             password: tempPassword,
             email_confirm: true
           });

           if (authError) {
              // 3. Graceful fallback if 422 email_exists happens due to race condition
              if (authError.message?.includes("already exists") || authError.status === 422) {
                 const { data: retryList } = await adminApi.listUsers();
                 const retryUser = retryList?.users?.find(u => u.email === email);
                 if (!retryUser) throw new Error("email_exists 422 returned, but user not found in fallback query.");
                 userId = retryUser.id;
              } else {
                 throw authError;
              }
           } else {
              userId = authData?.user?.id;
           }
        }

        if (!userId) {
           throw new Error("User flow succeeded but no userId was extracted.");
        }

        // 4. Upsert Profile using the resolved user ID
        const { error: profileError } = await adminApi.db("profiles", "upsert", {
          payload: {
            id: userId,
            role: "student",
            first_name: student.first_name,
            last_name: student.last_name,
            middle_name: student.middle_name,
            lrn: normalizedLRN,
            year_level: student.year_level,
            section: student.section,
            email: email,
            status: "Active",
            must_change_password: true,
            is_verified: false
          },
          onConflict: "id"
        });

        if (profileError) {
          throw profileError;
        }

        // 5. Atomic Masterlist Update
        const { error: masterlistError } = await adminApi.db("student_masterlist", "update", {
          payload: { account_created: true },
          eq: { column: "id", value: student.id }
        });

        if (masterlistError) throw masterlistError;

        successCount++;
      } catch (err) {
        // Structured error logging as requested
        console.error(`Failed to generate account for ${student.lrn}:`, err.message || err);
        errorCount++;
      }
    }

    setIsGenerating(false);
    setSelectedMasterlistIds(new Set());
    
    if (successCount > 0) toast.success(`Successfully generated ${successCount} accounts.`);
    if (errorCount > 0) toast.error(`Failed to generate ${errorCount} accounts.`);

    await refreshStudents();
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
      
      const results = await Promise.allSettled(
        idsToDelete.map(async (id) => {
          // 1. Manually delete related records to prevent 409 Foreign Key Constraint Errors
          // This is necessary if the Supabase schema lacks ON DELETE CASCADE for these tables.
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
            await adminApi.db(table.name, "delete", { eq: { column: table.col, value: id } });
          }

          // 2. Delete the profile
          const { error: profileError } = await adminApi.db("profiles", "delete", { eq: { column: "id", value: id } });
          if (profileError) throw profileError;

          // 3. Fully delete the user from Auth
          try {
             await adminApi.deleteUser(id);
          } catch (e) {
             console.error("Non-fatal: Failed to delete auth user", e);
          }
        })
      );

      let successCount = 0;
      let failureCount = 0;

      results.forEach(result => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          failureCount++;
          console.error("Delete failed for a student:", result.reason);
        }
      });

      if (successCount > 0) {
        logActivity({
          actionType: "deleted",
          entityType: "student",
          entityName: `${successCount} students`,
          details: { action: "bulk_delete" },
          timestamp: new Date().toISOString()
        });
      }

      if (failureCount === 0) {
        toast.success(`Successfully deleted ${successCount} students.`);
      } else if (successCount > 0) {
        toast.warning(`Deleted ${successCount} students. ${failureCount} failed (likely due to linked records).`);
      } else {
        throw new Error(`Failed to delete students. They might have linked records (e.g., grades, messages) that prevent deletion.`);
      }

      setSelectedStudentIds(new Set());
      setShowBulkDeleteConfirm(false);
      await refreshStudents();
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

  const allData = [...students, ...masterlist];
  
  const availableYearLevels = Array.from(new Set(allData.map(s => s.year_level).filter(Boolean))).sort();
  const availableSections = Array.from(new Set(
    allData
      .filter(s => yearLevelFilter === "all" || s.year_level === yearLevelFilter)
      .map(s => s.section)
      .filter(Boolean)
  )).sort();
  const availableCourses = Array.from(new Set(allData.map(s => s.course).filter(Boolean))).sort();

  const filterStudent = (student, isMasterlist = false) => {
    const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ").toLowerCase();
    const search = searchQuery.toLowerCase();
    
    const matchesSearch = fullName.includes(search) || 
      (student.email ?? "").toLowerCase().includes(search) || 
      (student.lrn ?? "").toLowerCase().includes(search);

    const matchesYearLevel = yearLevelFilter === "all" || student.year_level === yearLevelFilter;
    const matchesSection = sectionFilter === "all" || student.section === sectionFilter;
    const matchesCourse = courseFilter === "all" || student.course === courseFilter;
    
    // Status filter only applies to enrolled profiles
    const matchesStatus = isMasterlist || statusFilter === "all" || student.status === statusFilter;

    return matchesSearch && matchesYearLevel && matchesSection && matchesCourse && matchesStatus;
  };

  const filteredStudents = students.filter(s => filterStudent(s, false));
  const filteredMasterlist = masterlist.filter(s => filterStudent(s, true));

  const handleExportToCSV = () => {
    if (activeTab === "Profiles") {
      const headers = ["Full Name", "Email", "LRN", "Year Level", "Section", "Status", "Created At"];
      const rows = filteredStudents.map((student) => [
        getFullName(student),
        student.email,
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
      link.setAttribute("download", `students_${new Date().toISOString().split("T")[0]}.csv`);
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
      link.setAttribute("download", `masterlist_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
          <p className="text-gray-500">Loading student management...</p>
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

      <main className="flex-1 h-screen overflow-y-auto lg:pl-64">
        <div className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-end gap-4">
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) => setNotificationList((prev) => prev.map((notification) => (notification.id === id ? { ...notification, isRead: true } : notification)))}
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div data-tour="students-header" className="relative rounded-2xl p-8 text-gray-900 shadow-lg overflow-hidden bg-white border border-gray-200">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4 flex items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-blue-400">Student Management</h1>
                <p className="text-gray-600">Student records are up to date.</p>
              </div>
              <div className="flex items-center gap-3">
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button data-tour="students-import-btn" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors font-semibold shadow-sm cursor-pointer disabled:opacity-50">
                  {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  {isImporting ? "Importing..." : "Import Masterlist"}
                </button>
                <button data-tour="students-add-btn" onClick={() => { setStudentFormData((f) => ({ ...f, password: generateTempPassword() })); setShowAddModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-lg shadow-blue-600/20 cursor-pointer">
                  <UserPlus className="w-5 h-5" />
                  Add Student
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">{students.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Newest Registration</p>
              <p className="text-lg font-semibold text-blue-400">{students[0] ? getFullName(students[0]) : "No students yet"}</p>
              <p className="text-sm text-gray-500 mt-1">{students[0] ? formatDate(students[0].created_at) : "Add the first student to get started"}</p>
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
                  ? "border-blue-600 text-blue-600"
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
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Masterlist
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
                  <input type="text" placeholder="Search by name, email, or LRN..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500/50" />
                </div>
                <button data-tour="students-export-btn" onClick={handleExportToCSV} className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-900 rounded-xl hover:bg-white/20 transition-colors border border-gray-200 w-full md:w-auto justify-center">
                  <Download className="w-4 h-4" />
                  Export
                </button>

              {activeTab === "Profiles" && (
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={selectedStudentIds.size === 0 || isBulkDeleting}
                  className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center disabled:opacity-50"
                >
                  {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isBulkDeleting ? "Deleting..." : `Delete Selected (${selectedStudentIds.size})`}
                </button>
              )}

              {activeTab === "Masterlist" && (
                <>
                  {selectedMasterlistIds.size > 0 && (
                    <button
                      onClick={handleGenerateAccounts}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {isGenerating ? "Generating..." : `Generate Accounts (${selectedMasterlistIds.size})`}
                    </button>
                  )}
                  {masterlist.length > 0 && (
                    <button
                      onClick={() => setShowClearMasterlistConfirm(true)}
                      disabled={isClearingMasterlist}
                      className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold shadow-sm w-full md:w-auto justify-center disabled:opacity-50"
                    >
                      {isClearingMasterlist ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {isClearingMasterlist ? "Clearing..." : "Clear Imported Masterlist"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

          <div data-tour="students-table" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              {activeTab === "Profiles" ? (
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
                    <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Email</th>
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
                      const section = student.section || "Unassigned Section";
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
                                <span className="font-semibold text-gray-700">{section.toLowerCase().includes('section') ? section : `Section ${section}`}</span>
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
                                  <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                  <div className="truncate max-w-[200px]">{student.email}</div>
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
                                  <button onClick={() => handlePromptResetPassword(student)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Reset Password">
                                    <Key className="w-4 h-4 text-amber-500" />
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
              ) : (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                      <button 
                        onClick={() => {
                          if (selectedMasterlistIds.size === filteredMasterlist.filter(m => !m.account_created).length) {
                            setSelectedMasterlistIds(new Set());
                          } else {
                            setSelectedMasterlistIds(new Set(filteredMasterlist.filter(m => !m.account_created).map(m => m.id)));
                          }
                        }}
                        className="text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        {selectedMasterlistIds.size > 0 && selectedMasterlistIds.size === filteredMasterlist.filter(m => !m.account_created).length ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                      </button>
                    </th>
                    <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Full Name</th>
                    <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">LRN</th>
                    <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/6">Year Level</th>
                    <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/6">Section</th>
                    <th className="px-6 py-5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const grouped = {};
                    filteredMasterlist.forEach(student => {
                      const year = student.year_level ? `Grade ${student.year_level.replace(/\D/g, '')}` : "Unassigned Year";
                      const section = student.section || "Unassigned Section";
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
                                <span className="font-semibold text-gray-700">{section.toLowerCase().includes('section') ? section : `Section ${section}`}</span>
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
                                  disabled={student.account_created}
                                  onClick={() => {
                                    const newSet = new Set(selectedMasterlistIds);
                                    if (newSet.has(student.id)) newSet.delete(student.id);
                                    else newSet.add(student.id);
                                    setSelectedMasterlistIds(newSet);
                                  }}
                                  className="text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                                >
                                  {selectedMasterlistIds.has(student.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
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
                                <span className="truncate">{student.section || "-"}</span>
                              </td>
                              <td className="px-6 py-5 text-right align-middle">
                                <div className="flex items-center justify-end gap-2">
                                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${
                                    student.account_created
                                      ? "bg-green-50 text-green-600 border-green-200"
                                      : "bg-gray-50 text-gray-500 border-gray-200"
                                  }`}>
                                    {student.account_created ? "Created" : "Pending"}
                                  </span>
                                  {!student.account_created && (
                                    <button
                                      onClick={() => handleGenerateAccounts([student.id])}
                                      disabled={isGenerating}
                                      className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors shadow-sm"
                                    >
                                      Enroll
                                    </button>
                                  )}
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
            </div>
            {activeTab === "Profiles" && filteredStudents.length === 0 && (
              <div className="p-16 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600">No students found.</p>
              </div>
            )}
            {activeTab === "Masterlist" && filteredMasterlist.length === 0 && (
              <div className="p-16 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600">No masterlist records found. Import a CSV to get started.</p>
              </div>
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
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" value={studentFormData.email} readOnly placeholder="Auto-generated from LRN" className={`w-full px-4 py-3 border rounded-lg focus:outline-none bg-gray-100 text-gray-500 cursor-not-allowed ${formErrors.email ? "border-red-500" : "border-gray-300"}`} />
                    {formErrors.email && <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">LRN</label>
                    <input type="text" value={studentFormData.lrn} onChange={(e) => handleAddStudentFieldChange("lrn", e.target.value)} inputMode="numeric" maxLength={12} placeholder="12-digit LRN" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.lrn ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.lrn && <p className="text-red-500 text-sm mt-1">{formErrors.lrn}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Year Level</label>
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
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Temporary Password</label>
                    <div className="flex gap-2">
                      <input type="text" value={studentFormData.password} onChange={(e) => handleAddStudentFieldChange("password", e.target.value)} placeholder="Auto-generated temporary password" className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono" />
                      <button type="button" onClick={() => handleAddStudentFieldChange("password", generateTempPassword())} className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm text-gray-700 transition-colors">Regenerate</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Student uses this password to log in. Share it securely.</p>
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
                    <input type="text" value={editFormData.first_name} onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })} placeholder="Enter first name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {editFormErrors.first_name && <p className="text-red-500 text-sm mt-1">{editFormErrors.first_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                    <input type="text" value={editFormData.middle_name} onChange={(e) => setEditFormData({ ...editFormData, middle_name: e.target.value })} placeholder="Enter middle name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input type="text" value={editFormData.last_name} onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })} placeholder="Enter last name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {editFormErrors.last_name && <p className="text-red-500 text-sm mt-1">{editFormErrors.last_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" value={editFormData.email} readOnly placeholder="Auto-generated from LRN" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none bg-gray-100 text-gray-500 cursor-not-allowed" />
                    {editFormErrors.email && <p className="text-red-500 text-sm mt-1">{editFormErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">LRN</label>
                    <input type="text" value={editFormData.lrn} onChange={(e) => {
                      const nextValue = normalizeLrn(e.target.value);
                      const autoEmail = `${nextValue.toLowerCase()}@students.connected`;
                      setEditFormData({ ...editFormData, lrn: nextValue, email: autoEmail });
                      setEditFormErrors((currentErrors) => {
                        const nextErrors = { ...currentErrors };
                        const fieldError = validateAddField("lrn", nextValue);

                        if (fieldError) {
                          nextErrors.lrn = fieldError;
                        } else {
                          delete nextErrors.lrn;
                        }
                        
                        const emailError = validateAddField("email", autoEmail);
                        if (emailError) {
                          nextErrors.email = emailError;
                        } else {
                          delete nextErrors.email;
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
      {showResetPasswordModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Key className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Reset Password</h3>
                  <p className="text-sm text-gray-500">Generate a temporary password</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">User Information</p>
                <p className="font-semibold text-gray-900">{getFullName(selectedStudent)}</p>
                <p className="text-sm text-gray-600">{selectedStudent.email}</p>
                <p className="text-xs text-gray-500 mt-1">Role: Student • LRN: {selectedStudent.lrn || "N/A"}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Temporary Password</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={resetSettings.tempPassword} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 font-mono text-center text-lg tracking-wider" />
                  <button type="button" onClick={() => setResetSettings(s => ({ ...s, tempPassword: generateTempPassword() }))} className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm text-gray-700 transition-colors" disabled={isSubmitting}>
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                <input 
                  type="checkbox" 
                  id="forceChange" 
                  checked={resetSettings.forceChange} 
                  onChange={(e) => setResetSettings(s => ({ ...s, forceChange: e.target.checked }))}
                  className="mt-1 w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <label htmlFor="forceChange" className="text-sm cursor-pointer">
                  <span className="block font-medium mb-0.5">Force Password Change On Next Login</span>
                  <span className="text-blue-600/80">User will be locked out of the system until they create a new password.</span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowResetPasswordModal(false)} type="button" className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors" disabled={isSubmitting}>
                Cancel
              </button>
              <button onClick={handleResetPassword} type="button" className="px-6 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-all flex items-center gap-2 shadow-sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? "Generating..." : "Generate Password"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export { StudentManagement };
