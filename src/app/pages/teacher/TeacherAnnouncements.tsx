import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherSidebar } from '@/app/components/TeacherSidebar';
import { CustomSelect } from '@/app/components/CustomSelect';
import { 
  Bell, 
  Megaphone,
  Plus,
  X,
  Send,
  FileText,
  Upload,
  Paperclip,
  Calendar,
  Clock,
  Download,
  Trash2,
  BookOpen
} from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: 'School-wide' | 'Subject-specific';
  subject?: string;
  priority: 'High' | 'Medium' | 'Low';
  datePosted: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  subject: string;
  dueDate: string;
  totalPoints: number;
  datePosted: string;
  attachments?: string[];
}

interface FileUpload {
  id: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  subject: string;
  description: string;
  fileType: string;
}

export function TeacherAnnouncements() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('');
  const [notifications, setNotifications] = useState(5);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'announcements' | 'assignments' | 'files'>('announcements');
  const assignmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const [assignmentFileNames, setAssignmentFileNames] = useState<string>('');
  const [uploadFileName, setUploadFileName] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetAudience: 'Subject-specific' as 'School-wide' | 'Subject-specific',
    subject: 'MATH101',
    priority: 'Medium' as 'High' | 'Medium' | 'Low'
  });

  const [assignmentFormData, setAssignmentFormData] = useState({
    title: '',
    description: '',
    subject: 'MATH101',
    dueDate: '',
    totalPoints: 100,
    attachments: [] as string[]
  });

  const [fileFormData, setFileFormData] = useState({
    fileName: '',
    subject: 'MATH101',
    description: '',
    fileType: 'PDF'
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: '1',
      title: 'Quiz on Friday',
      content: 'Reminder: Quiz on Chapters 3-5 this Friday.',
      targetAudience: 'Subject-specific',
      subject: 'MATH101',
      priority: 'High',
      datePosted: '2026-01-14'
    },
    {
      id: '2',
      title: 'Project Submission Deadline',
      content: 'Final project submissions due January 25th.',
      targetAudience: 'Subject-specific',
      subject: 'MATH102',
      priority: 'Medium',
      datePosted: '2026-01-12'
    }
  ]);

  const [assignments, setAssignments] = useState<Assignment[]>([
    {
      id: '1',
      title: 'Chapter 5 Problem Set',
      description: 'Complete problems 1-20 from Chapter 5. Show all work and explanations.',
      subject: 'MATH101',
      dueDate: '2026-01-20',
      totalPoints: 50,
      datePosted: '2026-01-13',
      attachments: ['problem_set_ch5.pdf']
    },
    {
      id: '2',
      title: 'Midterm Project',
      description: 'Create a presentation on a mathematical concept of your choice.',
      subject: 'MATH102',
      dueDate: '2026-01-25',
      totalPoints: 100,
      datePosted: '2026-01-10'
    }
  ]);

  const [files, setFiles] = useState<FileUpload[]>([
    {
      id: '1',
      fileName: 'Lecture_Notes_Week3.pdf',
      fileSize: '2.4 MB',
      uploadDate: '2026-01-15',
      subject: 'MATH101',
      description: 'Week 3 lecture notes covering derivatives',
      fileType: 'PDF'
    },
    {
      id: '2',
      fileName: 'Practice_Problems.docx',
      fileSize: '1.1 MB',
      uploadDate: '2026-01-14',
      subject: 'MATH102',
      description: 'Additional practice problems for midterm preparation',
      fileType: 'DOCX'
    }
  ]);

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');
    if (!userData) {
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'teacher') {
      navigate('/login');
      return;
    }

    setTeacherName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  const handleAssignmentFilesClick = () => {
    assignmentFileInputRef.current?.click();
  };

  const handleAssignmentFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const names = Array.from(files).map((f) => f.name);
      setAssignmentFormData({ ...assignmentFormData, attachments: names });
      setAssignmentFileNames(names.join(', '));
    } else {
      setAssignmentFormData({ ...assignmentFormData, attachments: [] });
      setAssignmentFileNames('');
    }
  };

  const handleUploadFileClick = () => {
    uploadFileInputRef.current?.click();
  };

  const handleUploadFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileFormData({ ...fileFormData, fileName: file.name });
      setUploadFileName(file.name);
    } else {
      setUploadFileName('');
    }
  };

  const handleSubmit = () => {
    const newAnnouncement: Announcement = {
      id: Date.now().toString(),
      ...formData,
      datePosted: new Date().toISOString().split('T')[0]
    };

    setAnnouncements([newAnnouncement, ...announcements]);
    setShowCreateModal(false);
    setFormData({
      title: '',
      content: '',
      targetAudience: 'Subject-specific',
      subject: 'MATH101',
      priority: 'Medium'
    });
  };

  const handleAssignmentSubmit = () => {
    const newAssignment: Assignment = {
      id: Date.now().toString(),
      ...assignmentFormData,
      datePosted: new Date().toISOString().split('T')[0]
    };

    setAssignments([newAssignment, ...assignments]);
    setShowCreateModal(false);
    setAssignmentFormData({
      title: '',
      description: '',
      subject: 'MATH101',
      dueDate: '',
      totalPoints: 100,
      attachments: []
    });
  };

  const handleFileSubmit = () => {
    const newFile: FileUpload = {
      id: Date.now().toString(),
      ...fileFormData,
      fileSize: '1.5 MB', // Mock size
      uploadDate: new Date().toISOString().split('T')[0]
    };

    setFiles([newFile, ...files]);
    setShowCreateModal(false);
    setFileFormData({
      fileName: '',
      subject: 'MATH101',
      description: '',
      fileType: 'PDF'
    });
  };

  const handleDeleteFile = (id: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      setFiles(files.filter(file => file.id !== id));
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700';
      case 'Medium': return 'bg-blue-100 text-blue-700';
      case 'Low': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getFileIcon = (fileType: string) => {
    return <FileText className="w-5 h-5 text-emerald-600" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Announcements</h2>
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
                {notifications > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Manage Content</h1>
                <p className="text-emerald-50">Create and share announcements, assignments, and files</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-medium shadow-sm hover:shadow-md"
              >
                <Plus className="w-5 h-5" />
                {activeTab === 'announcements' && 'New Announcement'}
                {activeTab === 'assignments' && 'New Assignment'}
                {activeTab === 'files' && 'Upload File'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('announcements')}
                className={`flex-1 px-6 py-4 font-medium transition-all ${
                  activeTab === 'announcements'
                    ? 'bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Megaphone className="w-5 h-5" />
                  <span>Announcements</span>
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {announcements.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className={`flex-1 px-6 py-4 font-medium transition-all ${
                  activeTab === 'assignments'
                    ? 'bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5" />
                  <span>Assignments</span>
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {assignments.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`flex-1 px-6 py-4 font-medium transition-all ${
                  activeTab === 'files'
                    ? 'bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Upload className="w-5 h-5" />
                  <span>Files</span>
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {files.length}
                  </span>
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Announcements Tab */}
              {activeTab === 'announcements' && (
                <div className="space-y-4">
                  {announcements.map((announcement) => (
                    <div key={announcement.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(announcement.priority)}`}>
                          {announcement.priority}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-4">{announcement.content}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{announcement.targetAudience}</span>
                        {announcement.subject && <span>• {announcement.subject}</span>}
                        <span>• {new Date(announcement.datePosted).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                  {announcements.length === 0 && (
                    <div className="text-center py-12">
                      <Megaphone className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No announcements yet</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Create your first announcement
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Assignments Tab */}
              {activeTab === 'assignments' && (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">{assignment.title}</h3>
                          <p className="text-gray-700 mb-4">{assignment.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          <span>{assignment.subject}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{assignment.totalPoints} points</span>
                        </div>
                      </div>
                      {assignment.attachments && assignment.attachments.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Paperclip className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-600">{assignment.attachments.length} attachment(s)</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {assignments.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No assignments yet</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Create your first assignment
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div className="space-y-4">
                  {files.map((file) => (
                    <div key={file.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="p-3 bg-emerald-50 rounded-lg">
                            {getFileIcon(file.fileType)}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">{file.fileName}</h3>
                            <p className="text-gray-600 text-sm mb-3">{file.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>{file.subject}</span>
                              <span>• {file.fileSize}</span>
                              <span>• {new Date(file.uploadDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Download className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {files.length === 0 && (
                    <div className="text-center py-12">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No files uploaded yet</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Upload your first file
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {activeTab === 'announcements' && 'Create Announcement'}
                    {activeTab === 'assignments' && 'Create Assignment'}
                    {activeTab === 'files' && 'Upload File'}
                  </h3>
                  <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Announcement Form */}
                {activeTab === 'announcements' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Enter announcement title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Enter announcement content"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <CustomSelect
                        label="Target Audience"
                        value={formData.targetAudience}
                        onChange={(value) => setFormData({ ...formData, targetAudience: value as any })}
                        options={[
                          { value: 'Subject-specific', label: 'Subject-specific' },
                          { value: 'School-wide', label: 'School-wide' }
                        ]}
                      />

                      <CustomSelect
                        label="Priority"
                        value={formData.priority}
                        onChange={(value) => setFormData({ ...formData, priority: value as any })}
                        options={[
                          { value: 'Low', label: 'Low' },
                          { value: 'Medium', label: 'Medium' },
                          { value: 'High', label: 'High' }
                        ]}
                      />
                    </div>

                    {formData.targetAudience === 'Subject-specific' && (
                      <CustomSelect
                        label="Subject"
                        value={formData.subject}
                        onChange={(value) => setFormData({ ...formData, subject: value })}
                        options={[
                          { value: 'MATH101', label: 'MATH101 - Advanced Mathematics' },
                          { value: 'MATH102', label: 'MATH102 - Calculus I' },
                          { value: 'MATH201', label: 'MATH201 - Linear Algebra' }
                        ]}
                      />
                    )}

                    <button
                      onClick={handleSubmit}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all font-medium shadow-sm hover:shadow-md"
                    >
                      <Send className="w-4 h-4" />
                      Post Announcement
                    </button>
                  </>
                )}

                {/* Assignment Form */}
                {activeTab === 'assignments' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Title</label>
                      <input
                        type="text"
                        value={assignmentFormData.title}
                        onChange={(e) => setAssignmentFormData({ ...assignmentFormData, title: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Enter assignment title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        value={assignmentFormData.description}
                        onChange={(e) => setAssignmentFormData({ ...assignmentFormData, description: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Enter assignment description and instructions"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <CustomSelect
                        label="Subject"
                        value={assignmentFormData.subject}
                        onChange={(value) => setAssignmentFormData({ ...assignmentFormData, subject: value })}
                        options={[
                          { value: 'MATH101', label: 'MATH101 - Advanced Mathematics' },
                          { value: 'MATH102', label: 'MATH102 - Calculus I' },
                          { value: 'MATH201', label: 'MATH201 - Linear Algebra' }
                        ]}
                      />

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Total Points</label>
                        <input
                          type="number"
                          value={assignmentFormData.totalPoints}
                          onChange={(e) => setAssignmentFormData({ ...assignmentFormData, totalPoints: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                      <input
                        type="date"
                        value={assignmentFormData.dueDate}
                        onChange={(e) => setAssignmentFormData({ ...assignmentFormData, dueDate: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Optional)</label>
                      <input
                        ref={assignmentFileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleAssignmentFilesChange}
                      />
                      <div
                        onClick={handleAssignmentFilesClick}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                      >
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {assignmentFileNames || 'Click to upload or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10MB</p>
                      </div>
                    </div>

                    <button
                      onClick={handleAssignmentSubmit}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all font-medium shadow-sm hover:shadow-md"
                    >
                      <FileText className="w-4 h-4" />
                      Create Assignment
                    </button>
                  </>
                )}

                {/* File Upload Form */}
                {activeTab === 'files' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">File Upload</label>
                      <input
                        ref={uploadFileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleUploadFileChange}
                      />
                      <div
                        onClick={handleUploadFileClick}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                      >
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-1">
                          {uploadFileName || 'Click to upload or drag and drop'}
                        </p>
                        <p className="text-sm text-gray-500">PDF, DOC, DOCX, PPT, PPTX up to 25MB</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">File Name</label>
                      <input
                        type="text"
                        value={fileFormData.fileName}
                        onChange={(e) => setFileFormData({ ...fileFormData, fileName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g., Lecture_Notes_Week4.pdf"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        value={fileFormData.description}
                        onChange={(e) => setFileFormData({ ...fileFormData, description: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Brief description of the file content"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <CustomSelect
                        label="Subject"
                        value={fileFormData.subject}
                        onChange={(value) => setFileFormData({ ...fileFormData, subject: value })}
                        options={[
                          { value: 'MATH101', label: 'MATH101 - Advanced Mathematics' },
                          { value: 'MATH102', label: 'MATH102 - Calculus I' },
                          { value: 'MATH201', label: 'MATH201 - Linear Algebra' }
                        ]}
                      />

                      <CustomSelect
                        label="File Type"
                        value={fileFormData.fileType}
                        onChange={(value) => setFileFormData({ ...fileFormData, fileType: value })}
                        options={[
                          { value: 'PDF', label: 'PDF Document' },
                          { value: 'DOCX', label: 'Word Document' },
                          { value: 'PPTX', label: 'PowerPoint' },
                          { value: 'XLSX', label: 'Excel Spreadsheet' }
                        ]}
                      />
                    </div>

                    <button
                      onClick={handleFileSubmit}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all font-medium shadow-sm hover:shadow-md"
                    >
                      <Upload className="w-4 h-4" />
                      Upload File
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}