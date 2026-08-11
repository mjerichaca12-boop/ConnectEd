import { useState, useEffect, useCallback } from "react";
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
  MapPin,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { isColumnMissingError, resolveTeacherIdByEmail, getTeacherAssignedClasses } from "@/app/lib/teacherHelpers";
import { useTourPreview } from "@/app/hooks/useTourPreview";
import { useCachedFetch } from "@/app/hooks/useCachedFetch";

function Classes() {
  const navigate = useNavigate();
  const { isDemoMode, mockData } = useTourPreview();
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
    return (subjectRows ?? []).map((subject) => {
      const code = String(subject.code || "").trim();
      const name = String(subject.name || "Untitled Subject").trim();
      let rawGrade = String(subject.gradeLevel || subject.grade_level || subject.grade || subject.year_level || "").trim();
      if (!rawGrade) {
        const gradeMatch = (code.match(/10|11|12|[7-9]/) || name.match(/10|11|12|[7-9]/))?.[0];
        if (gradeMatch) rawGrade = `Grade ${gradeMatch}`;
      } else if (!rawGrade.toLowerCase().includes("grade") && /^\d+$/.test(rawGrade)) {
        rawGrade = `Grade ${rawGrade}`;
      }

      return {
        id: String(subject.id),
        code,
        name,
        section: String(subject.section || "").trim() || "No section assigned",
        schedule: String(subject.schedule || "").trim(),
        room: "",
        semester: "Current School Year",
        studentCount: Number(enrollmentBySubject.get(String(subject.id)) ?? subject.enrolled ?? 0),
        capacity: Number(subject.capacity || 0),
        students: [],
        gradeLevel: rawGrade
      };
    });
  };

  const getSubjectIdentityKey = (subject) => {
    const code = String(subject?.code || "").trim().toLowerCase();
    const name = String(subject?.name || "").trim().toLowerCase();
    const section = String(subject?.section || "").trim().toLowerCase();
    const gradeLevel = String(subject?.gradeLevel || subject?.grade_level || subject?.year_level || "").trim().toLowerCase();
    const semanticKey = [code, name, section, gradeLevel].filter(Boolean).join("|");

    if (semanticKey) {
      return semanticKey;
    }

    return `id:${String(subject?.id || "").trim()}`;
  };

  const dedupeSubjects = (rows) => {
    const seen = new Set();
    return (rows ?? []).filter((subject) => {
      const key = getSubjectIdentityKey(subject);
      if (!key.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const setClassesAndPersist = (nextClasses) => {
    const realClasses = (nextClasses ?? []).filter((c) => !String(c?.id || "").startsWith("demo-"));
    setClasses(realClasses);
    localStorage.setItem("teacher_classes", JSON.stringify(realClasses));
  };



  const loadTeacherSubjects = async (id) => {
    if (!supabase || !id) {
      setClassesAndPersist([]);
      return;
    }

    let { data, error } = await supabase
      .from("subjects")
      .select("id, code, name, section, schedule, enrolled, grade_level, capacity")
      .eq("teacher_id", id)
      .order("code", { ascending: true });

    if (error && isColumnMissingError(error)) {
      const fallback = await supabase
        .from("subjects")
        .select("id, code, name, section, schedule, enrolled, grade_level, capacity")
        .eq("teacher_id", id)
        .order("code", { ascending: true });

      data = fallback.data;
      error = fallback.error;
    }

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

    const uniqueSubjects = dedupeSubjects(data);
    console.log("[Classes] fetched teacher subjects", {
      teacherId: id,
      fetched: (data ?? []).length,
      unique: uniqueSubjects.length,
      fetchedSubjectIds: (data ?? []).map((subject) => String(subject.id || "")).filter(Boolean)
    });

    if (uniqueSubjects.length !== (data ?? []).length) {
      console.warn("[Classes] duplicate subjects detected and removed", {
        teacherId: id,
        fetched: (data ?? []).length,
        kept: uniqueSubjects.length
      });
    }

    setClassesAndPersist(mapSubjectsToCards(uniqueSubjects, enrollmentBySubject));
  };

  const fetchTeacherClassesData = useCallback(async () => {
    const rawUser = localStorage.getItem("currentUser");
    if (!rawUser) return null;
    const user = JSON.parse(rawUser);
    const { teacherId: resId, classes: resClasses } = await getTeacherAssignedClasses(user);
    if (resId) setTeacherId(resId);

    return mapSubjectsToCards(resClasses);
  }, []);

  const { data: cachedClassesCards, loading: isCachedClassesLoading } = useCachedFetch(
    teacherEmail ? `teacher_classes_${teacherEmail}` : "teacher_classes_default",
    fetchTeacherClassesData,
    { deps: [teacherEmail] }
  );

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "teacher") { navigate("/login"); return; }

    setTeacherName(user.name);
    const normalizedEmail = String(user.email || "").trim().toLowerCase();
    setTeacherEmail(normalizedEmail);
  }, [navigate]);

  useEffect(() => {
    if (cachedClassesCards && cachedClassesCards.length > 0) {
      setClasses(cachedClassesCards);
      setLoading(false);
    } else {
      setLoading(isCachedClassesLoading);
    }
  }, [cachedClassesCards, isCachedClassesLoading]);

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

  const activeClassesList = isDemoMode ? mockData.classes : classes;

  const filteredClasses = activeClassesList.filter((classItem) =>
    String(classItem.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(classItem.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(classItem.section || "").toLowerCase().includes(searchQuery.toLowerCase())
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



  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <TeacherSidebar teacherName={teacherName} onLogout={handleLogoutClick} />

      <main className="flex-1 h-screen overflow-y-auto lg:pl-64">
        {/* Top Bar */}
        <div className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-end gap-4">
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
          <div data-tour="teacher-classes-header" className="bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
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
                <p className="text-white/90 text-sm">
                  {classes[0]?.semester || "First Semester 2026"} &bull; {classes.length} {classes.length === 1 ? "Class" : "Classes"}
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div data-tour="teacher-classes-search" className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
              <input
                type="text"
                placeholder="Search classes by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 text-gray-900 placeholder-gray-500 pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500/50 transition-colors"
              />
            </div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-2xl border border-green-200 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? "No classes found" : "No classes assigned yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? "Try a different search term."
                  : "Your school administrator has not assigned you any classes yet."}
              </p>
            </div>
          ) : (
            <div data-tour="teacher-classes-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((classItem) => (
                <div
                  key={classItem.id}
                  onClick={() => navigate(`/teacher/class/${classItem.id}`)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-green-300 hover:bg-gray-200/80 transition-all duration-300 cursor-pointer group overflow-hidden"
                >
                  <div className="bg-gray-50 border-b border-gray-100 p-6">
                    {classItem.code ? (
                      <p className="text-green-600 text-sm font-medium tracking-wide">
                        {classItem.code}
                      </p>
                    ) : null}
                    <h3 className="text-gray-900 font-bold text-xl mt-1 line-clamp-1">
                      {classItem.name}
                    </h3>
                    {(classItem.gradeLevel || classItem.section) && (
                      <p className="text-gray-600 text-sm mt-1">
                        {classItem.gradeLevel ? classItem.gradeLevel : ""} {classItem.section ? (classItem.gradeLevel ? `- ${classItem.section}` : classItem.section) : ""}
                      </p>
                    )}
                  </div>
                  <div className="p-6 space-y-3">
                    {classItem.room && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                        {classItem.room}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>{classItem.studentCount} / {classItem.capacity || 30} students enrolled</span>
                      {classItem.capacity > 0 && classItem.studentCount >= classItem.capacity && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 rounded">Full</span>
                      )}
                    </div>
                    <button
                      type="button"
                      data-tour="teacher-classes-view-btn"
                      data-class-id={classItem.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/teacher/class/${classItem.id}`);
                      }}
                      className="w-full mt-2 px-4 py-3 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-500/20 transition-colors font-medium flex items-center justify-center gap-2 cursor-pointer"
                    >
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
