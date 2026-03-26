import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import {
  Bell,
  Megaphone,
  Search,
  Filter,
  School,
  BookOpen,
  User
} from "lucide-react";
function Announcements() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [activeTab, setActiveTab] = useState("announcements");
  const [announcements, setAnnouncements] = useState([
    {
      id: "1",
      title: "Mid-term Examinations Schedule Released",
      content: "The mid-term examinations will be held from January 20-24, 2026. Please review the schedule posted on the bulletin board and make sure to prepare accordingly. Students are expected to arrive 15 minutes before their scheduled exam time. Bring your school ID and required materials.",
      author: "Dr. Maria Santos",
      authorRole: "Admin",
      datePosted: "2026-01-16",
      targetAudience: "School-wide",
      isRead: false,
      priority: "High"
    },
    {
      id: "2",
      title: "Library Hours Extended for Exam Week",
      content: "Starting next week, the library will be open from 7:00 AM to 8:00 PM to accommodate students preparing for mid-term examinations. Study rooms are available for group discussions. Please reserve in advance through the library portal.",
      author: "Ms. Jennifer Cruz",
      authorRole: "Admin",
      datePosted: "2026-01-15",
      targetAudience: "School-wide",
      isRead: false,
      priority: "Medium"
    },
    {
      id: "3",
      title: "Mathematics Quiz on Friday",
      content: "Reminder: There will be a quiz on Friday covering Chapters 3-5. Please review your notes and practice problems. The quiz will be 30 minutes long and will cover derivatives and integrals.",
      author: "Ms. Sarah Rodriguez",
      authorRole: "Teacher",
      datePosted: "2026-01-14",
      targetAudience: "Subject-specific",
      subject: "MATH101",
      isRead: true,
      priority: "High"
    },
    {
      id: "4",
      title: "Annual Sports Festival Registration Now Open",
      content: "The Annual Sports Festival will be held on February 14-15, 2026. Registration is now open for all athletic events including basketball, volleyball, track and field, and swimming. Sign up at the PE Department office by January 31st.",
      author: "Coach Robert Tan",
      authorRole: "Teacher",
      datePosted: "2026-01-13",
      targetAudience: "School-wide",
      isRead: true,
      priority: "Medium"
    },
    {
      id: "5",
      title: "Science Project Submission Deadline",
      content: "The deadline for submitting your Science Fair projects is January 22, 2026. All projects must include a written report, visual presentation, and demonstration. Late submissions will not be accepted. Please see me during office hours if you have questions.",
      author: "Dr. Maria Cruz",
      authorRole: "Teacher",
      datePosted: "2026-01-12",
      targetAudience: "Subject-specific",
      subject: "SCI101",
      isRead: true,
      priority: "High"
    },
    {
      id: "6",
      title: "School Cafeteria Menu Changes",
      content: "Starting next week, the school cafeteria will be offering new healthy meal options including vegetarian and gluten-free choices. Meal prices remain the same. Check the cafeteria bulletin board for the full menu.",
      author: "Ms. Patricia Gomez",
      authorRole: "Admin",
      datePosted: "2026-01-10",
      targetAudience: "School-wide",
      isRead: true,
      priority: "Low"
    },
    {
      id: "7",
      title: "English Literature Essay Guidelines",
      content: "Your essay on Shakespeare's Hamlet is due on January 25th. Please follow MLA format, 1500-2000 words, double-spaced. Include at least 5 scholarly sources. Plagiarism will result in automatic failure. Submit through the online portal.",
      author: "Mr. David Santos",
      authorRole: "Teacher",
      datePosted: "2026-01-09",
      targetAudience: "Subject-specific",
      subject: "ENG101",
      isRead: true,
      priority: "High"
    }
  ]);
  const [assignments, setAssignments] = useState([
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
  const [files, setFiles] = useState([
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
    },
    {
      id: "5",
      fileName: "Periodic_Table_Reference.png",
      fileSize: "1.5 MB",
      uploadDate: "2026-01-09",
      subject: "SCI101",
      teacher: "Dr. Maria Cruz",
      description: "High-resolution periodic table with element properties",
      fileType: "PNG"
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
  const handleAnnouncementClick = (announcement) => {
    setSelectedAnnouncement(announcement);
    if (!announcement.isRead) {
      setAnnouncements(
        (prev) => prev.map((a) => a.id === announcement.id ? { ...a, isRead: true } : a)
      );
    }
  };
  const filteredAnnouncements = announcements.filter((announcement) => {
    const matchesSearch = announcement.title.toLowerCase().includes(searchQuery.toLowerCase()) || announcement.content.toLowerCase().includes(searchQuery.toLowerCase()) || announcement.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === "all" || selectedFilter === "school-wide" && announcement.targetAudience === "School-wide" || selectedFilter === "subject-specific" && announcement.targetAudience === "Subject-specific" || selectedFilter === "unread" && !announcement.isRead;
    return matchesSearch && matchesFilter;
  });
  const unreadCount = announcements.filter((a) => !a.isRead).length;
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
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading announcements...</p>
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
                <h2 className="text-xl font-semibold text-gray-900">Announcements</h2>
              </div>
              <div className="flex items-center gap-4">
                <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Bell className="w-6 h-6 text-gray-600" />
                  {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {
    /* Content */
  }
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {
    /* Left Sidebar - Announcements List */
  }
            <div className="lg:col-span-1 space-y-4">
              {
    /* Header */
  }
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Megaphone className="w-8 h-8" />
                  <div>
                    <h1 className="text-2xl font-bold">Announcements</h1>
                    <p className="text-emerald-50 text-sm">{unreadCount} unread</p>
                  </div>
                </div>
              </div>

              {
    /* Search */
  }
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
    type="text"
    placeholder="Search announcements..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
  />
                </div>
              </div>

              {
    /* Filters */
  }
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Filter by</span>
                </div>
                <div className="space-y-1">
                  <button
    onClick={() => setSelectedFilter("all")}
    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFilter === "all" ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
  >
                    All Announcements
                  </button>
                  <button
    onClick={() => setSelectedFilter("unread")}
    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFilter === "unread" ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
  >
                    Unread Only
                  </button>
                  <button
    onClick={() => setSelectedFilter("school-wide")}
    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFilter === "school-wide" ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
  >
                    School-wide
                  </button>
                  <button
    onClick={() => setSelectedFilter("subject-specific")}
    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFilter === "subject-specific" ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
  >
                    Subject-specific
                  </button>
                </div>
              </div>

              {
    /* Announcements List */
  }
              <div className="space-y-2">
                {filteredAnnouncements.map((announcement) => <div
    key={announcement.id}
    onClick={() => handleAnnouncementClick(announcement)}
    className={`bg-white rounded-xl p-4 border cursor-pointer transition-all hover:shadow-md ${selectedAnnouncement?.id === announcement.id ? "border-emerald-500 shadow-md" : announcement.isRead ? "border-gray-200" : "border-emerald-200 bg-emerald-50"}`}
  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1 pr-2">
                        {announcement.title}
                      </h3>
                      {!announcement.isRead && <span className="w-2 h-2 bg-emerald-600 rounded-full flex-shrink-0 mt-1" />}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">{announcement.content}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        {new Date(announcement.datePosted).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  })}
                      </span>
                      <span className={`px-2 py-1 rounded-full ${getPriorityColor(announcement.priority)}`}>
                        {announcement.priority}
                      </span>
                    </div>
                  </div>)}

                {filteredAnnouncements.length === 0 && <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <Megaphone className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm">No announcements found</p>
                  </div>}
              </div>
            </div>

            {
    /* Right Content - Announcement Detail */
  }
            <div className="lg:col-span-2">
              {selectedAnnouncement ? <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {
    /* Header */
  }
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 border-b border-gray-200">
                    <div className="flex items-start justify-between mb-4">
                      <h1 className="text-2xl font-bold text-gray-900 flex-1 pr-4">
                        {selectedAnnouncement.title}
                      </h1>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedAnnouncement.priority)}`}>
                        {selectedAnnouncement.priority} Priority
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="text-gray-700">
                          {selectedAnnouncement.author} ({selectedAnnouncement.authorRole})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedAnnouncement.targetAudience === "School-wide" ? <School className="w-4 h-4 text-gray-600" /> : <BookOpen className="w-4 h-4 text-gray-600" />}
                        <span className="text-gray-700">
                          {selectedAnnouncement.targetAudience}
                          {selectedAnnouncement.subject && ` - ${selectedAnnouncement.subject}`}
                        </span>
                      </div>

                      <div className="text-gray-600">
                        {new Date(selectedAnnouncement.datePosted).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  })}
                      </div>
                    </div>
                  </div>

                  {
    /* Content */
  }
                  <div className="p-6">
                    <div className="prose max-w-none">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                        {selectedAnnouncement.content}
                      </p>
                    </div>
                  </div>
                </div> : <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center h-full flex items-center justify-center">
                  <div>
                    <Megaphone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Select an announcement
                    </h3>
                    <p className="text-gray-600">
                      Click on an announcement from the list to view details
                    </p>
                  </div>
                </div>}
            </div>
          </div>
        </div>
      </main>
    </div>;
}
export {
  Announcements
};
