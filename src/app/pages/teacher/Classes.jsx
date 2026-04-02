import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "../../components/TeacherSidebar";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import {
  BookOpen,
  Users,
  Search,
  Plus,
  X,
  Clock,
  MapPin,
  ChevronRight,
  GraduationCap,
} from "lucide-react";

function Classes() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [classes, setClasses] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    section: "",
    schedule: "",
    room: "",
    semester: "First Semester 2026",
  });

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "teacher") { navigate("/login"); return; }
    setTeacherName(user.name);

    // 1. Clear legacy dummy data if found
    localStorage.removeItem("teacher_classes");

    // 2. Load globally assigned subjects from Admin
    const subjectsData = localStorage.getItem("subjects");
    if (subjectsData) {
      const allSubjects = JSON.parse(subjectsData);
      // Filter by the current teacher's name
      // cls.teacher is the name entered by Admin in Subject Management
      const assignedClasses = allSubjects.filter(cls =>
        cls.teacher.toLowerCase() === user.name.toLowerCase()
      );
      setClasses(assignedClasses);
    }
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    // Since Admin now handles class creation, we disable the handleCreate logic
    // but keep the state reset just in case.
    setShowCreateModal(false);
    setForm({ code: "", name: "", section: "", schedule: "", room: "", semester: "First Semester 2026" });
    setCreateError("");
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setCreateError("");
    setForm({ code: "", name: "", section: "", schedule: "", room: "", semester: "First Semester 2026" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay:'0ms'}} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'150ms'}} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{animationDelay:'300ms'}} />
          </div>
          <p className="text-gray-500">Loading classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
        {/* Top Bar */}
        <div className="bg-gray-950/80 backdrop-blur-md border-b border-white/8 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Classes</h2>
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
          {/* Header */}
          <div className="relative rounded-2xl p-8 text-white shadow-lg overflow-hidden bg-gray-900 border border-white/10">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-emerald-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1 text-emerald-400">My Classes</h1>
                <p className="text-gray-400">
                  {classes[0]?.semester || "First Semester 2026"} &bull;{" "}
                  {classes.length} {classes.length === 1 ? "Class" : "Classes"}
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="bg-gray-900/60 rounded-xl p-4 border border-white/8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search classes by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 text-white placeholder-gray-500 pl-10 pr-4 py-3 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="bg-gray-900/60 rounded-xl border border-white/10 p-16 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {searchQuery ? "No classes found" : "No classes assigned yet"}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchQuery
                  ? "Try a different search term."
                  : "Your school administrator has not assigned you any classes yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/teacher/class/${cls.id}`)}
                  className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm hover:border-emerald-500/30 hover:bg-gray-800/80 transition-all duration-300 cursor-pointer group overflow-hidden"
                >
                  <div className="bg-black/20 border-b border-white/5 p-6">
                    <p className="text-emerald-400 text-sm font-medium tracking-wide">
                      {cls.code}
                    </p>
                    <h3 className="text-white font-bold text-xl mt-1 line-clamp-1">
                      {cls.name}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">{cls.section}</p>
                  </div>
                  <div className="p-6 space-y-3">
                    {cls.schedule && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Clock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {cls.schedule}
                      </div>
                    )}
                    {cls.room && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {cls.room}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Users className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      {cls.studentCount} students enrolled
                    </div>
                    <button className="w-full mt-2 px-4 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors font-medium flex items-center justify-center gap-2">
                      View Class
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>


    </div>
  );
}

export { Classes };
