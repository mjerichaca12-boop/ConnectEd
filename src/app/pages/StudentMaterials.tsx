import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/app/components/Sidebar';
import { 
  Download, 
  Upload, 
  FileText, 
  File, 
  Calendar, 
  BookOpen,
  FolderOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  X
} from 'lucide-react';

interface ClassMaterial {
  id: string;
  title: string;
  description: string;
  fileType: string;
  fileName: string;
  fileSize: string;
  subject: string;
  uploadDate: string;
  teacherName: string;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  subject: string;
  dueDate: string;
  maxPoints: number;
  teacherName: string;
  status: 'pending' | 'submitted' | 'late';
  submittedDate?: string;
}

export function StudentMaterials() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('');
  const [activeTab, setActiveTab] = useState<'materials' | 'activities'>('materials');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

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
      teacherName: 'Ms. Sarah Rodriguez'
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
      teacherName: 'Mr. John Santos'
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
      teacherName: 'Ms. Maria Cruz'
    }
  ]);

  const [activities] = useState<Activity[]>([
    {
      id: '1',
      title: 'Quadratic Equations Problem Set',
      description: 'Solve 20 problems on quadratic equations. Show all work and submit before the deadline.',
      subject: 'Advanced Mathematics',
      dueDate: '2026-02-20',
      maxPoints: 50,
      teacherName: 'Ms. Sarah Rodriguez',
      status: 'pending'
    },
    {
      id: '2',
      title: 'Physics Lab Report',
      description: 'Write a comprehensive lab report on the Newton\'s Laws experiment conducted in class.',
      subject: 'Physics',
      dueDate: '2026-02-18',
      maxPoints: 100,
      teacherName: 'Mr. John Santos',
      status: 'submitted',
      submittedDate: '2026-02-17'
    },
    {
      id: '3',
      title: 'Python Programming Assignment',
      description: 'Create a simple calculator program using Python. Include comments explaining your code.',
      subject: 'Computer Science',
      dueDate: '2026-02-12',
      maxPoints: 75,
      teacherName: 'Ms. Maria Cruz',
      status: 'late'
    }
  ]);

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');
    if (!userData) {
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'student') {
      navigate('/login');
      return;
    }

    setStudentName(user.name);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  const handleDownload = (material: ClassMaterial) => {
    // In a real app, this would trigger file download
    console.log('Downloading:', material.fileName);
    alert(`Downloading: ${material.fileName}`);
  };

  const handleSubmitActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setShowSubmitModal(true);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" />
            Submitted
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            <AlertCircle className="w-3 h-3" />
            Late
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">My Learning Resources</h2>
                <p className="text-sm text-gray-600">Access materials and submit activities</p>
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
                  My Activities
                </div>
              </button>
            </div>
          </div>

          {/* Class Materials Tab */}
          {activeTab === 'materials' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Download className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-900 font-medium mb-1">Download for Offline Access</p>
                  <p className="text-xs text-blue-700">You can download any material to study offline. Click the download button on any item.</p>
                </div>
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
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Uploaded by {material.teacherName}</p>
                      </div>
                      <button
                        onClick={() => handleDownload(material)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities Tab */}
          {activeTab === 'activities' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-900 font-medium mb-1">Submit Before Deadline</p>
                  <p className="text-xs text-blue-700">Make sure to upload your completed activities before the due date to avoid late penalties.</p>
                </div>
              </div>

              {/* Activities List */}
              <div className="grid grid-cols-1 gap-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{activity.title}</h3>
                          {getStatusBadge(activity.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{activity.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-2">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {activity.subject}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(activity.dueDate).toLocaleDateString()}
                          </span>
                          <span>Max Points: {activity.maxPoints}</span>
                        </div>
                        <p className="text-xs text-gray-500">Assigned by {activity.teacherName}</p>
                        {activity.status === 'submitted' && activity.submittedDate && (
                          <p className="text-xs text-green-600 mt-1">
                            Submitted on {new Date(activity.submittedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <span className={`text-sm font-medium ${
                        getDaysUntilDue(activity.dueDate).includes('Overdue') 
                          ? 'text-red-600' 
                          : 'text-gray-700'
                      }`}>
                        {getDaysUntilDue(activity.dueDate)}
                      </span>
                      {activity.status !== 'submitted' && (
                        <button
                          onClick={() => handleSubmitActivity(activity)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Submit Activity
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Submit Activity Modal */}
      {showSubmitModal && selectedActivity && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Submit Activity</h3>
              <button
                onClick={() => {
                  setShowSubmitModal(false);
                  setSelectedActivity(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Activity Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">{selectedActivity.title}</h4>
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span>Subject: {selectedActivity.subject}</span>
                  <span>Max Points: {selectedActivity.maxPoints}</span>
                  <span>Due: {new Date(selectedActivity.dueDate).toLocaleDateString()}</span>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Your Work *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX, ZIP (max 20MB)</p>
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comments (Optional)</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Any additional notes for your teacher..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowSubmitModal(false);
                    setSelectedActivity(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all">
                  Submit Activity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}