import { useUnreadMessages } from "../contexts/UnreadMessagesContext";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, UserCog, BookOpen,
  Megaphone, Menu, X, LogOut, ChevronRight,
  Calendar, MessageSquare, Settings, HelpCircle
} from "lucide-react";
import { ConfirmDialog } from "@/app/components/ui/ConfirmDialog";

export function AdminSidebar({ adminName, onLogout }) {
  const { unreadCount } = useUnreadMessages();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard",          path: "/admin/dashboard",         tourId: "nav-dashboard" },
    { icon: Users,           label: "Student Management", path: "/admin/students",          tourId: "nav-students" },
    { icon: UserCog,         label: "Teacher Management", path: "/admin/teachers",          tourId: "nav-teachers" },
    { icon: BookOpen,        label: "Subject Management", path: "/admin/subjects",          tourId: "nav-subjects" },
    { icon: Megaphone,       label: "Announcements",      path: "/admin/announcements",      tourId: "nav-announcements" },
    { icon: MessageSquare,   label: "Messages",           path: "/admin/messages",          tourId: "nav-messages" },
    { icon: Calendar,        label: "School Calendar",    path: "/admin/calendar",          tourId: "nav-calendar" },
    { icon: Settings,        label: "Academic Settings",  path: "/admin/academic-settings",  tourId: "nav-academic-settings" },
    { icon: HelpCircle,      label: "Help Center",        path: "/admin/help-center",       tourId: "nav-help-center" },
  ];

  const isActive = (path) => location.pathname === path;
  const displayName = adminName || "Administrator";

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
        data-tour="sidebar"
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
          <p className="text-gray-900 font-extrabold text-lg tracking-tight leading-none">
            Connect<span className="text-green-600">Ed</span>
          </p>
          <p className="text-gray-400 text-[11px] mt-0.5">Administrator Portal</p>
        </div>

        {/* User chip */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-sm font-semibold truncate">{displayName}</p>
              <p className="text-green-600 text-[11px]">System Administrator</p>
            </div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
          </div>
        </div>

        {/* Nav label */}
        <div className="px-5 pt-3 pb-1 flex-shrink-0">
          <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest">Management</p>
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
                data-tour={item.tourId}
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
                  <span className={`ml-auto text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none flex-shrink-0
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
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors duration-150 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={onLogout}
        title="Confirm Logout"
        description="Are you sure you want to log out of your administrator account? Any unsaved work may be lost."
        confirmText="Log Out"
        cancelText="Cancel"
      />
    </>
  );
}
