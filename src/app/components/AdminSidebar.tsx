import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCog,
  BookOpen,
  ClipboardList,
  Megaphone, 
  FileText,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Shield
} from 'lucide-react';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';

interface AdminSidebarProps {
  adminName: string;
  onLogout: () => void;
}

export function AdminSidebar({ adminName, onLogout }: AdminSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Users, label: 'Student Management', path: '/admin/students' },
    { icon: UserCog, label: 'Teacher Management', path: '/admin/teachers' },
    { icon: BookOpen, label: 'Subject Management', path: '/admin/subjects' },
    { icon: ClipboardList, label: 'Enrollment Management', path: '/admin/enrollment' },
    { icon: Megaphone, label: 'Announcements', path: '/admin/announcements' },
    { icon: FileText, label: 'Reports', path: '/admin/reports' },
    { icon: Settings, label: 'System Settings', path: '/admin/settings' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40
          w-72 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col h-screen
        `}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-gradient-to-br from-emerald-600 to-emerald-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border-2 border-white/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">ConnectEd</h2>
              <p className="text-emerald-100 text-xs">Administrator Portal</p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
            <p className="text-white text-sm font-medium truncate">{adminName}</p>
            <p className="text-emerald-100 text-xs">System Administrator</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`cursor-pointer 
                    group flex items-center justify-between px-4 py-3 rounded-xl
                    transition-all duration-200
                    ${active
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md'
                      : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500 group-hover:text-emerald-600'}`} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {active && <ChevronRight className="w-4 h-4" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors group cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Dialog */}
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