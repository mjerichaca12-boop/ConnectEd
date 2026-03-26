import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { Search, Plus, Eye, Edit, Trash2, Download, Clock, User, X, BookOpen, Users, AlertTriangle, Award } from "lucide-react";
function SubjectManagement() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectToDelete, setSubjectToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjectFormData, setSubjectFormData] = useState({ code: "", name: "", description: "", credits: "", teacher: "", schedule: "", capacity: "" });
  const [formErrors, setFormErrors] = useState({});
  const [editFormData, setEditFormData] = useState({ code: "", name: "", description: "", credits: "", teacher: "", schedule: "", capacity: "" });
  const [editFormErrors, setEditFormErrors] = useState({});
  const [subjects, setSubjects] = useState([]);
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
  const filteredSubjects = subjects.filter(
    (subject) => subject.name.toLowerCase().includes(searchQuery.toLowerCase()) || subject.code.toLowerCase().includes(searchQuery.toLowerCase()) || subject.teacher.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const validateForm = () => {
    const errors = {};
    if (!subjectFormData.code.trim()) errors.code = "Subject code is required";
    if (!subjectFormData.name.trim()) errors.name = "Subject name is required";
    if (!subjectFormData.description.trim()) errors.description = "Description is required";
    if (!subjectFormData.credits.trim()) errors.credits = "Credits are required";
    else if (isNaN(Number(subjectFormData.credits)) || Number(subjectFormData.credits) <= 0) errors.credits = "Credits must be a positive number";
    if (!subjectFormData.teacher.trim()) errors.teacher = "Teacher is required";
    if (!subjectFormData.schedule.trim()) errors.schedule = "Schedule is required";
    if (!subjectFormData.capacity.trim()) errors.capacity = "Capacity is required";
    else if (isNaN(Number(subjectFormData.capacity)) || Number(subjectFormData.capacity) <= 0) errors.capacity = "Capacity must be a positive number";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const handleAddSubject = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setTimeout(() => {
      const newSubject = {
        id: String(Date.now()),
        code: subjectFormData.code,
        name: subjectFormData.name,
        description: subjectFormData.description,
        credits: Number(subjectFormData.credits),
        teacher: subjectFormData.teacher,
        schedule: subjectFormData.schedule,
        capacity: Number(subjectFormData.capacity),
        enrolled: 0
      };
      setSubjects([...subjects, newSubject]);
      setSubjectFormData({ code: "", name: "", description: "", credits: "", teacher: "", schedule: "", capacity: "" });
      setFormErrors({});
      setIsSubmitting(false);
      setShowAddModal(false);
      alert("Subject added successfully!");
    }, 1e3);
  };
  const handleCloseModal = () => {
    setShowAddModal(false);
    setSubjectFormData({ code: "", name: "", description: "", credits: "", teacher: "", schedule: "", capacity: "" });
    setFormErrors({});
  };
  const handleViewSubject = (subject) => {
    setSelectedSubject(subject);
    setShowViewModal(true);
  };
  const handleEditSubject = (subject) => {
    setSelectedSubject(subject);
    setEditFormData({ code: subject.code, name: subject.name, description: subject.description, credits: subject.credits.toString(), teacher: subject.teacher, schedule: subject.schedule, capacity: subject.capacity.toString() });
    setShowEditModal(true);
  };
  const validateEditForm = () => {
    const errors = {};
    if (!editFormData.code.trim()) errors.code = "Subject code is required";
    if (!editFormData.name.trim()) errors.name = "Subject name is required";
    if (!editFormData.description.trim()) errors.description = "Description is required";
    if (!editFormData.credits.trim()) errors.credits = "Credits are required";
    else if (isNaN(Number(editFormData.credits)) || Number(editFormData.credits) <= 0) errors.credits = "Credits must be a positive number";
    if (!editFormData.teacher.trim()) errors.teacher = "Teacher is required";
    if (!editFormData.schedule.trim()) errors.schedule = "Schedule is required";
    if (!editFormData.capacity.trim()) errors.capacity = "Capacity is required";
    else if (isNaN(Number(editFormData.capacity)) || Number(editFormData.capacity) <= 0) errors.capacity = "Capacity must be a positive number";
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const handleUpdateSubject = (e) => {
    e.preventDefault();
    if (!validateEditForm() || !selectedSubject) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setSubjects(subjects.map(
        (subject) => subject.id === selectedSubject.id ? { ...subject, code: editFormData.code, name: editFormData.name, description: editFormData.description, credits: Number(editFormData.credits), teacher: editFormData.teacher, schedule: editFormData.schedule, capacity: Number(editFormData.capacity) } : subject
      ));
      setIsSubmitting(false);
      setShowEditModal(false);
      setSelectedSubject(null);
      setEditFormErrors({});
      alert("Subject updated successfully!");
    }, 1e3);
  };
  const handleDeleteSubject = (subject) => {
    setSubjectToDelete(subject);
    setShowDeleteConfirm(true);
  };
  const handleConfirmDelete = () => {
    if (!subjectToDelete) return;
    setSubjects(subjects.filter((s) => s.id !== subjectToDelete.id));
    setShowDeleteConfirm(false);
    setSubjectToDelete(null);
    setTimeout(() => alert("Subject deleted successfully!"), 100);
  };
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedSubject(null);
    setEditFormData({ code: "", name: "", description: "", credits: "", teacher: "", schedule: "", capacity: "" });
    setEditFormErrors({});
  };
  const handleExportToCSV = () => {
    const headers = ["Subject Code", "Name", "Description", "Credits", "Teacher", "Schedule", "Capacity", "Enrolled"];
    const rows = filteredSubjects.map((subject) => [subject.code, subject.name, subject.description, subject.credits.toString(), subject.teacher, subject.schedule, subject.capacity.toString(), subject.enrolled.toString()]);
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `subjects_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading subject management...</p>
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
              <h2 className="text-xl font-semibold text-gray-900">Subject Management</h2>
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
                <h1 className="text-3xl font-bold mb-2">Subject Management</h1>
                <p className="text-emerald-50">{subjects.length} subjects available</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-medium">
                <Plus className="w-5 h-5" />
                Add Subject
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Total Subjects</p>
              <p className="text-3xl font-bold text-gray-900">{subjects.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Total Credits</p>
              <p className="text-3xl font-bold text-emerald-600">{subjects.reduce((sum, s) => sum + s.credits, 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Total Enrolled</p>
              <p className="text-3xl font-bold text-blue-600">{subjects.reduce((sum, s) => sum + s.enrolled, 0)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Search by name, code, or teacher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <button onClick={handleExportToCSV} className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {filteredSubjects.length === 0 ? <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No subjects found. Add your first subject!</p>
            </div> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredSubjects.map((subject) => <div key={subject.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-emerald-600 font-medium">{subject.code}</p>
                        <h3 className="text-lg font-bold text-gray-900 mt-1">{subject.name}</h3>
                      </div>
                      <div className="px-3 py-1 bg-white rounded-full">
                        <p className="text-sm font-medium text-gray-900">{subject.credits} Credits</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-gray-600 text-sm">{subject.description}</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{subject.teacher}</span></div>
                      <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{subject.schedule}</span></div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">Enrollment</p>
                        <p className="text-sm font-medium text-gray-900">{subject.enrolled}/{subject.capacity} students</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleViewSubject(subject)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4 text-blue-600" /></button>
                        <button onClick={() => handleEditSubject(subject)} className="p-2 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit"><Edit className="w-4 h-4 text-emerald-600" /></button>
                        <button onClick={() => handleDeleteSubject(subject)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4 text-red-600" /></button>
                      </div>
                    </div>
                  </div>
                </div>)}
            </div>}
        </div>
      </main>

      {
    /* Add Subject Modal */
  }
      {showAddModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Add New Subject</h3>
              <button onClick={handleCloseModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddSubject}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                    <input type="text" placeholder="e.g., CS101" value={subjectFormData.code} onChange={(e) => setSubjectFormData({ ...subjectFormData, code: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.code && <p className="text-red-500 text-sm mt-1">{formErrors.code}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
                    <input type="number" min="1" placeholder="e.g., 3" value={subjectFormData.credits} onChange={(e) => setSubjectFormData({ ...subjectFormData, credits: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.credits && <p className="text-red-500 text-sm mt-1">{formErrors.credits}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                    <input type="text" placeholder="e.g., Computer Science Fundamentals" value={subjectFormData.name} onChange={(e) => setSubjectFormData({ ...subjectFormData, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.name && <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea rows={3} placeholder="Brief description of the subject" value={subjectFormData.description} onChange={(e) => setSubjectFormData({ ...subjectFormData, description: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.description && <p className="text-red-500 text-sm mt-1">{formErrors.description}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                    <input type="text" placeholder="e.g., John Doe" value={subjectFormData.teacher} onChange={(e) => setSubjectFormData({ ...subjectFormData, teacher: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.teacher && <p className="text-red-500 text-sm mt-1">{formErrors.teacher}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input type="number" min="1" placeholder="e.g., 30" value={subjectFormData.capacity} onChange={(e) => setSubjectFormData({ ...subjectFormData, capacity: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.capacity && <p className="text-red-500 text-sm mt-1">{formErrors.capacity}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                    <input type="text" placeholder="e.g., MWF 8:00-9:00 AM" value={subjectFormData.schedule} onChange={(e) => setSubjectFormData({ ...subjectFormData, schedule: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {formErrors.schedule && <p className="text-red-500 text-sm mt-1">{formErrors.schedule}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={handleCloseModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Subject"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>}

      {
    /* Edit Subject Modal */
  }
      {showEditModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Edit Subject</h3>
              <button onClick={handleCloseEditModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateSubject}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                    <input type="text" value={editFormData.code} onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.code && <p className="text-red-500 text-sm mt-1">{editFormErrors.code}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
                    <input type="number" min="1" value={editFormData.credits} onChange={(e) => setEditFormData({ ...editFormData, credits: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.credits && <p className="text-red-500 text-sm mt-1">{editFormErrors.credits}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                    <input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.name && <p className="text-red-500 text-sm mt-1">{editFormErrors.name}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea rows={3} value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.description && <p className="text-red-500 text-sm mt-1">{editFormErrors.description}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                    <input type="text" value={editFormData.teacher} onChange={(e) => setEditFormData({ ...editFormData, teacher: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.teacher && <p className="text-red-500 text-sm mt-1">{editFormErrors.teacher}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input type="number" min="1" value={editFormData.capacity} onChange={(e) => setEditFormData({ ...editFormData, capacity: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.capacity && <p className="text-red-500 text-sm mt-1">{editFormErrors.capacity}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                    <input type="text" value={editFormData.schedule} onChange={(e) => setEditFormData({ ...editFormData, schedule: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {editFormErrors.schedule && <p className="text-red-500 text-sm mt-1">{editFormErrors.schedule}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={handleCloseEditModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors" disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Update Subject"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>}

      {
    /* View Subject Modal */
  }
      {showViewModal && selectedSubject && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Subject Details</h3>
              <button onClick={() => setShowViewModal(false)} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 font-medium mb-1">{selectedSubject.code}</p>
                    <h4 className="text-2xl font-bold text-gray-900">{selectedSubject.name}</h4>
                  </div>
                  <div className="px-4 py-2 bg-white rounded-full">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-gray-900">{selectedSubject.credits} Credits</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Teacher</label>
                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-emerald-600" /><p className="text-gray-900">{selectedSubject.teacher}</p></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Schedule</label>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-600" /><p className="text-gray-900">{selectedSubject.schedule}</p></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Capacity</label>
                    <div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-600" /><p className="text-gray-900">{selectedSubject.capacity} students</p></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Currently Enrolled</label>
                    <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-600" /><p className="text-gray-900">{selectedSubject.enrolled} students</p></div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Description</label>
                  <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">{selectedSubject.description}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Enrollment Progress</label>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Available Slots</span>
                      <span className="font-medium text-gray-900">{selectedSubject.capacity - selectedSubject.enrolled} / {selectedSubject.capacity}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 h-3 rounded-full transition-all" style={{ width: `${selectedSubject.enrolled / selectedSubject.capacity * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                <button onClick={() => {
    setShowViewModal(false);
    handleEditSubject(selectedSubject);
  }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"><Edit className="w-4 h-4" />Edit Subject</button>
                <button onClick={() => setShowViewModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>}

      {
    /* Confirm Delete Modal */
  }
      {showDeleteConfirm && subjectToDelete && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-red-100"><Trash2 className="w-8 h-8 text-red-600" /></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Delete Subject?</h3>
              <p className="text-center text-gray-600 mb-1">Are you sure you want to delete</p>
              <p className="text-center font-medium text-gray-900 mb-1">{subjectToDelete.name}?</p>
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg w-full">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800"><p className="font-medium mb-1">Warning</p><p>This action cannot be undone. All data related to this subject will be permanently deleted.</p></div>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => {
    setShowDeleteConfirm(false);
    setSubjectToDelete(null);
  }} className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium">Cancel</button>
              <button onClick={handleConfirmDelete} className="flex-1 px-4 py-3 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium">Delete</button>
            </div>
          </div>
        </div>}
    </div>;
}
export {
  SubjectManagement
};
