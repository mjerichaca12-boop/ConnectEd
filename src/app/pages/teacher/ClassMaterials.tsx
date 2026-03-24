import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherSidebar } from '@/app/components/TeacherSidebar';
import { 
  Upload, 
  FileText, 
  File, 
  Download, 
  Trash2, 
  Eye,
  Plus,
  X,
  FolderOpen,
  Calendar,
  BookOpen
} from 'lucide-react';
import { CustomSelect } from '@/app/components/CustomSelect';

interface ClassMaterial {
  id: string;
  title: string;
  description: string;
  fileType: string;
  fileName: string;
  fileSize: string;
  subject: string;
  uploadDate: string;
  downloads: number;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  subject: string;
  dueDate: string;
  maxPoints: number;
  submissions: number;
  totalStudents: number;
}

export function ClassMaterials() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('');
  const [activeTab, setActiveTab] = useState<'materials' | 'activities'>('materials');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const materialFileInputRef = useRef<HTMLInputElement | null>(null);
  const activityFileInputRef = useRef<HTMLInputElement | null>(null);
  const [materialFileName, setMaterialFileName] = useState('');
  const [activityFileName, setActivityFileName] = useState('');

  // Mock data
  const [materials] = useState<ClassMaterial[]>([
    {
      id: '1',
      title: 'Chapter 5: Quadratic Equations',
      description: 'Complete lecture notes and practice problems',
      fileType: 'PDF',
      fileName: 'chapter-5-quadratic-equations.pdf',
      fileSize: '2.5 MB',
      subject: 'Advanced Mathematics',
      uploadDate: '2026-02-10',
      downloads: 24
    },
    {
      id: '2',
      title: 'Physics Lab Guide',
      description: 'Laboratory procedures and safety guidelines',
      fileType: 'PDF',
      fileName: 'physics-lab-guide.pdf',
      fileSize: '1.8 MB',
      subject: 'Physics',
      uploadDate: '2026-02-08',
      downloads: 18
    },
    {
      id: '3',
      title: 'Programming Basics Slides',
      description: 'Introduction to Python programming',
      fileType: 'PPTX',
      fileName: 'python-basics.pptx',
      fileSize: '5.2 MB',
      subject: 'Computer Science',
      uploadDate: '2026-02-05',
      downloads: 31
    }
  ]);

  const [activities] = useState<Activity[]>([
    {
      id: '1',
      title: 'Quadratic Equations Problem Set',
      description: 'Solve 20 problems on quadratic equations. Show all work.',
      subject: 'Advanced Mathematics',
      dueDate: '2026-02-20',
      maxPoints: 50,
      submissions: 18,
      totalStudents: 25
    },
    {
      id: '2',
      title: 'Physics Lab Report',
      description: 'Write a lab report on the Newton\'s Laws experiment',
      subject: 'Physics',
      dueDate: '2026-02-18',
      maxPoints: 100,
      submissions: 12,
      totalStudents: 25
    }
  ]);

  const subjects = [
    { value: 'math', label: 'Advanced Mathematics' },
    { value: 'physics', label: 'Physics' },
    { value: 'cs', label: 'Computer Science' },
    { value: 'chem', label: 'Chemistry' }
  ];

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
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  const handleMaterialFileClick = () => {
    materialFileInputRef.current?.click();
  };

  const handleMaterialFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setMaterialFileName(file ? file.name : '');
  };

  const handleActivityFileClick = () => {
    activityFileInputRef.current?.click();
  };

  const handleActivityFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setActivityFileName(file ? file.name : '');
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toUpperCase()) {
      case 'PDF':
        return <FileText className="w-5 h-5 text-red-600" />;
      case 'PPTX':
      case 'PPT':
        return <File className="w-5 h-5 text-red-600" />;
      case 'DOCX':
      case 'DOC':
        return <File className="w-5 h-5 text-blue-600" />;
      default:
        return <File className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Class Materials & Activities</h2>
                <p className="text-sm text-gray-600">Upload and manage educational resources</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('materials')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'materials'
                    ? 'text-emerald-600 border-b-2 border-emerald-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  Class Materials
                </div>
              </button>
              <button
                onClick={() => setActiveTab('activities')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'activities'
                    ? 'text-emerald-600 border-b-2 border-emerald-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Activities
                </div>
              </button>
            </div>
          </div>

          {/* Class Materials Tab */}
          {activeTab === 'materials' && (
            <div className="space-y-6">
              {/* Upload Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Upload className="w-5 h-5" />
                  Upload Material
                </button>
              </div>

              {/* Materials List */}
              <div className="grid grid-cols-1 gap-4">
                {materials.map((material) => (
                  <div key={material.id} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {getFileIcon(material.fileType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{material.title}</h3>
                        <p className="text-sm text-gray-600 mb-3">{material.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {material.subject}
                          </span>
                          <span className="flex items-center gap-1">
                            <File className="w-4 h-4" />
                            {material.fileType} · {material.fileSize}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(material.uploadDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="w-4 h-4" />
                            {material.downloads} downloads
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                          <Eye className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities Tab */}
          {activeTab === 'activities' && (
            <div className="space-y-6">
              {/* Create Activity Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Plus className="w-5 h-5" />
                  Create Activity
                </button>
              </div>

              {/* Activities List */}
              <div className="grid grid-cols-1 gap-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{activity.title}</h3>
                        <p className="text-sm text-gray-600 mb-3">{activity.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {activity.subject}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Due: {new Date(activity.dueDate).toLocaleDateString()}
                          </span>
                          <span>Max Points: {activity.maxPoints}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-emerald-600 h-2 rounded-full transition-all"
                              style={{ width: `${(activity.submissions / activity.totalStudents) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">
                            {activity.submissions}/{activity.totalStudents} submitted
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                          <Eye className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Upload Material Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Upload Class Material</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Chapter 5 Notes"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Brief description of the material"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                <CustomSelect
                  options={subjects}
                  value=""
                  onChange={() => {}}
                  placeholder="Select subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload File *</label>
                <input
                  ref={materialFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleMaterialFileChange}
                />
                <div
                  onClick={handleMaterialFileClick}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-1">
                    {materialFileName || 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX, PPT, PPTX (max 50MB)</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all">
                  Upload Material
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Create Activity</h3>
              <button
                onClick={() => setShowActivityModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Activity Title *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Problem Set 1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instructions *</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Detailed instructions for students"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                  <CustomSelect
                    options={subjects}
                    value=""
                    onChange={() => {}}
                    placeholder="Select subject"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Points *</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attach File (optional)</label>
                <input
                  ref={activityFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleActivityFileChange}
                />
                <div
                  onClick={handleActivityFileClick}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-1">
                    {activityFileName || 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX, ZIP (max 50MB)</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowActivityModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all">
                  Create Activity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}