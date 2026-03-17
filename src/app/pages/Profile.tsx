import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/app/components/Sidebar';
import { 
  Bell, 
  User,
  Mail,
  Phone,
  School,
  Calendar,
  MapPin,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface StudentProfile {
  studentId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  grade: string;
  section: string;
  enrollmentDate: string;
  address: string;
  dateOfBirth: string;
  guardianName: string;
  guardianContact: string;
}

export function Profile() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('');
  const [notifications, setNotifications] = useState(3);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [profileErrors, setProfileErrors] = useState<{ field: string; message: string }[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showPasswordSuccess, setShowPasswordSuccess] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Mock profile data
  const [profile, setProfile] = useState<StudentProfile>({
    studentId: 'STU-2026-001',
    fullName: 'Juan Dela Cruz',
    email: 'juan.delacruz@student.connected.edu',
    contactNumber: '+63 912 345 6789',
    grade: 'Grade 11',
    section: 'STEM-A',
    enrollmentDate: '2025-08-15',
    address: '123 Main Street, Manila, Philippines',
    dateOfBirth: '2008-05-15',
    guardianName: 'Maria Dela Cruz',
    guardianContact: '+63 917 654 3210'
  });

  const [editedProfile, setEditedProfile] = useState(profile);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

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
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedProfile(profile);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile(profile);
    setProfileErrors([]);
  };

  const handleSave = () => {
    const errors: { field: string; message: string }[] = [];

    // Contact number validation
    if (!editedProfile.contactNumber.trim()) {
      errors.push({ field: 'contactNumber', message: 'Contact number is required' });
    } else if (!/^\+\d{1,3}\s\d{3}\s\d{3}\s\d{4}$/.test(editedProfile.contactNumber.trim())) {
      errors.push({ field: 'contactNumber', message: 'Contact number must be in format: +63 912 345 6789' });
    }

    // Address validation
    if (!editedProfile.address.trim()) {
      errors.push({ field: 'address', message: 'Address is required' });
    } else if (editedProfile.address.trim().length < 10) {
      errors.push({ field: 'address', message: 'Address must be at least 10 characters long' });
    }

    if (errors.length > 0) {
      setProfileErrors(errors);
      return;
    }

    // Clear errors and save
    setProfileErrors([]);
    setProfile(editedProfile);
    setIsEditing(false);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handlePasswordChange = () => {
    const errors: string[] = [];

    // Current password validation
    if (!passwordData.currentPassword) {
      errors.push('Current password is required');
    }

    // New password validation
    if (!passwordData.newPassword) {
      errors.push('New password is required');
    } else {
      // Minimum length check
      if (passwordData.newPassword.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }
      
      // At least one uppercase letter
      if (!/[A-Z]/.test(passwordData.newPassword)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      
      // At least one lowercase letter
      if (!/[a-z]/.test(passwordData.newPassword)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      
      // At least one number
      if (!/[0-9]/.test(passwordData.newPassword)) {
        errors.push('Password must contain at least one number');
      }
      
      // At least one special character
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword)) {
        errors.push('Password must contain at least one special character (!@#$%^&*...)');
      }
    }

    // Confirm password validation
    if (!passwordData.confirmPassword) {
      errors.push('Please confirm your new password');
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.push('New password and confirmation password do not match');
    }

    // Check if new password is same as current
    if (passwordData.currentPassword && passwordData.newPassword && 
        passwordData.currentPassword === passwordData.newPassword) {
      errors.push('New password must be different from current password');
    }

    if (errors.length > 0) {
      setPasswordErrors(errors);
      return;
    }

    // Clear errors and simulate password change
    setPasswordErrors([]);
    setIsChangingPassword(false);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswordSuccess(true);
    setTimeout(() => setShowPasswordSuccess(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
              </div>
              <div className="flex items-center gap-4">
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
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white/30">
                <span className="text-4xl font-bold">{profile.fullName.charAt(0)}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{profile.fullName}</h1>
                <p className="text-emerald-50 mb-1">{profile.studentId}</p>
                <p className="text-emerald-100">{profile.grade} - {profile.section}</p>
              </div>
            </div>
          </div>

          {/* Main Profile Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Personal Information */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                {!isEditing ? (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-6">
                {/* Error Alert */}
                {profileErrors.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800 mb-1">Please fix the following errors:</p>
                        <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                          {profileErrors.map((error, index) => (
                            <li key={index}>{error.message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Student ID - Read Only */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Student ID
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <User className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">{profile.studentId}</span>
                  </div>
                </div>

                {/* Full Name - Read Only */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <User className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">{profile.fullName}</span>
                  </div>
                </div>

                {/* Email - Read Only */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">{profile.email}</span>
                  </div>
                </div>

                {/* Contact Number - Editable */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number
                  </label>
                  {isEditing ? (
                    <div className="flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        value={editedProfile.contactNumber}
                        onChange={(e) => setEditedProfile({ ...editedProfile, contactNumber: e.target.value })}
                        className="flex-1 outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-900">{profile.contactNumber}</span>
                    </div>
                  )}
                </div>

                {/* Address - Editable */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  {isEditing ? (
                    <div className="flex items-start gap-3 px-4 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <textarea
                        value={editedProfile.address}
                        onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value })}
                        rows={2}
                        className="flex-1 outline-none resize-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <span className="text-gray-900">{profile.address}</span>
                    </div>
                  )}
                </div>

                {/* Date of Birth - Read Only */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">
                      {new Date(profile.dateOfBirth).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Academic & Guardian Info */}
            <div className="space-y-6">
              {/* Academic Information */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Academic Information</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Grade Level</p>
                    <p className="font-medium text-gray-900">{profile.grade}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">Section</p>
                    <p className="font-medium text-gray-900">{profile.section}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">Enrollment Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(profile.enrollmentDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Guardian Information */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Guardian Information</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Guardian Name</p>
                    <p className="font-medium text-gray-900">{profile.guardianName}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">Guardian Contact</p>
                    <p className="font-medium text-gray-900">{profile.guardianContact}</p>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Security</h3>
                </div>
                <div className="p-6">
                  <button
                    onClick={() => setIsChangingPassword(!isChangingPassword)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Change Password Modal */}
          {isChangingPassword && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900">Change Password</h3>
                    <button
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordErrors([]);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {passwordErrors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {passwordErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={handlePasswordChange}
                    className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all font-medium"
                  >
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {showSuccessMessage && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900">Success</h3>
                    <button
                      onClick={() => setShowSuccessMessage(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <ul className="list-disc list-inside text-sm text-emerald-700 space-y-1">
                      <li>Profile updated successfully!</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Password Success Message */}
          {showPasswordSuccess && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900">Success</h3>
                    <button
                      onClick={() => setShowPasswordSuccess(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <ul className="list-disc list-inside text-sm text-emerald-700 space-y-1">
                      <li>Password changed successfully!</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}