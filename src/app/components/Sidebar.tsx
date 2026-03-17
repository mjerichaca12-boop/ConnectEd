import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  GraduationCap, 
  Calendar, 
  Video,
  Megaphone, 
  MessageSquare, 
  User,
  Menu,
  X,
  LogOut,
  ChevronRight,
  FolderOpen,
  FileCheck
} from 'lucide-react';

interface SidebarProps {
  studentName: string;
  onLogout: () => void;
}

export function Sidebar({ studentName, onLogout }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: BookOpen, label: 'Subjects', path: '/subjects' },
    { icon: GraduationCap, label: 'Grades', path: '/grades' },
    { icon: Calendar, label: 'Attendance', path: '/attendance' },
    { icon: Video, label: 'Video Conference', path: '/video-conference' },
    { icon: Megaphone, label: 'Announcements', path: '/announcements' },
    { icon: FolderOpen, label: 'Materials', path: '/materials' },
    { icon: FileCheck, label: 'Enrollment', path: '/enrollment' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogoutClick = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
    }
  };

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
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-white shadow-xl lg:shadow-none border-r border-gray-100 transition-all duration-300 z-40 flex flex-col
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          w-72`}
      >
        {/* Logo Section */}
        <div className="px-6 py-4 bg-gradient-to-br from-emerald-600 to-emerald-700 relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-8 -translate-x-4"></div>
          <div className="relative">
            <h1 className="text-xl font-bold text-white mb-0.5">ConnectEd</h1>
            <p className="text-emerald-100 text-xs font-medium">Student Portal</p>
          </div>
        </div>

        {/* Student Info Card */}
        <div className="px-4 py-3 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md">
                {studentName.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate text-sm">{studentName}</p>
              <p className="text-xs text-emerald-600 font-medium">Student Account</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3">
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
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/30' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-emerald-600'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      active ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-emerald-50'
                    }`}>
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-600 group-hover:text-emerald-600'}`} />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-white" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout Section */}
        <div className="px-3 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <button
            onClick={handleLogoutClick}
            className="group w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 cursor-pointer"
          >
            <div className="p-1.5 bg-red-50 group-hover:bg-red-100 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}