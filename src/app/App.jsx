import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ActivityProvider } from "./lib/ActivityContext";
import { UnreadMessagesProvider } from "./contexts/UnreadMessagesContext";
import { AcademicProvider } from "./context/AcademicContext";
import { supabase } from "./lib/supabaseClient";
import { isStaticAdminUser } from "./lib/staticAdminAuth";
import { Toaster } from "sonner";
import { LandingPage } from "./pages/LandingPage";
import { SitePolicy } from "./pages/SitePolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { ContactUs } from "./pages/ContactUs";
import { Support } from "./pages/Support";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ChangePassword } from "./pages/ChangePassword";
import { ResetPassword } from "./pages/ResetPassword";
import { TeacherDashboard } from "./pages/teacher/TeacherDashboard";
import { Classes } from "./pages/teacher/Classes";
import { ClassDetail } from "./pages/teacher/ClassDetail";
import { GradesManagement } from "./pages/teacher/GradesManagement";
import { TeacherAnnouncements } from "./pages/teacher/TeacherAnnouncements";
import { ClassMaterials } from "./pages/teacher/ClassMaterials";
import { TeacherMessages } from "./pages/teacher/TeacherMessages";
import { TeacherProfile } from "./pages/teacher/TeacherProfile";
import { Notifications } from "./pages/teacher/Notifications";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { StudentManagement } from "./pages/admin/StudentManagement";
import { TeacherManagement } from "./pages/admin/TeacherManagement";
import { SubjectManagement } from "./pages/admin/SubjectManagement";
import { AdminAnnouncements } from "./pages/admin/AdminAnnouncements";
import { AdminCalendar } from "./pages/admin/AdminCalendar";
import AdminAcademicSettings from "./pages/admin/AdminAcademicSettings";

import { SystemSettings } from "./pages/admin/SystemSettings";
import { AdminPasswordResets } from "./pages/admin/AdminPasswordResets";
import { AdminMessages } from "./pages/admin/AdminMessages";
import { AIAssistant } from "./pages/teacher/AIAssistant";
import { TeacherHelpCenter } from "./pages/teacher/TeacherHelpCenter";
import { AdminNotifications } from "./pages/admin/AdminNotifications";
import { HelpCenter } from "./pages/admin/HelpCenter";
import { TourProvider } from "./context/TourContext";
import { WelcomeTourModal } from "./components/tour/WelcomeTourModal";
import { TourSpotlightOverlay } from "./components/tour/TourSpotlightOverlay";
import { ModuleTourProvider } from "./context/ModuleTourContext";
import { ModuleTourOverlay } from "./components/tour/ModuleTourOverlay";
import { ModuleTourFinishModal } from "./components/tour/ModuleTourFinishModal";
import { ResumeTourModal } from "./components/tour/ResumeTourModal";
import { TeacherTourProvider } from "./context/TeacherTourContext";
import { TeacherWelcomeModal } from "./components/tour/TeacherWelcomeModal";
import { TeacherTourSpotlightOverlay } from "./components/tour/TeacherTourSpotlightOverlay";
import { TourDemoModeBanner } from "./components/tour/TourDemoModeBanner";
import { Smartphone, Monitor, ShieldAlert } from "lucide-react";

const isMobileDevice = () => window.innerWidth < 1024;

function DeviceRestricted({ role, allowed }) {
  const Icon = allowed === "Desktop" ? Monitor : Smartphone;
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-gray-400 text-sm">
          The {role} Portal is optimized for {allowed} view. Please switch to a {allowed.toLowerCase()} device to continue.
        </p>
        <button
          onClick={() => {
            localStorage.removeItem("currentUser");
            window.location.href = "/login";
          }}
          className="mt-6 inline-block text-green-400 font-semibold hover:underline text-sm"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
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
        
        if (parsedUser?.must_change_password === true) {
          if (isMounted) setStatus("force-change");
          return;
        }

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
  if (status === "force-change") return <Navigate to="/change-password" replace />;
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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AcademicProvider>
    <ActivityProvider>
      <UnreadMessagesProvider>
      <TourProvider>
      <TeacherTourProvider>
      <ModuleTourProvider>
      <Router>
        <ScrollToTop />
        <Toaster position="top-right" richColors />
        <WelcomeTourModal />
        <TeacherWelcomeModal />
        <TourSpotlightOverlay />
        <TeacherTourSpotlightOverlay />
        <ModuleTourOverlay />
        <ModuleTourFinishModal />
        <ResumeTourModal />
        <TourDemoModeBanner />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/privacy-policy" element={<SitePolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/support" element={<Support />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/admin" element={<Navigate to="/login" replace />} />

        <Route path="/dashboard" element={<Navigate to="/login" replace />} />
        <Route path="/subjects" element={<Navigate to="/login" replace />} />
        <Route path="/subject/:id" element={<Navigate to="/login" replace />} />
        <Route path="/grades" element={<Navigate to="/login" replace />} />
        <Route path="/announcements" element={<Navigate to="/login" replace />} />
        <Route path="/content" element={<Navigate to="/login" replace />} />
        <Route path="/materials" element={<Navigate to="/login" replace />} />
        <Route path="/messages" element={<Navigate to="/login" replace />} />
        <Route path="/profile" element={<Navigate to="/login" replace />} />
        <Route path="/ai-assistant" element={<Navigate to="/login" replace />} />
        <Route path="/notifications" element={<Navigate to="/login" replace />} />

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
        <Route path="/teacher/help-center" element={<TeacherRouteGuard><TeacherHelpCenter /></TeacherRouteGuard>} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminRouteGuard><AdminDashboard /></AdminRouteGuard>} />
        <Route path="/admin/students" element={<AdminRouteGuard><StudentManagement /></AdminRouteGuard>} />
        <Route path="/admin/teachers" element={<AdminRouteGuard><TeacherManagement /></AdminRouteGuard>} />
        <Route path="/admin/subjects" element={<AdminRouteGuard><SubjectManagement /></AdminRouteGuard>} />
        <Route path="/admin/announcements" element={<AdminRouteGuard><AdminAnnouncements /></AdminRouteGuard>} />
        <Route path="/admin/calendar" element={<AdminRouteGuard><AdminCalendar /></AdminRouteGuard>} />
        <Route path="/admin/academic-settings" element={<AdminRouteGuard><AdminAcademicSettings /></AdminRouteGuard>} />

        <Route path="/admin/settings" element={<AdminRouteGuard><SystemSettings /></AdminRouteGuard>} />
        <Route path="/admin/password-resets" element={<AdminRouteGuard><AdminPasswordResets /></AdminRouteGuard>} />
        <Route path="/admin/messages" element={<AdminRouteGuard><AdminMessages /></AdminRouteGuard>} />
        <Route path="/admin/notifications" element={<AdminRouteGuard><AdminNotifications /></AdminRouteGuard>} />
        <Route path="/admin/help-center" element={<AdminRouteGuard><HelpCenter /></AdminRouteGuard>} />

        {/* Teacher AI */}
        <Route path="/teacher/ai-assistant" element={<TeacherRouteGuard><AIAssistant /></TeacherRouteGuard>} />
      </Routes>
      </Router>
      </ModuleTourProvider>
      </TeacherTourProvider>
      </TourProvider>
          </UnreadMessagesProvider>
    </ActivityProvider>
    </AcademicProvider>
  );
}
