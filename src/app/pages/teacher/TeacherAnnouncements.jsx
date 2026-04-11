import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { teacherNotifications } from "@/app/components/NotificationDefault";
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
  BookOpen
} from "lucide-react";
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
  useEffect(() => {
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
    setTeacherName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);
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
    setAnnouncements([newAnnouncement, ...announcements]);
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
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-white/5 text-gray-300";
    }
  };
  if (loading) {
    return <LoadingScreen message="Loading announcements..." />;
  }
  return <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {
    /* Top Bar */
  }
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Announcements</h2>
              <NotificationDropdown
    notifications={notificationList}
    onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))}
    onNotificationsChange={setNotificationList}
  />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Manage Content</h1>
                <p className="text-emerald-50">Create and share announcements, assignments, and files</p>
              </div>
              <button
    onClick={() => setShowCreateModal(true)}
    className="flex items-center gap-2 px-6 py-3 bg-gray-900/60 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-medium shadow-sm"
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
          <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm overflow-hidden">
            <div className="flex border-b border-white/10">
              {["announcements", "assignments", "files"].map((tab) => <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    className={`flex-1 px-6 py-4 font-medium transition-all ${activeTab === tab ? "bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600" : "text-gray-400 hover:bg-black/20"}`}
  >
                  <div className="flex items-center justify-center gap-2">
                    {tab === "announcements" && <Megaphone className="w-5 h-5" />}
                    {tab === "assignments" && <FileText className="w-5 h-5" />}
                    {tab === "files" && <Upload className="w-5 h-5" />}
                    <span className="capitalize">{tab}</span>
                    <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                      {tab === "announcements" ? announcements.length : tab === "assignments" ? assignments.length : files.length}
                    </span>
                  </div>
                </button>)}
            </div>

            <div className="p-6">
              {
    /* Announcements Tab */
  }
              {activeTab === "announcements" && <div className="space-y-4">
                  {announcements.length === 0 ? <div className="text-center py-12">
                      <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No announcements yet</p>
                      <button onClick={() => setShowCreateModal(true)} className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium">Create your first announcement</button>
                    </div> : announcements.map((announcement) => <div key={announcement.id} className="bg-gray-900/60 rounded-xl border border-white/10 p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white">{announcement.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(announcement.priority)}`}>{announcement.priority}</span>
                      </div>
                      <p className="text-gray-300 mb-4">{announcement.content}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{announcement.targetAudience}</span>
                        {announcement.subject && <span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {announcement.subject}</span>}
                        <span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {new Date(announcement.datePosted).toLocaleDateString()}</span>
                      </div>
                    </div>)}
                </div>}

              {
    /* Assignments Tab */
  }
              {activeTab === "assignments" && <div className="space-y-4">
                  {assignments.length === 0 ? <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No assignments yet</p>
                      <button onClick={() => setShowCreateModal(true)} className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium">Create your first assignment</button>
                    </div> : assignments.map((assignment) => <div key={assignment.id} className="bg-gray-900/60 rounded-xl border border-white/10 p-6 shadow-sm hover:shadow-md transition-shadow">
                      <h3 className="text-lg font-semibold text-white mb-1">{assignment.title}</h3>
                      <p className="text-gray-300 mb-4">{assignment.description}</p>
                      <div className="flex items-center gap-6 text-sm text-gray-400 mb-3">
                        <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /><span>{assignment.subject}</span></div>
                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span></div>
                        <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>{assignment.totalPoints} points</span></div>
                      </div>
                      {assignment.attachments && assignment.attachments.length > 0 && <div className="flex items-center gap-2 text-sm">
                          <Paperclip className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-600">{assignment.attachments.length} attachment(s)</span>
                        </div>}
                    </div>)}
                </div>}

              {
    /* Files Tab */
  }
              {activeTab === "files" && <div className="space-y-4">
                  {files.length === 0 ? <div className="text-center py-12">
                      <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No files uploaded yet</p>
                      <button onClick={() => setShowCreateModal(true)} className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium">Upload your first file</button>
                    </div> : files.map((file) => <div key={file.id} className="bg-gray-900/60 rounded-xl border border-white/10 p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="p-3 bg-emerald-50 rounded-lg">
                            <FileText className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">{file.fileName}</h3>
                            <p className="text-gray-400 text-sm mb-3">{file.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span>{file.subject}</span>
                              <span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {file.fileSize}</span>
                              <span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {new Date(file.uploadDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Download className="w-5 h-5" /></button>
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
          <div className="bg-gray-900/60 rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="p-6 border-b border-white/10 sticky top-0 bg-gray-900/60 z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">
                  {activeTab === "announcements" && "Create Announcement"}
                  {activeTab === "assignments" && "Create Assignment"}
                  {activeTab === "files" && "Upload File"}
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
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
                    <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                    <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Enter announcement title" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Content</label>
                    <textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} rows={4} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Enter announcement content" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Target Audience</label>
                      <select value={formData.targetAudience} onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="Subject-specific">Subject-specific</option>
                        <option value="School-wide">School-wide</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                      <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>
                  {formData.targetAudience === "Subject-specific" && <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                      <input type="text" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g., MATH101" />
                    </div>}
                  <button onClick={handleSubmit} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-medium">
                    <Send className="w-4 h-4" />Post Announcement
                  </button>
                </>}

              {
    /* Assignment Form */
  }
              {activeTab === "assignments" && <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Assignment Title</label>
                    <input type="text" value={assignmentFormData.title} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, title: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Enter assignment title" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea value={assignmentFormData.description} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, description: e.target.value })} rows={4} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Enter assignment description" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                      <input type="text" value={assignmentFormData.subject} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, subject: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g., MATH101" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Total Points</label>
                      <input type="number" value={assignmentFormData.totalPoints} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, totalPoints: parseInt(e.target.value) || 0 })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="100" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Due Date</label>
                    <input type="date" value={assignmentFormData.dueDate} onChange={(e) => setAssignmentFormData({ ...assignmentFormData, dueDate: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Attachments (Optional)</label>
                    <input ref={assignmentFileInputRef} type="file" multiple className="hidden" onChange={handleAssignmentFilesChange} />
                    <div onClick={handleAssignmentFilesClick} className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">{assignmentFileNames || "Click to upload or drag and drop"}</p>
                      <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10MB</p>
                    </div>
                  </div>
                  <button onClick={handleAssignmentSubmit} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-medium">
                    <FileText className="w-4 h-4" />Create Assignment
                  </button>
                </>}

              {
    /* File Upload Form */
  }
              {activeTab === "files" && <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">File Upload</label>
                    <input ref={uploadFileInputRef} type="file" className="hidden" onChange={handleUploadFileChange} />
                    <div onClick={handleUploadFileClick} className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-400 mb-1">{uploadFileName || "Click to upload or drag and drop"}</p>
                      <p className="text-sm text-gray-500">PDF, DOC, DOCX, PPT, PPTX up to 25MB</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">File Name</label>
                    <input type="text" value={fileFormData.fileName} onChange={(e) => setFileFormData({ ...fileFormData, fileName: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g., Lecture_Notes_Week4.pdf" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea value={fileFormData.description} onChange={(e) => setFileFormData({ ...fileFormData, description: e.target.value })} rows={3} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Brief description of the file content" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                      <input type="text" value={fileFormData.subject} onChange={(e) => setFileFormData({ ...fileFormData, subject: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g., MATH101" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">File Type</label>
                      <select value={fileFormData.fileType} onChange={(e) => setFileFormData({ ...fileFormData, fileType: e.target.value })} className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="PDF">PDF Document</option>
                        <option value="DOCX">Word Document</option>
                        <option value="PPTX">PowerPoint</option>
                        <option value="XLSX">Excel Spreadsheet</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={handleFileSubmit} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-medium">
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
