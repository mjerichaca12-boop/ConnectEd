import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ActivityProvider } from "./lib/ActivityContext";
import { supabase } from "./lib/supabaseClient";
import { isStaticAdminUser } from "./lib/staticAdminAuth";
import { LandingPage } from "./pages/LandingPage";
import { TermsAndPrivacy } from "./pages/TermsAndPrivacy";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { ForgotPassword } from "./pages/ForgotPassword";
import { VerifyEmail } from "./pages/VerifyEmail";
import { RequestAccess } from "./pages/RequestAccess";
import { SetPassword } from "./pages/SetPassword";
import { StudentDashboard } from "./pages/StudentDashboard";
import { Subjects } from "./pages/Subjects";
import { SubjectDetail } from "./pages/SubjectDetail";
import { Grades } from "./pages/Grades";
import { Attendance } from "./pages/Attendance";
import { Announcements } from "./pages/Announcements";
import { StudentContent } from "./pages/StudentContent";
import { StudentMaterials } from "./pages/StudentMaterials";
import { StudentEnrollment } from "./pages/StudentEnrollment";
import { Messages } from "./pages/Messages";
import { Profile } from "./pages/Profile";
import { VideoConferencing } from "./pages/VideoConferencing";
import { TeacherDashboard } from "./pages/teacher/TeacherDashboard";
import { Classes } from "./pages/teacher/Classes";
import { ClassDetail } from "./pages/teacher/ClassDetail";
import { GradesManagement } from "./pages/teacher/GradesManagement";
import { AttendanceManagement } from "./pages/teacher/AttendanceManagement";
import { TeacherAnnouncements } from "./pages/teacher/TeacherAnnouncements";
import { ClassMaterials } from "./pages/teacher/ClassMaterials";
import { TeacherMessages } from "./pages/teacher/TeacherMessages";
import { TeacherProfile } from "./pages/teacher/TeacherProfile";
import { VideoConferencing as TeacherVideoConferencing } from "./pages/teacher/VideoConferencing";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { StudentManagement } from "./pages/admin/StudentManagement";
import { TeacherManagement } from "./pages/admin/TeacherManagement";
import { SubjectManagement } from "./pages/admin/SubjectManagement";
import { EnrollmentManagement } from "./pages/admin/EnrollmentManagement";
import { AdminAnnouncements } from "./pages/admin/AdminAnnouncements";
import { AdminCalendar } from "./pages/admin/AdminCalendar";
import { AdminAccessRequests } from "./pages/admin/AdminAccessRequests";
import { Reports } from "./pages/admin/Reports";
import { SystemSettings } from "./pages/admin/SystemSettings";

