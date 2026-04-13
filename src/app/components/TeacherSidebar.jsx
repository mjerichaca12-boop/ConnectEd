import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, GraduationCap, Calendar,
  MessageSquare, User, Menu, X, LogOut, ChevronRight, Video
} from "lucide-react";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { supabase } from "../lib/supabaseClient";

export function TeacherSidebar({ teacherName, onLogout }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

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
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gray-900 text-white rounded-xl shadow-lg border border-white/10"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-gray-950 border-r border-white/8 transition-all duration-300 z-40 flex flex-col
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} w-72`}
      >
        {/* DepEd tri-color top bar */}
        <div className="flex h-1 flex-shrink-0">
          <div className="flex-1 bg-emerald-500" />
          <div className="flex-1 bg-blue-600" />
          <div className="flex-1 bg-red-600" />
        </div>

        {/* Logo Section */}
        <div className="px-5 py-5 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3 mb-5">
            <div>
              <p className="text-white font-extrabold text-base tracking-tight leading-none">
                Connect<span className="text-emerald-400">Ed</span>
              </p>
              <p className="text-gray-500 text-[11px] mt-0.5">Teacher Portal</p>
            </div>
          </div>

          {/* User chip */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {teacherName?.charAt(0)?.toUpperCase() || "T"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{teacherName}</p>
              <p className="text-emerald-400 text-[11px]">Teacher Account</p>
            </div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
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
                  className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer
                    ${active
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                      : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-colors ${active ? "bg-emerald-500/20" : "bg-white/5 group-hover:bg-white/10"}`}>
                      <Icon className={`w-4 h-4 ${active ? "text-emerald-400" : "text-gray-500 group-hover:text-white"}`} />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 flex-shrink-0">
          {/* DepEd color dots */}
          <div className="flex items-center justify-center gap-1 mb-3 opacity-40">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="group w-full flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 cursor-pointer border border-transparent hover:border-red-500/20"
          >
            <div className="p-1.5 bg-white/5 group-hover:bg-red-500/10 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
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
