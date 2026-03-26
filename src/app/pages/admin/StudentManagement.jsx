import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { Search, Filter, UserPlus, MoreVertical, Eye, Edit, Ban, CheckCircle, Download, Mail, Phone, X, User, GraduationCap, Users, AlertTriangle } from "lucide-react";
function StudentManagement() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentFormData, setStudentFormData] = useState({ name: "", email: "", phone: "", grade: "", section: "", status: "Active" });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: "", email: "", phone: "", grade: "", section: "", status: "Active" });
  const [editFormErrors, setEditFormErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [studentToToggle, setStudentToToggle] = useState(null);
  const [students, setStudents] = useState([]);
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
  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || student.studentId.toLowerCase().includes(searchQuery.toLowerCase()) || student.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || student.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });
  const activeCount = students.filter((s) => s.status === "Active").length;
  const inactiveCount = students.filter((s) => s.status === "Inactive").length;
  const validateForm = () => {
    const errors = {};
    if (!studentFormData.name.trim()) errors.name = "Name is required";
    if (!studentFormData.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentFormData.email)) errors.email = "Invalid email format";
    if (!studentFormData.phone.trim()) errors.phone = "Phone number is required";
    else if (!/^\+?[\d\s\-()]+$/.test(studentFormData.phone)) errors.phone = "Invalid phone number format";
    if (!studentFormData.grade.trim()) errors.grade = "Grade is required";
    if (!studentFormData.section.trim()) errors.section = "Section is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setTimeout(() => {
      const newStudent = {
        id: String(Date.now()),
        studentId: `STU-2026-${String(students.length + 1).padStart(3, "0")}`,
        name: studentFormData.name,
        email: studentFormData.email,
        phone: studentFormData.phone,
        grade: studentFormData.grade,
        section: studentFormData.section,
        status: studentFormData.status,
        enrollmentDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      };
      setStudents([...students, newStudent]);
      setStudentFormData({ name: "", email: "", phone: "", grade: "", section: "", status: "Active" });
      setFormErrors({});
      setIsSubmitting(false);
      setShowAddModal(false);
      alert("Student added successfully!");
    }, 1e3);
  };
  const handleCloseModal = () => {
    setShowAddModal(false);
    setStudentFormData({ name: "", email: "", phone: "", grade: "", section: "", status: "Active" });
    setFormErrors({});
  };
  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setShowViewModal(true);
  };
  const handleEditStudent = (student) => {
    setSelectedStudent(student);
    setEditFormData({ name: student.name, email: student.email, phone: student.phone, grade: student.grade, section: student.section, status: student.status });
    setShowEditModal(true);
  };
  const validateEditForm = () => {
    const errors = {};
    if (!editFormData.name.trim()) errors.name = "Name is required";
    if (!editFormData.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email)) errors.email = "Invalid email format";
    if (!editFormData.phone.trim()) errors.phone = "Phone number is required";
    else if (!/^\+?[\d\s\-()]+$/.test(editFormData.phone)) errors.phone = "Invalid phone number format";
    if (!editFormData.grade.trim()) errors.grade = "Grade is required";
    if (!editFormData.section.trim()) errors.section = "Section is required";
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const handleUpdateStudent = (e) => {
    e.preventDefault();
    if (!validateEditForm() || !selectedStudent) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setStudents(students.map((student) => student.id === selectedStudent.id ? { ...student, ...editFormData } : student));
      setIsSubmitting(false);
      setShowEditModal(false);
      setSelectedStudent(null);
      setEditFormErrors({});
      alert("Student updated successfully!");
    }, 1e3);
  };
  const handleToggleStatus = (student) => {
    setStudentToToggle(student);
    setShowConfirmModal(true);
  };
  const handleConfirmToggleStatus = () => {
    if (!studentToToggle) return;
    const newStatus = studentToToggle.status === "Active" ? "Inactive" : "Active";
    setStudents(students.map((s) => s.id === studentToToggle.id ? { ...s, status: newStatus } : s));
    setShowConfirmModal(false);
    setStudentToToggle(null);
    setTimeout(() => alert(`Student ${newStatus === "Active" ? "activated" : "deactivated"} successfully!`), 100);
  };
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedStudent(null);
    setEditFormData({ name: "", email: "", phone: "", grade: "", section: "", status: "Active" });
    setEditFormErrors({});
  };
  const handleExportToCSV = () => {
    const headers = ["Student ID", "Name", "Email", "Phone", "Grade", "Section", "Status", "Enrollment Date"];
    const rows = filteredStudents.map((student) => [student.studentId, student.name, student.email, student.phone, student.grade, student.section, student.status, new Date(student.enrollmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })]);
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `students_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading student management...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar adminName={adminName} onLogout={handleLogout} />
      <div className="hidden lg:block w-72 flex-shrink-0" />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Student Management</h2>
              <NotificationDropdown
    notifications={notificationList}
    onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))}
    onNotificationsChange={setNotificationList}
  />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Student Management</h1>
                <p className="text-emerald-50">{students.length} students registered</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-medium">
                <UserPlus className="w-5 h-5" />
                Add Student
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">{students.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Active Students</p>
              <p className="text-3xl font-bold text-emerald-600">{activeCount}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Inactive Students</p>
              <p className="text-3xl font-bold text-red-600">{inactiveCount}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Search by name, student ID, or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <CustomSelect value={filterStatus} onChange={setFilterStatus} options={[{ value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} icon={<Filter className="w-5 h-5" />} className="min-w-[180px]" />
              </div>
              <button onClick={handleExportToCSV} className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade & Section</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollment Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-500">{student.studentId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="w-4 h-4" />{student.email}</div>
                          <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="w-4 h-4" />{student.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{student.grade}</p>
                        <p className="text-sm text-gray-500">{student.section}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${student.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{student.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(student.enrollmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleViewStudent(student)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4 text-blue-600" /></button>
                          <button onClick={() => handleEditStudent(student)} className="p-2 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit"><Edit className="w-4 h-4 text-emerald-600" /></button>
                          {student.status === "Active" ? <button onClick={() => handleToggleStatus(student)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate"><Ban className="w-4 h-4 text-red-600" /></button> : <button onClick={() => handleToggleStatus(student)} className="p-2 hover:bg-emerald-50 rounded-lg transition-colors" title="Activate"><CheckCircle className="w-4 h-4 text-emerald-600" /></button>}
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="More"><MoreVertical className="w-4 h-4 text-gray-600" /></button>
                        </div>
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>
            {filteredStudents.length === 0 && <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No students found. Add your first student!</p>
              </div>}
          </div>
        </div>
      </main>

      {
    /* Add Student Modal */
  }
      {showAddModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Add New Student</h3>
              <button onClick={handleCloseModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddStudent}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input type="text" value={studentFormData.name} onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.name && <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" value={studentFormData.email} onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.email && <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input type="text" value={studentFormData.phone} onChange={(e) => setStudentFormData({ ...studentFormData, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.phone && <p className="text-red-500 text-sm mt-1">{formErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Grade</label>
                    <input type="text" value={studentFormData.grade} onChange={(e) => setStudentFormData({ ...studentFormData, grade: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.grade && <p className="text-red-500 text-sm mt-1">{formErrors.grade}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Section</label>
                    <input type="text" value={studentFormData.section} onChange={(e) => setStudentFormData({ ...studentFormData, section: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.section && <p className="text-red-500 text-sm mt-1">{formErrors.section}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <CustomSelect value={studentFormData.status} onChange={(value) => setStudentFormData({ ...studentFormData, status: value })} options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} icon={<User className="w-5 h-5" />} className="min-w-[180px]" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={handleCloseModal} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Student"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>}

      {
    /* Edit Student Modal */
  }
      {showEditModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Edit Student</h3>
              <button onClick={handleCloseEditModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateStudent}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.name && <p className="text-red-500 text-sm mt-1">{editFormErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.email && <p className="text-red-500 text-sm mt-1">{editFormErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input type="text" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.phone && <p className="text-red-500 text-sm mt-1">{editFormErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Grade</label>
                    <input type="text" value={editFormData.grade} onChange={(e) => setEditFormData({ ...editFormData, grade: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.grade && <p className="text-red-500 text-sm mt-1">{editFormErrors.grade}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Section</label>
                    <input type="text" value={editFormData.section} onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.section && <p className="text-red-500 text-sm mt-1">{editFormErrors.section}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <CustomSelect value={editFormData.status} onChange={(value) => setEditFormData({ ...editFormData, status: value })} options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} icon={<User className="w-5 h-5" />} className="min-w-[180px]" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={handleCloseEditModal} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors" disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Update Student"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>}

      {
    /* View Student Modal */
  }
      {showViewModal && selectedStudent && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Student Details</h3>
              <button onClick={() => setShowViewModal(false)} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">{selectedStudent.name.charAt(0)}</div>
                <div>
                  <h4 className="text-2xl font-bold text-gray-900">{selectedStudent.name}</h4>
                  <p className="text-gray-600">{selectedStudent.studentId}</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${selectedStudent.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{selectedStudent.status}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-600" /><p className="text-gray-900">{selectedStudent.email}</p></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-600" /><p className="text-gray-900">{selectedStudent.phone}</p></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Grade Level</label>
                    <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-emerald-600" /><p className="text-gray-900">{selectedStudent.grade}</p></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Section</label>
                    <div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-600" /><p className="text-gray-900">{selectedStudent.section}</p></div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Enrollment Date</label>
                  <p className="text-gray-900">{new Date(selectedStudent.enrollmentDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                <button onClick={() => {
    setShowViewModal(false);
    handleEditStudent(selectedStudent);
  }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"><Edit className="w-4 h-4" />Edit Student</button>
                <button onClick={() => setShowViewModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>}

      {
    /* Confirm Toggle Status Modal */
  }
      {showConfirmModal && studentToToggle && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-6 flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${studentToToggle.status === "Active" ? "bg-red-100" : "bg-emerald-100"}`}>
                {studentToToggle.status === "Active" ? <Ban className="w-8 h-8 text-red-600" /> : <CheckCircle className="w-8 h-8 text-emerald-600" />}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{studentToToggle.status === "Active" ? "Deactivate Student?" : "Activate Student?"}</h3>
              <p className="text-center text-gray-600 mb-1">Are you sure you want to {studentToToggle.status === "Active" ? "deactivate" : "activate"}</p>
              <p className="text-center font-medium text-gray-900">{studentToToggle.name}?</p>
              {studentToToggle.status === "Active" && <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg w-full">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800"><p className="font-medium mb-1">Warning</p><p>Deactivating this student will restrict their access to the system and classes.</p></div>
                  </div>
                </div>}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => {
    setShowConfirmModal(false);
    setStudentToToggle(null);
  }} className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium">Cancel</button>
              <button onClick={handleConfirmToggleStatus} className={`flex-1 px-4 py-3 text-white rounded-lg transition-colors font-medium ${studentToToggle.status === "Active" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                {studentToToggle.status === "Active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>}
    </div>;
}
export {
  StudentManagement
};
