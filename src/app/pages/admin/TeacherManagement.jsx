import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { SectionDropdown } from "../../components/admin/SectionDropdown";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { toast } from "sonner";
import { adminNotifications } from "../../components/NotificationDefault";
import { supabase } from "../../lib/supabaseClient";
import { adminApi } from "@/app/lib/adminApi";
import { useActivity } from "../../lib/ActivityContext";
import {
  Search,

  UserPlus,
  Eye,
  Edit,
  Trash2,
  BookOpen,
  Download,
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
  Square
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

const teacherSelectColumns = "*";
const subjectSelectColumns = "id, code, name, section, grade_level";
const emptyTeacherForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
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
  const [notificationList, setNotificationList] = useState(adminNotifications);
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
  
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  useEffect(() => {
    if (showAddModal || showEditModal || showViewModal || showAssignModal || showDeleteConfirm || showResetPasswordModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAddModal, showEditModal, showViewModal, showAssignModal, showDeleteConfirm, showResetPasswordModal]);

  const isLettersOnly = (value) => /^[A-Za-z\s.\-]+$/.test(value);
  const isValidAssignedClass = (value) => /^[A-Za-z0-9][A-Za-z0-9\s./-]*$/.test(value);
  const composeTeacherName = (formData) => [formData.first_name, formData.middle_name, formData.last_name].map((value) => value.trim()).filter(Boolean).join(" ");
  const formatTeacherFullName = (teacher) => {
    if (!teacher) return "Unknown teacher";

    const firstName = String(teacher.first_name ?? "").trim();
    const middleName = String(teacher.middle_name ?? "").trim();
    const lastName = String(teacher.last_name ?? "").trim();
    const combined = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();

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
  const splitTeacherName = (fullName) => {
    const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return { first_name: "", middle_name: "", last_name: "" };
    }

    if (parts.length === 1) {
      return { first_name: parts[0], middle_name: "", last_name: "" };
    }

    return {
      first_name: parts[0],
      middle_name: parts.slice(1, -1).join(" "),
      last_name: parts[parts.length - 1]
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
  const normalizeSubjects = (value) => {
    let rawArray = [];
    if (Array.isArray(value)) {
      rawArray = value;
    } else if (typeof value === "string") {
      const cleaned = value.replace(/[{}]/g, "");
      rawArray = cleaned.split(",");
    }

    return rawArray
      .map((item) => String(item || "").trim())
      .filter((item) => {
        if (!item) return false;
        const low = item.toLowerCase();
        return low !== "null" && low !== "undefined" && low !== "select teacher" && low !== "select subject";
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
    const subjectIds = normalizeSubjects(teacher?.subjects);
    return subjectIds.map((subjectId) => {
      const subject = availableSubjects.find((item) => String(item.id) === String(subjectId));
      if (!subject) return null;

      return {
        subjectLabel: `${subject.code} - ${subject.name} (${subject.section || "All Sections"})`,
        classLabel: subject.grade_level || "No grade assigned"
      };
    }).filter(Boolean);
  };
  const validateTeacherField = (field, value, formData) => {
    const nextValue = typeof value === "string" ? value : "";

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
        if (normalizeSubjects(nextValue).length === 0) return "At least one subject is required";
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
    const nextValue = field === "phone" ? normalizePhone(value) : value;
    const nextFormData = { ...formData, [field]: nextValue };
    const nextError = validateTeacherField(field, nextValue, nextFormData);

    setData(nextFormData);
    setErrors((current) => {
      if (nextError) {
        return { ...current, [field]: nextError };
      }

      if (!(field in current)) {
        return current;
      }

      const updatedErrors = { ...current };
      delete updatedErrors[field];
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

    setAvailableSubjects(data ?? []);
    console.log("[TeacherManagement] fetched subjects:", (data ?? []).map((s) => ({ id: s.id, code: s.code, name: s.name, grade_level: s.grade_level, year_level: s.year_level, grade: s.grade, year: s.year, section: s.section })));
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
      .select("id, teacher_id")
      .in("teacher_id", uniqueTeacherIds);

    if (subjectError) {
      throw new Error(subjectError.message);
    }

    await Promise.all(uniqueTeacherIds.map(async (teacherId) => {
      const assignedSubjectIds = [...new Set((subjectRows ?? [])
        .filter((subject) => String(subject.teacher_id) === String(teacherId))
        .map((subject) => String(subject.id || "").trim())
        .filter(Boolean))];

      console.log("[TeacherManagement] refreshing teacher subjects", {
        teacherId,
        assignedSubjectIds
      });

      const { error: updateError } = await db
        .from("profiles")
        .update({ subjects: assignedSubjectIds })
        .eq("id", teacherId);

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
    const affectedSubjectIds = [...new Set([...previousIds, ...nextIds])];

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
    const removeSubjectIds = previousIds.filter((subjectId) => !nextIds.includes(subjectId));

    if (addSubjectIds.length > 0) {
      try {
        const { data: teacherRow } = await db.from("profiles").select("grade_level, year_level, grade, year").eq("id", teacherId).maybeSingle();
        const teacherGradeNorm = normalizeGradeLevel(String(teacherRow?.grade_level || teacherRow?.year_level || teacherRow?.grade || teacherRow?.year || ""));

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
        const { error: assignError } = await db
          .from("subjects")
          .update({ teacher_id: teacherId })
          .in("id", addSubjectIds);

        if (assignError) {
          throw new Error(assignError.message);
        }
      }

      if (removeSubjectIds.length > 0) {
        console.log("[TeacherManagement] removing subjects", { teacherId, removeSubjectIds });
        const removableIds = (currentSubjects ?? [])
          .filter((subject) => removeSubjectIds.includes(subject.id) && String(subject.teacher_id) === String(teacherId))
          .map((subject) => subject.id);

        if (removableIds.length > 0) {
          const { error: removeError } = await db
            .from("subjects")
            .update({ teacher_id: null })
            .in("id", removableIds);

          if (removeError) {
            throw new Error(removeError.message);
          }
        }
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
        const { error: restoreError } = await db
          .from("subjects")
          .update({ teacher_id: snapshot.get(subject.id) ?? null })
          .eq("id", subject.id);

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

    const { data, error } = await db
      .from("profiles")
      .select(teacherSelectColumns)
      .eq("role", "teacher")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    setTeachers((data ?? []).map((teacher) => ({
      ...teacher,
      display_name: formatTeacherFullName(teacher),
      status: normalizeTeacherStatus(teacher.status),
      subjects: normalizeSubjects(teacher.subjects),
      grade_level: teacher.grade_level || teacher.year_level || ""
    })));
  };

  const validateTeacherForm = async (formData, excludeId = null, options = {}) => {
    const { requireSubjects = false } = options;
    const errors = {};
    const trimmedFirstName = formData.first_name.trim();
    const trimmedMiddleName = formData.middle_name.trim();
    const trimmedLastName = formData.last_name.trim();
    const trimmedEmail = formData.email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(formData.phone);
    const normalizedSubjects = normalizeSubjects(formData.subjects);
    const validSubjectIds = new Set(availableSubjects.map((subject) => subject.id));
    const assignedClass = formData.assigned_class?.trim() || "";

    if (!trimmedFirstName) {
      errors.first_name = "First name is required";
    } else if (!isLettersOnly(trimmedFirstName)) {
      errors.first_name = "First name can only contain letters";
    }

    if (trimmedMiddleName && !isLettersOnly(trimmedMiddleName)) {
      errors.middle_name = "Middle name can only contain letters";
    }

    if (!trimmedLastName) {
      errors.last_name = "Last name is required";
    } else if (!isLettersOnly(trimmedLastName)) {
      errors.last_name = "Last name can only contain letters";
    }

    if (excludeId !== null) {
      if (!trimmedEmail) {
        errors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        errors.email = "Invalid email format";
      }
    }

    if (!normalizedPhone) {
      errors.phone = "Phone number is required";
    } else if (!/^\d{11}$/.test(normalizedPhone)) {
      errors.phone = "Phone number must be exactly 11 digits";
    }

    if (normalizedSubjects.length > 0 && normalizedSubjects.some((subjectId) => !validSubjectIds.has(subjectId))) {
      errors.subjects = "One or more selected subjects are invalid";
    } else if (requireSubjects && normalizedSubjects.length === 0) {
      errors.subjects = "At least one subject is required";
    }

    if (!formData.status) {
      errors.status = "Status is required";
    }

    if (assignedClass && !isValidAssignedClass(assignedClass)) {
      errors.assigned_class = "Assigned class or section is invalid";
    }

    if (formData.grade_level && normalizedSubjects.length > 0) {
      try {
        const { data: subjectRows, error: subjErr } = await db
          .from("subjects")
          .select("*")
          .in("id", normalizedSubjects);

        if (subjErr) {
          errors.form = subjErr.message;
          return errors;
        }

        const teacherGradeNorm = normalizeGradeLevel(formData.grade_level);
        const mismatch = (subjectRows ?? []).some((s) => {
          if (String(s?.teacher_id || "") === String(excludeId)) return false;
          const subjGradeRaw = String(s?.grade_level || "").trim();
          return subjGradeRaw && normalizeGradeLevel(subjGradeRaw) !== teacherGradeNorm;
        });

        if (mismatch) {
          errors.subjects = "One or more selected subjects do not match the teacher's grade level.";
        }
      } catch (err) {
        errors.form = err instanceof Error ? err.message : "Failed to validate subject grade levels.";
        return errors;
      }
    }

    if (Object.keys(errors).length > 0) {
      return errors;
    }

    if (!db) {
      errors.form = "Supabase client is not configured.";
      return errors;
    }

    if (excludeId !== null) {
      const emailQuery = db.from("profiles").select("id").eq("email", trimmedEmail).limit(1);
      const [emailResult] = await Promise.all([emailQuery.neq("id", excludeId)]);

      if (emailResult.error) {
        errors.form = emailResult.error.message;
        return errors;
      }

      if ((emailResult.data ?? []).length > 0) {
        errors.email = "Email already exists";
      }
    }

    if (assignedClass) {
      const teacherQuery = supabase
        .from("profiles")
        .select(teacherSelectColumns)
        .eq("role", "teacher");

      const teacherResult = await (excludeId ? teacherQuery.neq("id", excludeId) : teacherQuery);

      if (teacherResult.error) {
        errors.form = teacherResult.error.message;
        return errors;
      }

      const conflictingTeacher = (teacherResult.data ?? []).find((teacher) => hasAssignedClass(teacher.assigned_class, assignedClass));
      if (conflictingTeacher) {
        errors.assigned_class = `This class is already assigned to ${getTeacherName(conflictingTeacher)}.`;
      }
    }

    return errors;
  };

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

    const initializeTeachers = async () => {
      try {
        if (!db) {
          setErrorMessage("Supabase client is not configured.");
          return;
        }

        await Promise.allSettled([fetchTeachers(), fetchSubjects()]);
        setErrorMessage("");
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load teachers.");
          setTeachers([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeTeachers();

    const channel = supabase
      ? supabase
          .channel("admin-teacher-profiles")
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
          .channel("admin-teacher-subjects")
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
    const { first_name, middle_name, last_name } = splitTeacherName(formatTeacherFullName(teacher));
    setEditFormData({
      first_name,
      middle_name,
      last_name,
      email: teacher.email ?? "",
      phone: teacher.phone ?? "",
      grade_level: teacher.grade_level ?? "",
      subjects: normalizeSubjects(teacher.subjects),
      status: teacher.status ?? "Active"
    });
    setEditFormErrors({});
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
      
      const results = await Promise.allSettled(
        idsToDelete.map(async (id) => {
          // Find the teacher object to get their subjects
          const teacher = teachers.find(t => t.id === id);
          if (teacher) {
            const subjectIdsToRelease = normalizeSubjects(teacher.subjects);
            if (subjectIdsToRelease.length > 0) {
              await db.from("subjects").update({ teacher_id: null }).in("id", subjectIdsToRelease);
            }
          }

          const cleanupTables = [
            { name: "notifications", col: "user_id" },
            { name: "password_reset_logs", col: "user_id" },
            { name: "conversation_participants", col: "profile_id" },
            { name: "conversation_reads", col: "user_id" },
            { name: "messages", col: "sender_id" },
            { name: "teacher_student_grades", col: "teacher_id" },
            { name: "teacher_assessment_submissions", col: "teacher_id" },
            { name: "teacher_assessment_grades", col: "teacher_id" },
            { name: "lessons", col: "teacher_id" }
          ];

          for (const table of cleanupTables) {
            await db.from(table.name).delete().eq(table.col, id);
          }

          const { error: profileError } = await db.from("profiles").delete().eq("id", id);
          if (profileError) throw profileError;

          try {
             await adminApi.deleteUser(id);
          } catch (e) {
             console.warn("Non-fatal: Failed to delete auth user", e);
          }
        })
      );

      let successCount = 0;
      results.forEach(result => {
        if (result.status === "fulfilled") successCount++;
        else console.error("Failed to delete a teacher:", result.reason);
      });

      setShowBulkDeleteConfirm(false);
      setSelectedTeacherIds(new Set());
      await fetchTeachers();
      await fetchSubjects();

      if (successCount === idsToDelete.length) {
        toast.success(`Successfully deleted ${successCount} teacher(s).`);
      } else if (successCount > 0) {
        toast.warning(`Deleted ${successCount} out of ${idsToDelete.length} teachers.`);
      } else {
        toast.error("Failed to delete any teachers.");
      }

    } catch (err) {
      console.error(err);
      toast.error("An error occurred during bulk deletion.");
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
    const search = searchQuery.toLowerCase();
    const assignments = getTeacherAssignments(teacher);
    const subjectText = assignments.map((item) => item.subjectLabel).join(" ").toLowerCase();
    const sectionText = assignments.map((item) => item.classLabel).join(" ").toLowerCase();
    const matchesSearch =
      getTeacherName(teacher).toLowerCase().includes(search) ||
      (teacher.email ?? "").toLowerCase().includes(search) ||
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
      const selectedSubjectIds = normalizeSubjects(teacherFormData.subjects);
      const fullName = composeTeacherName(teacherFormData);
      
      const firstNameLow = teacherFormData.first_name.trim().toLowerCase().replace(/\s+/g, "");
      const middleNameLow = teacherFormData.middle_name.trim().toLowerCase().replace(/\s+/g, "");
      const lastNameLow = teacherFormData.last_name.trim().toLowerCase().replace(/\s+/g, "");
      
      const tempPassword = `${firstNameLow}${middleNameLow}${lastNameLow}`;
      const baseEmail = `${firstNameLow}.${lastNameLow}@dasma.deped.gov.ph`;
      
      let teacherEmail = baseEmail;
      let suffix = 1;
      while (true) {
        const { data: existing } = await db.from("profiles").select("id").eq("email", teacherEmail).maybeSingle();
        if (!existing) break;
        teacherEmail = `${firstNameLow}.${lastNameLow}.${suffix}@dasma.deped.gov.ph`;
        suffix++;
      }

      const { data: authData, error: authError } = await db.auth.admin.createUser({
        email: teacherEmail,
        password: tempPassword,
        email_confirm: true
      });
      if (authError) throw authError;

      const resolvedId = authData?.user?.id || generateUUID();

      const payload = {
        id: resolvedId,
        role: "teacher",
        first_name: teacherFormData.first_name.trim(),
        middle_name: teacherFormData.middle_name.trim() || null,
        last_name: teacherFormData.last_name.trim() || null,
        email: teacherEmail,
        phone: normalizePhone(teacherFormData.phone),
        status: normalizeTeacherStatus(teacherFormData.status),
        year_level: teacherFormData.grade_level?.trim() || null,
        must_change_password: true,
        is_verified: false
      };

      const { data, error } = await db.from("profiles").insert(payload).select(teacherSelectColumns).single();

      if (error) {
        await db.auth.admin.deleteUser(resolvedId).catch(() => {});
        throw error;
      }

      createdTeacherId = data.id;

      const nextTeacher = { 
        ...data, 
        grade_level: data.grade_level || data.year_level || "",
        subjects: normalizeSubjects(data.subjects) 
      };
      await syncTeacherSubjectAssignments({
        teacherId: nextTeacher.id,
        previousSubjectIds: [],
        nextSubjectIds: selectedSubjectIds
      });

      await Promise.allSettled([fetchTeachers(), fetchSubjects()]);
      const nextTeacherName = getTeacherName(nextTeacher);
      logActivity({
        actionType: selectedSubjectIds.length > 0 ? "assigned_subject_to_teacher" : "added",
        entityType: "teacher",
        entityId: nextTeacher.id,
        entityName: nextTeacherName,
        details: { email: nextTeacher.email, phone: nextTeacher.phone, subjects: formatSubjects(selectedSubjectIds) },
        timestamp: nextTeacher.created_at
      });
      toast.success(`${nextTeacherName} added successfully.`, { duration: 6000 });
      resetAddModal();
      
      setCreatedCredentials({
        name: nextTeacherName,
        email: teacherEmail,
        password: tempPassword
      });
      setShowCredentialsModal(true);
      
    } catch (error) {
      if (createdTeacherId) {
        try {
          await db.from("profiles").delete().eq("id", createdTeacherId);
        } catch {
        }
      }
      console.error("Add teacher error:", error);
      const errMsg = error?.message || (typeof error === 'string' ? error : "Unable to add teacher.");
      toast.error(errMsg);
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
      const nextSubjectIds = normalizeSubjects(editFormData.subjects);
      const fullName = composeTeacherName(editFormData);
      const payload = {
        first_name: editFormData.first_name.trim(),
        middle_name: editFormData.middle_name.trim() || null,
        last_name: editFormData.last_name.trim() || null,
        email: editFormData.email.trim().toLowerCase(),
        phone: normalizePhone(editFormData.phone),
        status: normalizeTeacherStatus(editFormData.status),
        year_level: editFormData.grade_level?.trim() || null
      };

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

      const { data, error } = await adminApi.updateProfile(selectedTeacher.id, payload);

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

      toast.success(`${nextTeacherName} updated successfully`);
      resetEditModal();
    } catch (error) {
      if (updateSucceeded) {
        try {
          const previousSubjectIds = normalizeSubjects(selectedTeacher.subjects);
          await db
            .from("profiles")
            .update({
              first_name: selectedTeacher.first_name ?? "",
              middle_name: selectedTeacher.middle_name ?? null,
              last_name: selectedTeacher.last_name ?? null,
              email: selectedTeacher.email ?? "",
              phone: selectedTeacher.phone ?? "",
              subjects: previousSubjectIds,
              status: selectedTeacher.status ?? "Active"
            })
            .eq("id", selectedTeacher.id);

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
    setSelectedTeacher((current) => (current?.id === teacherId ? null : current));
    setShowViewModal(false);
    setShowEditModal(false);
    setTeacherToDelete(null);

    try {
      const subjectIdsToRelease = normalizeSubjects(teacherToDelete.subjects);
      if (subjectIdsToRelease.length > 0) {
        const { error: subjectError } = await db
          .from("subjects")
          .update({ teacher_id: null })
          .in("id", subjectIdsToRelease);

        if (subjectError) {
          throw subjectError;
        }
      }

      const { error } = await db.from("profiles").delete().eq("id", teacherId);

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

      const { error: logError } = await db.from("password_reset_logs").insert({
        user_id: selectedTeacher.id,
        reset_by: JSON.parse(localStorage.getItem("currentUser")).id,
        temporary_password_generated: true
      });

      if (logError) console.error("Failed to log password reset:", logError);

      await db.from("notifications").insert({
        user_id: selectedTeacher.id,
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

      const { data: teacherRows, error: teacherRowsError } = await db
        .from("profiles")
        .select(teacherSelectColumns)
        .eq("role", "teacher")
        .neq("id", teacherToAssign.id);

      if (teacherRowsError) {
        throw teacherRowsError;
      }

      const conflictingTeacher = (teacherRows ?? []).find((teacher) => hasAssignedClass(teacher.assigned_class, assignedClass));
      if (conflictingTeacher) {
        setAssignFormErrors({ assigned_class: `This class is already assigned to ${getTeacherName(conflictingTeacher)}.` });
        return;
      }

      const nextAssignedClass = [...currentClasses, assignedClass].join(", ");

      const { data, error } = await db
        .from("profiles")
        .update({ assigned_class: nextAssignedClass })
        .eq("id", teacherToAssign.id)
        .select(teacherSelectColumns)
        .single();

      if (error) {
        throw error;
      }

      const updatedTeacher = {
        ...data,
        display_name: formatTeacherFullName(data),
        subjects: normalizeSubjects(data.subjects)
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
    link.setAttribute("download", `teachers_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeCount = teachers.filter((teacher) => isTeacherActive(teacher.status)).length;
  const inactiveCount = teachers.length - activeCount;
  const assignedCount = teachers.reduce((count, teacher) => count + getTeacherAssignments(teacher).length, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-gray-500">Loading teacher management...</p>
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
          <div data-tour="teachers-header" className="relative rounded-2xl p-8 text-gray-900 shadow-lg overflow-hidden bg-white border border-gray-200">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4 flex items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-blue-600">Teacher Management</h1>
                <p className="text-gray-600">Teacher records are up to date</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                <button data-tour="teachers-add-btn" onClick={() => { setTeacherFormData((f) => ({ ...f, password: generateTempPassword() })); setShowAddModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-lg shadow-blue-600/20 shadow-sm cursor-pointer">
                  <UserPlus className="w-5 h-5" />
                  Add Teacher
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Total Teachers</p>
              <p className="text-3xl font-bold text-gray-900">{teachers.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Active Teachers</p>
              <p className="text-3xl font-bold text-green-600">{activeCount}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Assigned Classes</p>
              <p className="text-3xl font-bold text-blue-400">{assignedCount}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Inactive Teachers</p>
              <p className="text-3xl font-bold text-red-500">{inactiveCount}</p>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div data-tour="teachers-search" className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  type="text"
                  placeholder="Search by teacher, subject, or class/section..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500/50"
                />
              </div>
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
              {selectedTeacherIds.size > 0 && (
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors border border-red-600 font-semibold shadow-sm w-full md:w-auto justify-center disabled:opacity-50"
                >
                  {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isBulkDeleting ? "Deleting..." : `Delete Selected (${selectedTeacherIds.size})`}
                </button>
              )}
              <button onClick={handleExportToCSV} className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-900 rounded-xl hover:bg-white/20 transition-colors border border-gray-200">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Teacher Table */}
          <div data-tour="teachers-table" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
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
                    
                    // Helper to render badges with +More functionality
                    const renderBadges = (items, type) => {
                      if (!items || items.length === 0) {
                        return <span className="text-gray-400 text-sm italic">None</span>;
                      }
                      
                      const isSubject = type === 'subject';
                      // Use a Set to extract unique labels for Grade Levels, but map for Subjects
                      let uniqueLabels = [];
                      if (isSubject) {
                        uniqueLabels = items.map(item => item.subjectLabel);
                      } else {
                        uniqueLabels = [...new Set(items.map(item => item.classLabel))];
                      }
                      
                      // Filter out empty labels and deduplicate
                      const finalLabels = [...new Set(uniqueLabels.filter(Boolean))];
                      
                      if (finalLabels.length === 0) return <span className="text-gray-400 text-sm italic">None</span>;

                      const limit = 2;
                      const bgClass = isSubject ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-indigo-50 text-indigo-700 border-indigo-200/60';
                      
                      // Using a details/summary approach for an inline expand/collapse without complex state
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
                            <button onClick={() => handleViewTeacher(teacher)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View">
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            <button data-tour="teachers-assignments-btn" onClick={() => handleEditTeacher(teacher)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                              <Edit className="w-4 h-4 text-blue-500" />
                            </button>
                            <button onClick={() => handlePromptResetPassword(teacher)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Reset Password">
                              <Key className="w-4 h-4 text-amber-500" />
                            </button>
                            <button onClick={() => handlePromptDeleteTeacher(teacher)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredTeachers.length === 0 && (
              <div className="p-16 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600">No teachers found.</p>
              </div>
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
                  <div className="md:col-span-2">
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
                  <div className="md:col-span-2">
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
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subjects</label>
                    <CustomSelect
                      multiple
                      value={editFormData.subjects}
                      onChange={(value) => updateTeacherField(setEditFormData, setEditFormErrors, editFormData, "subjects", value)}
                      options={availableSubjects
                        .filter((subject) => {
                          if (!editFormData.grade_level) return true;
                          const subjGradeRaw = String(subject.grade_level || "").trim();
                          return subjGradeRaw && normalizeGradeLevel(subjGradeRaw) === normalizeGradeLevel(editFormData.grade_level);
                        })
                        .map((subject) => ({ value: subject.id, label: `${subject.code} - ${subject.name} (${subject.section || "All Sections"})` }))}
                      placeholder={availableSubjects.length > 0 ? "Select subjects" : "No subjects available"}
                      icon={<BookOpen className="w-5 h-5" />}
                      className="min-w-[180px]"
                      disabled={availableSubjects.length === 0}
                    />
                    
                    <p className="text-xs text-gray-500 mt-1">Choose one or more subjects from the dropdown.</p>
                    {editFormErrors.subjects && <p className="text-red-500 text-sm mt-1">{editFormErrors.subjects}</p>}
                  </div>
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
                <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-gray-900">{createdCredentials.email}</p>
                  <button onClick={() => { navigator.clipboard.writeText(createdCredentials.email); toast.success("Email copied!"); }} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Copy</button>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Temporary Password</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-gray-900">{createdCredentials.password}</p>
                  <button onClick={() => { navigator.clipboard.writeText(createdCredentials.password); toast.success("Password copied!"); }} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Copy</button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => {
                  const csv = `Name,Email,Temporary Password\n"${createdCredentials.name}","${createdCredentials.email}","${createdCredentials.password}"`;
                  const blob = new Blob([csv], { type: "text/csv" });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = `credentials_${createdCredentials.name.replace(/\s+/g, '_')}.csv`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }} 
                className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-all"
              >
                Download CSV
              </button>
              <button 
                onClick={() => {
                  setShowCredentialsModal(false);
                  setCreatedCredentials(null);
                }} 
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetPasswordModal && selectedTeacher && (
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
                <p className="font-semibold text-gray-900">{getTeacherName(selectedTeacher)}</p>
                <p className="text-sm text-gray-600">{selectedTeacher.email}</p>
                <p className="text-xs text-gray-500 mt-1">Role: Teacher</p>
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
                  id="forceChangeTeacher" 
                  checked={resetSettings.forceChange} 
                  onChange={(e) => setResetSettings(s => ({ ...s, forceChange: e.target.checked }))}
                  className="mt-1 w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <label htmlFor="forceChangeTeacher" className="text-sm cursor-pointer">
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

export { TeacherManagement };
export default TeacherManagement;
