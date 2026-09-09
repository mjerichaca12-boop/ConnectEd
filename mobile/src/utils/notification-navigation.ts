export interface NotificationRouteResult {
    pathname: string;
    params?: Record<string, any>;
}

export interface NotificationMetaResult {
    icon: string;
    color: string;
    bg: string;
}

/**
 * Returns visual meta (icon, color, bg) for a notification item
 */
export function getNotificationMeta(item: any): NotificationMetaResult {
    const rawType = String(item?.type || '').toLowerCase().trim();
    const title = String(item?.title || '').toLowerCase().trim();

    if (rawType === 'chat' || rawType === 'message' || rawType === 'messages') {
        return { icon: 'chatbubble-ellipses', color: '#0284C7', bg: '#E0F2FE' };
    }

    if (
        rawType === 'grade' ||
        rawType === 'grades' ||
        rawType === 'grade_submission' ||
        rawType === 'assessment_grade' ||
        rawType === 'teacher_student_grades' ||
        title.includes('grade') ||
        title.includes('graded')
    ) {
        return { icon: 'trending-up', color: '#10B981', bg: '#DCFCE7' };
    }

    if (rawType === 'quiz' || rawType === 'quizzes' || title.includes('quiz')) {
        return { icon: 'help-circle', color: '#D97706', bg: '#FEF3C7' };
    }

    if (
        rawType === 'activity' ||
        rawType === 'assignment' ||
        rawType === 'assignments' ||
        rawType === 'assignments_activity' ||
        title.includes('activity') ||
        title.includes('assignment')
    ) {
        return { icon: 'document-text', color: '#16A34A', bg: '#DCFCE7' };
    }

    if (rawType === 'lesson' || rawType === 'lessons' || rawType === 'material' || rawType === 'materials' || title.includes('lesson')) {
        return { icon: 'book', color: '#2563EB', bg: '#DBEAFE' };
    }

    if (
        rawType === 'announcement' ||
        rawType === 'announcements' ||
        rawType === 'school_announcement' ||
        rawType === 'school_announcements' ||
        rawType === 'class_announcement' ||
        rawType === 'class_announcements' ||
        title.includes('announcement')
    ) {
        return { icon: 'megaphone', color: '#7C3AED', bg: '#F3E8FF' };
    }

    if (rawType === 'event' || rawType === 'events' || rawType === 'calendar' || rawType === 'school_calendar_events' || title.includes('event')) {
        return { icon: 'calendar', color: '#EA580C', bg: '#FFEDD5' };
    }

    if (
        rawType === 'enrollment' ||
        rawType === 'enrollments' ||
        rawType === 'subject' ||
        rawType === 'subjects' ||
        rawType === 'alert' ||
        title.includes('enrolled') ||
        title.includes('application')
    ) {
        return { icon: 'school', color: '#0D9488', bg: '#CCFBF1' };
    }

    return { icon: 'notifications', color: '#16A34A', bg: '#F1F5F9' };
}

/**
 * Resolves the exact target mobile route and parameters when tapping a notification item
 */
