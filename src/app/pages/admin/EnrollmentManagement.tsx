import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from '../../components/AdminSidebar';
import { CustomSelect } from '../../components/admin/CustomSelect';
import { CustomDropdown } from '../../components/admin/CustomDropdown';
import { NotificationDropdown, type NotificationItem } from '../../components/NotificationDropdown';
import { adminNotifications } from '../../components/NotificationDefault';
import { Search, Filter, UserPlus, CheckCircle, XCircle, Clock, Download, X } from 'lucide-react';

interface Enrollment {
  id: string;
  studentName: string;
  studentId: string;
  subjectCode: string;
  subjectName: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  enrollmentDate: string;
}

interface EnrollmentFormData {
  studentId: string;
  subjectCode: string;
}

export function EnrollmentManagement() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [formData, setFormData] = useState<EnrollmentFormData>({ studentId: '', subjectCode: '' });
  const [notificationList, setNotificationList] = useState<NotificationItem[]>(adminNotifications);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const availableStudents: { id: string; name: string }[] = [];
  const availableSubjects: { code: string; name: string }[] = [];

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

  const handleEnrollStudent = () => {
    if (!formData.studentId || !formData.subjectCode) {
      alert('Please select both student and subject');
      return;
    }
    const student = availableStudents.find(s => s.id === formData.studentId);
    const subject = availableSubjects.find(s => s.code === formData.subjectCode);
    if (!student || !subject) return;

    const newEnrollment: Enrollment = {
      id: String(Date.now()),
      studentName: student.name,
      studentId: student.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      status: 'Pending',
      enrollmentDate: new Date().toISOString().split('T')[0]
    };
    setEnrollments([...enrollments, newEnrollment]);
    setShowEnrollModal(false);
    setFormData({ studentId: '', subjectCode: '' });
  };

  const handleStatusChange = (enrollmentId: string, newStatus: 'Approved' | 'Rejected') => {
    setEnrollments(enrollments.map(e => e.id === enrollmentId ? { ...e, status: newStatus } : e));
  };

  const handleOpenStatusModal = (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment);
    setShowStatusModal(true);
  };

  const handleUpdateStatus = (newStatus: 'Pending' | 'Approved' | 'Rejected') => {
    if (selectedEnrollment) {
      setEnrollments(enrollments.map(e => e.id === selectedEnrollment.id ? { ...e, status: newStatus } : e));
      setShowStatusModal(false);
      setSelectedEnrollment(null);
    }
  };

  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesSearch =
      enrollment.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enrollment.subjectCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || enrollment.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-100 text-emerald-700';
      case 'Pending': return 'bg-blue-100 text-blue-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
      case 'Pending': return <Clock className="w-4 h-4" />;
      case 'Rejected': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enrollment management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar adminName={adminName} onLogout={handleLogout} />
      <div className="hidden lg:block w-72 flex-shrink-0" />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Enrollment Management</h2>
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id: string) => setNotificationList(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))}
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Enrollment Management</h1>
                <p className="text-emerald-50">{enrollments.length} enrollment requests</p>
              </div>
              <button onClick={() => setShowEnrollModal(true)} className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-medium">
                <UserPlus className="w-5 h-5" />
                Enroll Student
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Approved</p>
              <p className="text-3xl font-bold text-emerald-600">{enrollments.filter(e => e.status === 'Approved').length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Pending</p>
              <p className="text-3xl font-bold text-blue-600">{enrollments.filter(e => e.status === 'Pending').length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Rejected</p>
              <p className="text-3xl font-bold text-red-600">{enrollments.filter(e => e.status === 'Rejected').length}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Search by student name or subject..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <CustomSelect value={filterStatus} onChange={setFilterStatus} options={[{ value: 'all', label: 'All Status' }, { value: 'approved', label: 'Approved' }, { value: 'pending', label: 'Pending' }, { value: 'rejected', label: 'Rejected' }]} icon={<Filter className="w-5 h-5" />} className="min-w-[180px]" />
              </div>
              <button className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollment Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEnrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{enrollment.studentName}</p>
                        <p className="text-sm text-gray-500">{enrollment.studentId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{enrollment.subjectName}</p>
                        <p className="text-sm text-gray-500">{enrollment.subjectCode}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(enrollment.status)}`}>
                          {getStatusIcon(enrollment.status)}{enrollment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(enrollment.enrollmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {enrollment.status === 'Pending' ? (
                            <>
                              <button onClick={() => handleStatusChange(enrollment.id, 'Approved')} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium">Approve</button>
                              <button onClick={() => handleStatusChange(enrollment.id, 'Rejected')} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">Reject</button>
                            </>
                          ) : (
                            <button onClick={() => handleOpenStatusModal(enrollment)} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">Change Status</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredEnrollments.length === 0 && (
              <div className="p-12 text-center">
                <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No enrollments yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Enroll Student Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Enroll Student</h3>
              <button onClick={() => { setShowEnrollModal(false); setFormData({ studentId: '', subjectCode: '' }); }} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <CustomDropdown label="Select Student" value={formData.studentId} onChange={(value: string) => setFormData({ ...formData, studentId: value })} options={[{ value: '', label: 'Choose a student...' }, ...availableStudents.map(student => ({ value: student.id, label: student.name, sublabel: student.id }))]} placeholder="Choose a student..." />
                <CustomDropdown label="Select Subject" value={formData.subjectCode} onChange={(value: string) => setFormData({ ...formData, subjectCode: value })} options={[{ value: '', label: 'Choose a subject...' }, ...availableSubjects.map(subject => ({ value: subject.code, label: subject.name, sublabel: subject.code }))]} placeholder="Choose a subject..." />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowEnrollModal(false); setFormData({ studentId: '', subjectCode: '' }); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleEnrollStudent} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Enroll Student</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatusModal && selectedEnrollment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Change Enrollment Status</h3>
              <button onClick={() => { setShowStatusModal(false); setSelectedEnrollment(null); }} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
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
                <button onClick={() => handleUpdateStatus('Pending')} className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border-2 border-blue-200">
                  <Clock className="w-5 h-5" /><span className="font-medium">Pending</span>
                </button>
                <button onClick={() => handleUpdateStatus('Approved')} className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors border-2 border-emerald-200">
                  <CheckCircle className="w-5 h-5" /><span className="font-medium">Approved</span>
                </button>
                <button onClick={() => handleUpdateStatus('Rejected')} className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border-2 border-red-200">
                  <XCircle className="w-5 h-5" /><span className="font-medium">Rejected</span>
                </button>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowStatusModal(false); setSelectedEnrollment(null); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}