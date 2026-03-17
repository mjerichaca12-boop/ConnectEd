import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LandingPage } from '@/app/pages/LandingPage';
import { TermsAndPrivacy } from '@/app/pages/TermsAndPrivacy';
import { Login } from '@/app/pages/Login';
import { SignUp } from '@/app/pages/SignUp';
import { ForgotPassword } from '@/app/pages/ForgotPassword';
import { AdminLogin } from '@/app/pages/AdminLogin';
import { StudentDashboard } from '@/app/pages/StudentDashboard';
import { Subjects } from '@/app/pages/Subjects';
import { SubjectDetail } from '@/app/pages/SubjectDetail';
import { Grades } from '@/app/pages/Grades';
import { Attendance } from '@/app/pages/Attendance';
import { Announcements } from '@/app/pages/Announcements';
import { StudentContent } from '@/app/pages/StudentContent';
import { StudentMaterials } from '@/app/pages/StudentMaterials';
import { StudentEnrollment } from '@/app/pages/StudentEnrollment';
import { Messages } from '@/app/pages/Messages';
import { Profile } from '@/app/pages/Profile';
import { VideoConferencing } from '@/app/pages/VideoConferencing';
import { TeacherDashboard } from '@/app/pages/teacher/TeacherDashboard';
import { Classes } from '@/app/pages/teacher/Classes';
import { ClassDetail } from '@/app/pages/teacher/ClassDetail';
import { GradesManagement } from '@/app/pages/teacher/GradesManagement';
import { AttendanceManagement } from '@/app/pages/teacher/AttendanceManagement';
import { TeacherAnnouncements } from '@/app/pages/teacher/TeacherAnnouncements';
import { ClassMaterials } from '@/app/pages/teacher/ClassMaterials';
import { TeacherMessages } from '@/app/pages/teacher/TeacherMessages';
import { TeacherProfile } from '@/app/pages/teacher/TeacherProfile';
import { VideoConferencing as TeacherVideoConferencing } from '@/app/pages/teacher/VideoConferencing';
import { AdminDashboard } from '@/app/pages/admin/AdminDashboard';
import { StudentManagement } from '@/app/pages/admin/StudentManagement';
import { TeacherManagement } from '@/app/pages/admin/TeacherManagement';
import { SubjectManagement } from '@/app/pages/admin/SubjectManagement';
import { EnrollmentManagement } from '@/app/pages/admin/EnrollmentManagement';
import { AdminAnnouncements } from '@/app/pages/admin/AdminAnnouncements';
import { Reports } from '@/app/pages/admin/Reports';
import { SystemSettings } from '@/app/pages/admin/SystemSettings';

/**
 * ConnectEd Academic Portal - Route Configuration
 * 
 * Authentication Flow:
 * 1. Landing Page (/) - Public
 * 2. Login (/login) - Students, Teachers, and Admins (role-based redirect):
 *    - Student → /dashboard
 *    - Teacher → /teacher/dashboard
 *    - Admin → /admin/dashboard
 * 3. Sign Up (/signup) - Students, Teachers, and Admins
 * 4. Forgot Password (/forgot-password) - Password reset for all users
 * 
 * Student Routes (prefix: /)
 * - /dashboard - Main dashboard
 * - /subjects - View enrolled subjects
 * - /grades - View academic grades
 * - /attendance - View attendance records
 * - /announcements - School and subject announcements
 * - /content - Academic resources (announcements, assignments, files)
 * - /materials - Student materials
 * - /enrollment - Student enrollment
 * - /messages - Inbox and messaging
 * - /profile - Personal profile and settings
 * - /video-conference - Video conferencing
 * 
 * Teacher Routes (prefix: /teacher)
 * - /teacher/dashboard - Teacher main dashboard
 * - /teacher/classes - Manage classes
 * - /teacher/class/:id - Class detail
 * - /teacher/grades - Grades management
 * - /teacher/attendance - Attendance management
 * - /teacher/announcements - Create and manage announcements, assignments, files
 * - /teacher/materials - Class materials
 * - /teacher/messages - Teacher messaging
 * - /teacher/profile - Teacher profile
 * - /teacher/video-conference - Video conferencing
 * 
 * Admin Routes (prefix: /admin)
 * - /admin - Dedicated admin login page
 * - /admin/dashboard - Admin main dashboard
 * - /admin/students - Student management
 * - /admin/teachers - Teacher management
 * - /admin/subjects - Subject management
 * - /admin/enrollment - Enrollment management
 * - /admin/announcements - System announcements
 * - /admin/reports - Generate reports
 * - /admin/settings - System settings
 */

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/terms-and-privacy" element={<TermsAndPrivacy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Admin Login - Separate from regular login */}
        <Route path="/admin" element={<AdminLogin />} />
        
        {/* Student Routes */}
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/subject/:id" element={<SubjectDetail />} />
        <Route path="/grades" element={<Grades />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/content" element={<StudentContent />} />
        <Route path="/materials" element={<StudentMaterials />} />
        <Route path="/enrollment" element={<StudentEnrollment />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/video-conference" element={<VideoConferencing />} />
        
        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/teacher/classes" element={<Classes />} />
        <Route path="/teacher/class/:id" element={<ClassDetail />} />
        <Route path="/teacher/grades" element={<GradesManagement />} />
        <Route path="/teacher/attendance" element={<AttendanceManagement />} />
        <Route path="/teacher/announcements" element={<TeacherAnnouncements />} />
        <Route path="/teacher/materials" element={<ClassMaterials />} />
        <Route path="/teacher/messages" element={<TeacherMessages />} />
        <Route path="/teacher/profile" element={<TeacherProfile />} />
        <Route path="/teacher/video-conference" element={<TeacherVideoConferencing />} />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<StudentManagement />} />
        <Route path="/admin/teachers" element={<TeacherManagement />} />
        <Route path="/admin/subjects" element={<SubjectManagement />} />
        <Route path="/admin/enrollment" element={<EnrollmentManagement />} />
        <Route path="/admin/announcements" element={<AdminAnnouncements />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/settings" element={<SystemSettings />} />
      </Routes>
    </Router>
  );
}