import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import {
  Bell,
  Megaphone,
  FileText,
  Upload,
  Download,
  Calendar,
  Clock,
  Paperclip,
  CheckCircle,
  User,
  BookOpen,
  AlertCircle
} from "lucide-react";

export function StudentContent() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("announcements");
  
  const [announcements] = useState([]);
  
  const [assignments] = useState([
    {
      id: 1,
      title: "Algebraic Expressions Worksheet",
      description: "Complete the exercises from chapter 4.",
      subject: "Math 101",
      teacher: "Miss Reyes",
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), // Upcoming (in 2 days)
      status: "Upcoming",
      totalPoints: 100,
      attachments: [{ name: "worksheet.pdf" }]
    },
    {
      id: 2,
      title: "Science Fair Proposal",
      description: "Submit your topic and initial research.",
      subject: "Science 201",
      teacher: "Mr. Santos",
      dueDate: new Date(Date.now() - 86400000 * 5).toISOString(), // Submitted
      status: "Submitted",
      totalPoints: 50,
      score: 48 
    },
    {
      id: 3,
      title: "History Essay: Renaissance",
      description: "Write a 500-word essay.",
      subject: "History 101",
      teacher: "Mrs. Cruz",
      dueDate: new Date(Date.now() - 86400000 * 2).toISOString(), // Late
      status: "Late",
      totalPoints: 100
    }
  ]);
  
  const [files] = useState([]);

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "student") {
      navigate("/login");
      return;
    }
    setStudentName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-700";
      case "Medium":
        return "bg-blue-100 text-blue-700";
      case "Low":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Upcoming":
        return "bg-blue-100 text-blue-700";
      case "Submitted":
        return "bg-green-100 text-green-700";
      case "Late":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getFileIcon = (fileType) => {
    return <FileText className="w-5 h-5 text-emerald-600" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Helper function to render a single assignment card
  const renderAssignmentCard = (assignment) => (
    <div key={assignment.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow mb-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{assignment.title}</h3>
          <p className="text-gray-700 mb-4">{assignment.description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
          {assignment.status}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <span>{assignment.subject}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <span>{assignment.teacher}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{assignment.totalPoints} points</span>
        </div>
      </div>
      {assignment.attachments && assignment.attachments.length > 0 && (
        <div className="flex items-center gap-2 text-sm mb-3">
          <Paperclip className="w-4 h-4 text-emerald-600" />
          <span className="text-emerald-600">{assignment.attachments.length} attachment(s)</span>
        </div>
      )}
      {assignment.status === "Submitted" && assignment.score !== undefined && (
        <div className="flex items-center gap-2 text-sm mt-3">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-green-700 font-medium">Score: {assignment.score}/{assignment.totalPoints}</span>
        </div>
      )}
      {assignment.status === "Upcoming" && (
        <div className="mt-4">
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium">
            Submit Assignment
          </button>
        </div>
      )}
      {assignment.status === "Late" && (
        <div className="mt-4">
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
            Submit Late Assignment
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Academic Content</h2>
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
                
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Academic Resources</h1>
            <p className="text-emerald-50">View announcements, assignments, and learning materials</p>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab("announcements")}
                className={`flex-1 px-6 py-4 min-w-[200px] font-medium transition-all ${
                  activeTab === "announcements"
                    ? "bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Megaphone className="w-5 h-5" />
                  <span>Announcements</span>
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {announcements.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("assignments")}
                className={`flex-1 px-6 py-4 min-w-[200px] font-medium transition-all ${
                  activeTab === "assignments"
                    ? "bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5" />
                  <span>Assignments</span>
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {assignments.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("files")}
                className={`flex-1 px-6 py-4 min-w-[200px] font-medium transition-all ${
                  activeTab === "files"
                    ? "bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Upload className="w-5 h-5" />
                  <span>Files</span>
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {files.length}
                  </span>
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Announcements Tab */}
              {activeTab === "announcements" && (
                <div className="space-y-4">
                  {announcements.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No announcements</div>
                  ) : (
                    announcements.map((announcement) => (
                      <div key={announcement.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(announcement.priority)}`}>
                            {announcement.priority}
                          </span>
                        </div>
                        <p className="text-gray-700 mb-4">{announcement.content}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{announcement.author} ({announcement.authorRole})</span>
                          </div>
                          {announcement.subject && (
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4" />
                              <span>{announcement.subject}</span>
                            </div>
                          )}
                          <span>â€¢ {new Date(announcement.datePosted).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Assignments Tab */}
              {activeTab === "assignments" && (
                <div className="space-y-8">
                  {/* Upcoming Assignments */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      Upcoming
                    </h3>
                    {assignments.filter((a) => a.status === "Upcoming").length === 0 ? (
                        <p className="text-gray-500 mb-4">No upcoming assignments.</p>
                      ) : (
                        assignments.filter((a) => a.status === "Upcoming").map(renderAssignmentCard)
                    )}
                  </div>

                  {/* Late Assignments */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      Late
                    </h3>
                    {assignments.filter((a) => a.status === "Late").length === 0 ? (
                        <p className="text-gray-500 mb-4">No late assignments.</p>
                      ) : (
                        assignments.filter((a) => a.status === "Late").map(renderAssignmentCard)
                    )}
                  </div>

                  {/* Submitted Assignments */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      Submitted
                    </h3>
                    {assignments.filter((a) => a.status === "Submitted").length === 0 ? (
                        <p className="text-gray-500 mb-4">No submitted assignments.</p>
                      ) : (
                        assignments.filter((a) => a.status === "Submitted").map(renderAssignmentCard)
                    )}
                  </div>

                </div>
              )}

              {/* Files Tab */}
              {activeTab === "files" && (
                <div className="space-y-4">
                  {files.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No files uploaded</div>
                  ) : (
                    files.map((file) => (
                      <div key={file.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="p-3 bg-emerald-50 rounded-lg">
                              {getFileIcon(file.fileType)}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">{file.fileName}</h3>
                              <p className="text-gray-600 text-sm mb-3">{file.description}</p>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4" />
                                  <span>{file.subject}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  <span>{file.teacher}</span>
                                </div>
                                <span>â€¢ {file.fileSize}</span>
                                <span>â€¢ {new Date(file.uploadDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Download className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default StudentContent;
