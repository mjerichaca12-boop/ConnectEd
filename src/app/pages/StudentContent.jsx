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
  BookOpen
} from "lucide-react";
function StudentContent() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [notifications, setNotifications] = useState(3);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("announcements");
  const [announcements] = useState([
    {
      id: "1",
      title: "Mid-term Examinations Schedule Released",
      content: "The mid-term examinations will be held from January 20-24, 2026. Please review the schedule posted on the bulletin board and make sure to prepare accordingly.",
      author: "Dr. Maria Santos",
      authorRole: "Admin",
      datePosted: "2026-01-16",
      priority: "High"
    },
    {
      id: "2",
      title: "Mathematics Quiz on Friday",
      content: "Reminder: There will be a quiz on Friday covering Chapters 3-5. Please review your notes and practice problems.",
      author: "Ms. Sarah Rodriguez",
      authorRole: "Teacher",
      datePosted: "2026-01-14",
      subject: "MATH101",
      priority: "High"
    },
    {
      id: "3",
      title: "Library Hours Extended for Exam Week",
      content: "Starting next week, the library will be open from 7:00 AM to 8:00 PM to accommodate students preparing for mid-term examinations.",
      author: "Ms. Jennifer Cruz",
      authorRole: "Admin",
      datePosted: "2026-01-15",
      priority: "Medium"
    }
  ]);
  const [assignments] = useState([
    {
      id: "1",
      title: "Chapter 5 Problem Set",
      description: "Complete problems 1-20 from Chapter 5. Show all work and explanations for full credit.",
      subject: "MATH101",
      teacher: "Ms. Sarah Rodriguez",
      dueDate: "2026-01-20",
      totalPoints: 50,
      datePosted: "2026-01-13",
      attachments: ["problem_set_ch5.pdf"],
      status: "Pending"
    },
    {
      id: "2",
      title: "Midterm Project Presentation",
      description: "Create a 10-minute presentation on a mathematical concept of your choice. Include visual aids and demonstrations.",
      subject: "MATH102",
      teacher: "Dr. Michael Chen",
      dueDate: "2026-01-25",
      totalPoints: 100,
      datePosted: "2026-01-10",
      status: "Pending"
    },
    {
      id: "3",
      title: "Shakespeare Essay - Hamlet Analysis",
      description: "Write a 1500-2000 word essay analyzing the theme of revenge in Hamlet. Use MLA format with at least 5 scholarly sources.",
      subject: "ENG101",
      teacher: "Mr. David Santos",
      dueDate: "2026-01-25",
      totalPoints: 100,
      datePosted: "2026-01-08",
      status: "Submitted"
    },
    {
      id: "4",
      title: "Lab Report - Chemical Reactions",
      description: "Submit your lab report on the chemical reactions experiment conducted last week. Include observations, data analysis, and conclusions.",
      subject: "SCI101",
      teacher: "Dr. Maria Cruz",
      dueDate: "2026-01-18",
      totalPoints: 75,
      datePosted: "2026-01-11",
      status: "Graded",
      score: 68
    }
  ]);
  const [files] = useState([
    {
      id: "1",
      fileName: "Lecture_Notes_Week3.pdf",
      fileSize: "2.4 MB",
      uploadDate: "2026-01-15",
      subject: "MATH101",
      teacher: "Ms. Sarah Rodriguez",
      description: "Week 3 lecture notes covering derivatives and their applications",
      fileType: "PDF"
    },
    {
      id: "2",
      fileName: "Practice_Problems_Calculus.docx",
      fileSize: "1.1 MB",
      uploadDate: "2026-01-14",
      subject: "MATH102",
      teacher: "Dr. Michael Chen",
      description: "Additional practice problems for midterm preparation",
      fileType: "DOCX"
    },
    {
      id: "3",
      fileName: "Hamlet_Study_Guide.pdf",
      fileSize: "3.2 MB",
      uploadDate: "2026-01-12",
      subject: "ENG101",
      teacher: "Mr. David Santos",
      description: "Comprehensive study guide for Hamlet with key themes and quotes",
      fileType: "PDF"
    },
    {
      id: "4",
      fileName: "Chemistry_Lab_Instructions.pdf",
      fileSize: "890 KB",
      uploadDate: "2026-01-10",
      subject: "SCI101",
      teacher: "Dr. Maria Cruz",
      description: "Detailed instructions for upcoming chemistry lab experiments",
      fileType: "PDF"
    }
  ]);
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
      case "Pending":
        return "bg-blue-100 text-blue-700";
      case "Submitted":
        return "bg-blue-100 text-blue-700";
      case "Graded":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };
  const getFileIcon = (fileType) => {
    return <FileText className="w-5 h-5 text-emerald-600" />;
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {
    /* Top Bar */
  }
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Academic Content</h2>
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
                {notifications > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications}
                  </span>}
              </button>
            </div>
          </div>
        </div>

        {
    /* Content */
  }
        <div className="p-6 space-y-6">
          {
    /* Header */
  }
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Academic Resources</h1>
            <p className="text-emerald-50">View announcements, assignments, and learning materials</p>
          </div>

          {
    /* Tabs */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button
    onClick={() => setActiveTab("announcements")}
    className={`flex-1 px-6 py-4 font-medium transition-all ${activeTab === "announcements" ? "bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600" : "text-gray-600 hover:bg-gray-50"}`}
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
    className={`flex-1 px-6 py-4 font-medium transition-all ${activeTab === "assignments" ? "bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600" : "text-gray-600 hover:bg-gray-50"}`}
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
    className={`flex-1 px-6 py-4 font-medium transition-all ${activeTab === "files" ? "bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600" : "text-gray-600 hover:bg-gray-50"}`}
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

            {
    /* Tab Content */
  }
            <div className="p-6">
              {
    /* Announcements Tab */
  }
              {activeTab === "announcements" && <div className="space-y-4">
                  {announcements.map((announcement) => <div key={announcement.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
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
                        {announcement.subject && <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span>{announcement.subject}</span>
                          </div>}
                        <span>• {new Date(announcement.datePosted).toLocaleDateString()}</span>
                      </div>
                    </div>)}
                </div>}

              {
    /* Assignments Tab */
  }
              {activeTab === "assignments" && <div className="space-y-4">
                  {assignments.map((assignment) => <div key={assignment.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
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
                      {assignment.attachments && assignment.attachments.length > 0 && <div className="flex items-center gap-2 text-sm mb-3">
                          <Paperclip className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-600">{assignment.attachments.length} attachment(s)</span>
                        </div>}
                      {assignment.status === "Graded" && assignment.score !== void 0 && <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-700 font-medium">Score: {assignment.score}/{assignment.totalPoints}</span>
                        </div>}
                      {assignment.status === "Pending" && <div className="mt-4">
                          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium">
                            Submit Assignment
                          </button>
                        </div>}
                    </div>)}
                </div>}

              {
    /* Files Tab */
  }
              {activeTab === "files" && <div className="space-y-4">
                  {files.map((file) => <div key={file.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
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
                              <span>• {file.fileSize}</span>
                              <span>• {new Date(file.uploadDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </div>)}
                </div>}
            </div>
          </div>
        </div>
      </main>
    </div>;
}
export {
  StudentContent
};
