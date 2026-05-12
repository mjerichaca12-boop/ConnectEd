import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { supabase, supabaseAdmin } from "../../lib/supabaseClient";
import { useActivity } from "../../lib/ActivityContext";
import { Search, UserPlus, Eye, Edit, Trash2, Download, X, Mail, Phone, Hash, CalendarDays, Users, Loader2, AlertTriangle, ChevronDown, CheckCircle2, Sparkles } from "lucide-react";

const db = supabaseAdmin || supabase;
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
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [studentFormData, setStudentFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    lrn: "",
    year_level: "",
    phone: "",
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
    phone: "",
    section: "",
    status: "Active"
  });
  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

        const { data, error } = await db
          .from("profiles")
          .select("id, first_name, middle_name, last_name, email, lrn, year_level, phone, section, status, role, created_at")
          .eq("role", "student")
          .order("created_at", { ascending: false });

        if (error) {
          setErrorMessage(error.message);
          setStudents([]);
          return;
        }

        setErrorMessage("");
        setStudents(data ?? []);
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

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const refreshStudents = async () => {
    if (!db) return;

    const { data, error } = await db
      .from("profiles")
      .select("id, first_name, middle_name, last_name, email, lrn, year_level, phone, section, status, role, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    setStudents(data ?? []);
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

  const normalizePhone = (value) => value.replace(/\D/g, "").slice(0, 11);
  const normalizeLrn = (value) => value.replace(/\D/g, "").slice(0, 12);
  const normalizeYearLevel = (value) => value.replace(/\D/g, "").slice(0, 2);

  const validateAddField = (field, value) => {
    const trimmedValue = typeof value === "string" ? value.trim() : value;

    switch (field) {
      case "first_name":
        if (!trimmedValue) return "First name is required";
        if (!/^[A-Za-z]+$/.test(trimmedValue)) return "First name must contain letters only";
        return "";
      case "last_name":
        if (!trimmedValue) return "Last name is required";
        if (!/^[A-Za-z]+$/.test(trimmedValue)) return "Last name must contain letters only";
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
      case "phone": {
        if (!trimmedValue) return "Phone number is required";
        const normalizedPhone = normalizePhone(String(trimmedValue));
        if (!/^\d{11}$/.test(normalizedPhone)) return "Phone number must be exactly 11 digits";
        return "";
      }
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
      const nextValue = field === "phone" ? normalizePhone(value) : field === "lrn" ? normalizeLrn(value) : field === "year_level" ? normalizeYearLevel(value) : value;
      const nextFormData = { ...current, [field]: nextValue };
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

  const buildPayload = (formData) => ({
    first_name: formData.first_name.trim(),
    middle_name: formData.middle_name.trim() || null,
    last_name: formData.last_name.trim(),
    email: formData.email.trim().toLowerCase(),
    lrn: normalizeLrn(formData.lrn),
    year_level: normalizeYearLevel(formData.year_level),
    phone: formData.phone.trim(),
    section: formData.section?.trim() || null,
    status: formData.status,
    role: "student"
  });

  const validateStudentForm = async (formData, excludeId = null) => {
    const errors = {};

    const fieldNames = ["first_name", "last_name", "email", "lrn", "year_level", "phone", "section", "status"];

    fieldNames.forEach((field) => {
      const fieldError = validateAddField(field, formData[field]);
      if (fieldError) errors[field] = fieldError;
    });

    if (Object.keys(errors).length > 0) {
      return errors;
    }

    if (!db) {
      errors.form = "Supabase client is not configured.";
      return errors;
    }

    const emailQuery = db.from("profiles").select("id").eq("email", formData.email.trim().toLowerCase()).limit(1);
    const lrnQuery = db.from("profiles").select("id").eq("lrn", normalizeLrn(formData.lrn)).limit(1);

    const [emailResult, lrnResult] = await Promise.all([
      excludeId ? emailQuery.neq("id", excludeId) : emailQuery,
      excludeId ? lrnQuery.neq("id", excludeId) : lrnQuery
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
    setSuccessMessage("");

    const validationErrors = await validateStudentForm(studentFormData);
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (!db) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const newStudentId = generateUUID();
      const { data, error } = await db
        .from("profiles")
        .insert({ id: newStudentId, ...buildPayload(studentFormData) })
        .select("id, first_name, middle_name, last_name, email, lrn, year_level, phone, section, status, role, created_at")
        .single();

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
        phone: "",
        section: "",
        status: "Active",
        password: ""
      });
      setFormErrors({});
      setShowAddModal(false);
      setSuccessMessage(`Student account added successfully.${savedPassword ? ` Temporary password: ${savedPassword}` : ""}`);
    } catch (error) {
      console.error("Add student error:", error);
      setErrorMessage(error?.message || (typeof error === 'string' ? error : "Unable to add student."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

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
      const { data, error } = await db
        .from("profiles")
        .update(buildPayload(editFormData))
        .eq("id", selectedStudent.id)
        .select("id, first_name, middle_name, last_name, email, lrn, year_level, phone, section, status, role, created_at")
        .single();

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
        phone: "",
        section: "",
        status: "Active"
      });
      setEditFormErrors({});
      setShowEditModal(false);
      setSuccessMessage("Student account updated successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update student.");
    } finally {
      setIsSubmitting(false);
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
      email: student.email ?? "",
      lrn: student.lrn ?? "",
      year_level: student.year_level ?? "",
      phone: student.phone ?? "",
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
      phone: "",
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
      phone: "",
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
    setSuccessMessage("");
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
      const { error } = await db.from("profiles").delete().eq("id", studentId);

      if (error) {
        throw new Error(error.message);
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
      setSuccessMessage(`${studentName} deleted successfully`);
    } catch (err) {
      setStudents(previousStudents);
      setErrorMessage(err instanceof Error ? err.message : "Unable to delete student.");
    }
  };

  const filteredStudents = students.filter((student) => {
    const fullName = getFullName(student).toLowerCase();
    const search = searchQuery.toLowerCase();
    return fullName.includes(search) || (student.email ?? "").toLowerCase().includes(search) || (student.lrn ?? "").toLowerCase().includes(search) || (student.year_level ?? "").toLowerCase().includes(search) || (student.section ?? "").toLowerCase().includes(search) || (student.status ?? "").toLowerCase().includes(search);
  });

  const handleExportToCSV = () => {
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

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10 lg:pl-64">
        <div className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-gray-900">Student Management</h2>
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
            <div className="relative pl-4 flex items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-blue-400">Student Database</h1>
                <p className="text-gray-600">{students.length} student profiles loaded from Supabase</p>
              </div>
              <button onClick={() => { setStudentFormData((f) => ({ ...f, password: generateTempPassword() })); setShowAddModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-gray-900 rounded-xl hover:bg-blue-500 transition-colors font-semibold shadow-lg shadow-blue-500/20">
                <UserPlus className="w-5 h-5" />
                Add Student
              </button>
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

          {successMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-200">
              {successMessage}
            </div>
          )}

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input type="text" placeholder="Search by name, email, year level, or status..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500/50" />
              </div>
              <button onClick={handleExportToCSV} className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-900 rounded-xl hover:bg-white/20 transition-colors border border-gray-200">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Full Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">LRN</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Year Level</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Created At</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{getFullName(student)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Student profile</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-gray-500" />
                          {student.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-gray-500" />
                          {student.lrn || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Hash className="w-3.5 h-3.5 text-gray-500" />
                          {student.year_level || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${student.status === "Disabled" ? "bg-red-50 text-red-400 border-red-200" : "bg-green-50 text-green-600 border-green-200"}`}>
                          {student.status || "Active"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(student.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleViewStudent(student)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View">
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button onClick={() => handleEditStudent(student)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                            <Edit className="w-4 h-4 text-blue-400" />
                          </button>
                          <button onClick={() => handlePromptDeleteStudent(student)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredStudents.length === 0 && (
              <div className="p-16 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600">No students found.</p>
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
                    <input type="email" value={studentFormData.email} onChange={(e) => handleAddStudentFieldChange("email", e.target.value)} placeholder="student@example.com" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.email ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.email && <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">LRN</label>
                    <input type="text" value={studentFormData.lrn} onChange={(e) => handleAddStudentFieldChange("lrn", e.target.value)} inputMode="numeric" maxLength={12} placeholder="12-digit LRN" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.lrn ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.lrn && <p className="text-red-500 text-sm mt-1">{formErrors.lrn}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Year Level</label>
                    <input type="text" inputMode="numeric" maxLength={2} value={studentFormData.year_level} onChange={(e) => handleAddStudentFieldChange("year_level", e.target.value)} placeholder="e.g. 7 or 12" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.year_level ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.year_level && <p className="text-red-500 text-sm mt-1">{formErrors.year_level}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                    <input type="text" value={studentFormData.phone} onChange={(e) => handleAddStudentFieldChange("phone", e.target.value)} inputMode="numeric" maxLength={11} placeholder="11-digit phone number" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${formErrors.phone ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`} />
                    {formErrors.phone && <p className="text-red-500 text-sm mt-1">{formErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <div className="relative">
                      <select value={studentFormData.status} onChange={(e) => handleAddStudentFieldChange("status", e.target.value)} className={`w-full appearance-none px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 bg-white ${formErrors.status ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"}`}>
                        <option value="">Select status</option>
                        <option value="Active">Active</option>
                        <option value="Disabled">Disabled</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
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
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={handleCloseAddModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2" disabled={isSubmitting}>
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
                    <input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} placeholder="student@example.com" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {editFormErrors.email && <p className="text-red-500 text-sm mt-1">{editFormErrors.email}</p>}
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
                    <input type="text" value={editFormData.year_level} onChange={(e) => {
                      const nextValue = normalizeYearLevel(e.target.value);
                      setEditFormData({ ...editFormData, year_level: nextValue });
                      setEditFormErrors((currentErrors) => {
                        const nextErrors = { ...currentErrors };
                        const fieldError = validateAddField("year_level", nextValue);

                        if (fieldError) {
                          nextErrors.year_level = fieldError;
                        } else {
                          delete nextErrors.year_level;
                        }

                        return nextErrors;
                      });
                    }} inputMode="numeric" maxLength={2} placeholder="e.g. 7 or 12" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {editFormErrors.year_level && <p className="text-red-500 text-sm mt-1">{editFormErrors.year_level}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                    <input type="text" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {editFormErrors.phone && <p className="text-red-500 text-sm mt-1">{editFormErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Section</label>
                    <input type="text" value={editFormData.section} onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })} placeholder="Enter section" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {editFormErrors.section && <p className="text-red-500 text-sm mt-1">{editFormErrors.section}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <div className="relative">
                      <select value={editFormData.status} onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })} className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                        <option value="">Select status</option>
                        <option value="Active">Active</option>
                        <option value="Disabled">Disabled</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {editFormErrors.status && <p className="text-red-500 text-sm mt-1">{editFormErrors.status}</p>}
                  </div>
                </div>
                {editFormErrors.form && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {editFormErrors.form}
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={handleCloseEditModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2" disabled={isSubmitting}>
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
                    <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-600" />
                      <p className="text-gray-900">{selectedStudent.phone || "Not set"}</p>
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
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    handleCloseViewModal();
                    handleEditStudent(selectedStudent);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit Student
                </button>
                <button onClick={handleCloseViewModal} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  Close
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
    </div>
  );
}

export { StudentManagement };
