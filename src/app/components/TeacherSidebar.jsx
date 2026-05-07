import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, GraduationCap, Calendar,
  MessageSquare, User, Menu, X, LogOut, ChevronRight, Video, Sparkles
} from "lucide-react";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { supabase } from "../lib/supabaseClient";

const getStoredCurrentUser = () => {
  try {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function TeacherSidebar({ teacherName, onLogout }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const storedCurrentUser = getStoredCurrentUser();
  const avatarUrl = String(storedCurrentUser?.avatarUrl || storedCurrentUser?.avatar_url || "").trim();

  const handleConfirmLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // Continue with local logout even if remote sign-out fails.
    } finally {
      setShowLogoutConfirm(false);
      setIsMobileOpen(false);
      onLogout?.();
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard",            path: "/teacher/dashboard" },
    { icon: BookOpen,        label: "Classes",              path: "/teacher/classes" },
    { icon: GraduationCap,  label: "Grades Management",    path: "/teacher/grades" },
    { icon: Calendar,        label: "Attendance",           path: "/teacher/attendance" },
    { icon: Video,           label: "Video Conference",     path: "/teacher/video-conference" },
    { icon: MessageSquare,   label: "Messages",             path: "/teacher/messages" },
    { icon: User,            label: "Profile",              path: "/teacher/profile" },
    { icon: Sparkles,        label: "AI Assistant",         path: "/teacher/ai-assistant", isNew: true },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-white text-gray-900 rounded-xl shadow-lg border border-gray-200"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 z-40 flex flex-col
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} w-72`}
      >
        {/* DepEd tri-color top bar */}
        <div className="flex h-1 flex-shrink-0">
          <div className="flex-1 bg-green-600" />
          <div className="flex-1 bg-blue-600" />
          <div className="flex-1 bg-red-600" />
        </div>

        {/* Logo Section */}
        <div className="px-5 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 mb-5">
            <div>
              <p className="text-gray-900 font-extrabold text-base tracking-tight leading-none">
                Connect<span className="text-green-600">Ed</span>
              </p>
              <p className="text-gray-500 text-[11px] mt-0.5">Teacher Portal</p>
            </div>
          </div>

          {/* User chip */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 bg-green-600 rounded-lg overflow-hidden flex items-center justify-center text-gray-900 font-bold text-sm flex-shrink-0 shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Teacher avatar" className="w-full h-full object-cover" />
              ) : (
                teacherName?.charAt(0)?.toUpperCase() || "T"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-sm font-semibold truncate">{teacherName}</p>
              <p className="text-green-700 text-[11px]">Teacher Account</p>
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 min-h-0">
          <p className="text-gray-600 text-[10px] font-semibold uppercase tracking-widest px-3 mb-3">Navigation</p>
          <div className="space-y-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer border
                    ${active
                      ? "bg-green-50 border-green-200 text-green-700 shadow-sm"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-colors ${active ? "bg-green-100/50" : "bg-gray-100 group-hover:bg-gray-200"}`}>
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${active ? "text-green-600" : "text-gray-500 group-hover:text-gray-900"}`} />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                    {item.isNew && (
                      <span className="ml-auto text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5 leading-none">
                        NEW
                      </span>
                    )}
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-green-600" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 flex-shrink-0">
          {/* DepEd color dots */}
          <div className="flex items-center justify-center gap-1 mb-3 opacity-40">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="group w-full flex items-center gap-3 px-3 py-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 cursor-pointer border border-transparent hover:border-red-100"
          >
            <div className="p-1.5 bg-gray-100 group-hover:bg-red-100 rounded-lg transition-colors">
              <LogOut className="w-4 h-4 group-hover:text-red-600" />
            </div>
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
      />
    </>
  );
}

export default TeacherSidebar;
