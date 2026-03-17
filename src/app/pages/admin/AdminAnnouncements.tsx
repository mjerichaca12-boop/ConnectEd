import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from '@/app/components/AdminSidebar';
import { CustomSelect } from '@/app/components/admin/CustomSelect';
import { 
  Bell, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  School,
  FileText,
  Upload,
  Download,
  Calendar,
  Clock,
  Paperclip,
  Megaphone,
  BookOpen,
  User,
  X
} from 'lucide-react';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: 'School-wide' | 'Students' | 'Teachers';
  datePosted: string;
  author: string;
  priority?: 'High' | 'Medium' | 'Low';
}

interface AnnouncementFormData {
  title: string;
  content: string;
  targetAudience: 'School-wide' | 'Students' | 'Teachers';
  priority: 'High' | 'Medium' | 'Low';
}

interface FormErrors {
  title?: string;
  content?: string;
  targetAudience?: string;
}

export function AdminAnnouncements() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState('');
  const [notifications, setNotifications] = useState(8);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; announcementId: string; announcementTitle: string }>({
    isOpen: false,
    announcementId: '',
    announcementTitle: ''
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { id: '1', title: 'Mid-term Examinations Schedule Released', content: 'The mid-term examinations will be held from January 20-24, 2026...', targetAudience: 'School-wide', datePosted: '2026-01-16', author: 'Admin Office', priority: 'High' },
    { id: '2', title: 'Library Hours Extended for Exam Week', content: 'Starting next week, the library will be open from 7:00 AM to 8:00 PM...', targetAudience: 'Students', datePosted: '2026-01-15', author: 'Admin Office', priority: 'Medium' },
    { id: '3', title: 'Faculty Meeting This Friday', content: 'All teaching staff are required to attend the faculty meeting...', targetAudience: 'Teachers', datePosted: '2026-01-14', author: 'Admin Office', priority: 'High' },
  ]);

  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: '',
    content: '',
    targetAudience: 'School-wide',
    priority: 'Medium'
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');
    if (!userData) { navigate('/login'); return; }
    const user = JSON.parse(userData);
    if (user.role !== 'admin') { navigate('/login'); return; }
    setAdminName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  const filteredAnnouncements = announcements.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters';
    }

    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    } else if (formData.content.trim().length < 10) {
      errors.content = 'Content must be at least 10 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAnnouncement = () => {
    if (!validateForm()) return;

    if (editingId) {
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? {
                ...a,
                title: formData.title.trim(),
                content: formData.content.trim(),
                targetAudience: formData.targetAudience,
                priority: formData.priority,
              }
            : a
        )
      );
    } else {
      const newAnnouncement: Announcement = {
        id: String(announcements.length + 1),
        title: formData.title.trim(),
        content: formData.content.trim(),
        targetAudience: formData.targetAudience,
        priority: formData.priority,
        datePosted: new Date().toISOString().split('T')[0],
        author: adminName || 'Admin Office',
      };
      setAnnouncements([newAnnouncement, ...announcements]);
    }

    handleCloseModal();
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingId(null);
    setFormData({
      title: '',
      content: '',
      targetAudience: 'School-wide',
      priority: 'Medium'
    });
    setFormErrors({});
  };

  const handleDeleteAnnouncement = () => {
    setAnnouncements(announcements.filter(a => a.id !== deleteConfirm.announcementId));
    setDeleteConfirm({ isOpen: false, announcementId: '', announcementTitle: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading announcements...</p>
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
                <h2 className="text-xl font-semibold text-gray-900">Announcements</h2>
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

          <div className="space-y-4">
            {filteredAnnouncements.map((announcement) => (
              <div key={announcement.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{announcement.title}</h3>
                      <p className="text-gray-600 mb-3">{announcement.content}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium ${
                          announcement.targetAudience === 'School-wide' ? 'bg-emerald-100 text-emerald-700' :
                          announcement.targetAudience === 'Students' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {announcement.targetAudience === 'School-wide' ? <School className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          {announcement.targetAudience}
                        </span>
                        <span>Posted: {new Date(announcement.datePosted).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>By: {announcement.author}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
                        onClick={() => {
                          setEditingId(announcement.id);
                          setFormData({
                            title: announcement.title,
                            content: announcement.content,
                            targetAudience: announcement.targetAudience,
                            priority: announcement.priority || 'Medium',
                          });
                          setShowCreateModal(true);
                        }}
                      >
                        <Edit className="w-4 h-4 text-emerald-600" />
                      </button>
                      <button
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={() => setDeleteConfirm({ isOpen: true, announcementId: announcement.id, announcementTitle: announcement.title })}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <ConfirmDialog
            isOpen={deleteConfirm.isOpen}
            onClose={() => setDeleteConfirm({ isOpen: false, announcementId: '', announcementTitle: '' })}
            onConfirm={handleDeleteAnnouncement}
            title="Delete Announcement"
            message={`Are you sure you want to delete "${deleteConfirm.announcementTitle}"? This action cannot be undone.`}
            confirmText="Delete"
            cancelText="Cancel"
            type="danger"
          />
        </div>
      </main>

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Create Announcement</h3>
              <button 
                onClick={handleCloseModal}
                type="button" 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.title ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter announcement title"
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={5}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${
                      formErrors.content ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter announcement content"
                  />
                  {formErrors.content && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.content}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Audience <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    value={formData.targetAudience}
                    onChange={(value) => setFormData({ ...formData, targetAudience: value as 'School-wide' | 'Students' | 'Teachers' })}
                    options={[
                      { value: 'School-wide', label: 'School-wide' },
                      { value: 'Students', label: 'Students' },
                      { value: 'Teachers', label: 'Teachers' }
                    ]}
                    icon={<Users className="w-5 h-5" />}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <CustomSelect
                    value={formData.priority}
                    onChange={(value) => setFormData({ ...formData, priority: value as 'High' | 'Medium' | 'Low' })}
                    options={[
                      { value: 'High', label: 'High' },
                      { value: 'Medium', label: 'Medium' },
                      { value: 'Low', label: 'Low' }
                    ]}
                    icon={<Megaphone className="w-5 h-5" />}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAnnouncement}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Create Announcement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}