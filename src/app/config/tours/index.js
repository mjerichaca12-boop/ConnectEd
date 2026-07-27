import { DASHBOARD_TOUR } from "./dashboardTour";
import { STUDENT_TOUR } from "./studentTour";
import { TEACHER_TOUR } from "./teacherTour";
import { SUBJECT_TOUR } from "./subjectTour";
import { ANNOUNCEMENTS_TOUR } from "./announcementsTour";
import { CALENDAR_TOUR } from "./calendarTour";
import { ACADEMIC_SETTINGS_TOUR } from "./academicSettingsTour";
import { MESSAGES_TOUR } from "./messagesTour";

import { TEACHER_DASHBOARD_TOUR } from "./teacherDashboardTour";
import { TEACHER_CLASSES_TOUR } from "./teacherClassesTour";
import { TEACHER_GRADES_TOUR } from "./teacherGradesTour";
import { TEACHER_MESSAGES_TOUR } from "./teacherMessagesTour";
import { TEACHER_AI_TOUR } from "./teacherAiTour";
import { TEACHER_ANNOUNCEMENTS_TOUR } from "./teacherAnnouncementsTour";
import { TEACHER_PROFILE_TOUR } from "./teacherProfileTour";
import { TEACHER_CLASS_DETAIL_TOUR } from "./teacherClassDetailTour";

export const MODULE_TOURS = {
  // Admin Module Tours
  dashboard: DASHBOARD_TOUR,
  students: STUDENT_TOUR,
  teachers: TEACHER_TOUR,
  subjects: SUBJECT_TOUR,
  announcements: ANNOUNCEMENTS_TOUR,
  calendar: CALENDAR_TOUR,
  "academic-settings": ACADEMIC_SETTINGS_TOUR,
  messages: MESSAGES_TOUR,

  // Teacher Module Tours
  "teacher-dashboard": TEACHER_DASHBOARD_TOUR,
  classes: TEACHER_CLASSES_TOUR,
  "class-detail": TEACHER_CLASS_DETAIL_TOUR,
  grades: TEACHER_GRADES_TOUR,
  "teacher-messages": TEACHER_MESSAGES_TOUR,
  "ai-assistant": TEACHER_AI_TOUR,
  "teacher-announcements": TEACHER_ANNOUNCEMENTS_TOUR,
  "teacher-profile": TEACHER_PROFILE_TOUR,
};

export {
  DASHBOARD_TOUR,
  STUDENT_TOUR,
  TEACHER_TOUR,
  SUBJECT_TOUR,
  ANNOUNCEMENTS_TOUR,
  CALENDAR_TOUR,
  ACADEMIC_SETTINGS_TOUR,
  MESSAGES_TOUR,
  TEACHER_DASHBOARD_TOUR,
  TEACHER_CLASSES_TOUR,
  TEACHER_CLASS_DETAIL_TOUR,
  TEACHER_GRADES_TOUR,
  TEACHER_MESSAGES_TOUR,
  TEACHER_AI_TOUR,
  TEACHER_ANNOUNCEMENTS_TOUR,
  TEACHER_PROFILE_TOUR,
};
