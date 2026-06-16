import { NotificationItem } from '../components/NotificationDropdown';


export const studentNotifications: NotificationItem[] = [
  {
    id: 'student-1',
    title: 'New Assignment Posted',
    message: 'Mathematics chapter 5 assignment is now available',
    path: '/subjects',
    isRead: false,
    timestamp: '1 hour ago'
  },
  {
    id: 'student-2',
    title: 'Grade Updated',
    message: 'Your Mathematics grade has been recorded: 92%',
    path: '/grades',
    isRead: false,
    timestamp: '2 hours ago'
  },
  {
    id: 'student-5',
    title: 'New Announcement',
    message: 'Mid-term examinations scheduled for January 20-24',
    path: '/announcements',
    isRead: false,
    timestamp: '2 days ago'
  },
  {
    id: 'student-6',
    title: 'New Material Uploaded',
    message: 'Ms. Rodriguez uploaded Week 3 lecture notes',
    path: '/materials',
    isRead: false,
    timestamp: '3 hours ago'
  },
  {
    id: 'student-7',
    title: 'Enrollment Open',
    message: 'Enrollment for next semester is now open',
    path: '/enrollment',
    isRead: false,
    timestamp: '1 day ago'
  },
  {
    id: 'student-8',
    title: 'New Message',
    message: 'Ms. Rodriguez sent you a message',
    path: '/messages',
    isRead: false,
    timestamp: '30 mins ago'
  },
  {
    id: 'student-9',
    title: 'Profile Incomplete',
    message: 'Please complete your profile information',
    path: '/profile',
    isRead: false,
    timestamp: '2 days ago'
  },
];

export const teacherNotifications: NotificationItem[] = [
  {
    id: 'teacher-1',
    title: 'Grade Submission Reminder',
    message: 'Final grades for MATH101 are due by Jan 28.',
    path: '/teacher/grades',
    isRead: false,
    timestamp: '2 hours ago'
  },
  {
    id: 'teacher-2',
    title: 'New Message from Student',
    message: 'Juan Dela Cruz sent you a message.',
    path: '/teacher/messages',
    isRead: false,
    timestamp: '1 day ago'
  },
  {
    id: 'teacher-5',
    title: 'Announcement Posted',
    message: 'Your announcement has been published successfully.',
    path: '/teacher/announcements',
    isRead: false,
    timestamp: '1 day ago'
  },
  {
    id: 'teacher-6',
    title: 'New Class Material',
    message: 'A student submitted a request for additional materials.',
    path: '/teacher/materials',
    isRead: false,
    timestamp: '4 hours ago'
  },
  {
    id: 'teacher-7',
    title: 'Profile Update Required',
    message: 'Please update your teacher profile information.',
    path: '/teacher/profile',
    isRead: false,
    timestamp: '3 days ago'
  },
];

export const adminNotifications: NotificationItem[] = [
  {
    id: 'admin-1',
    title: 'New Student Enrollment',
    message: '5 new enrollment requests pending approval.',
    path: '/admin/enrollment',
    isRead: false,
    timestamp: '1 hour ago'
  },
  {
    id: 'admin-2',
    title: 'System Backup Complete',
    message: 'Nightly backup completed successfully.',
    path: '/admin/settings',
    isRead: false,
    timestamp: '3 hours ago'
  },
  {
    id: 'admin-3',
    title: 'Teacher Account Created',
    message: 'Maria Santos was added to the system.',
    path: '/admin/teachers',
    isRead: false,
    timestamp: '1 day ago'
  },
  {
    id: 'admin-4',
    title: 'New Student Registered',
    message: 'Juan Dela Cruz has registered and is pending approval.',
    path: '/admin/students',
    isRead: false,
    timestamp: '2 hours ago'
  },
  {
    id: 'admin-5',
    title: 'New Announcement',
    message: 'A new announcement has been posted school-wide.',
    path: '/admin/announcements',
    isRead: false,
    timestamp: '30 mins ago'
  },
  {
    id: 'admin-6',
    title: 'Subject Updated',
    message: 'Advanced Mathematics curriculum has been updated.',
    path: '/admin/subjects',
    isRead: false,
    timestamp: '5 hours ago'
  },
  {
    id: 'admin-7',
    title: 'New Report Available',
    message: 'Monthly academic performance report is ready.',
    path: '/admin/reports',
    isRead: false,
    timestamp: '1 day ago'
  },
  {
    id: 'admin-8',
    title: 'System Settings Changed',
    message: 'School year settings have been updated.',
    path: '/admin/settings',
    isRead: false,
    timestamp: '2 days ago'
  },
];