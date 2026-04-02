import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { CustomDropdown } from "../../components/admin/CustomDropdown";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { Search, Filter, UserPlus, CheckCircle, XCircle, Clock, Download, X } from "lucide-react";
function EnrollmentManagement() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [formData, setFormData] = useState({ studentId: "", subjectCode: "" });
  const [notificationList, setNotificationList] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const availableStudents = [];
  const availableSubjects = [];
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
  const handleEnrollStudent = () => {
    if (!formData.studentId || !formData.subjectCode) {
      alert("Please select both student and subject");
      return;
    }
    const student = availableStudents.find((s) => s.id === formData.studentId);
    const subject = availableSubjects.find((s) => s.code === formData.subjectCode);
    if (!student || !subject) return;
    const newEnrollment = {
      id: String(Date.now()),
      studentName: student.name,
      studentId: student.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      status: "Pending",
      enrollmentDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    setEnrollments([...enrollments, newEnrollment]);
    setShowEnrollModal(false);
    setFormData({ studentId: "", subjectCode: "" });
  };
  const handleStatusChange = (enrollmentId, newStatus) => {
    setEnrollments(enrollments.map((e) => e.id === enrollmentId ? { ...e, status: newStatus } : e));
  };
  const handleOpenStatusModal = (enrollment) => {
    setSelectedEnrollment(enrollment);
    setShowStatusModal(true);
  };
  const handleUpdateStatus = (newStatus) => {
    if (selectedEnrollment) {
      setEnrollments(enrollments.map((e) => e.id === selectedEnrollment.id ? { ...e, status: newStatus } : e));
      setShowStatusModal(false);
      setSelectedEnrollment(null);
    }
  };
  const filteredEnrollments = enrollments.filter((enrollment) => {
    const matchesSearch = enrollment.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || enrollment.subjectCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || enrollment.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });
  const getStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-100 text-emerald-700";
      case "Pending":
        return "bg-blue-100 text-blue-700";
      case "Rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };
  const getStatusIcon = (status) => {
    switch (status) {
      case "Approved":
        return <CheckCircle className="w-4 h-4" />;
      case "Pending":
        return <Clock className="w-4 h-4" />;
      case "Rejected":
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay:'0ms'}} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'150ms'}} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{animationDelay:'300ms'}} />
          </div>
          <p className="text-gray-500">Loading enrollment management...</p>
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
        <div className="bg-gray-950/80 backdrop-blur-md border-b border-white/8 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-white">Enrollment Management</h2>
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
          <div className="relative rounded-2xl p-8 text-white shadow-lg overflow-hidden bg-gray-900 border border-white/10">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-emerald-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-emerald-400">Enrollment Management</h1>
                <p className="text-gray-400">{enrollments.length} enrollment requests</p>
              </div>
              <button onClick={() => setShowEnrollModal(true)} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors font-semibold shadow-lg shadow-emerald-500/20">
                <UserPlus className="w-5 h-5" />
                Enroll Student
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/8 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">Approved</p>
              <p className="text-3xl font-bold text-emerald-400">{enrollments.filter((e) => e.status === "Approved").length}</p>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/8 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">Pending</p>
              <p className="text-3xl font-bold text-blue-400">{enrollments.filter((e) => e.status === "Pending").length}</p>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/8 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">Rejected</p>
              <p className="text-3xl font-bold text-red-500">{enrollments.filter((e) => e.status === "Rejected").length}</p>
            </div>
          </div>

          <div className="bg-gray-900/60 rounded-xl p-4 border border-white/8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Search by student name or subject..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/20 text-white placeholder-gray-500 pl-10 pr-4 py-3 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Status</span>
                <CustomSelect value={filterStatus} onChange={setFilterStatus} options={[{ value: "all", label: "All Status" }, { value: "approved", label: "Approved" }, { value: "pending", label: "Pending" }, { value: "rejected", label: "Rejected" }]} icon={<Filter className="w-5 h-5" />} className="min-w-[160px]" />
              </div>
              <button className="flex items-center gap-2 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors border border-white/10">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="bg-gray-900/80 rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-black/40 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Enrollment Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredEnrollments.map((enrollment) => <tr key={enrollment.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white">{enrollment.studentName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{enrollment.studentId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-300">{enrollment.subjectName}</p>
                        <p className="text-xs text-emerald-500 mt-0.5">{enrollment.subjectCode}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                          enrollment.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          enrollment.status === 'Pending' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {getStatusIcon(enrollment.status)}{enrollment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(enrollment.enrollmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {enrollment.status === "Pending" ? <>
                              <button onClick={() => handleStatusChange(enrollment.id, "Approved")} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors text-xs font-semibold uppercase tracking-wider">Approve</button>
                              <button onClick={() => handleStatusChange(enrollment.id, "Rejected")} className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-xs font-semibold uppercase tracking-wider">Reject</button>
                            </> : <button onClick={() => handleOpenStatusModal(enrollment)} className="px-3 py-1 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-xs font-semibold uppercase tracking-wider">Change Status</button>}
                        </div>
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>
            {filteredEnrollments.length === 0 && <div className="p-16 text-center">
                <UserPlus className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No enrollments yet.</p>
              </div>}
          </div>
        </div>
      </main>

      {
    /* Enroll Student Modal */
  }
      {showEnrollModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Enroll Student</h3>
              <button onClick={() => {
    setShowEnrollModal(false);
    setFormData({ studentId: "", subjectCode: "" });
  }} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <CustomDropdown label="Select Student" value={formData.studentId} onChange={(value) => setFormData({ ...formData, studentId: value })} options={[{ value: "", label: "Choose a student..." }, ...availableStudents.map((student) => ({ value: student.id, label: student.name, sublabel: student.id }))]} placeholder="Choose a student..." />
                <CustomDropdown label="Select Subject" value={formData.subjectCode} onChange={(value) => setFormData({ ...formData, subjectCode: value })} options={[{ value: "", label: "Choose a subject..." }, ...availableSubjects.map((subject) => ({ value: subject.code, label: subject.name, sublabel: subject.code }))]} placeholder="Choose a subject..." />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => {
    setShowEnrollModal(false);
    setFormData({ studentId: "", subjectCode: "" });
  }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleEnrollStudent} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Enroll Student</button>
              </div>
            </div>
          </div>
        </div>}

      {
    /* Change Status Modal */
  }
      {showStatusModal && selectedEnrollment && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Change Enrollment Status</h3>
              <button onClick={() => {
    setShowStatusModal(false);
    setSelectedEnrollment(null);
  }} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Student</p>
                  <p className="font-medium text-gray-900">{selectedEnrollment.studentName}</p>
                  <p className="text-sm text-gray-500">{selectedEnrollment.studentId}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Subject</p>
                  <p className="font-medium text-gray-900">{selectedEnrollment.subjectName}</p>
                  <p className="text-sm text-gray-500">{selectedEnrollment.subjectCode}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Current Status</p>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedEnrollment.status)}`}>
                    {getStatusIcon(selectedEnrollment.status)}{selectedEnrollment.status}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 mb-3">Select New Status:</p>
                <button onClick={() => handleUpdateStatus("Pending")} className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border-2 border-blue-200">
                  <Clock className="w-5 h-5" /><span className="font-medium">Pending</span>
                </button>
                <button onClick={() => handleUpdateStatus("Approved")} className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors border-2 border-emerald-200">
                  <CheckCircle className="w-5 h-5" /><span className="font-medium">Approved</span>
                </button>
                <button onClick={() => handleUpdateStatus("Rejected")} className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border-2 border-red-200">
                  <XCircle className="w-5 h-5" /><span className="font-medium">Rejected</span>
                </button>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => {
    setShowStatusModal(false);
    setSelectedEnrollment(null);
  }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>}
    </div>;
}
export {
  EnrollmentManagement
};
