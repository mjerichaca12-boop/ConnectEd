import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import {
  LayoutDashboard, BookOpen, GraduationCap, Calendar,
  Video, MessageSquare, User, Menu, X, LogOut, ChevronRight, Shield, Sparkles
} from "lucide-react";

function Sidebar({ studentName, onLogout }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard",        path: "/dashboard",        color: "blue" },
    { icon: Sparkles,        label: "AI Assistant",     path: "/ai-assistant",     color: "green" },
    { icon: BookOpen,        label: "Subjects",         path: "/subjects",         color: "green" },
    { icon: GraduationCap,   label: "Grades",           path: "/grades",           color: "green" },
    { icon: Calendar,        label: "Attendance",       path: "/attendance",       color: "blue" },
    { icon: Video,           label: "Video Conference", path: "/video-conference", color: "blue" },
    { icon: MessageSquare,   label: "Messages",         path: "/messages",         color: "green" },
    { icon: User,            label: "Profile",          path: "/profile",          color: "blue" },
  ];

  const isActive = (path) => location.pathname === path;

  const activeColor = {
    green: "text-green-600 bg-green-500/15 border-green-300",
    blue: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  };
  const activeIcon = {
    green: "text-green-600",
    blue: "text-blue-400",
  };

  const handleLogoutClick = () => setShowLogoutConfirm(true);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-white text-gray-900 rounded-xl shadow-lg border border-gray-200"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity duration-300" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-gray-50 border-r border-gray-200 transition-all duration-300 z-40 flex flex-col
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} w-72`}
      >
        {/* DepEd tri-color top bar */}
        <div className="flex h-1 flex-shrink-0">
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-blue-600" />
          <div className="flex-1 bg-red-600" />
        </div>

        {/* Logo Section */}
        <div className="px-5 py-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 mb-5">
            <div>
              <p className="text-gray-900 font-extrabold text-base tracking-tight leading-none">
                Connect<span className="text-green-600">Ed</span>
              </p>
              <p className="text-gray-500 text-[11px] mt-0.5">Student Mobile/Web App</p>
            </div>
          </div>

          {/* Student Info Card */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-gray-900 font-bold text-sm flex-shrink-0">
              {studentName?.charAt(0)?.toUpperCase() || "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate text-sm">{studentName}</p>
              <p className="text-xs text-blue-400 font-medium">Student</p>
            </div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 min-h-0">
          <p className="text-gray-600 text-[10px] font-semibold uppercase tracking-widest px-3 mb-3">Activities</p>
          <div className="space-y-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const ac = activeColor[item.color];
              const ai = activeIcon[item.color];
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border cursor-pointer
                    ${active ? ac : "text-gray-600 hover:bg-gray-50 border-transparent hover:text-gray-900"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-colors ${active ? "bg-gray-100" : "bg-gray-50 group-hover:bg-gray-100"}`}>
                      <Icon className={`w-4 h-4 ${active ? ai : "text-gray-500 group-hover:text-gray-900"}`} />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {active && <ChevronRight className={`w-3.5 h-3.5 ${ai}`} />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout Section */}
        <div className="px-3 py-3 flex-shrink-0">
          <div className="flex items-center justify-center gap-1 mb-3 opacity-40">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
          <button
            onClick={handleLogoutClick}
            className="group w-full flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all duration-200 cursor-pointer border border-transparent hover:border-red-200"
          >
            <div className="p-1.5 bg-gray-50 group-hover:bg-red-50 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={onLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
      />
    </>
  );
}

export { Sidebar };