function TeacherRouteGuard({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let isMounted = true;

    const verifyAccess = async () => {
      try {
        const rawUser = localStorage.getItem("currentUser");
        if (!rawUser) {
          if (isMounted) setStatus("denied");
          return;
        }

        const parsedUser = JSON.parse(rawUser);
        const email = String(parsedUser?.email || "").trim().toLowerCase();
        if (parsedUser?.role !== "teacher" || !email) {
          if (isMounted) setStatus("denied");
          return;
        }

        if (!supabase) {
          if (isMounted) setStatus("allowed");
          return;
        }

        const profileLookup = await supabase
          .from("profiles")
          .select("id, role")
          .ilike("email", email)
          .limit(1)
          .maybeSingle();

        if (!profileLookup.error && profileLookup.data?.id) {
          const profileRole = String(profileLookup.data.role || "").trim().toLowerCase();
          if (profileRole === "teacher") {
            if (isMounted) setStatus("allowed");
            return;
          }
        }

        const teacherLookup = await supabase
          .from("teachers")
          .select("id, role")
          .ilike("email", email)
          .limit(1)
          .maybeSingle();

        if (!teacherLookup.error && teacherLookup.data?.id) {
          const teacherRole = String(teacherLookup.data.role || "").trim().toLowerCase();
          if (!teacherRole || teacherRole === "teacher") {
            if (isMounted) setStatus("allowed");
            return;
          }
        }

        if (isMounted) {
          localStorage.removeItem("currentUser");
          setStatus("denied");
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem("currentUser");
          setStatus("denied");
        }
      }
    };

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="text-sm text-gray-500">Checking access...</p>
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRouteGuard({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("currentUser");
      if (!rawUser) {
        setStatus("denied");
        return;
      }

      const parsedUser = JSON.parse(rawUser);
      if (!isStaticAdminUser(parsedUser)) {
        localStorage.removeItem("currentUser");
        setStatus("denied");
        return;
      }

      setStatus("allowed");
    } catch {
      localStorage.removeItem("currentUser");
      setStatus("denied");
    }
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="text-sm text-gray-500">Checking admin access...</p>
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ActivityProvider>
      <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/terms-and-privacy" element={<TermsAndPrivacy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="/set-password" element={<SetPassword />} />

        <Route path="/admin" element={<Navigate to="/login" replace />} />

        {/* Student Routes */}
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/subject/:id" element={<SubjectDetail />} />
        <Route path="/grades" element={<Grades />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/content" element={<StudentContent />} />
        <Route path="/materials" element={<StudentMaterials />} />
        <Route path="/enrollment" element={<StudentEnrollment />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/video-conference" element={<VideoConferencing />} />

        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={<TeacherRouteGuard><TeacherDashboard /></TeacherRouteGuard>} />
        <Route path="/teacher/classes" element={<TeacherRouteGuard><Classes /></TeacherRouteGuard>} />
        <Route path="/teacher/class/:id" element={<TeacherRouteGuard><ClassDetail /></TeacherRouteGuard>} />
        <Route path="/teacher/grades" element={<TeacherRouteGuard><GradesManagement /></TeacherRouteGuard>} />
        <Route path="/teacher/attendance" element={<TeacherRouteGuard><AttendanceManagement /></TeacherRouteGuard>} />
        <Route path="/teacher/announcements" element={<TeacherRouteGuard><TeacherAnnouncements /></TeacherRouteGuard>} />
        <Route path="/teacher/materials" element={<TeacherRouteGuard><ClassMaterials /></TeacherRouteGuard>} />
        <Route path="/teacher/messages" element={<TeacherRouteGuard><TeacherMessages /></TeacherRouteGuard>} />
        <Route path="/teacher/profile" element={<TeacherRouteGuard><TeacherProfile /></TeacherRouteGuard>} />
        <Route path="/teacher/video-conference" element={<TeacherRouteGuard><TeacherVideoConferencing /></TeacherRouteGuard>} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminRouteGuard><AdminDashboard /></AdminRouteGuard>} />
        <Route path="/admin/students" element={<AdminRouteGuard><StudentManagement /></AdminRouteGuard>} />
        <Route path="/admin/teachers" element={<AdminRouteGuard><TeacherManagement /></AdminRouteGuard>} />
        <Route path="/admin/subjects" element={<AdminRouteGuard><SubjectManagement /></AdminRouteGuard>} />
        <Route path="/admin/enrollment" element={<AdminRouteGuard><EnrollmentManagement /></AdminRouteGuard>} />
        <Route path="/admin/announcements" element={<AdminRouteGuard><AdminAnnouncements /></AdminRouteGuard>} />
        <Route path="/admin/calendar" element={<AdminRouteGuard><AdminCalendar /></AdminRouteGuard>} />
        <Route path="/admin/access-requests" element={<AdminRouteGuard><AdminAccessRequests /></AdminRouteGuard>} />
        <Route path="/admin/reports" element={<AdminRouteGuard><Reports /></AdminRouteGuard>} />
        <Route path="/admin/settings" element={<AdminRouteGuard><SystemSettings /></AdminRouteGuard>} />
      </Routes>
      </Router>
    </ActivityProvider>
  );
}
