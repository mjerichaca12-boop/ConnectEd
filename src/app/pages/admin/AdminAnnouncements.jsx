import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  School,
  Megaphone,
  X
} from "lucide-react";
function AdminAnnouncements() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    announcementId: "",
    announcementTitle: ""
  });
  const [announcements, setAnnouncements] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetAudience: "School-wide",
    priority: "Medium"
  });
  const [editFormData, setEditFormData] = useState({
    title: "",
    content: "",
    targetAudience: "School-wide",
    priority: "Medium"
  });
  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});
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
  const filteredAnnouncements = announcements.filter(
    (a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const validateForm = (data, setErrors) => {
    const errors = {};
    if (!data.title.trim()) {
      errors.title = "Title is required";
    } else if (data.title.trim().length < 3) {
      errors.title = "Title must be at least 3 characters";
    }
    if (!data.content.trim()) {
      errors.content = "Content is required";
    } else if (data.content.trim().length < 10) {
      errors.content = "Content must be at least 10 characters";
    }
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const handleCreateAnnouncement = () => {
    if (!validateForm(formData, setFormErrors)) return;
    const newAnnouncement = {
      id: String(Date.now()),
      title: formData.title.trim(),
      content: formData.content.trim(),
      targetAudience: formData.targetAudience,
      priority: formData.priority,
      datePosted: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      author: adminName || "Admin Office"
    };
    setAnnouncements([newAnnouncement, ...announcements]);
    handleCloseCreateModal();
  };
  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setFormData({ title: "", content: "", targetAudience: "School-wide", priority: "Medium" });
    setFormErrors({});
  };
  const handleOpenEditModal = (announcement) => {
    setEditingAnnouncement(announcement);
    setEditFormData({
      title: announcement.title,
      content: announcement.content,
      targetAudience: announcement.targetAudience,
      priority: announcement.priority || "Medium"
    });
    setEditFormErrors({});
    setShowEditModal(true);
  };
  const handleSaveEdit = () => {
    if (!validateForm(editFormData, setEditFormErrors)) return;
    if (!editingAnnouncement) return;
    setAnnouncements(announcements.map(
      (a) => a.id === editingAnnouncement.id ? { ...a, title: editFormData.title.trim(), content: editFormData.content.trim(), targetAudience: editFormData.targetAudience, priority: editFormData.priority } : a
    ));
    setShowEditModal(false);
    setEditingAnnouncement(null);
  };
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingAnnouncement(null);
    setEditFormErrors({});
  };
  const handleDeleteAnnouncement = () => {
    setAnnouncements(announcements.filter((a) => a.id !== deleteConfirm.announcementId));
    setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" });
  };
  const ConfirmDeleteDialog = () => {
    if (!deleteConfirm.isOpen) return null;
    return <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Announcement</h3>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete "{deleteConfirm.announcementTitle}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
      onClick={() => setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" })}
      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
    >
              Cancel
            </button>
            <button
      onClick={handleDeleteAnnouncement}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
    >
              Delete
            </button>
          </div>
        </div>
      </div>;
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading announcements...</p>
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
              <h2 className="text-xl font-semibold text-gray-900">Announcements</h2>
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Announcements</h1>
                <p className="text-emerald-50">{announcements.length} published announcements</p>
              </div>
              <button
    onClick={() => setShowCreateModal(true)}
    className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-medium"
  >
                <Plus className="w-5 h-5" />
                Create Announcement
              </button>
            </div>
          </div>

          {
    /* Search */
  }
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
    type="text"
    placeholder="Search announcements..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
  />
            </div>
          </div>

          {
    /* Announcements List */
  }
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement) => <div key={announcement.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{announcement.title}</h3>
                      <p className="text-gray-600 mb-3">{announcement.content}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium ${announcement.targetAudience === "School-wide" ? "bg-emerald-100 text-emerald-700" : announcement.targetAudience === "Students" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                          {announcement.targetAudience === "School-wide" ? <School className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          {announcement.targetAudience}
                        </span>
                        <span>Posted: {new Date(announcement.datePosted).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span>By: {announcement.author}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
    onClick={() => handleOpenEditModal(announcement)}
    className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
    title="Edit"
  >
                        <Edit className="w-4 h-4 text-emerald-600" />
                      </button>
                      <button
    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
    onClick={() => setDeleteConfirm({ isOpen: true, announcementId: announcement.id, announcementTitle: announcement.title })}
    title="Delete"
  >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>)}
          </div>
        </div>
      </main>

      {
    /* Delete Confirm Dialog */
  }
      <ConfirmDeleteDialog />

      {
    /* Create Announcement Modal */
  }
      {showCreateModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Create Announcement</h3>
              <button onClick={handleCloseCreateModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input
    type="text"
    value={formData.title}
    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${formErrors.title ? "border-red-500" : "border-gray-300"}`}
    placeholder="Enter announcement title"
  />
                  {formErrors.title && <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content <span className="text-red-500">*</span></label>
                  <textarea
    value={formData.content}
    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
    rows={5}
    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${formErrors.content ? "border-red-500" : "border-gray-300"}`}
    placeholder="Enter announcement content"
  />
                  {formErrors.content && <p className="mt-1 text-sm text-red-600">{formErrors.content}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience <span className="text-red-500">*</span></label>
                  <CustomSelect
    value={formData.targetAudience}
    onChange={(value) => setFormData({ ...formData, targetAudience: value })}
    options={[
      { value: "School-wide", label: "School-wide" },
      { value: "Students", label: "Students" },
      { value: "Teachers", label: "Teachers" }
    ]}
    icon={<Users className="w-5 h-5" />}
    className="w-full"
  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <CustomSelect
    value={formData.priority}
    onChange={(value) => setFormData({ ...formData, priority: value })}
    options={[
      { value: "High", label: "High" },
      { value: "Medium", label: "Medium" },
      { value: "Low", label: "Low" }
    ]}
    icon={<Megaphone className="w-5 h-5" />}
    className="w-full"
  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={handleCloseCreateModal} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleCreateAnnouncement} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Create Announcement</button>
              </div>
            </div>
          </div>
        </div>}

      {
    /* Edit Announcement Modal */
  }
      {showEditModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Edit Announcement</h3>
              <button onClick={handleCloseEditModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input
    type="text"
    value={editFormData.title}
    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${editFormErrors.title ? "border-red-500" : "border-gray-300"}`}
    placeholder="Enter announcement title"
  />
                  {editFormErrors.title && <p className="mt-1 text-sm text-red-600">{editFormErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content <span className="text-red-500">*</span></label>
                  <textarea
    value={editFormData.content}
    onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
    rows={5}
    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${editFormErrors.content ? "border-red-500" : "border-gray-300"}`}
    placeholder="Enter announcement content"
  />
                  {editFormErrors.content && <p className="mt-1 text-sm text-red-600">{editFormErrors.content}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience <span className="text-red-500">*</span></label>
                  <CustomSelect
    value={editFormData.targetAudience}
    onChange={(value) => setEditFormData({ ...editFormData, targetAudience: value })}
    options={[
      { value: "School-wide", label: "School-wide" },
      { value: "Students", label: "Students" },
      { value: "Teachers", label: "Teachers" }
    ]}
    icon={<Users className="w-5 h-5" />}
    className="w-full"
  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <CustomSelect
    value={editFormData.priority}
    onChange={(value) => setEditFormData({ ...editFormData, priority: value })}
    options={[
      { value: "High", label: "High" },
      { value: "Medium", label: "Medium" },
      { value: "Low", label: "Low" }
    ]}
    icon={<Megaphone className="w-5 h-5" />}
    className="w-full"
  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={handleCloseEditModal} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleSaveEdit} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Save Changes</button>
              </div>
            </div>
          </div>
        </div>}
    </div>;
}
export {
  AdminAnnouncements
};
