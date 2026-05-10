import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { CustomSelect } from "@/app/components/admin/CustomSelect";
import { Bell, Calendar, Shield, Database, Globe, Save, Snowflake, Sun } from "lucide-react";
function SystemSettings() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notifications, setNotifications] = useState(0);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-bounce" style={{animationDelay:'0ms'}} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'150ms'}} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{animationDelay:'300ms'}} />
          </div>
          <p className="text-gray-500">Loading system settings...</p>
        </div>
      </div>
    );
  }
  return <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10 lg:pl-64">
        <div className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-gray-900">System Settings</h2>
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors border border-transparent hover:border-gray-200">
                <Bell className="w-6 h-6 text-gray-600 hover:text-green-600 transition-colors" />
                
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="relative rounded-2xl p-8 text-gray-900 shadow-lg overflow-hidden bg-white border border-gray-200">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4">
              <h1 className="text-3xl font-bold mb-2 text-green-600">System Settings</h1>
              <p className="text-gray-600">Configure system-wide settings and preferences</p>
            </div>
          </div>

          {
    /* Academic Year Settings */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Academic Year Settings</h3>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Academic Year</label>
                <input
    type="text"
    value={settings.academicYear}
    onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
    className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500/50"
  />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Current Semester</label>
                <CustomSelect
    value={settings.currentSemester}
    onChange={(value) => setSettings({ ...settings, currentSemester: value })}
    options={[
      {
        value: "First Semester",
        label: "First Semester",
        icon: <Snowflake className="w-5 h-5 text-blue-400" />
      },
      {
        value: "Second Semester",
        label: "Second Semester",
        icon: <Sun className="w-5 h-5 text-blue-400" />
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <Database className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Enrollment Settings</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-gray-200 bg-gray-50 rounded-xl gap-4">
                <div>
                  <p className="font-semibold text-gray-900">Enrollment Open</p>
                  <p className="text-sm text-gray-500 mt-1">Allow students to enroll in subjects</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.enrollmentOpen}
    onChange={(e) => setSettings({ ...settings, enrollmentOpen: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500 border border-gray-200" />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-gray-200 bg-gray-50 rounded-xl gap-4">
                <div>
                  <p className="font-semibold text-gray-900">Allow Self-Enrollment</p>
                  <p className="text-sm text-gray-500 mt-1">Students can enroll without admin approval</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.allowSelfEnrollment}
    onChange={(e) => setSettings({ ...settings, allowSelfEnrollment: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500 border border-gray-200" />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-gray-200 bg-gray-50 rounded-xl gap-4">
                <div>
                  <p className="font-semibold text-gray-900">Require Enrollment Approval</p>
                  <p className="text-sm text-gray-500 mt-1">Admin must approve enrollment requests</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.requireApproval}
    onChange={(e) => setSettings({ ...settings, requireApproval: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500 border border-gray-200" />
                </label>
              </div>
            </div>
          </div>

          {
    /* System Status */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <Shield className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-gray-200 bg-gray-50 rounded-xl gap-4">
                <div>
                  <p className="font-semibold text-gray-900">Maintenance Mode</p>
                  <p className="text-sm text-gray-500 mt-1">Temporarily disable system access</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.systemMaintenance}
    onChange={(e) => setSettings({ ...settings, systemMaintenance: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500 border border-gray-200" />
                </label>
              </div>

              <div className="p-5 bg-green-500/5 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Globe className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-600">System Status: Online</p>
                    <p className="text-sm text-green-600/70 mt-0.5">All systems operational</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {
    /* Save Button */
  }
          <div className="flex justify-end pt-4">
            <button
    onClick={handleSaveSettings}
    className="flex items-center gap-2 px-8 py-3.5 bg-green-600 text-gray-900 font-semibold rounded-xl hover:bg-green-500 transition-colors shadow-lg shadow-green-500/20"
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
