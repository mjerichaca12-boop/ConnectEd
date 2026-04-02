import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import { CustomSelect } from "@/app/components/admin/CustomSelect";
import {
  Bell,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Download,
  FileText
} from "lucide-react";
function Attendance() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("2026-01");
  const [attendanceRecords] = useState([]);
  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "student") {
      navigate("/login");
      return;
    }
    setStudentName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };
  const totalClasses = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((r) => r.status === "Present").length;
  const absentCount = attendanceRecords.filter((r) => r.status === "Absent").length;
  const lateCount = attendanceRecords.filter((r) => r.status === "Late").length;
  const attendanceRate = totalClasses > 0 ? Math.round(presentCount / totalClasses * 100) : 0;
  const getStatusIcon = (status) => {
    switch (status) {
      case "Present":
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case "Absent":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "Late":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };
  const getStatusColor = (status) => {
    switch (status) {
      case "Present":
        return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "Absent":
        return "text-red-600 bg-red-50 border-red-200";
      case "Late":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };
  const filteredRecords = attendanceRecords.filter((record) => {
    const matchesFilter = selectedFilter === "all" || record.status.toLowerCase() === selectedFilter;
    const matchesMonth = record.date.startsWith(selectedMonth);
    return matchesFilter && matchesMonth;
  });
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading attendance...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {
    /* Top Bar */
  }
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Attendance</h2>
              </div>
              <div className="flex items-center gap-4">
                <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Bell className="w-6 h-6 text-gray-600" />
                  
                </button>
              </div>
            </div>
          </div>
        </div>

        {
    /* Content */
  }
        <div className="p-6 space-y-6">
          {
    /* Header Section */
  }
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Attendance Record</h1>
            <p className="text-emerald-50">1st Quarter 2026 â€¢ Track your class attendance</p>
          </div>

          {
    /* Summary Cards */
  }
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Total Classes</p>
              <p className="text-3xl font-bold text-gray-900">{totalClasses}</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Present</p>
              <p className="text-3xl font-bold text-emerald-600">{presentCount}</p>
              <p className="text-emerald-600 text-sm mt-2">{attendanceRate}% rate</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Absent</p>
              <p className="text-3xl font-bold text-red-600">{absentCount}</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-50 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">Late</p>
              <p className="text-3xl font-bold text-red-600">{lateCount}</p>
            </div>
          </div>

          {
    /* Filters */
  }
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-56">
                <CustomSelect
    value={selectedFilter}
    onChange={setSelectedFilter}
    options={[
      { value: "all", label: "All Status", icon: <FileText className="w-5 h-5 text-gray-500" /> },
      { value: "present", label: "Present", icon: <CheckCircle className="w-5 h-5 text-emerald-500" /> },
      { value: "absent", label: "Absent", icon: <XCircle className="w-5 h-5 text-red-500" /> },
      { value: "late", label: "Late", icon: <AlertCircle className="w-5 h-5 text-red-500" /> }
    ]}
    icon={<Filter className="w-5 h-5" />}
    placeholder="Filter by status"
  />
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <input
    type="month"
    value={selectedMonth}
    onChange={(e) => setSelectedMonth(e.target.value)}
    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
  />
              </div>
            </div>

            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md">
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>

          {
    /* Attendance Table */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time In</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map((record) => <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(record.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{record.subjectName}</p>
                          <p className="text-xs text-gray-500">{record.subjectCode}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(record.status)}`}>
                          {getStatusIcon(record.status)}
                          <span className="text-sm font-medium">{record.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.timeIn || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.remarks || "-"}
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>

            {
    /* Empty State */
  }
            {filteredRecords.length === 0 && <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No records found</h3>
                <p className="text-gray-600">Try adjusting your filters</p>
              </div>}
          </div>
        </div>
      </main>
    </div>;
}
export {
  Attendance
};
