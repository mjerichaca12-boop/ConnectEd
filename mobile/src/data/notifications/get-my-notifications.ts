import { supabase } from "../../lib/supabase";
import { getReadNotificationIds } from "./notification-storage";

const isValidUuid = (value: unknown) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const formatDueDate = (due?: string | null) => {
    if (!due) return '';
    try {
        const d = new Date(String(due).replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return '';
    }
};

export function deduplicateNotificationList(items: any[]): any[] {
    if (!Array.isArray(items) || items.length === 0) return [];

    // Sort descending by created_at first so newest notifications take precedence
    const sorted = [...items].sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    const result: any[] = [];
    const seenIds = new Set<string>();

    for (const notif of sorted) {
        if (!notif) continue;
        const id = String(notif.id || '');
        if (id && seenIds.has(id)) continue;

        const notifBody = String(notif.body || notif.message || '').trim().toLowerCase();
        const notifTitle = String(notif.title || '').trim().toLowerCase();
        const notifType = String(notif.type || '').toLowerCase();
        const notifTime = new Date(notif.created_at || 0).getTime();
        const notifRawId = id.replace(/^(act-|classann-|lesson-|ann-|ev-)/, '');

        // Check if there is already a matching notification in result
        const existingIndex = result.findIndex(existing => {
            const existingId = String(existing.id || '');
            const existingRawId = existingId.replace(/^(act-|classann-|lesson-|ann-|ev-)/, '');
            const existingBody = String(existing.body || existing.message || '').trim().toLowerCase();
            const existingTitle = String(existing.title || '').trim().toLowerCase();
            const existingType = String(existing.type || '').toLowerCase();
            const existingTime = new Date(existing.created_at || 0).getTime();

            // Match exact related_id or stripped ID (e.g. synthetic vs DB notification)
            if (notif.related_id && existing.related_id && notif.related_id === existing.related_id) {
                return true;
            }
            if (notifRawId && existingRawId && notifRawId === existingRawId) {
                return true;
            }

            const timeDiffSec = Math.abs(notifTime - existingTime) / 1000;

            // Message notifications deduplication:
            // e.g. "New Message" vs "New Message from Euri gin Jiao" with same body "hi" within 120 seconds
            const isMsg1 = notifType.includes('message') || notifTitle.includes('new message');
            const isMsg2 = existingType.includes('message') || existingTitle.includes('new message');
            if (isMsg1 && isMsg2 && notifBody === existingBody && (isNaN(timeDiffSec) || timeDiffSec <= 120)) {
                return true;
            }

            // General duplicate check: same title, same body, within 120 seconds
            if (notifTitle === existingTitle && notifBody === existingBody && (isNaN(timeDiffSec) || timeDiffSec <= 120)) {
                return true;
            }

            return false;
        });

        if (existingIndex !== -1) {
            const existing = result[existingIndex];
            const existingTitle = String(existing.title || '').trim().toLowerCase();

            // If the current item has a richer title (e.g., "New Message from <Name>" vs "New Message"), replace existing generic one
            const isCurrentRicher = notifTitle.startsWith('new message from') && existingTitle === 'new message';
            if (isCurrentRicher) {
                result[existingIndex] = notif;
            }

            if (id) seenIds.add(id);
            continue;
        }

        if (id) seenIds.add(id);
        result.push(notif);
    }

    return result;
}

export async function getMyNotifications() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
        console.error("[MobileNotifications] Supabase auth error:", userError);
    }

    const user = userData?.user ?? null;
    if (!isValidUuid(user?.id)) {
        console.warn("[MobileNotifications] Skipping notification fetch until a valid authenticated user exists.");
        return [];
    }

    // Load persisted set of IDs marked read by this user (pass userId for user-scoped storage)
    const readIds = await getReadNotificationIds(user.id);

    // 1. Fetch real notifications from notifications table
    const { data: dbNotifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (notifError) {
        console.warn('[MobileNotifications] notifications table error (non-fatal):', notifError.message);
    }

    // 2. Fetch enrolled subjects (for students) and taught subjects (for teachers)
    let enrolledSubjectIds: string[] = [];
    try {
        // Query teacher_student_assignments directly
        const { data: tsaData, error: tsaErr } = await supabase
            .from('teacher_student_assignments')
            .select('subject_id, status')
            .eq('student_id', user.id);

        if (!tsaErr && Array.isArray(tsaData) && tsaData.length > 0) {
            const valid = tsaData
                .filter((r: any) => {
                    const st = String(r.status || '').toLowerCase().trim();
                    return st !== 'rejected' && st !== 'dropped' && st !== 'inactive';
                })
                .map((r: any) => r.subject_id)
                .filter(Boolean);
            enrolledSubjectIds.push(...valid);
        }

        // Also check enrollments view/table
        const { data: enrollments, error: enrErr } = await supabase
            .from('enrollments')
            .select('subject_id, status')
            .eq('student_id', user.id);

        if (!enrErr && Array.isArray(enrollments) && enrollments.length > 0) {
            const valid = enrollments
                .filter((r: any) => {
                    const st = String(r.status || '').toLowerCase().trim();
                    return st !== 'rejected' && st !== 'dropped' && st !== 'inactive';
                })
                .map((r: any) => r.subject_id)
                .filter(Boolean);
            enrolledSubjectIds.push(...valid);
        }
    } catch (e) {
        console.warn('[MobileNotifications] Error fetching enrollments:', e);
    }

    const { data: taughtSubjects } = await supabase
        .from('subjects')
        .select('id')
        .eq('teacher_id', user.id);

    const taughtSubjectIds = (taughtSubjects || []).map(s => s.id).filter(Boolean);
    const allCourseIds = [...new Set([...enrolledSubjectIds, ...taughtSubjectIds])];

    const activityNotifs: any[] = [];
    const seenActivityIds = new Set<string>();

    if (allCourseIds.length > 0) {
        // Fetch subject names for display
        const { data: subjectsData } = await supabase
            .from('subjects')
            .select('id, name')
            .in('id', allCourseIds);

        const subjectMap = new Map<string, string>();
        (subjectsData || []).forEach(s => {
            if (s && s.id) subjectMap.set(s.id, s.name);
        });

        // Fetch ALL lessons for enrolled subjects so we can map lesson_id -> subject_id
        let lessonsData: any[] = [];
        try {
            const { data: lData, error: lErr } = await supabase
                .from('lessons')
                .select('id, subject_id, title, description, created_at, status')
                .in('subject_id', allCourseIds);
            if (!lErr && lData) {
                lessonsData = lData;
            }
        } catch (e) {
            console.warn('[MobileNotifications] Failed to query lessons:', e);
        }

        const lessonToSubjectMap = new Map<string, string>();
        const allLessonIds: string[] = [];
        (lessonsData || []).forEach((l: any) => {
            if (l && l.id) {
                const subjectId = l.subject_id;
                if (subjectId) lessonToSubjectMap.set(l.id, subjectId);
                allLessonIds.push(l.id);
            }
        });

        const processActivityItem = (act: any, defaultType: string, subjectId?: string) => {
            if (!act || !act.id || seenActivityIds.has(act.id)) return;
            seenActivityIds.add(act.id);

            const notifId = String(act.id).startsWith('act-') ? act.id : `act-${act.id}`;
            const rawType = String(act.assessment_type || act.assignment_type || defaultType).toLowerCase();
            const typeLabel = rawType.includes('quiz') ? 'Quiz' : (rawType.includes('activity') ? 'Activity' : 'Assignment');
            // Resolve subject name: use direct course_id/subject_id, or map through lesson_id
            const resolvedSubjectId = subjectId || act.course_id || act.subject_id || (act.lesson_id ? lessonToSubjectMap.get(act.lesson_id) : undefined);
            const subjectName = (resolvedSubjectId ? subjectMap.get(resolvedSubjectId) : undefined) || 'Subject';
            const dueStr = formatDueDate(act.deadline || act.due_date);
            const bodyText = [subjectName, dueStr ? `Due: ${dueStr}` : null].filter(Boolean).join(' • ') || (act.description || 'New class activity posted');

            activityNotifs.push({
                id: notifId,
                user_id: user.id,
                title: `New ${typeLabel}: ${act.title || 'Untitled'}`,
                body: bodyText,
                type: rawType.includes('quiz') ? 'quiz' : (rawType.includes('activity') ? 'activity' : 'assignment'),
                is_read: readIds.has(notifId),
                created_at: act.created_at || new Date().toISOString(),
                related_id: String(act.id),
                subject_id: resolvedSubjectId,
                route: resolvedSubjectId ? `/(tabs)/subjects/${resolvedSubjectId}/assignment` : '/(tabs)/assignment',
                data: {
                    id: act.id,
                    subjectId: resolvedSubjectId,
                    type: rawType.includes('quiz') ? 'quiz' : (rawType.includes('activity') ? 'activity' : 'assignment')
                }
            });
        };

        // Query assignments_activity (uses course_id directly)
        try {
            const { data: actData } = await supabase
                .from('assignments_activity')
                .select('id, course_id, title, description, deadline, due_date, assessment_type, created_at')
                .in('course_id', allCourseIds)
                .order('created_at', { ascending: false })
                .limit(20);

            (actData || []).forEach(a => processActivityItem(a, a.assessment_type || 'activity'));
        } catch (e) {
            console.warn('[MobileNotifications] Failed to query assignments_activity:', e);
        }

        // Query assignments via lesson_id (assignments table uses lesson_id)
        if (allLessonIds.length > 0) {
            try {
                const { data: asgData } = await supabase
                    .from('assignments')
                    .select('id, lesson_id, title, description, due_date, assignment_type, created_at')
                    .in('lesson_id', allLessonIds)
                    .order('created_at', { ascending: false })
                    .limit(20);

                (asgData || []).forEach(a => {
                    const subjectId = a.lesson_id ? lessonToSubjectMap.get(a.lesson_id) : undefined;
                    processActivityItem(a, a.assignment_type || 'assignment', subjectId);
                });
            } catch (e) {
                console.warn('[MobileNotifications] Failed to query assignments:', e);
            }
        }

        // Query quizzes (quizzes table uses lesson_id)
        if (allLessonIds.length > 0) {
            try {
                const { data: quizData } = await supabase
                    .from('quizzes')
                    .select('id, lesson_id, title, description, due_date, created_at')
                    .in('lesson_id', allLessonIds)
                    .order('created_at', { ascending: false })
                    .limit(20);

                (quizData || []).forEach(q => {
                    const subjectId = q.lesson_id ? lessonToSubjectMap.get(q.lesson_id) : undefined;
                    processActivityItem(q, 'quiz', subjectId);
                });
            } catch (e) {
                console.warn('[MobileNotifications] Failed to query quizzes:', e);
            }
        }

        // Query class_materials (uses subject_id)
        try {
            const { data: classMatData } = await supabase
                .from('class_materials')
                .select('id, subject_id, title, description, file_name, file_url, created_at')
                .in('subject_id', allCourseIds)
                .order('created_at', { ascending: false })
                .limit(20);

            (classMatData || []).forEach(mat => {
                if (!mat || !mat.id || seenActivityIds.has(`mat-${mat.id}`) || seenActivityIds.has(mat.id)) return;
                seenActivityIds.add(`mat-${mat.id}`);
                seenActivityIds.add(mat.id);

                const notifId = `mat-${mat.id}`;
                const subjectName = subjectMap.get(mat.subject_id) || 'Subject';
                const matTitle = mat.title || mat.file_name || 'Learning Material';

                activityNotifs.push({
                    id: notifId,
                    user_id: user.id,
                    title: `New Material: ${matTitle}`,
                    body: `${subjectName} • ${mat.description || 'New learning material uploaded'}`,
                    type: 'material',
                    is_read: readIds.has(notifId),
                    created_at: mat.created_at || new Date().toISOString(),
                    related_id: String(mat.id),
                    subject_id: mat.subject_id,
                    route: mat.subject_id ? `/(tabs)/subjects/${mat.subject_id}/materials` : '/(tabs)/assignment',
                    data: {
                        id: mat.id,
                        subjectId: mat.subject_id,
                        type: 'material'
                    }
                });
            });
        } catch (e) {
            console.warn('[MobileNotifications] Failed to query class_materials:', e);
        }

        // Query lesson_materials via allLessonIds
        if (allLessonIds.length > 0) {
            try {
                const { data: lessonMatData } = await supabase
                    .from('lesson_materials')
                    .select('id, lesson_id, file_name, file_url, created_at')
                    .in('lesson_id', allLessonIds)
                    .order('created_at', { ascending: false })
                    .limit(20);

                (lessonMatData || []).forEach(lm => {
                    if (!lm || !lm.id || seenActivityIds.has(`lm-${lm.id}`) || seenActivityIds.has(lm.id)) return;
                    seenActivityIds.add(`lm-${lm.id}`);
                    seenActivityIds.add(lm.id);

                    const notifId = `lm-${lm.id}`;
                    const subjectId = lm.lesson_id ? lessonToSubjectMap.get(lm.lesson_id) : undefined;
                    const subjectName = (subjectId ? subjectMap.get(subjectId) : undefined) || 'Subject';
                    const matTitle = lm.file_name || 'Attached Material';

                    activityNotifs.push({
                        id: notifId,
                        user_id: user.id,
                        title: `New Material: ${matTitle}`,
                        body: `${subjectName} • New lesson material uploaded`,
                        type: 'material',
                        is_read: readIds.has(notifId),
                        created_at: lm.created_at || new Date().toISOString(),
                        related_id: String(lm.id),
                        subject_id: subjectId,
                        route: subjectId ? `/(tabs)/subjects/${subjectId}/materials` : '/(tabs)/assignment',
                        data: {
                            id: lm.id,
                            subjectId: subjectId,
                            type: 'material'
                        }
                    });
                });
            } catch (e) {
                console.warn('[MobileNotifications] Failed to query lesson_materials:', e);
            }
        }

        // Query class_announcements (uses class_id which maps to subject_id)
        try {
            const { data: classAnnData } = await supabase
                .from('class_announcements')
                .select('id, class_id, title, content, created_at')
                .in('class_id', allCourseIds)
                .order('created_at', { ascending: false })
                .limit(20);

            (classAnnData || []).forEach(ann => {
                if (!ann || !ann.id || seenActivityIds.has(ann.id)) return;
                seenActivityIds.add(ann.id);

                const notifId = `classann-${ann.id}`;
                const subjectName = subjectMap.get(ann.class_id) || 'Class';

                activityNotifs.push({
                    id: notifId,
                    user_id: user.id,
                    title: `New Class Announcement: ${ann.title || 'Untitled'}`,
                    body: `${subjectName} • ${ann.content ? ann.content.substring(0, 100) : 'New announcement posted'}`,
                    type: 'class_announcement',
                    is_read: readIds.has(notifId),
                    created_at: ann.created_at || new Date().toISOString(),
                    related_id: String(ann.id),
                    subject_id: ann.class_id,
                    route: `/(tabs)/announcement/${ann.id}`,
                    data: {
                        id: ann.id,
                        class_id: ann.class_id
                    }
                });
            });
        } catch (e) {
            console.warn('[MobileNotifications] Failed to query class_announcements:', e);
        }

        // Query lessons (published lessons as "new lesson" notifications)
        try {
            const publishedLessons = (lessonsData || []).filter((l: any) =>
                l && l.id && (l.status === 'Published' || l.status === 'published')
            );

            publishedLessons.forEach((lesson: any) => {
                if (seenActivityIds.has(lesson.id) || seenActivityIds.has(`lesson-${lesson.id}`)) return;
                seenActivityIds.add(lesson.id);
                seenActivityIds.add(`lesson-${lesson.id}`);

                const notifId = `lesson-${lesson.id}`;
                const subjectId = lesson.subject_id;
                const subjectName = subjectId ? subjectMap.get(subjectId) : undefined;

                activityNotifs.push({
                    id: notifId,
                    user_id: user.id,
                    title: `New Lesson: ${lesson.title || 'Untitled'}`,
                    body: `${subjectName || 'Subject'} • New lesson published`,
                    type: 'lesson',
                    is_read: readIds.has(notifId),
                    created_at: lesson.created_at || new Date().toISOString(),
                    related_id: String(lesson.id),
                    subject_id: subjectId,
                    route: subjectId ? `/(tabs)/subjects/${subjectId}/materials` : '/(tabs)/assignment',
                    data: {
                        id: lesson.id,
                        subjectId: subjectId
                    }
                });
            });
        } catch (e) {
            console.warn('[MobileNotifications] Failed to process lessons:', e);
        }
    }

    // 3. Fetch recent announcements
    const { data: announcements } = await supabase
        .from('school_announcements')
        .select('id, title, content, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    // 4. Fetch upcoming calendar events
    const { data: events } = await supabase
        .from('school_calendar_events')
        .select('id, title, event_date, created_at')
        .order('event_date', { ascending: true })
        .limit(10);

    // Map announcements
    const announcementNotifs = (announcements || []).map(ann => {
        const notifId = `ann-${ann.id}`;
        return {
            id: notifId,
            user_id: user.id,
            title: `New Announcement: ${ann.title}`,
            body: ann.content,
            type: 'announcement',
            is_read: readIds.has(notifId),
            created_at: ann.created_at,
            related_id: String(ann.id),
            route: `/(tabs)/announcement/${ann.id}`,
            data: {
                id: ann.id
            }
        };
    });

    // Map events
    const eventNotifs = (events || []).map(ev => {
        const notifId = `ev-${ev.id}`;
        return {
            id: notifId,
            user_id: user.id,
            title: `Upcoming Event: ${ev.title}`,
            body: `Date: ${ev.event_date}`,
            type: 'event',
            is_read: readIds.has(notifId),
            created_at: ev.created_at,
            related_id: String(ev.id),
            route: '/(tabs)/calendar',
            data: {
                id: ev.id,
                event_date: ev.event_date
            }
        };
    });

    // Format DB notifications — respect local read state alongside DB is_read
    const formattedDbNotifs = (dbNotifications || []).map(n => ({
        ...n,
        is_read: Boolean(n.is_read || readIds.has(n.id)),
    }));

    // Merge all sources
    const all = [...formattedDbNotifs, ...activityNotifs, ...announcementNotifs, ...eventNotifs];

    // Deduplicate and return sorted notifications
    return deduplicateNotificationList(all);
}

