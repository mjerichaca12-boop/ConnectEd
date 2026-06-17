import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ActivityProvider } from "./lib/ActivityContext";
import { supabase } from "./lib/supabaseClient";
import { isStaticAdminUser } from "./lib/staticAdminAuth";
import { Toaster } from "sonner";
import { LandingPage } from "./pages/LandingPage";
import { TermsAndPrivacy } from "./pages/TermsAndPrivacy";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { ForgotPassword } from "./pages/ForgotPassword";
import { VerifyEmail } from "./pages/VerifyEmail";
import { RequestAccess } from "./pages/RequestAccess";
import { SetPassword } from "./pages/SetPassword";
import { SecureAccount } from "./pages/SecureAccount";
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
import { StudentAIAssistant } from "./pages/StudentAIAssistant";
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
import { Notifications } from "./pages/teacher/Notifications";
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
import { AdminMessages } from "./pages/admin/AdminMessages";
import { AIAdminAssistant } from "./pages/admin/AIAdminAssistant";
import { AIAssistant } from "./pages/teacher/AIAssistant";
import { NotificationsPage } from "./pages/NotificationsPage";
import { Smartphone, Monitor, ShieldAlert } from "lucide-react";

const isMobileDevice = () => window.innerWidth < 1024;

function DeviceRestricted({ role, allowed }) {
  const Icon = allowed === "Desktop" ? Monitor : Smartphone;
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <ShieldAlert className="w-10 h-10 text-red-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Restricted Access</h1>
      <p className="text-gray-600 max-w-md mb-8">
        The <span className="font-semibold">{role} Portal</span> is only accessible via <span className="font-semibold text-green-600">{allowed}</span> devices. 
        Please switch to a {allowed.toLowerCase()} to continue.
      </p>
      <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <Icon className="w-12 h-12 text-gray-400" />
        <p className="text-sm font-medium text-gray-500 italic">Expected Device: {allowed}</p>
      </div>
      <button 
        onClick={() => {
          localStorage.removeItem("currentUser");
          window.location.href = "/login";
        }}
        className="mt-10 text-green-600 font-semibold hover:underline"
      >
        Back to Login
      </button>
    </div>
  );
}

function StudentRouteGuard({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    if (!isMobileDevice()) {
      setStatus("device-restricted");
      return;
    }

    const rawUser = localStorage.getItem("currentUser");
    if (!rawUser) {
      setStatus("denied");
      return;
    }

    try {
      const parsedUser = JSON.parse(rawUser);
      if (parsedUser?.role === "student") {
        if (parsedUser?.must_change_password) {
          setStatus("force-password-change");
        } else {
          setStatus("allowed");
        }
      } else {
        setStatus("denied");
      }
    } catch {
      setStatus("denied");
    }
  }, []);

  if (status === "checking") return null;
  if (status === "device-restricted") return <DeviceRestricted role="Student" allowed="Mobile" />;
  if (status === "force-password-change") return <Navigate to="/secure-account" replace />;
  if (status === "denied") return <Navigate to="/login" replace />;

  return children;
}

function TeacherRouteGuard({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    if (isMobileDevice()) {
      setStatus("device-restricted");
      return;
    }

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Checking access...</p>
      </div>
    );
  }

  if (status === "device-restricted") return <DeviceRestricted role="Teacher" allowed="Desktop" />;
  if (status === "denied") return <Navigate to="/login" replace />;

  return children;
}

function AdminRouteGuard({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    if (isMobileDevice()) {
      setStatus("device-restricted");
      return;
    }

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Checking admin access...</p>
      </div>
    );
  }

  if (status === "device-restricted") return <DeviceRestricted role="Administrator" allowed="Desktop" />;
  if (status === "denied") return <Navigate to="/login" replace />;

  return children;
}

