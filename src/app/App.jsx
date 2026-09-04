import React, { useEffect, useState, lazy, Suspense, Component } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ActivityProvider } from "./lib/ActivityContext";
import { UnreadMessagesProvider } from "./contexts/UnreadMessagesContext";
import { AcademicProvider } from "./context/AcademicContext";
import { supabase } from "./lib/supabaseClient";
import { isStaticAdminUser } from "./lib/staticAdminAuth";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";

const handleChunkError = () => {
  if (typeof window === "undefined") return;
  const lastReload = Number(sessionStorage.getItem("chunk_reload_time") || 0);
  const now = Date.now();
  if (now - lastReload > 3000) {
    sessionStorage.setItem("chunk_reload_time", String(now));
    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.set("_v", String(now));
    window.location.replace(targetUrl.toString());
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const msg = String(reason?.message || reason || "");
    if (
      /failed to fetch dynamically imported module/i.test(msg) ||
      /expected a javascript-or-wasm module script/i.test(msg) ||
      /importing a module script failed/i.test(msg)
    ) {
      event.preventDefault();
      handleChunkError();
    }
  });

  window.addEventListener("error", (event) => {
    const msg = String(event?.message || "");
    if (
      /failed to load module script/i.test(msg) ||
      /expected a javascript-or-wasm module script/i.test(msg) ||
      /failed to fetch dynamically imported module/i.test(msg)
    ) {
      handleChunkError();
    }
  }, true);
}

