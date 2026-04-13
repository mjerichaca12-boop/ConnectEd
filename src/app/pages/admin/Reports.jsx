import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { Download, TrendingUp, Users, BookOpen, Calendar } from "lucide-react";
function Reports() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay:'0ms'}} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'150ms'}} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{animationDelay:'300ms'}} />
          </div>
          <p className="text-gray-500">Loading reports...</p>
        </div>
      </div>
    );
  }
  return <div className="min-h-screen bg-gray-950 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />
      <div className="hidden lg:block w-72 flex-shrink-0" />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
        {
    /* Top Bar */
  }
        <div className="bg-gray-950/80 backdrop-blur-md border-b border-white/8 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-white">Reports</h2>
              </div>
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
          <div className="relative rounded-2xl p-8 text-white shadow-lg overflow-hidden bg-gray-900 border border-white/10">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-emerald-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4">
              <h1 className="text-3xl font-bold mb-2 text-emerald-400">System Reports</h1>
              <p className="text-gray-400">Generate and download various system reports</p>
            </div>
          </div>

          {
    /* Report Categories */
  }
          {reportCategories.map((category, idx) => {
    const Icon = category.icon;
    const colorClasses = {
      emerald: "bg-emerald-500/10 text-emerald-400",
      blue: "bg-blue-500/10 text-blue-400",
      red: "bg-red-500/10 text-red-400"
    };
    return <div key={idx} className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-black/20">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl border border-white/5 ${colorClasses[category.color]}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{category.title}</h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {category.reports.map((report, reportIdx) => <div key={reportIdx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-white/10 bg-white/5 rounded-xl hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-200 group-hover:text-emerald-400 transition-colors">{report.name}</h4>
                          <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                        </div>
                        <button
      className="flex flex-shrink-0 items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-medium shadow-lg shadow-emerald-500/20"
      onClick={() => handleGenerateReport(report.name)}
    >
                          <Download className="w-4 h-4" />
                          Generate Report
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
