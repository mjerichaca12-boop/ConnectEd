import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import {
  Download,
  Upload,
  FileText,
  File,
  Calendar,
  BookOpen,
  FolderOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Search,
} from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { QuizTakingModal, parseQuizText } from "@/app/components/QuizTakingModal";

const STORAGE_BUCKET = "class-materials";
const ASSIGNMENT_TABLE_CANDIDATES = ["assignments_activity", "class_assignments", "assignments", "teacher_assignments", "class_activities"];

const parseStoredFileList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  const text = String(value || "").trim();
  if (!text) return [];

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch {
      // Fall through to single-value handling.
    }
  }

  return [text];
};

const buildAssignmentAttachments = (row) => {
  const fileNames = parseStoredFileList(row?.file_name);
  const filePaths = parseStoredFileList(row?.file_path);
  const fileUrls = parseStoredFileList(row?.file_url);
  const totalCount = Math.max(fileNames.length, filePaths.length, fileUrls.length);

  const attachments = Array.from({ length: totalCount }, (_, index) => ({
    fileName: fileNames[index] || `File ${index + 1}`,
    filePath: filePaths[index] || "",
    fileUrl: fileUrls[index] || ""
  })).filter((attachment) => attachment.fileName || attachment.filePath || attachment.fileUrl);

  return { fileNames, filePaths, fileUrls, attachments };
};

const buildMaterialAttachments = (row) => {
  const fileNames = parseStoredFileList(row?.file_name);
  const filePaths = parseStoredFileList(row?.file_path);
  const fileUrls = parseStoredFileList(row?.file_url);
  const totalCount = Math.max(fileNames.length, filePaths.length, fileUrls.length);

  const attachments = Array.from({ length: totalCount }, (_, index) => ({
    fileName: fileNames[index] || `File ${index + 1}`,
    filePath: filePaths[index] || "",
    fileUrl: fileUrls[index] || ""
  })).filter((attachment) => attachment.fileName || attachment.filePath || attachment.fileUrl);

  return { fileNames, filePaths, fileUrls, attachments };
};

const normalizeMaterialRecord = (row) => {
  const attachments = buildMaterialAttachments(row);
  const primaryFileName = attachments.fileNames[0] || "";
  const extension = primaryFileName.includes(".") ? primaryFileName.split(".").pop().toUpperCase() : "FILE";

  return {
    id: String(row?.id || ""),
    title: String(row?.title || "").trim(),
    description: String(row?.description || "").trim(),
    fileNames: attachments.fileNames,
    filePaths: attachments.filePaths,
    fileUrls: attachments.fileUrls,
    attachments: attachments.attachments,
    fileName: primaryFileName,
    filePath: attachments.filePaths[0] || "",
    fileType: extension,
    fileUrl: attachments.fileUrls[0] || "",
    uploadDate: row?.created_at || new Date().toISOString(),
    classCode: String(row?.subject || row?.class_code || "").trim(),
    className: String(row?.class_name || "").trim(),
    teacherName: String(row?.author || row?.teacher_name || "").trim(),
    section: String(row?.section || "").trim()
  };
};

