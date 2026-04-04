import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { supabase } from "@/app/lib/supabaseClient";
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

  // Material form
  const [matForm, setMatForm] = useState({ title: "", description: "", fileType: "PDF" });
  const [matFileName, setMatFileName] = useState("");

  // Assignment form
  const [asgForm, setAsgForm] = useState({
    title: "",
    description: "",
    type: "assignment",
    dueDate: "",
    maxPoints: "100",
  });
  const [asgFileName, setAsgFileName] = useState("");
  const asgFileRef = useRef(null);

  // Announcement form
  const [annForm, setAnnForm] = useState({ title: "", content: "", priority: "Medium" });

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

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) { navigate("/login"); return; }
      const user = JSON.parse(userData);
      if (user.role !== "teacher") { navigate("/login"); return; }
      setTeacherName(user.name);

      const saved = localStorage.getItem("teacher_classes");
      if (saved) {
        const all = JSON.parse(saved);
        const found = all.find((c) => c.id === id);
        if (isMounted) {
          setClassData(found || null);
        }
      }

      const allMaterials = JSON.parse(localStorage.getItem("class_materials") || "[]");
      if (isMounted) {
        setMaterials(allMaterials.filter((m) => m.classId === id));
      }

      const allAssignments = JSON.parse(localStorage.getItem("class_assignments") || "[]");
      if (isMounted) {
        setAssignments(allAssignments.filter((a) => a.classId === id));
      }

      const allAnnouncements = JSON.parse(localStorage.getItem("class_announcements") || "[]");
      if (isMounted) {
        setAnnouncements(allAnnouncements.filter((a) => a.classId === id));
      }

      const resolvedTeacherId = await resolveTeacherProfileId(user.email);
      if (isMounted) {
        setTeacherProfileId(resolvedTeacherId);
      }

      await Promise.all([
        loadAvailableStudents(),
        loadAssignedStudents(resolvedTeacherId, id)
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

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const saveToStorage = (key, classId, newItem, setter) => {
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = [...existing, newItem];
    localStorage.setItem(key, JSON.stringify(updated));
    setter((prev) => [...prev, newItem]);
  };

  const deleteFromStorage = (key, itemId, setter) => {
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = existing.filter((item) => item.id !== itemId);
    localStorage.setItem(key, JSON.stringify(updated));
    setter((prev) => prev.filter((item) => item.id !== itemId));
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

  // Upload Material
  const handleAddMaterial = () => {
    if (!matForm.title.trim()) return;
    const item = {
      id: Date.now().toString(),
      classId: id,
      className: classData.name,
      classCode: classData.code,
      section: classData.section,
      ...matForm,
      fileName: matFileName || `${matForm.title}.${matForm.fileType.toLowerCase()}`,
      fileSize: "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â",
      uploadDate: new Date().toISOString(),
      teacherName,
      subject: classData.code,
    };
    saveToStorage("class_materials", id, item, setMaterials);
    setMatForm({ title: "", description: "", fileType: "PDF" });
    setMatFileName("");
    setShowMaterialModal(false);
  };

  // Create Assignment/Activity
  const handleAddAssignment = () => {
    if (!asgForm.title.trim() || !asgForm.dueDate) return;
    const item = {
      id: Date.now().toString(),
      classId: id,
      className: classData.name,
      classCode: classData.code,
      section: classData.section,
      ...asgForm,
      maxPoints: parseInt(asgForm.maxPoints) || 100,
      fileName: asgFileName || "",
      uploadDate: new Date().toISOString(),
      teacherName,
      subject: classData.code,
      status: "pending",
    };
    saveToStorage("class_assignments", id, item, setAssignments);
    setAsgForm({ title: "", description: "", type: "assignment", dueDate: "", maxPoints: "100" });
    setAsgFileName("");
    setShowAssignmentModal(false);
  };

  // Post Announcement
  const handlePostAnnouncement = () => {
    if (!annForm.title.trim() || !annForm.content.trim()) return;
    const item = {
      id: Date.now().toString(),
      classId: id,
      className: classData.name,
      classCode: classData.code,
      section: classData.section,
      ...annForm,
      datePosted: new Date().toISOString(),
      author: teacherName,
      authorRole: "Teacher",
      targetAudience: "Subject-specific",
      subject: classData.code,
      isRead: false,
    };
    saveToStorage("class_announcements", id, item, setAnnouncements);
    setAnnForm({ title: "", content: "", priority: "Medium" });
    setShowAnnouncementModal(false);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading class details...</p>
        </div>
      </div>
    );
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
          {/* Back Button */}
          <button
            onClick={() => navigate("/teacher/classes")}
            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Classes
          </button>

          {/* Class Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-emerald-100 text-sm font-medium tracking-wide">{classData.code}</p>
                <h1 className="text-3xl font-bold">{classData.name}</h1>
                <p className="text-emerald-100 text-lg">{classData.section}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-emerald-100" />
                  <p className="text-emerald-100 text-xs">Students</p>
                </div>
                <p className="text-2xl font-bold">{assignedStudents.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-4 h-4 text-emerald-100" />
                  <p className="text-emerald-100 text-xs">Materials</p>
                </div>
                <p className="text-2xl font-bold">{materials.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-emerald-100" />
                  <p className="text-emerald-100 text-xs">Assignments</p>
                </div>
                <p className="text-2xl font-bold">{assignments.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone className="w-4 h-4 text-emerald-100" />
                  <p className="text-emerald-100 text-xs">Announcements</p>
                </div>
                <p className="text-2xl font-bold">{announcements.length}</p>
              </div>
            </div>
            {(classData.schedule || classData.room) && (
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/20">
                {classData.schedule && (
                  <div className="flex items-center gap-2 text-emerald-100 text-sm">
                    <Clock className="w-4 h-4" />
                    {classData.schedule}
                  </div>
                )}
                {classData.room && (
                  <div className="flex items-center gap-2 text-emerald-100 text-sm">
                    <MapPin className="w-4 h-4" />
                    {classData.room}
                  </div>
                )}
              </div>
            )}
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
                                  onClick={() => handleRemoveStudent(student.assignmentId)}
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
                    </div>
                    <button
                      onClick={() => setShowMaterialModal(true)}
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
                        onClick={() => setShowMaterialModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        Upload First Material
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {materials.map((mat) => (
                        <div key={mat.id} className="flex items-center gap-4 p-4 bg-black/20 rounded-xl border border-white/10 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                          <div className="w-10 h-10 bg-gray-900/60 rounded-lg flex items-center justify-center border border-white/10 flex-shrink-0">
                            {getFileIcon(mat.fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm">{mat.title}</p>
                            {mat.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{mat.description}</p>}
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span>{mat.fileType}</span>
                              <span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢</span>
                              <span>{new Date(mat.uploadDate).toLocaleDateString()}</span>
                              {mat.fileName && <><span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢</span><span className="italic">{mat.fileName}</span></>}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteFromStorage("class_materials", mat.id, setMaterials)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                    </div>
                    <button
                      onClick={() => setShowAssignmentModal(true)}
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
                        onClick={() => setShowAssignmentModal(true)}
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
                                  {asg.fileName && <span className="italic">{asg.fileName}</span>}
                                </div>
                              </div>
                              <button
                                onClick={() => deleteFromStorage("class_assignments", asg.id, setAssignments)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
                    </div>
                    <button
                      onClick={() => setShowAnnouncementModal(true)}
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
                        onClick={() => setShowAnnouncementModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                      >
                        <Megaphone className="w-4 h-4" />
                        Post First Announcement
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[...announcements].reverse().map((ann) => (
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
                              <p className="text-xs text-gray-400 mt-2">Posted by {ann.author}</p>
                            </div>
                            <button
                              onClick={() => deleteFromStorage("class_announcements", ann.id, setAnnouncements)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
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
                  <h3 className="text-lg font-bold text-white">Upload Class Material</h3>
                  <p className="text-sm text-gray-500">Visible to all students in {classData.code}</p>
                </div>
              </div>
              <button onClick={() => setShowMaterialModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
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
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setMatFileName(e.target.files?.[0]?.name || "")} />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-emerald-500 cursor-pointer transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">{matFileName || "Click to select a file"}</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX, ZIP (max 50MB)</p>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 px-6 py-4 flex gap-3">
              <button onClick={() => setShowMaterialModal(false)} className="flex-1 px-4 py-2.5 border border-white/20 text-gray-300 rounded-lg hover:bg-black/20 text-sm font-medium">Cancel</button>
              <button onClick={handleAddMaterial} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 text-sm font-semibold">Upload Material</button>
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
                  <h3 className="text-lg font-bold text-white">Create Assignment / Activity</h3>
                  <p className="text-sm text-gray-500">Students in {classData.code} will see this task</p>
                </div>
              </div>
              <button onClick={() => setShowAssignmentModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
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
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Attach Reference File (Optional)</label>
                <input ref={asgFileRef} type="file" className="hidden" onChange={(e) => setAsgFileName(e.target.files?.[0]?.name || "")} />
                <div
                  onClick={() => asgFileRef.current?.click()}
                  className="border-2 border-dashed border-white/20 rounded-xl p-5 text-center hover:border-blue-500 cursor-pointer transition-colors"
                >
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-sm text-gray-500">{asgFileName || "Click to attach a file"}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 px-6 py-4 flex gap-3 sticky bottom-0 bg-gray-900/60">
              <button onClick={() => setShowAssignmentModal(false)} className="flex-1 px-4 py-2.5 border border-white/20 text-gray-300 rounded-lg hover:bg-black/20 text-sm font-medium">Cancel</button>
              <button onClick={handleAddAssignment} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-semibold">Post Task</button>
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
                  <h3 className="text-lg font-bold text-white">Post Announcement</h3>
                  <p className="text-sm text-gray-500">All students in {classData.code} will be notified</p>
                </div>
              </div>
              <button onClick={() => setShowAnnouncementModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
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
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Message <span className="text-red-500">*</span></label>
                <textarea
                  rows={5}
                  placeholder="Write your announcement here..."
                  value={annForm.content}
                  onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
                />
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
              <button onClick={() => setShowAnnouncementModal(false)} className="flex-1 px-4 py-2.5 border border-white/20 text-gray-300 rounded-lg hover:bg-black/20 text-sm font-medium">Cancel</button>
              <button onClick={handlePostAnnouncement} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 text-sm font-semibold">Post Announcement</button>
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
