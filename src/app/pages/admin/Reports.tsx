import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from '@/app/components/AdminSidebar';
import { Bell, FileText, Download, TrendingUp, Users, BookOpen, Calendar } from 'lucide-react';

export function Reports() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [notifications, setNotifications] = useState(8);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');
    const schoolData = localStorage.getItem('selectedSchool');
    if (!userData) { navigate('/school-selection'); return; }
    const user = JSON.parse(userData);
    if (user.role !== 'admin') { navigate('/school-selection'); return; }
    setAdminName(user.name);
    if (schoolData) { setSchoolName(JSON.parse(schoolData).name); }
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/school-selection');
  };

  const reportCategories = [
    {
      title: 'Academic Performance Reports',
      icon: TrendingUp,
      color: 'emerald',
      reports: [
        { name: 'Student Grade Summary', description: 'Overview of student grades by subject' },
        { name: 'Class Performance Report', description: 'Average grades per class and section' },
        { name: 'Honor Roll Report', description: 'Students with outstanding academic performance' },
      ]
    },
    {
      title: 'Attendance Reports',
      icon: Calendar,
      color: 'blue',
      reports: [
        { name: 'Student Attendance Summary', description: 'Individual student attendance records' },
        { name: 'Class Attendance Report', description: 'Attendance statistics by class' },
        { name: 'Monthly Attendance Trends', description: 'Attendance patterns and trends' },
      ]
    },
    {
      title: 'Enrollment Reports',
      icon: Users,
      color: 'blue',
      reports: [
        { name: 'Enrollment Statistics', description: 'Overall enrollment numbers and trends' },
        { name: 'Subject Enrollment Report', description: 'Student distribution across subjects' },
        { name: 'Enrollment History', description: 'Historical enrollment data' },
      ]
    },
    {
      title: 'Subject & Teacher Reports',
      icon: BookOpen,
      color: 'emerald',
      reports: [
        { name: 'Subject Load Report', description: 'Teacher workload and subject assignments' },
        { name: 'Teacher Performance Summary', description: 'Overview of teacher metrics' },
        { name: 'Subject Capacity Report', description: 'Subject enrollment vs capacity' },
      ]
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar lg:ml-72">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
                <p className="text-sm text-gray-600">{schoolName}</p>
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
                {notifications > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{notifications}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">System Reports</h1>
            <p className="text-emerald-50">Generate and download various system reports</p>
          </div>

          {reportCategories.map((category, idx) => {
            const Icon = category.icon;
            const colorClasses = {
              emerald: 'bg-emerald-50 text-emerald-600',
              blue: 'bg-blue-50 text-blue-600',
              red: 'bg-red-50 text-red-600'
            };

            return (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${colorClasses[category.color as keyof typeof colorClasses]}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{category.title}</h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {category.reports.map((report, reportIdx) => (
                      <div key={reportIdx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 group-hover:text-emerald-700">{report.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors ml-4">
                          <Download className="w-4 h-4" />
                          Generate
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}