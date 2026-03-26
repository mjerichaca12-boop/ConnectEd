import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { Download, TrendingUp, Users, BookOpen, Calendar } from "lucide-react";
function Reports() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [loading, setLoading] = useState(true);
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
  const handleGenerateReport = (name) => {
    const header = ["Report Name", "Generated At"];
    const row = [name, (/* @__PURE__ */ new Date()).toISOString()];
    const csv = [header, row].map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/\s+/g, "_").toLowerCase()}_report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const reportCategories = [];
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar adminName={adminName} onLogout={handleLogout} />
      <div className="hidden lg:block w-72 flex-shrink-0" />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {
    /* Top Bar */
  }
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
              <NotificationDropdown
    notifications={notificationList}
    onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))}
    onNotificationsChange={setNotificationList}
  />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {
    /* Header */
  }
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">System Reports</h1>
            <p className="text-emerald-50">Generate and download various system reports</p>
          </div>

          {
    /* Report Categories */
  }
          {reportCategories.map((category, idx) => {
    const Icon = category.icon;
    const colorClasses = {
      emerald: "bg-emerald-50 text-emerald-600",
      blue: "bg-blue-50 text-blue-600",
      red: "bg-red-50 text-red-600"
    };
    return <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${colorClasses[category.color]}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{category.title}</h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {category.reports.map((report, reportIdx) => <div key={reportIdx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 group-hover:text-emerald-700">{report.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                        </div>
                        <button
      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors ml-4"
      onClick={() => handleGenerateReport(report.name)}
    >
                          <Download className="w-4 h-4" />
                          Generate
                        </button>
                      </div>)}
                  </div>
                </div>
              </div>;
  })}
        </div>
      </main>
    </div>;
}
export {
  Reports
};