const normalizeAssignmentRecord = (row) => {
  const attachments = buildAssignmentAttachments(row);

  return {
    id: String(row?.id || ""),
    type: String(row?.type || row?.assessment_type || row?.task_type || "assignment").trim().toLowerCase() === "activity" ? "activity" : "assignment",
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
    classCode: String(row?.subject || row?.class_code || row?.course_id || "").trim(),
    className: String(row?.class_name || "").trim(),
    teacherName: String(row?.author || row?.teacher_name || "").trim(),
    teacherId: row?.teacher_id || row?.created_by || null,
    subjectId: row?.subject_id || row?.course_id || null,
    uploadDate: row?.created_at || row?.date_posted || new Date().toISOString(),
    status: "pending"
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

function StudentMaterials() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [activeTab, setActiveTab] = useState("materials");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [showQuizTaking, setShowQuizTaking] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [materials, setMaterials] = useState([]);
  const [activities, setActivities] = useState([]);
  const [submittedIds, setSubmittedIds] = useState([]);
  const [submissionFeedbackMap, setSubmissionFeedbackMap] = useState({}); // activityId -> feedback
  const [assignmentTable, setAssignmentTable] = useState("");
  const [assignmentColumns, setAssignmentColumns] = useState([]);

  const resolveAssignmentTable = async () => {
    for (const tableName of ASSIGNMENT_TABLE_CANDIDATES) {
      const { error } = await supabase.from(tableName).select("id", { count: "exact", head: true });
      if (!error) {
        setAssignmentTable(tableName);
        return tableName;
      }
    }
    return "";
  };

  const resolveAssignmentColumns = async (tableName) => {
    if (!tableName) {
      setAssignmentColumns([]);
      return [];
    }

    const candidates = ["id", "type", "assessment_type", "task_type", "title", "name", "description", "instructions", "content", "deadline", "max_points", "total_points", "maxPoints", "file_url", "file_name", "file_path", "subject", "class_code", "class_name", "course_id", "author", "teacher_name", "created_at"];
    const detected = [];

    for (const col of candidates) {
      const { error } = await supabase.from(tableName).select(col, { count: "exact", head: true });
      if (!error) {
        detected.push(col);
      }
    }

    setAssignmentColumns(detected);
    return detected;
  };

  const fetchMaterials = async () => {
    const { data, error } = await supabase.from("class_materials").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("[StudentMaterials] Failed to fetch materials:", error);
      setMaterials([]);
      return;
    }
    setMaterials((data ?? []).map(normalizeMaterialRecord));
  };

  const fetchActivities = async (tableNameOverride, columnsOverride) => {
    const tableName = tableNameOverride || assignmentTable || (await resolveAssignmentTable());
    if (!tableName) {
      setActivities([]);
      return;
    }

    const columns = columnsOverride || assignmentColumns || [];
    const orderColumn = columns.includes("created_at") ? "created_at" : columns.includes("deadline") ? "deadline" : "";

    let query = supabase.from(tableName).select("*");
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: false });
    }

    let { data, error } = await query;

    if (error && /column .* does not exist|PGRST204/i.test(error.message || "")) {
      const fallback = await supabase.from(tableName).select("*");
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("[StudentMaterials] Failed to fetch activities:", error);
      setActivities([]);
      return;
    }

    setActivities((data ?? []).map(normalizeAssignmentRecord));
  };

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "student") { navigate("/login"); return; }
    setStudentName(user.name);

    const studentId = String(user.id || "");

    // Read submitted ids
    const submitted = JSON.parse(localStorage.getItem("student_submissions") || "[]");
    setSubmittedIds(submitted);

    let mounted = true;

    const load = async () => {
      try {
        const tableName = await resolveAssignmentTable();
        const columns = await resolveAssignmentColumns(tableName);
        await Promise.all([fetchMaterials(), fetchActivities(tableName, columns)]);
        // fetch any feedback for the student's submissions
        try {
          if (studentId) {
            const feedbackMap = {};
            // For each activity currently in activities (we fetch activities above)
            for (const act of (activities || [])) {
              // skip if not submitted locally
              const isSubmitted = JSON.parse(localStorage.getItem("student_submissions") || "[]").includes(act.id);
              if (!isSubmitted) continue;
              const { data: submissionRow } = await supabase
                .from("teacher_assessment_submissions")
                .select("id")
                .eq("assessment_id", act.id)
                .eq("student_id", studentId)
                .maybeSingle();

              if (submissionRow?.id) {
                const { data: fb } = await supabase
                  .from("submission_feedback")
                  .select("feedback_text, comments, teacher_id, created_at, updated_at")
                  .eq("submission_id", submissionRow.id)
                  .maybeSingle();

                if (fb) feedbackMap[act.id] = { ...fb, comments: fb.feedback_text || fb.comments || "" };
              }
            }
            setSubmissionFeedbackMap(feedbackMap);
          }
        } catch (err) {
          console.error("Failed to fetch submission feedback for student view:", err);
        }
      } catch (error) {
        console.error("[StudentMaterials] Failed to load resources:", error);
        if (mounted) {
          setMaterials([]);
          setActivities([]);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    const materialsChannel = supabase
      .channel("student-materials-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "class_materials" }, () => {
        fetchMaterials();
      })
      .subscribe();

    let assignmentChannel = null;

    if (assignmentTable) {
      assignmentChannel = supabase
        .channel(`student-assignments-realtime-${assignmentTable}`)
        .on("postgres_changes", { event: "*", schema: "public", table: assignmentTable }, () => {
          fetchActivities(assignmentTable, assignmentColumns);
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(materialsChannel);
      if (assignmentChannel) {
        supabase.removeChannel(assignmentChannel);
      }
    };
  }, [assignmentTable, assignmentColumns]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const resolveFileUrl = (fileUrl, filePath) => {
    const normalizedUrl = String(fileUrl || "").trim();
    if (normalizedUrl) return normalizedUrl;

    const normalizedPath = String(filePath || "").trim();
    if (!normalizedPath) return "";

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(normalizedPath);
    return String(data?.publicUrl || "").trim();
  };

  const handleDownload = (material, attachment = null) => {
    const targetFileUrl = attachment ? attachment.fileUrl : material.fileUrl;
    const targetFilePath = attachment ? attachment.filePath : material.filePath;
    const resolved = resolveFileUrl(targetFileUrl, targetFilePath);

    if (resolved) {
      window.open(resolved, "_blank", "noopener,noreferrer");
      return;
    }

    const fallbackName = attachment?.fileName || material.fileName || material.title;
    alert(`File is not available for download: ${fallbackName}`);
  };

  const handleSubmitActivity = (activity) => {
    if (getAssignmentLifecycle(activity.dueDate).key === "closed") {
      alert("Assignment is already closed");
      return;
    }
    setSelectedActivity(activity);
    setSelectedFile(null);
    setSelectedFileName("");
    setComments("");
    setShowSubmitModal(true);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
    setSelectedFileName(file ? file.name : "");
  };

  const handleConfirmSubmit = async () => {
    if (!selectedFile) return;
    if (selectedActivity && getAssignmentLifecycle(selectedActivity.dueDate).key === "closed") {
      alert("Assignment is already closed");
      return;
    }

    setIsSubmitting(true);
    try {
      const userData = localStorage.getItem("currentUser");
      if (!userData) throw new Error("User not found in local storage.");
      const user = JSON.parse(userData);
      const studentId = user.id;

      if (!studentId) throw new Error("Student ID not resolved.");

      // 1. Upload file to Supabase storage
      const storagePath = `submissions/${studentId}/${Date.now()}_${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. Retrieve public URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || "";

      if (!publicUrl) throw new Error("Failed to retrieve public file URL.");

      // 3. Upsert into submissions table
      const { error: subError } = await supabase
        .from("submissions")
        .upsert({
          assignment_id: selectedActivity.id,
          user_id: studentId,
          file_url: publicUrl
        }, { onConflict: "assignment_id,user_id" });

      if (subError) throw subError;

      // 4. Fetch teacher_id and subject_id from subjects
      let teacherId = selectedActivity.teacherId;
      let subjectId = selectedActivity.subjectId;

      if (!teacherId || !subjectId) {
        // Query as fallback
        const { data: subjectData } = await supabase
          .from("subjects")
          .select("id, teacher_id")
          .eq("code", selectedActivity.classCode)
          .limit(1)
          .maybeSingle();
        
        if (subjectData) {
          teacherId = subjectData.teacher_id;
          subjectId = subjectData.id;
        }
      }

      // 5. Upsert into teacher_assessment_submissions
      if (teacherId && subjectId) {
        const { error: teacherSubError } = await supabase
          .from("teacher_assessment_submissions")
          .upsert({
            teacher_id: teacherId,
            subject_id: subjectId,
            assessment_id: selectedActivity.id,
            student_id: studentId,
            response_text: comments.trim() || "Submitted via Web Dashboard",
            file_url: publicUrl,
            file_name: selectedFile.name,
            file_path: storagePath,
            status: "submitted"
          }, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });
        
        if (teacherSubError) {
          console.error("Failed to upsert into teacher_assessment_submissions:", teacherSubError);
        }
      }

      // 6. Update local storage and state
      const updated = [...submittedIds, selectedActivity.id];
      setSubmittedIds(updated);
      localStorage.setItem("student_submissions", JSON.stringify(updated));

      // Mark in activities list
      setActivities((prev) =>
        prev.map((a) =>
          a.id === selectedActivity.id ? { ...a, status: "submitted", submittedDate: new Date().toISOString() } : a
        )
      );

      alert("Assignment submitted successfully!");
      setShowSubmitModal(false);
      setSelectedActivity(null);
      setSelectedFile(null);
      setSelectedFileName("");
      setComments("");
    } catch (err) {
      console.error("[StudentMaterials] Submission error:", err);
      alert(err.message || "Failed to submit assignment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuizComplete = async (score) => {
    if (!activeQuiz) return;

    try {
      const userData = localStorage.getItem("currentUser");
      const user = JSON.parse(userData);
      const studentId = user.id;

      // 1. Record submission
      const { data: submission, error: subError } = await supabase
        .from("teacher_assessment_submissions")
        .insert([{
          assessment_id: activeQuiz.id,
          student_id: studentId,
          status: "graded",
          content: "Auto-graded AI Quiz"
        }])
        .select()
        .single();

      if (subError) throw subError;

      // 2. Record grade
      const { error: gradeError } = await supabase
        .from("teacher_assessment_grades")
        .insert([{
          submission_id: submission.id,
          assessment_id: activeQuiz.id,
          student_id: studentId,
          grade_value: score,
          max_points: activeQuiz.maxPoints,
          status: "Graded",
          designation: "Quiz",
          assessment_title: activeQuiz.title,
          subject_id: activeQuiz.subjectId || null
        }]);

      if (gradeError) throw gradeError;

      // 3. Update local state
      const updated = [...submittedIds, activeQuiz.id];
      setSubmittedIds(updated);
      localStorage.setItem("student_submissions", JSON.stringify(updated));

      setActivities((prev) =>
        prev.map((a) =>
          a.id === activeQuiz.id ? { ...a, status: "submitted", submittedDate: new Date().toISOString() } : a
        )
      );

      setShowQuizTaking(false);
      setActiveQuiz(null);
      alert(`Quiz submitted successfully! Your score: ${score}/${activeQuiz.maxPoints}`);
    } catch (err) {
      console.error("Failed to submit quiz results:", err);
      alert("Failed to save your results. Please try again.");
    }
  };

  const getFileIcon = (fileType = "PDF") => {
    const t = fileType.toUpperCase();
    if (t === "PDF") return <FileText className="w-5 h-5 text-red-600" />;
    if (t === "PPTX" || t === "PPT") return <File className="w-5 h-5 text-orange-500" />;
    if (t === "DOCX" || t === "DOC") return <File className="w-5 h-5 text-blue-600" />;
    return <File className="w-5 h-5 text-gray-600" />;
  };

  const getStatusBadge = (activity) => {
    const lifecycle = getAssignmentLifecycle(activity.dueDate);

    if (submittedIds.includes(activity.id) || activity.status === "submitted") {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
          <CheckCircle className="w-3 h-3" /> Submitted
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full ${lifecycle.cls}`}>
        <Clock className="w-3 h-3" /> {lifecycle.label}
      </span>
    );
  };

  const getDaysLabel = (dueDate) => {
    const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "Overdue", cls: "text-red-600" };
    if (diff === 0) return { label: "Due today", cls: "text-orange-600" };
    if (diff === 1) return { label: "Due tomorrow", cls: "text-yellow-600" };
    return { label: `Due in ${diff} days`, cls: "text-gray-600" };
  };

  // All unique class codes for filter
  const allClasses = [...new Set([...materials.map((m) => m.classCode), ...activities.map((a) => a.classCode)].filter(Boolean))];

  const filteredMaterials = materials.filter((m) => {
    const matchSearch = m.title?.toLowerCase().includes(searchQuery.toLowerCase()) || m.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchClass = filterClass === "all" || m.classCode === filterClass;
    return matchSearch && matchClass;
  });

  const filteredActivities = activities.filter((a) => {
    const matchSearch = a.title?.toLowerCase().includes(searchQuery.toLowerCase()) || a.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchClass = filterClass === "all" || a.classCode === filterClass;
    return matchSearch && matchClass;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">My Learning Resources</h2>
                <p className="text-sm text-gray-500">Access materials and submit activities from your teachers</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <FolderOpen className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Learning Resources</h1>
                <p className="text-emerald-100 text-sm">{materials.length} materials â€¢ {activities.length} tasks</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("materials")}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === "materials" ? "text-emerald-600 border-emerald-600" : "text-gray-600 hover:text-gray-900 border-transparent"}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  Class Materials
                  {filteredMaterials.length > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">{filteredMaterials.length}</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab("activities")}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === "activities" ? "text-emerald-600 border-emerald-600" : "text-gray-600 hover:text-gray-900 border-transparent"}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Assignments & Activities
                  {filteredActivities.filter((a) => !submittedIds.includes(a.id) && a.status !== "submitted").length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      {filteredActivities.filter((a) => !submittedIds.includes(a.id) && a.status !== "submitted").length} pending
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Search + Filter */}
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={activeTab === "materials" ? "Search materials..." : "Search assignments..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
              {allClasses.length > 0 && (
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="all">All Classes</option>
                  {allClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* â”€â”€ CLASS MATERIALS TAB â”€â”€ */}
          {activeTab === "materials" && (
            <div className="space-y-4">
              {filteredMaterials.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FolderOpen className="w-7 h-7 text-emerald-300" />
                  </div>
                  <h3 className="font-semibold text-gray-700 mb-2">No materials yet</h3>
                  <p className="text-gray-500 text-sm">Your teachers haven't uploaded any materials yet.</p>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <Download className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-900 font-medium mb-1">Download for Offline Access</p>
                      <p className="text-xs text-blue-700">You can download any material to study offline.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {filteredMaterials.map((material) => (
                      <div key={material.id} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            {getFileIcon(material.fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 mb-1">{material.title}</h3>
                            {material.description && (
                              <p className="text-sm text-gray-600 mb-3">{material.description}</p>
                            )}
                            {Array.isArray(material.attachments) && material.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {material.attachments.map((attachment, index) => (
                                  <button
                                    key={`${material.id}-attachment-${index}`}
                                    onClick={() => handleDownload(material, attachment)}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                                  >
                                    <File className="w-3 h-3" />
                                    {attachment.fileName || `File ${index + 1}`}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                              {material.classCode && (
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3.5 h-3.5" />
                                  {material.classCode} {material.className && `â€“ ${material.className}`}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <File className="w-3.5 h-3.5" />
                                {material.fileType}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(material.uploadDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            {material.teacherName && (
                              <p className="text-xs text-gray-400 mt-2">Uploaded by {material.teacherName}</p>
                            )}
                          </div>
                          {(!Array.isArray(material.attachments) || material.attachments.length === 0) && (
                            <button
                              onClick={() => handleDownload(material)}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0 text-sm"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* â”€â”€ ACTIVITIES TAB â”€â”€ */}
          {activeTab === "activities" && (
            <div className="space-y-4">
              {filteredActivities.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-7 h-7 text-blue-300" />
                  </div>
                  <h3 className="font-semibold text-gray-700 mb-2">No assignments yet</h3>
                  <p className="text-gray-500 text-sm">Your teachers haven't posted any tasks yet.</p>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-900 font-medium mb-1">Submit Before Deadline</p>
                      <p className="text-xs text-blue-700">Upload your completed work before the due date to avoid late penalties.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {filteredActivities.map((activity) => {
                      const due = getDaysLabel(activity.dueDate);
                      const isSubmitted = submittedIds.includes(activity.id) || activity.status === "submitted";
                      return (
                        <div key={activity.id} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${activity.type === "activity" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                  {activity.type || "assignment"}
                                </span>
                                {getStatusBadge(activity)}
                              </div>
                              <h3 className="text-base font-semibold text-gray-900">{activity.title}</h3>
                              {activity.description && (
                                <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                              )}
                              <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
                                {activity.classCode && (
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    {activity.classCode}{activity.className && ` â€“ ${activity.className}`}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {new Date(activity.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                                <span>Max Points: {activity.maxPoints}</span>
                              </div>
                              {Array.isArray(activity.attachments) && activity.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {activity.attachments.map((attachment, index) => (
                                    <a
                                      key={`${activity.id}-attachment-${index}`}
                                      href={attachment.fileUrl || attachment.filePath || "#"}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                                    >
                                      <File className="w-3 h-3" />
                                      {attachment.fileName || `File ${index + 1}`}
                                    </a>
                                  ))}
                                </div>
                              )}
                              {activity.teacherName && (
                                <p className="text-xs text-gray-400 mt-2">Posted by {activity.teacherName}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <span className={`text-sm font-medium ${due.cls}`}>{due.label}</span>
                            {!isSubmitted && getAssignmentLifecycle(activity.dueDate).key !== "closed" && (
                              <button
                                onClick={() => handleSubmitActivity(activity)}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                              >
                                <Upload className="w-4 h-4" />
                                Submit Work
                              </button>
                            )}
                            {!isSubmitted && getAssignmentLifecycle(activity.dueDate).key === "closed" && (
                              <span className="text-sm text-red-600 font-medium">Assignment is already closed</span>
                            )}
                            {isSubmitted && (
                              <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircle className="w-4 h-4" /> Submitted
                              </span>
                            )}
                            {isSubmitted && submissionFeedbackMap[activity.id] && (
                            <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm text-emerald-900">
                              <p className="text-xs font-semibold">Teacher Feedback</p>
                              {submissionFeedbackMap[activity.id].comments && (
                                <p className="mt-1"><strong>Comments:</strong> {submissionFeedbackMap[activity.id].comments}</p>
                              )}
                            </div>
                            )}
                            {!isSubmitted && activity.type === "activity" && parseQuizText(activity.description) && (
                            <button
                              onClick={() => { setActiveQuiz(activity); setShowQuizTaking(true); }}
                              className="mt-3 flex items-center justify-center gap-2 w-full px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all font-bold shadow-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Start Interactive Quiz
                            </button>
                            )}
                            </div>
                            </div>
                            );
                            })}
                            </div>
                            </>
                            )}
                            </div>
                            )}
                            </div>
                            </main>

                            {/* Quiz Taking Modal */}
                            {showQuizTaking && activeQuiz && (
                            <QuizTakingModal
                            isOpen={showQuizTaking}
                            onClose={() => { setShowQuizTaking(false); setActiveQuiz(null); }}
                            quizTitle={activeQuiz.title}
                            quizContent={activeQuiz.description}
                            maxPoints={activeQuiz.maxPoints}
                            onComplete={handleQuizComplete}
                            />
                            )}

                            {/* Submit Activity Modal */}      {showSubmitModal && selectedActivity && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-900">Submit Work</h3>
              <button
                onClick={() => { setShowSubmitModal(false); setSelectedActivity(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Activity Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${selectedActivity.type === "activity" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                    {selectedActivity.type || "assignment"}
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">{selectedActivity.title}</h4>
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  {selectedActivity.classCode && <span>Class: {selectedActivity.classCode}</span>}
                  <span>Max Points: {selectedActivity.maxPoints}</span>
                  <span>Due: {new Date(selectedActivity.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <div className="mt-3">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full ${getAssignmentLifecycle(selectedActivity.dueDate).cls}`}>
                    <Clock className="w-3 h-3" /> {getAssignmentLifecycle(selectedActivity.dueDate).label}
                  </span>
                  {getAssignmentLifecycle(selectedActivity.dueDate).key === "closed" && (
                    <p className="mt-2 text-sm text-red-600 font-medium">Assignment is already closed</p>
                  )}
                </div>
                {Array.isArray(selectedActivity.attachments) && selectedActivity.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedActivity.attachments.map((attachment, index) => (
                      <a
                        key={`${selectedActivity.id}-submit-attachment-${index}`}
                        href={attachment.fileUrl || attachment.filePath || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-50"
                      >
                        <File className="w-3 h-3" />
                        {attachment.fileName || `File ${index + 1}`}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Your Work <span className="text-red-500">*</span></label>
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer group focus-within:ring-2 focus-within:ring-emerald-500">
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    className="sr-only" 
                    onChange={handleFileChange} 
                  />
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3 group-hover:text-emerald-500 transition-colors" />
                  <p className="text-sm text-gray-600 mb-1">
                    {selectedFileName ? selectedFileName : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-gray-400">PDF, DOC, DOCX, ZIP (max 20MB)</p>
                </label>
              </div>

              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comments (Optional)</label>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm resize-none"
                  placeholder="Any notes for your teacher..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowSubmitModal(false); setSelectedActivity(null); }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                 <button
                  onClick={handleConfirmSubmit}
                  disabled={!selectedFile || isSubmitting || getAssignmentLifecycle(selectedActivity.dueDate).key === "closed"}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Submit Work"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { StudentMaterials };
