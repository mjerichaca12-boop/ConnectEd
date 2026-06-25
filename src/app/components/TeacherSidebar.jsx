import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUnreadMessages } from "../contexts/UnreadMessagesContext";
import {
  LayoutDashboard, BookOpen, ClipboardList,
  MessageSquare, User, Menu, X, LogOut, ChevronRight, Sparkles
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
  const { unreadCount } = useUnreadMessages();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const storedCurrentUser = getStoredCurrentUser();
  const avatarUrl = String(storedCurrentUser?.avatarUrl || storedCurrentUser?.avatar_url || "").trim();

  const displayName = storedCurrentUser?.first_name && storedCurrentUser?.last_name
    ? `${storedCurrentUser.first_name} ${storedCurrentUser.last_name}`
    : teacherName || "Teacher";

  const handleConfirmLogout = async () => {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch {
      // Continue with local logout even if remote sign-out fails.
    } finally {
      setShowLogoutConfirm(false);
      setIsMobileOpen(false);
      onLogout?.();
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard",        path: "/teacher/dashboard" },
    { icon: BookOpen,        label: "Classes",           path: "/teacher/classes" },
    { icon: ClipboardList,   label: "Grades Management", path: "/teacher/grades" },
    { icon: MessageSquare,   label: "Messages",          path: "/teacher/messages" },
    { icon: User,            label: "Profile",           path: "/teacher/profile" },
    { icon: Sparkles,        label: "AI Assistant",      path: "/teacher/ai-assistant", badge: "NEW" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-white text-gray-700 rounded-xl shadow-md border border-gray-200"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200
          flex flex-col h-screen overflow-hidden
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* DepEd tri-color accent bar */}
        <div className="flex h-1 flex-shrink-0">
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-blue-500" />
          <div className="flex-1 bg-red-500" />
        </div>

        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="text-green-900 font-extrabold text-lg tracking-tight leading-none">
            Connect<span className="text-green-600">Ed</span>
          </p>
          <p className="text-gray-400 text-[11px] mt-0.5">Teacher Portal</p>
        </div>

        {/* User chip */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-green-900 text-sm font-semibold truncate">{displayName}</p>
              <p className="text-green-600 text-[11px]">Teacher Account</p>
            </div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
          </div>
        </div>

        {/* Nav label */}
        <div className="px-5 pt-3 pb-1 flex-shrink-0">
          <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest">Navigation</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 pb-2 flex flex-col gap-0.5 overflow-hidden">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-150 text-sm font-medium group
                  ${active
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-green-50 hover:text-green-700"
                  }`}
              >
                <div className={`p-1 rounded-lg flex-shrink-0
                  ${active ? "bg-white/20" : "bg-gray-100 group-hover:bg-green-100"}`}>
                  <Icon className={`w-4 h-4 ${active ? "text-white" : "text-gray-500 group-hover:text-green-600"}`} />
                </div>
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className={`ml-auto text-[10px] font-bold rounded-full px-2 py-0.5 leading-none flex-shrink-0
                    ${active ? "bg-white/20 text-white" : "bg-green-100 text-green-600"}`}>
                    {item.badge}
                  </span>
                )}
                {active && !item.badge && (
                  <ChevronRight className="w-3.5 h-3.5 text-white ml-auto flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* DepEd dots */}
        <div className="flex items-center justify-center gap-1 py-2 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 opacity-60" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-60" />
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 opacity-60" />
        </div>

        {/* Logout */}
        <div className="px-3 pb-4 flex-shrink-0 border-t border-gray-100 pt-2">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 text-sm font-medium group"
          >
            <div className="p-1 bg-gray-100 group-hover:bg-red-100 rounded-lg transition-colors flex-shrink-0">
              <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
            </div>
            <span>Logout</span>
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
