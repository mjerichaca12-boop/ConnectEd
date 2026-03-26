import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { CustomSelect } from "@/app/components/admin/CustomSelect";
import { Bell, Calendar, Shield, Database, Globe, Save, Snowflake, Sun } from "lucide-react";
function SystemSettings() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notifications, setNotifications] = useState(8);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    academicYear: "2025-2026",
    currentSemester: "First Semester",
    enrollmentOpen: true,
    systemMaintenance: false,
    allowSelfEnrollment: true,
    requireApproval: true
  });
  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "admin") {
      navigate("/login");
      return;
    }
    setAdminName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };
  const handleSaveSettings = () => {
    alert("Settings saved successfully!");
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading system settings...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar lg:ml-72">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">System Settings</h2>
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
                {notifications > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{notifications}</span>}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">System Settings</h1>
            <p className="text-emerald-50">Configure system-wide settings and preferences</p>
          </div>

          {
    /* Academic Year Settings */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Academic Year Settings</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                <input
    type="text"
    value={settings.academicYear}
    onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
  />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Semester</label>
                <CustomSelect
    value={settings.currentSemester}
    onChange={(value) => setSettings({ ...settings, currentSemester: value })}
    options={[
      {
        value: "First Semester",
        label: "First Semester",
        icon: <Snowflake className="w-5 h-5 text-blue-500" />
      },
      {
        value: "Second Semester",
        label: "Second Semester",
        icon: <Sun className="w-5 h-5 text-blue-500" />
      }
    ]}
    icon={<Calendar className="w-5 h-5" />}
    placeholder="Select semester"
  />
              </div>
            </div>
          </div>

          {
    /* Enrollment Settings */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Database className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Enrollment Settings</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Enrollment Open</p>
                  <p className="text-sm text-gray-600">Allow students to enroll in subjects</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.enrollmentOpen}
    onChange={(e) => setSettings({ ...settings, enrollmentOpen: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Allow Self-Enrollment</p>
                  <p className="text-sm text-gray-600">Students can enroll without admin approval</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.allowSelfEnrollment}
    onChange={(e) => setSettings({ ...settings, allowSelfEnrollment: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Require Enrollment Approval</p>
                  <p className="text-sm text-gray-600">Admin must approve enrollment requests</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.requireApproval}
    onChange={(e) => setSettings({ ...settings, requireApproval: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>
            </div>
          </div>

          {
    /* System Status */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-50 rounded-lg">
                  <Shield className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Maintenance Mode</p>
                  <p className="text-sm text-gray-600">Temporarily disable system access</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.systemMaintenance}
    onChange={(e) => setSettings({ ...settings, systemMaintenance: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" />
                </label>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-600" />
                  <p className="font-medium text-emerald-700">System Status: Online</p>
                </div>
                <p className="text-sm text-emerald-600 mt-1">All systems operational</p>
              </div>
            </div>
          </div>

          {
    /* Save Button */
  }
          <div className="flex justify-end">
            <button
    onClick={handleSaveSettings}
    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-md hover:shadow-lg"
  >
              <Save className="w-5 h-5" />
              Save All Settings
            </button>
          </div>
        </div>
      </main>
    </div>;
}
export {
  SystemSettings
};
