import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, UserCog, BookOpen, ClipboardList,
  Megaphone, FileText, Settings, Menu, X, LogOut, ChevronRight,

  Shield, Calendar, MessageSquare

} from "lucide-react";
import { ConfirmDialog } from "@/app/components/ui/ConfirmDialog";

function AdminSidebar({ adminName, onLogout }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard",            path: "/admin/dashboard",   color: "emerald" },
    { icon: Users,           label: "Student Management",   path: "/admin/students",    color: "blue" },
    { icon: UserCog,         label: "Teacher Management",   path: "/admin/teachers",    color: "emerald" },
    { icon: Mail,            label: "Access Requests",      path: "/admin/access-requests", color: "yellow" },
    { icon: BookOpen,        label: "Subject Management",   path: "/admin/subjects",    color: "blue" },
    { icon: Megaphone,       label: "Announcements",        path: "/admin/announcements", color: "red" },
    { icon: MessageSquare,   label: "Messages",             path: "/admin/messages",    color: "blue" },
    { icon: Calendar,        label: "School Calendar",      path: "/admin/calendar",    color: "emerald" },
    { icon: FileText,        label: "Reports",              path: "/admin/reports",     color: "red" },
    { icon: Settings,        label: "System Settings",      path: "/admin/settings",    color: "blue" },
  ];

  const isActive = (path) => location.pathname === path;

  /* Icon color per item when active */
  const activeColor = {
    emerald: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30 bg-left-panel-emerald",
    blue: "text-blue-400 bg-blue-500/20 border-blue-500/30",
    red: "text-red-400 bg-red-500/20 border-red-500/30",
    yellow: "text-yellow-400 bg-yellow-500/20 border-yellow-500/30",
  };
  const activeIcon = {
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
  };

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gray-900 text-white rounded-xl shadow-lg border border-white/10"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-gray-950 border-r border-white/8
          transform transition-transform duration-300 ease-in-out flex flex-col h-screen
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* DepEd tri-color top bar */}
        <div className="flex h-1 flex-shrink-0">
          <div className="flex-1 bg-emerald-500" />
          <div className="flex-1 bg-blue-600" />
          <div className="flex-1 bg-red-600" />
        </div>

        {/* Header */}
        <div className="px-5 py-5 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3 mb-5">
            <div>
              <p className="text-white font-extrabold text-base tracking-tight leading-none">
                Connect<span className="text-emerald-400">Ed</span>
              </p>
              <p className="text-gray-500 text-[11px] mt-0.5">Administrator Portal</p>
            </div>
          </div>

          {/* Admin chip */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{adminName}</p>
              <p className="text-blue-400 text-[11px]">System Administrator</p>
            </div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 min-h-0">
          <p className="text-gray-600 text-[10px] font-semibold uppercase tracking-widest px-3 mb-3">Management</p>
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
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer border
                    ${active
                      ? `${ac} text-white`
                      : "text-gray-400 hover:bg-white/5 hover:text-white border-transparent"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-colors ${active ? "bg-white/10" : "bg-white/5 group-hover:bg-white/10"}`}>
                      <Icon className={`w-4 h-4 ${active ? ai : "text-gray-500 group-hover:text-white"}`} />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {active && <ChevronRight className={`w-3.5 h-3.5 ${ai}`} />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 p-3">
          <div className="flex items-center justify-center gap-1 mb-3 opacity-40">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="group w-full flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 cursor-pointer"
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
        onConfirm={onLogout}
        title="Logout Confirmation"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
      />
    </>
  );
}

export { AdminSidebar };