export function getNotificationRoute(item: any, userRole: string = 'student'): NotificationRouteResult {
    if (!item) {
        return { pathname: userRole === 'teacher' ? '/(tabs)/teacher-home' : '/(tabs)/home' };
    }

    const rawType = String(item.type || '').toLowerCase().trim();
    const title = String(item.title || '').toLowerCase().trim();
    const isTeacher = userRole === 'teacher';

    // 1. Chat / Direct Message / Group Conversation
    if (rawType === 'chat' || rawType === 'message' || rawType === 'messages' || item.related_type === 'messages') {
        const partnerId =
            item.data?.partnerId ||
            item.data?.senderId ||
            item.data?.conversation_id ||
            item.data?.room_id ||
            item.partner_id ||
            item.sender_id ||
            item.conversation_id ||
            item.room_id ||
            (item.related_type === 'messages' || item.related_type === 'conversation' ? item.related_id : null);

        if (partnerId) {
            const isRoom = Boolean(
                item.data?.isRoom === true ||
                item.data?.isRoom === 'true' ||
                (typeof partnerId === 'string' && partnerId.startsWith('group_')) ||
                item.is_room
            );
            const chatName = item.data?.name || item.name || item.title?.replace(/^New message from\s*/i, '') || 'Chat';
            return {
                pathname: '/conversation/[id]',
                params: {
                    id: String(partnerId),
                    name: chatName,
                    isRoom: String(isRoom),
                },
            };
        }

        return {
            pathname: isTeacher ? '/(tabs)/teacher/messages' : '/(tabs)/messages',
        };
    }

    // 2. Grades & Performance Records
    if (
        rawType === 'grade' ||
        rawType === 'grades' ||
        rawType === 'grade_submission' ||
        rawType === 'assessment_grade' ||
        rawType === 'teacher_student_grades' ||
        item.related_type === 'teacher_student_grades' ||
        item.related_type === 'teacher_assessment_grades' ||
        title.includes('graded') ||
        title.includes('your grade')
    ) {
        return {
            pathname: isTeacher ? '/(tabs)/teacher/grades' : '/(tabs)/grades',
        };
    }

    // 3. School Announcements & Class Announcements
    if (
        rawType === 'announcement' ||
        rawType === 'announcements' ||
        rawType === 'school_announcement' ||
        rawType === 'school_announcements' ||
        item.related_type === 'school_announcements'
    ) {
        const annId =
            item.related_id ||
            item.data?.id ||
            (typeof item.id === 'string' && item.id.startsWith('ann-') ? item.id.replace(/^ann-/, '') : null);

        if (annId) {
            return {
                pathname: '/(tabs)/announcement/[id]',
                params: {
                    id: String(annId),
                    from: isTeacher ? 'manage' : 'home',
                },
            };
        }

        return {
            pathname: isTeacher ? '/(tabs)/teacher/announcements' : '/(tabs)/announcement/all',
        };
    }

    if (
        rawType === 'class_announcement' ||
        rawType === 'class_announcements' ||
        item.related_type === 'class_announcements'
    ) {
        const annId =
            item.related_id ||
            item.data?.id ||
            (typeof item.id === 'string' && item.id.startsWith('classann-') ? item.id.replace(/^classann-/, '') : null);

        const subjectId = item.subject_id || item.data?.class_id || item.data?.subjectId || item.class_id;

        if (annId) {
            return {
                pathname: '/(tabs)/announcement/[id]',
                params: {
                    id: String(annId),
                    from: isTeacher ? 'manage' : 'subject',
                },
            };
        }

        if (subjectId && !isTeacher) {
            return {
                pathname: '/(tabs)/subjects/[id]/announcement',
                params: { id: String(subjectId) },
            };
        }

        return {
            pathname: isTeacher ? '/(tabs)/teacher/announcements' : '/(tabs)/announcement/all',
        };
    }

    // 4. Assignments / Activities / Quizzes / Assessments
    if (
        rawType === 'activity' ||
        rawType === 'assignment' ||
        rawType === 'assignments' ||
        rawType === 'quiz' ||
        rawType === 'quizzes' ||
        rawType === 'assessment' ||
        rawType === 'assignments_activity' ||
        item.related_type === 'assignments_activity' ||
        item.related_type === 'assignments' ||
        item.related_type === 'quizzes'
    ) {
        if (isTeacher) {
            const classId = item.subject_id || item.data?.course_id || item.data?.subjectId || item.course_id;
            if (classId) {
                return {
                    pathname: '/(tabs)/teacher/class/[id]',
                    params: { id: String(classId) },
                };
            }
            return { pathname: '/(tabs)/teacher/materials' };
        }

        const subjectId = item.subject_id || item.data?.course_id || item.data?.subjectId || item.course_id;
        if (subjectId) {
            return {
                pathname: '/(tabs)/subjects/[id]/assignment',
                params: { id: String(subjectId) },
            };
        }

        return {
            pathname: '/(tabs)/assignment',
        };
    }

    // 5. Lessons & Learning Materials
    if (
        rawType === 'lesson' ||
        rawType === 'lessons' ||
        rawType === 'material' ||
        rawType === 'materials' ||
        item.related_type === 'lessons'
    ) {
        if (isTeacher) {
            return { pathname: '/(tabs)/teacher/materials' };
        }

        const subjectId = item.subject_id || item.data?.subjectId || item.course_id;
        if (subjectId) {
            return {
                pathname: '/(tabs)/subjects/[id]/materials',
                params: { id: String(subjectId) },
            };
        }

        return {
            pathname: '/(tabs)/assignment',
        };
    }

    // 6. School Calendar & Events
    if (
        rawType === 'event' ||
        rawType === 'events' ||
        rawType === 'calendar' ||
        rawType === 'school_calendar_events' ||
        item.related_type === 'school_calendar_events'
    ) {
        return {
            pathname: '/(tabs)/calendar',
        };
    }

    // 7. Subject / Enrollment / Class Application Status
    if (
        rawType === 'subject' ||
        rawType === 'subjects' ||
        rawType === 'enrollment' ||
        rawType === 'enrollments' ||
        rawType === 'alert' ||
        item.related_type === 'enrollments' ||
        item.related_type === 'subjects'
    ) {
        const subjectId = item.subject_id || item.data?.subjectId || item.class_id || item.related_id;

        if (isTeacher) {
            if (subjectId && typeof subjectId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(subjectId)) {
                return {
                    pathname: '/(tabs)/teacher/class/[id]',
                    params: { id: String(subjectId) },
                };
            }
            return { pathname: '/(tabs)/teacher/classes' };
        } else {
            if (subjectId && typeof subjectId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(subjectId)) {
                return {
                    pathname: '/(tabs)/subjects/[id]',
                    params: { id: String(subjectId) },
                };
            }
            return { pathname: '/(tabs)/subjects' };
        }
    }

    // 8. Explicit Route on Item (Sanitizing legacy/plural route paths)
    if (item.route && typeof item.route === 'string') {
        let sanitizedRoute = item.route;
        if (sanitizedRoute === '/(tabs)/announcements') {
            sanitizedRoute = isTeacher ? '/(tabs)/teacher/announcements' : '/(tabs)/announcement/all';
        }
        return { pathname: sanitizedRoute };
    }

    // Default Fallback
    return {
        pathname: isTeacher ? '/(tabs)/teacher-home' : '/(tabs)/home',
    };
}
