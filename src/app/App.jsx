import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { TermsAndPrivacy } from "./pages/TermsAndPrivacy";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { ForgotPassword } from "./pages/ForgotPassword";
import { AdminLogin } from "./pages/AdminLogin";
import { StudentDashboard } from "./pages/StudentDashboard";
import { Subjects } from "./pages/Subjects";
import { SubjectDetail } from "./pages/SubjectDetail";
import { Grades } from "./pages/Grades";
import { Attendance } from "./pages/Attendance";
import { Announcements } from "./pages/Announcements";
import { StudentContent } from "./pages/StudentContent";
import { StudentMaterials } from "./pages/StudentMaterials";
import { StudentEnrollment } from "./pages/StudentEnrollment";
import { Messages } from "./pages/Messages";
import { Profile } from "./pages/Profile";
import { VideoConferencing } from "./pages/VideoConferencing";
import { TeacherDashboard } from "./pages/teacher/TeacherDashboard";
import { Classes } from "./pages/teacher/Classes";
import { ClassDetail } from "./pages/teacher/ClassDetail";
import { GradesManagement } from "./pages/teacher/GradesManagement";
import { AttendanceManagement } from "./pages/teacher/AttendanceManagement";
import { TeacherAnnouncements } from "./pages/teacher/TeacherAnnouncements";
import { ClassMaterials } from "./pages/teacher/ClassMaterials";
import { TeacherMessages } from "./pages/teacher/TeacherMessages";
import { TeacherProfile } from "./pages/teacher/TeacherProfile";
import { VideoConferencing as TeacherVideoConferencing } from "./pages/teacher/VideoConferencing";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { StudentManagement } from "./pages/admin/StudentManagement";
import { TeacherManagement } from "./pages/admin/TeacherManagement";
import { SubjectManagement } from "./pages/admin/SubjectManagement";
import { EnrollmentManagement } from "./pages/admin/EnrollmentManagement";
import { AdminAnnouncements } from "./pages/admin/AdminAnnouncements";
import { Reports } from "./pages/admin/Reports";
import { SystemSettings } from "./pages/admin/SystemSettings";
function App() {
  return <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/terms-and-privacy" element={<TermsAndPrivacy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {
    /* Admin Login - Separate from regular login */
  }
        <Route path="/admin" element={<AdminLogin />} />

        {
    /* Student Routes */
  }
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

        {
    /* Teacher Routes */
  }
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

        {
    /* Admin Routes */
  }
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<StudentManagement />} />
        <Route path="/admin/teachers" element={<TeacherManagement />} />
        <Route path="/admin/subjects" element={<SubjectManagement />} />
        <Route path="/admin/enrollment" element={<EnrollmentManagement />} />
        <Route path="/admin/announcements" element={<AdminAnnouncements />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/settings" element={<SystemSettings />} />
      </Routes>
    </Router>;
}
export {
  App as default
};
