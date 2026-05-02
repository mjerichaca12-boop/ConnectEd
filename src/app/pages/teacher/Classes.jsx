  import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { LoadingScreen } from "@/app/components/LoadingScreen";
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
import { supabase } from "@/app/lib/supabaseClient";
import { resolveTeacherIdByEmail } from "@/app/lib/teacherHelpers";

function Classes() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [classes, setClasses] = useState([]);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherId, setTeacherId] = useState("");
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

  const mapSubjectsToCards = (subjectRows, enrollmentBySubject = new Map()) => {
    return (subjectRows ?? []).map((subject) => ({
      id: String(subject.id),
      code: String(subject.code || "").trim(),
      name: String(subject.name || "Untitled Subject").trim(),
      section: String(subject.section || "").trim() || "No section assigned",
      schedule: String(subject.schedule || "").trim(),
      room: "",
      semester: "Current School Year",
      studentCount: Number(enrollmentBySubject.get(String(subject.id)) ?? subject.enrolled ?? 0),
      students: []
    }));
  };

  const setClassesAndPersist = (nextClasses) => {
    setClasses(nextClasses);
    localStorage.setItem("teacher_classes", JSON.stringify(nextClasses));
  };



  const loadTeacherSubjects = async (id) => {
    if (!supabase || !id) {
      setClassesAndPersist([]);
      return;
    }

    const { data, error } = await supabase
      .from("subjects")
      .select("id, code, name, section, schedule, enrolled")
      .eq("teacher_id", id)
      .order("code", { ascending: true });

    if (error) {
      console.error("Failed to load teacher subjects:", error);
      setClassesAndPersist([]);
      return;
    }

    const subjectIds = (data ?? []).map((subject) => String(subject.id)).filter(Boolean);
    const enrollmentBySubject = new Map();

    if (subjectIds.length > 0) {
      const { data: assignmentRows, error: assignmentError } = await supabase
        .from("teacher_student_assignments")
        .select("subject_id")
        .eq("teacher_id", id)
        .in("subject_id", subjectIds);

      if (!assignmentError) {
        (assignmentRows ?? []).forEach((row) => {
          const key = String(row.subject_id || "");
          if (!key) return;
          enrollmentBySubject.set(key, (enrollmentBySubject.get(key) || 0) + 1);
        });
      }
    }

    setClassesAndPersist(mapSubjectsToCards(data, enrollmentBySubject));
  };

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "teacher") { navigate("/login"); return; }

    setTeacherName(user.name);
    const normalizedEmail = String(user.email || "").trim().toLowerCase();
    setTeacherEmail(normalizedEmail);

    resolveTeacherIdByEmail(normalizedEmail)
      .then((id) => {
        setTeacherId(id);
        return loadTeacherSubjects(id);
      })
      .finally(() => {
      setLoading(false);
    });
  }, [navigate]);

  useEffect(() => {
    if (!supabase || !teacherId) return;

    let isMounted = true;
    let subjectsChannel;
    let assignmentChannel;

    const setupSubscription = async () => {
      subjectsChannel = supabase
        .channel(`teacher-subject-classes-${teacherId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "subjects"
          },
          (payload) => {
            if (!isMounted) return;
            const newTeacherId = String(payload?.new?.teacher_id || "");
            const oldTeacherId = String(payload?.old?.teacher_id || "");
            if (newTeacherId === teacherId || oldTeacherId === teacherId) {
              loadTeacherSubjects(teacherId);
            }
          }
        )
        .subscribe();

      assignmentChannel = supabase
        .channel(`teacher-subject-enrollment-${teacherId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "teacher_student_assignments",
            filter: `teacher_id=eq.${teacherId}`
          },
          () => {
            if (!isMounted) return;
            loadTeacherSubjects(teacherId);
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      isMounted = false;
      if (subjectsChannel) {
        supabase.removeChannel(subjectsChannel);
      }
      if (assignmentChannel) {
        supabase.removeChannel(assignmentChannel);
      }
    };
  }, [teacherId]);

  const handleLogoutClick = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const filteredClasses = classes.filter((classItem) =>
    classItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    classItem.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    classItem.section.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmitCreateClass = () => {
    // Since Admin now handles class creation, we disable the handleSubmitCreateClass logic
    // but keep the state reset just in case.
    setShowCreateModal(false);
    setForm({ code: "", name: "", section: "", schedule: "", room: "", semester: "First Semester 2026" });
    setCreateError("");
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateError("");
    setForm({ code: "", name: "", section: "", schedule: "", room: "", semester: "First Semester 2026" });
  };

  if (loading) {
    return <LoadingScreen message="Loading classes..." />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <TeacherSidebar teacherName={teacherName} onLogout={handleLogoutClick} />

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
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1">My Classes</h1>
                <p className="text-emerald-50 text-sm">
                  {classes[0]?.semester || "First Semester 2026"} &bull; {classes.length} {classes.length === 1 ? "Class" : "Classes"}
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
              {filteredClasses.map((classItem) => (
                <div
                  key={classItem.id}
                  onClick={() => navigate(`/teacher/class/${classItem.id}`)}
                  className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm hover:border-emerald-500/30 hover:bg-gray-800/80 transition-all duration-300 cursor-pointer group overflow-hidden"
                >
                  <div className="bg-black/20 border-b border-white/5 p-6">
                    {classItem.code ? (
                      <p className="text-emerald-400 text-sm font-medium tracking-wide">
                        {classItem.code}
                      </p>
                    ) : null}
                    <h3 className="text-white font-bold text-xl mt-1 line-clamp-1">
                      {classItem.name}
                    </h3>
                    {classItem.section && classItem.section !== classItem.name ? (
                      <p className="text-gray-400 text-sm mt-1">{classItem.section}</p>
                    ) : null}
                  </div>
                  <div className="p-6 space-y-3">
                    {classItem.schedule && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Clock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {classItem.schedule}
                      </div>
                    )}
                    {classItem.room && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {classItem.room}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Users className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      {classItem.studentCount} students enrolled
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