export default function App() {
  return (
    <ActivityProvider>
      <Router>
        <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/terms-and-privacy" element={<TermsAndPrivacy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/secure-account" element={<SecureAccount />} />

        <Route path="/admin" element={<Navigate to="/login" replace />} />

        {/* Student Routes */}
        <Route path="/dashboard" element={<StudentRouteGuard><StudentDashboard /></StudentRouteGuard>} />
        <Route path="/subjects" element={<StudentRouteGuard><Subjects /></StudentRouteGuard>} />
        <Route path="/subject/:id" element={<StudentRouteGuard><SubjectDetail /></StudentRouteGuard>} />
        <Route path="/grades" element={<StudentRouteGuard><Grades /></StudentRouteGuard>} />
        <Route path="/announcements" element={<StudentRouteGuard><Announcements /></StudentRouteGuard>} />
        <Route path="/content" element={<StudentRouteGuard><StudentContent /></StudentRouteGuard>} />
        <Route path="/materials" element={<StudentRouteGuard><StudentMaterials /></StudentRouteGuard>} />
        <Route path="/enrollment" element={<StudentRouteGuard><StudentEnrollment /></StudentRouteGuard>} />
        <Route path="/messages" element={<StudentRouteGuard><Messages /></StudentRouteGuard>} />
        <Route path="/profile" element={<StudentRouteGuard><Profile /></StudentRouteGuard>} />
        <Route path="/ai-assistant" element={<StudentRouteGuard><StudentAIAssistant /></StudentRouteGuard>} />
        <Route path="/notifications" element={<StudentRouteGuard><NotificationsPage /></StudentRouteGuard>} />

        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={<TeacherRouteGuard><TeacherDashboard /></TeacherRouteGuard>} />
        <Route path="/teacher/classes" element={<TeacherRouteGuard><Classes /></TeacherRouteGuard>} />
        <Route path="/teacher/class/:id" element={<TeacherRouteGuard><ClassDetail /></TeacherRouteGuard>} />
        <Route path="/teacher/grades" element={<TeacherRouteGuard><GradesManagement /></TeacherRouteGuard>} />
        <Route path="/teacher/announcements" element={<TeacherRouteGuard><TeacherAnnouncements /></TeacherRouteGuard>} />
        <Route path="/teacher/materials" element={<TeacherRouteGuard><ClassMaterials /></TeacherRouteGuard>} />
        <Route path="/teacher/messages" element={<TeacherRouteGuard><TeacherMessages /></TeacherRouteGuard>} />
        <Route path="/teacher/notifications" element={<TeacherRouteGuard><Notifications /></TeacherRouteGuard>} />
        <Route path="/teacher/profile" element={<TeacherRouteGuard><TeacherProfile /></TeacherRouteGuard>} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminRouteGuard><AdminDashboard /></AdminRouteGuard>} />
        <Route path="/admin/students" element={<AdminRouteGuard><StudentManagement /></AdminRouteGuard>} />
        <Route path="/admin/teachers" element={<AdminRouteGuard><TeacherManagement /></AdminRouteGuard>} />
        <Route path="/admin/subjects" element={<AdminRouteGuard><SubjectManagement /></AdminRouteGuard>} />
        <Route path="/admin/enrollment" element={<AdminRouteGuard><EnrollmentManagement /></AdminRouteGuard>} />
        <Route path="/admin/announcements" element={<AdminRouteGuard><AdminAnnouncements /></AdminRouteGuard>} />
        <Route path="/admin/calendar" element={<AdminRouteGuard><AdminCalendar /></AdminRouteGuard>} />
        <Route path="/admin/reports" element={<AdminRouteGuard><Reports /></AdminRouteGuard>} />
        <Route path="/admin/settings" element={<AdminRouteGuard><SystemSettings /></AdminRouteGuard>} />
        <Route path="/admin/messages" element={<AdminRouteGuard><AdminMessages /></AdminRouteGuard>} />
        <Route path="/admin/ai-assistant" element={<AdminRouteGuard><AIAdminAssistant /></AdminRouteGuard>} />
        <Route path="/admin/notifications" element={<AdminRouteGuard><NotificationsPage /></AdminRouteGuard>} />

        {/* Teacher AI */}
        <Route path="/teacher/ai-assistant" element={<TeacherRouteGuard><AIAssistant /></TeacherRouteGuard>} />
      </Routes>
      </Router>
    </ActivityProvider>
  );
}