const safeLazy = (importFn) => {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      try {
        await new Promise((r) => setTimeout(r, 150));
        return await importFn();
      } catch (retryError) {
        const msg = String(retryError?.message || retryError || error?.message || "");
        const isChunkError =
          retryError?.name === "ChunkLoadError" ||
          /failed to fetch dynamically imported module/i.test(msg) ||
          /expected a javascript-or-wasm module script/i.test(msg) ||
          /importing a module script failed/i.test(msg);

        if (isChunkError) {
          handleChunkError();
          return new Promise(() => {});
        }
        throw retryError;
      }
    }
  });
};

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error) {
    const msg = String(error?.message || error || "");
    if (
      /failed to fetch dynamically imported module/i.test(msg) ||
      /expected a javascript-or-wasm module script/i.test(msg) ||
      /importing a module script failed/i.test(msg)
    ) {
      handleChunkError();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-xl">
              ↻
            </div>
            <h2 className="text-xl font-bold text-gray-900">App Update Available</h2>
            <p className="text-sm text-gray-600">
              A new version of ConnectEd has been published. Click below to load the latest changes.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem("chunk_reload_time");
                window.location.replace(window.location.pathname + "?_v=" + Date.now());
              }}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-sm"
            >
              Refresh & Update
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Route-level Code Splitting for Performance
const LandingPage = safeLazy(() => import("./pages/LandingPage").then(m => ({ default: m.LandingPage })));
const SitePolicy = safeLazy(() => import("./pages/SitePolicy").then(m => ({ default: m.SitePolicy })));
const TermsOfService = safeLazy(() => import("./pages/TermsOfService").then(m => ({ default: m.TermsOfService })));
const ContactUs = safeLazy(() => import("./pages/ContactUs").then(m => ({ default: m.ContactUs })));
const Support = safeLazy(() => import("./pages/Support").then(m => ({ default: m.Support })));
const Login = safeLazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const ForgotPassword = safeLazy(() => import("./pages/ForgotPassword").then(m => ({ default: m.ForgotPassword })));
const ChangePassword = safeLazy(() => import("./pages/ChangePassword").then(m => ({ default: m.ChangePassword })));
const ResetPassword = safeLazy(() => import("./pages/ResetPassword").then(m => ({ default: m.ResetPassword })));
const NotificationsPage = safeLazy(() => import("./pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));

// Teacher Pages
const TeacherDashboard = safeLazy(() => import("./pages/teacher/TeacherDashboard").then(m => ({ default: m.TeacherDashboard })));
const Classes = safeLazy(() => import("./pages/teacher/Classes").then(m => ({ default: m.Classes })));
const ClassDetail = safeLazy(() => import("./pages/teacher/ClassDetail").then(m => ({ default: m.ClassDetail })));
const GradesManagement = safeLazy(() => import("./pages/teacher/GradesManagement").then(m => ({ default: m.GradesManagement })));
const TeacherAnnouncements = safeLazy(() => import("./pages/teacher/TeacherAnnouncements").then(m => ({ default: m.TeacherAnnouncements })));
const ClassMaterials = safeLazy(() => import("./pages/teacher/ClassMaterials").then(m => ({ default: m.ClassMaterials })));
const TeacherMessages = safeLazy(() => import("./pages/teacher/TeacherMessages").then(m => ({ default: m.TeacherMessages })));
const TeacherProfile = safeLazy(() => import("./pages/teacher/TeacherProfile").then(m => ({ default: m.TeacherProfile })));
const Notifications = safeLazy(() => import("./pages/teacher/Notifications").then(m => ({ default: m.Notifications })));
const AIAssistant = safeLazy(() => import("./pages/teacher/AIAssistant").then(m => ({ default: m.AIAssistant })));
const TeacherHelpCenter = safeLazy(() => import("./pages/teacher/TeacherHelpCenter").then(m => ({ default: m.TeacherHelpCenter })));

// Admin Pages
const AdminDashboard = safeLazy(() => import("./pages/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const StudentManagement = safeLazy(() => import("./pages/admin/StudentManagement").then(m => ({ default: m.StudentManagement })));
const TeacherManagement = safeLazy(() => import("./pages/admin/TeacherManagement").then(m => ({ default: m.TeacherManagement })));
const SubjectManagement = safeLazy(() => import("./pages/admin/SubjectManagement").then(m => ({ default: m.SubjectManagement })));
const AdminAnnouncements = safeLazy(() => import("./pages/admin/AdminAnnouncements").then(m => ({ default: m.AdminAnnouncements })));
const AdminCalendar = safeLazy(() => import("./pages/admin/AdminCalendar").then(m => ({ default: m.AdminCalendar })));
const AdminAcademicSettings = safeLazy(() => import("./pages/admin/AdminAcademicSettings"));
const SystemSettings = safeLazy(() => import("./pages/admin/SystemSettings").then(m => ({ default: m.SystemSettings })));
const AdminPasswordResets = safeLazy(() => import("./pages/admin/AdminPasswordResets").then(m => ({ default: m.AdminPasswordResets })));
const AdminMessages = safeLazy(() => import("./pages/admin/AdminMessages").then(m => ({ default: m.AdminMessages })));
const AdminNotifications = safeLazy(() => import("./pages/admin/AdminNotifications").then(m => ({ default: m.AdminNotifications })));
const HelpCenter = safeLazy(() => import("./pages/admin/HelpCenter").then(m => ({ default: m.HelpCenter })));

const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Loading...</p>
    </div>
  </div>
);
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
    try {
      const rawUser = localStorage.getItem("currentUser");
      if (!rawUser) {
        setStatus("denied");
        return;
      }

      const parsedUser = JSON.parse(rawUser);
      const email = String(parsedUser?.email || "").trim().toLowerCase();

      if (parsedUser?.must_change_password === true) {
        setStatus("force-change");
        return;
      }

      if (parsedUser?.role !== "teacher" || !email) {
        setStatus("denied");
        return;
      }

      setStatus("allowed");
    } catch {
      setStatus("denied");
    }
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Checking access...</p>
      </div>
    );
  }

  if (status === "force-change") return <Navigate to="/change-password" replace />;
  if (status === "denied") return <Navigate to="/login" replace />;

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
      if (parsedUser?.role !== "admin") {
        setStatus("denied");
        return;
      }

      setStatus("allowed");
    } catch {
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

import { DataCacheProvider } from "./context/DataCacheContext";

export default function App() {
  return (
    <DataCacheProvider>
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
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
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
            <Route path="/notifications" element={<NotificationsPage />} />

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
        </Suspense>
      </ChunkErrorBoundary>
      </Router>
      </ModuleTourProvider>
      </TeacherTourProvider>
      </TourProvider>
          </UnreadMessagesProvider>
    </ActivityProvider>
    </AcademicProvider>
    </DataCacheProvider>
  );
}
