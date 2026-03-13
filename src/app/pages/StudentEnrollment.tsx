import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/app/components/Sidebar';
import { 
  Upload, 
  FileText, 
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  File,
  Trash2
} from 'lucide-react';

interface EnrollmentRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedDate: string;
  documents: {
    birthCertificate?: string;
    reportCard?: string;
    idPhoto?: string;
  };
  remarks?: string;
}

export function StudentEnrollment() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{[key: string]: File | null}>({
    birthCertificate: null,
    reportCard: null,
    idPhoto: null
  });

  // Mock enrollment request data
  const [enrollmentRequest] = useState<EnrollmentRequest | null>({
    id: '1',
    status: 'pending',
    submittedDate: '2026-02-10',
    documents: {
      birthCertificate: 'birth_certificate.pdf',
      reportCard: 'grade_10_report.pdf',
      idPhoto: 'student_photo.jpg'
    }
  });

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');
    if (!userData) {
      navigate('/school-selection');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'student') {
      navigate('/school-selection');
      return;
    }

    setStudentName(user.name);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/school-selection');
  };

  const handleFileSelect = (fileType: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFiles(prev => ({
        ...prev,
        [fileType]: file
      }));
    }
  };

  const handleRemoveFile = (fileType: string) => {
    setUploadedFiles(prev => ({
      ...prev,
      [fileType]: null
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-4 py-2 bg-green-100 text-green-700 font-medium rounded-full">
            <CheckCircle className="w-4 h-4" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 font-medium rounded-full">
            <AlertCircle className="w-4 h-4" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-full">
            <Clock className="w-4 h-4" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      {/* Decorative Background Patterns */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
      </div>

      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        {/* Top Bar */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Enrollment Application</h2>
                <p className="text-sm text-gray-600">Submit your enrollment documents</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-w-5xl mx-auto">
          {/* Info Banner */}
          <div className="bg-emerald-600 rounded-2xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2">Enrollment Portal</h1>
              <p className="text-emerald-50 mb-6">Complete your registration by uploading the required academic documents below.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Step 1</p>
                  <p className="text-sm font-semibold">Prepare Documents</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Step 2</p>
                  <p className="text-sm font-semibold">Upload & Submit</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Step 3</p>
                  <p className="text-sm font-semibold">Wait for Review</p>
                </div>
              </div>
            </div>
            <FileText className="absolute bottom-[-20px] right-[-20px] w-48 h-48 opacity-10 rotate-12" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Document Upload Section - Always visible now */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                  <h3 className="text-lg font-semibold text-gray-900">Requirement Checklist</h3>
                  <span className="text-xs font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-1 rounded">Mandatory</span>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Birth Certificate */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-gray-700">Birth Certificate (PSA)</label>
                      {uploadedFiles.birthCertificate && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Ready</span>}
                    </div>
                    {uploadedFiles.birthCertificate ? (
                      <div className="border-2 border-emerald-500 bg-emerald-50 rounded-xl p-4 flex items-center justify-between group transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <FileText className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{uploadedFiles.birthCertificate.name}</p>
                            <p className="text-xs text-gray-500">{(uploadedFiles.birthCertificate.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        <button onClick={() => handleRemoveFile('birthCertificate')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer block group">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileSelect('birthCertificate', e)} className="hidden" />
                        <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2 group-hover:text-emerald-500 transition-colors" />
                        <p className="text-sm text-gray-600">Select file to upload</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG (max 5MB)</p>
                      </label>
                    )}
                  </div>

                  {/* Report Card */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-gray-700">Report Card (Form 138)</label>
                      {uploadedFiles.reportCard && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Ready</span>}
                    </div>
                    {uploadedFiles.reportCard ? (
                      <div className="border-2 border-emerald-500 bg-emerald-50 rounded-xl p-4 flex items-center justify-between group transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <FileText className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{uploadedFiles.reportCard.name}</p>
                            <p className="text-xs text-gray-500">{(uploadedFiles.reportCard.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        <button onClick={() => handleRemoveFile('reportCard')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer block group">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileSelect('reportCard', e)} className="hidden" />
                        <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2 group-hover:text-emerald-500 transition-colors" />
                        <p className="text-sm text-gray-600">Select file to upload</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG (max 5MB)</p>
                      </label>
                    )}
                  </div>

                  {/* Submit Button Area */}
                  <div className="pt-4">
                    <button
                      disabled={!uploadedFiles.birthCertificate || !uploadedFiles.reportCard}
                      className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit Enrollment Package
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-4 uppercase font-bold tracking-widest">Secure document transmission enabled</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Status Card */}
              {enrollmentRequest && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Application Status</h3>
                  <div className="flex flex-col items-center text-center p-4 bg-gray-50 rounded-xl mb-6">
                    <div className="mb-4">
                      {getStatusBadge(enrollmentRequest.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Last Updated</p>
                    <p className="font-bold text-gray-900">{new Date(enrollmentRequest.submittedDate).toLocaleDateString()}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${enrollmentRequest.status === 'pending' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                      <p className="text-sm text-gray-700">Documents Received</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${enrollmentRequest.status === 'pending' ? 'bg-gray-300' : 'bg-emerald-500'}`}></div>
                      <p className="text-sm text-gray-700">Administrator Review</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                      <p className="text-sm text-gray-700">Final Approval</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Assistance Card */}
              <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="font-bold mb-2">Need Help?</h4>
                  <p className="text-sm text-blue-100 mb-4">If you're having trouble uploading your documents, please visit the Registrar's Office.</p>
                  <button className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
                    Contact Support
                  </button>
                </div>
                <Clock className="absolute top-[-10px] right-[-10px] w-24 h-24 opacity-10 -rotate-12" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Submit Enrollment Documents</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Birth Certificate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birth Certificate (PSA) *
                </label>
                {uploadedFiles.birthCertificate ? (
                  <div className="border-2 border-emerald-500 bg-emerald-50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{uploadedFiles.birthCertificate.name}</p>
                        <p className="text-xs text-gray-600">
                          {(uploadedFiles.birthCertificate.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFile('birthCertificate')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer block">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileSelect('birthCertificate', e)}
                      className="hidden"
                    />
                    <File className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload</p>
                    <p className="text-xs text-gray-500">PDF, JPG, PNG (max 5MB)</p>
                  </label>
                )}
              </div>

              {/* Report Card */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Previous Report Card (Form 138) *
                </label>
                {uploadedFiles.reportCard ? (
                  <div className="border-2 border-emerald-500 bg-emerald-50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{uploadedFiles.reportCard.name}</p>
                        <p className="text-xs text-gray-600">
                          {(uploadedFiles.reportCard.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFile('reportCard')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer block">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileSelect('reportCard', e)}
                      className="hidden"
                    />
                    <File className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload</p>
                    <p className="text-xs text-gray-500">PDF, JPG, PNG (max 5MB)</p>
                  </label>
                )}
              </div>

              {/* ID Photo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recent ID Photo (2x2) *
                </label>
                {uploadedFiles.idPhoto ? (
                  <div className="border-2 border-emerald-500 bg-emerald-50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{uploadedFiles.idPhoto.name}</p>
                        <p className="text-xs text-gray-600">
                          {(uploadedFiles.idPhoto.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFile('idPhoto')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer block">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={(e) => handleFileSelect('idPhoto', e)}
                      className="hidden"
                    />
                    <File className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload</p>
                    <p className="text-xs text-gray-500">JPG, PNG (max 2MB)</p>
                  </label>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!uploadedFiles.birthCertificate || !uploadedFiles.reportCard || !uploadedFiles.idPhoto}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
