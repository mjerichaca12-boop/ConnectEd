import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { AnnouncementAttachmentPreview } from "@/app/components/AnnouncementAttachmentPreview";
import { teacherNotifications } from "@/app/components/NotificationDefault";
import { supabase } from "@/app/lib/supabaseClient";
import { parseStoredFileList } from "@/app/lib/teacherHelpers";
import {
  Megaphone,
  Plus,
  X,
  Send,
  FileText,
  Upload,
  Paperclip,
  Calendar,
  Clock,
  Download,
  Trash2,
  BookOpen,
  File
} from "lucide-react";

let announcementAttachmentsTableStatus = "unknown";

const normalizeAudience = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "teacher" || normalized === "teachers") return "Teacher";
  if (normalized === "student" || normalized === "students") return "Students";
  if (normalized === "schoolwide" || normalized === "school wide") return "School-wide";
  return "School-wide";
};

const normalizePriority = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
};

const getPriorityRank = (priority) => {
  const normalized = String(priority ?? "").trim().toLowerCase();
  if (normalized === "high") return 0;
  if (normalized === "medium") return 1;
  if (normalized === "low") return 2;
  return 1;
};

const normalizeAudienceType = (value) => {
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

const normalizeTimestamp = (row) =>
  row?.created_at ||
  row?.date_posted ||
  row?.datePosted ||
  row?.timestamp ||
  row?.updated_at ||
  new Date().toISOString();

const matchesTeacherAudience = (announcement) => {
  const normalizedType = String(announcement?.audienceType || "").trim().toLowerCase();
  if (normalizedType) {
    return normalizedType === "school" || normalizedType === "teacher";
  }

  const normalizedAudience = String(announcement?.targetAudience ?? "").trim().toLowerCase();
  return normalizedAudience.includes("school") || normalizedAudience.includes("teacher");
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

const normalizeAnnouncementAttachment = (attachment, index) => {
  const fileName = String(attachment?.file_name || attachment?.fileName || `File ${index + 1}`).trim();
  const fileUrl = String(attachment?.file_url || attachment?.fileUrl || "").trim();
  const filePath = String(attachment?.file_path || attachment?.filePath || "").trim();
  const fileType = String(attachment?.file_type || attachment?.fileType || "").trim();

  return {
    fileName,
    fileUrl,
    filePath,
    fileType,
    kind: getAnnouncementAttachmentKind(fileType, fileName, fileUrl),
  };
};

const getRowAttachments = (row) => {
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

const buildAnnouncementAttachments = (row, attachmentRows = []) => {
  const attachmentList = [
    ...getRowAttachments(row),
    ...(Array.isArray(attachmentRows) ? attachmentRows.map(normalizeAnnouncementAttachment) : []),
  ].filter((attachment) => attachment.fileName || attachment.fileUrl || attachment.filePath);

  const uniqueAttachments = [];
  const seenKeys = new Set();

  for (const attachment of attachmentList) {
    const key = [attachment.fileUrl, attachment.filePath, attachment.fileName].join("::");
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniqueAttachments.push(attachment);
  }

  return { attachments: uniqueAttachments };
};

const normalizeAnnouncement = (row, attachmentRows = []) => {
  const audienceType = normalizeAudienceType(
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
    priority: normalizePriority(
      row?.priority ??
        row?.announcement_priority ??
        row?.importance ??
        row?.priority_level ??
        "Medium"
    ),
    createdAt: normalizeTimestamp(row),
    subject: String(row?.subject ?? row?.course ?? row?.course_name ?? row?.class_name ?? row?.topic ?? "").trim(),
    ...buildAnnouncementAttachments(row, attachmentRows),
  };
};

const sortAnnouncements = (items) =>
  [...items].sort((left, right) => {
    const priorityDiff = getPriorityRank(left?.priority) - getPriorityRank(right?.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const leftTime = new Date(left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.createdAt || 0).getTime();
    if (rightTime !== leftTime) return rightTime - leftTime;

    return String(right?.id ?? "").localeCompare(String(left?.id ?? ""));
  });

function TeacherAnnouncements() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("announcements");
  const assignmentFileInputRef = useRef(null);
  const uploadFileInputRef = useRef(null);
  const [assignmentFileNames, setAssignmentFileNames] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetAudience: "Subject-specific",
    subject: "",
    priority: "Medium"
  });
  const [assignmentFormData, setAssignmentFormData] = useState({
    title: "",
    description: "",
    subject: "",
    dueDate: "",
    totalPoints: 100,
    attachments: []
  });
  const [fileFormData, setFileFormData] = useState({
    fileName: "",
    subject: "",
    description: "",
    fileType: "PDF"
  });
  const [announcements, setAnnouncements] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [files, setFiles] = useState([]);
  const [announcementTable, setAnnouncementTable] = useState("school_announcements");

  const fetchAttachmentRowsByAnnouncementId = async (tableName, rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Map();
    }

    const attachmentTableName = "announcement_attachments";
    const attachmentForeignKey = tableName === "school_announcements" ? "school_announcement_id" : "announcement_id";

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

    const ids = rows.map((row) => String(row?.id || "").trim()).filter(Boolean);
    if (ids.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from(attachmentTableName)
      .select(`${attachmentForeignKey}, file_url, file_name, file_path, file_type, created_at`)
      .in(attachmentForeignKey, ids)
      .order("created_at", { ascending: true });

    if (error) {
      announcementAttachmentsTableStatus = "missing";
      return new Map();
    }

    announcementAttachmentsTableStatus = "available";

    const grouped = new Map();
    for (const attachment of data ?? []) {
      const announcementId = String(attachment?.[attachmentForeignKey] ?? "");
      const list = grouped.get(announcementId) || [];
      list.push(attachment);
      grouped.set(announcementId, list);
    }

    return grouped;
  };

  const loadAnnouncements = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const tableName = "school_announcements";
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    const attachmentRowsByAnnouncementId = await fetchAttachmentRowsByAnnouncementId(tableName, rows);

    return sortAnnouncements(
      rows
        .map((row) => normalizeAnnouncement(row, attachmentRowsByAnnouncementId.get(String(row?.id ?? "")) || []))
        .filter((item) => item.id && matchesTeacherAudience(item))
    );
  };

  useEffect(() => {
    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) {
        navigate("/login");
        return;
      }

      const user = JSON.parse(userData);
      if (user.role !== "teacher") {
        navigate("/login");
        return;
      }

      setAnnouncementTable("school_announcements");
      setTeacherName(user.name);
      setNotificationList(teacherNotifications.map((item) => ({ ...item })));

      try {
        const rows = await loadAnnouncements();
        setAnnouncements(rows);
      } catch (error) {
        console.error("Failed to load teacher announcements:", error);
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [navigate]);

  useEffect(() => {
    if (!supabase || !announcementTable) return undefined;

    const channel = supabase
      .channel(`teacher-announcements-page-${announcementTable}`)
      .on("postgres_changes", { event: "*", schema: "public", table: announcementTable }, async () => {
        try {
          const rows = await loadAnnouncements();
          setAnnouncements(rows);
        } catch {
          // Keep current announcements if realtime refresh fails.
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [announcementTable]);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };
  const handleAssignmentFilesClick = () => assignmentFileInputRef.current?.click();
  const handleAssignmentFilesChange = (event) => {
    const files2 = event.target.files;
    if (files2 && files2.length > 0) {
      const names = Array.from(files2).map((f) => f.name);
      setAssignmentFormData({ ...assignmentFormData, attachments: names });
      setAssignmentFileNames(names.join(", "));
    } else {
      setAssignmentFormData({ ...assignmentFormData, attachments: [] });
      setAssignmentFileNames("");
    }
  };
  const handleUploadFileClick = () => uploadFileInputRef.current?.click();
  const handleUploadFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileFormData({ ...fileFormData, fileName: file.name });
      setUploadFileName(file.name);
    } else {
      setUploadFileName("");
    }
  };
  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.content.trim()) return;
    const newAnnouncement = {
      id: Date.now().toString(),
      ...formData,
      datePosted: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    setAnnouncements(sortAnnouncements([newAnnouncement, ...announcements].filter((announcement) => matchesTeacherAudience(announcement))));
    setShowCreateModal(false);
    setFormData({ title: "", content: "", targetAudience: "Subject-specific", subject: "", priority: "Medium" });
  };
  const handleAssignmentSubmit = () => {
    if (!assignmentFormData.title.trim()) return;
    const newAssignment = {
      id: Date.now().toString(),
      ...assignmentFormData,
      datePosted: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    setAssignments([newAssignment, ...assignments]);
    setShowCreateModal(false);
    setAssignmentFormData({ title: "", description: "", subject: "", dueDate: "", totalPoints: 100, attachments: [] });
    setAssignmentFileNames("");
  };
  const handleFileSubmit = () => {
    if (!fileFormData.fileName.trim()) return;
    const newFile = {
      id: Date.now().toString(),
      ...fileFormData,
      fileSize: "1.5 MB",
      uploadDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    setFiles([newFile, ...files]);
    setShowCreateModal(false);
    setFileFormData({ fileName: "", subject: "", description: "", fileType: "PDF" });
    setUploadFileName("");
  };
  const handleDeleteFile = (id) => {
    if (confirm("Are you sure you want to delete this file?")) {
      setFiles(files.filter((file) => file.id !== id));
    }
  };
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-700";
      case "Medium":
        return "bg-blue-100 text-blue-700";
      case "Low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-50 text-gray-700";
    }
  };
  const filteredAnnouncements = sortAnnouncements(
    announcements.filter((announcement) => matchesTeacherAudience(announcement))
  );
  if (loading) {
    return <LoadingScreen message="Loading announcements..." />;
  }
  return <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide lg:pl-64">
        {
    /* Top Bar */
  }
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Announcements</h2>
              <NotificationDropdown
    notifications={notificationList}
    onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))}
    onNotificationsChange={setNotificationList}
  />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-2xl p-8 text-gray-900 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Manage Content</h1>
                <p className="text-green-50">Create and share announcements, assignments, and files</p>
              </div>
              <button
    onClick={() => setShowCreateModal(true)}
    className="flex items-center gap-2 px-6 py-3 bg-white text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium shadow-sm"
  >
                <Plus className="w-5 h-5" />
                {activeTab === "announcements" && "New Announcement"}
                {activeTab === "assignments" && "New Assignment"}
                {activeTab === "files" && "Upload File"}
              </button>
            </div>
          </div>

          {
    /* Tabs */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-200">
              {["announcements", "assignments", "files"].map((tab) => <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    className={`flex-1 px-6 py-4 font-medium transition-all ${activeTab === tab ? "bg-green-50 text-green-600 border-b-2 border-green-600" : "text-gray-600 hover:bg-gray-50"}`}
  >
                  <div className="flex items-center justify-center gap-2">
                    {tab === "announcements" && <Megaphone className="w-5 h-5" />}
                    {tab === "assignments" && <FileText className="w-5 h-5" />}
                    {tab === "files" && <Upload className="w-5 h-5" />}
                    <span className="capitalize">{tab}</span>
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      {tab === "announcements" ? filteredAnnouncements.length : tab === "assignments" ? assignments.length : files.length}
                    </span>
                  </div>
                </button>)}
            </div>

            <div className="p-6">
              {
    /* Announcements Tab */
  }
              {activeTab === "announcements" && <div className="space-y-4">
                  {filteredAnnouncements.length === 0 ? <div className="text-center py-12">
                      <Megaphone className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500">No announcements yet</p>
                      <button onClick={() => setShowCreateModal(true)} className="mt-4 text-green-600 hover:text-green-700 font-medium">Create your first announcement</button>
                    </div> : filteredAnnouncements.map((announcement) => <div key={announcement.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(announcement.priority)}`}>{announcement.priority}</span>
                      </div>
                      <p className="text-gray-700 mb-4">{announcement.content}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span>{announcement.targetAudience}</span>
                        {announcement.subject ? (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {announcement.subject}
                          </span>
                        ) : null}
                        <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                      </div>

                      {Array.isArray(announcement.attachments) && announcement.attachments.length > 0 && (
                        <div className="mt-4 grid gap-3">
                          {announcement.attachments.map((attachment, index) => (
                            <AnnouncementAttachmentPreview
                              key={`${announcement.id}-attachment-${index}`}
                              attachment={attachment}
                              index={index}
                              announcementId={announcement.id}
                              variant="dark"
                            />
                          ))}
                        </div>
                      )}
                    </div>)}
                </div>}

              {
    /* Assignments Tab */
  }
              {activeTab === "assignments" && <div className="space-y-4">
                  {assignments.length === 0 ? <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500">No assignments yet</p>
                      <button onClick={() => setShowCreateModal(true)} className="mt-4 text-green-600 hover:text-green-700 font-medium">Create your first assignment</button>
                    </div> : assignments.map((assignment) => <div key={assignment.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{assignment.title}</h3>
                      <p className="text-gray-700 mb-4">{assignment.description}</p>
                      <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /><span>{assignment.subject}</span></div>
                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span></div>
                        <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>{assignment.totalPoints} points</span></div>
                      </div>
                      {assignment.attachments && assignment.attachments.length > 0 && <div className="flex items-center gap-2 text-sm">
                          <Paperclip className="w-4 h-4 text-green-600" />
                          <span className="text-green-600">{assignment.attachments.length} attachment(s)</span>
                        </div>}
                    </div>)}
                </div>}

              {
    /* Files Tab */
  }
              {activeTab === "files" && <div className="space-y-4">
                  {files.length === 0 ? <div className="text-center py-12">
                      <Upload className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500">No files uploaded yet</p>
                      <button onClick={() => setShowCreateModal(true)} className="mt-4 text-green-600 hover:text-green-700 font-medium">Upload your first file</button>
                    </div> : files.map((file) => <div key={file.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="p-3 bg-green-50 rounded-lg">
                            <FileText className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">{file.fileName}</h3>
                            <p className="text-gray-600 text-sm mb-3">{file.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>{file.subject}</span>
                              <span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {file.fileSize}</span>
                              <span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {new Date(file.uploadDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Download className="w-5 h-5" /></button>
                          <button onClick={() => handleDeleteFile(file.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </div>
                    </div>)}
                </div>}
            </div>
          </div>
        </div>
      </main>

      {
    /* Create Modal */
  }
      {showCreateModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {activeTab === "announcements" && "Create Announcement"}
                  {activeTab === "assignments" && "Create Assignment"}
                  {activeTab === "files" && "Upload File"}
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {
    /* Announcement Form */
  }
              {activeTab === "announcements" && <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Enter announcement title" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                    <textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} rows={4} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Enter announcement content" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                      <select value={formData.targetAudience} onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="Subject-specific">Subject-specific</option>
                        <option value="School-wide">School-wide</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                      <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>
                  {formData.targetAudience === "Subject-specific" && <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <input type="text" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., MATH101" />
                    </div>}
                  <button onClick={handleSubmit} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-all font-medium">
                    <Send className="w-4 h-4" />Post Announcement
                  </button>
                </>}

              {
    /* Assignment Form */
  }
              {activeTab === "assignments" && <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Title</label>
                    <input type="text" value={assignmentFormData.title} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, title: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Enter assignment title" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea value={assignmentFormData.description} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, description: e.target.value })} rows={4} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Enter assignment description" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <input type="text" value={assignmentFormData.subject} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, subject: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., MATH101" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Points</label>
                      <input type="number" value={assignmentFormData.totalPoints} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, totalPoints: parseInt(e.target.value) || 0 })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="100" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                    <input type="date" value={assignmentFormData.dueDate} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, dueDate: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Optional)</label>
                    <input ref={assignmentFileInputRef} type="file" multiple className="hidden" onChange={handleAssignmentFilesChange} />
                    <div onClick={handleAssignmentFilesClick} className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-green-500 transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">{assignmentFileNames || "Click to upload or drag and drop"}</p>
                      <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10MB</p>
                    </div>
                  </div>
                  <button onClick={handleAssignmentSubmit} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-all font-medium">
                    <FileText className="w-4 h-4" />Create Assignment
                  </button>
                </>}

              {
    /* File Upload Form */
  }
              {activeTab === "files" && <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">File Upload</label>
                    <input ref={uploadFileInputRef} type="file" className="hidden" onChange={handleUploadFileChange} />
                    <div onClick={handleUploadFileClick} className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-green-500 transition-colors cursor-pointer">
                      <Upload className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-600 mb-1">{uploadFileName || "Click to upload or drag and drop"}</p>
                      <p className="text-sm text-gray-500">PDF, DOC, DOCX, PPT, PPTX up to 25MB</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">File Name</label>
                    <input type="text" value={fileFormData.fileName} onChange={(e) => setFileFormData({ ...fileFormData, fileName: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., Lecture_Notes_Week4.pdf" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea value={fileFormData.description} onChange={(e) => setFileFormData({ ...fileFormData, description: e.target.value })} rows={3} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Brief description of the file content" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <input type="text" value={fileFormData.subject} onChange={(e) => setFileFormData({ ...fileFormData, subject: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., MATH101" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">File Type</label>
                      <select value={fileFormData.fileType} onChange={(e) => setFileFormData({ ...fileFormData, fileType: e.target.value })} className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="PDF">PDF Document</option>
                        <option value="DOCX">Word Document</option>
                        <option value="PPTX">PowerPoint</option>
                        <option value="XLSX">Excel Spreadsheet</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={handleFileSubmit} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-all font-medium">
                    <Upload className="w-4 h-4" />Upload File
                  </button>
                </>}
            </div>
          </div>
        </div>}
    </div>;
}
export {
  TeacherAnnouncements
};
