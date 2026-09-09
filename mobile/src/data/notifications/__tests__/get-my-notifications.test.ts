import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMyNotifications } from '../get-my-notifications';
import { supabase } from '../../../lib/supabase';
import * as storage from '../notification-storage';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(),
        },
        from: vi.fn(),
    },
}));

vi.mock('../notification-storage', () => ({
    getReadNotificationIds: vi.fn(),
    markNotificationIdAsRead: vi.fn(),
    markMultipleNotificationIdsAsRead: vi.fn(),
}));

describe('getMyNotifications', () => {
    const mockUserId = '11111111-2222-3333-4444-555555555555';
    const mockSubjectId = '22222222-3333-4444-5555-666666666666';

    beforeEach(() => {
        vi.clearAllMocks();
        (supabase.auth.getUser as any).mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
        });
        (storage.getReadNotificationIds as any).mockResolvedValue(new Set());
    });

    it('returns empty array if user is not authenticated or has invalid uuid', async () => {
        (supabase.auth.getUser as any).mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const notifs = await getMyNotifications();
        expect(notifs).toEqual([]);
    });

    it('aggregates db notifications, subject activities, announcements, and events with unread persistence', async () => {
        // Read IDs includes only the announcement
        (storage.getReadNotificationIds as any).mockResolvedValue(new Set(['ann-101']));

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'notifications') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'notif-1',
                                user_id: mockUserId,
                                title: 'System alert',
                                body: 'Welcome to ConnectEd',
                                type: 'system',
                                is_read: false,
                                created_at: '2026-09-08T01:00:00Z',
                            }
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'enrollments' || table === 'teacher_student_assignments') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [{ subject_id: mockSubjectId, status: 'Active' }],
                        error: null,
                    }),
                    in: vi.fn().mockResolvedValue({
                        data: [{ subject_id: mockSubjectId, status: 'Active' }],
                        error: null,
                    }),
                };
            }
            if (table === 'subjects') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                    in: vi.fn().mockResolvedValue({
                        data: [{ id: mockSubjectId, name: 'Science 10' }],
                        error: null,
                    }),
                };
            }
            if (table === 'assignments_activity') {
                return {
                    select: vi.fn().mockReturnThis(),
                    in: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'act-999',
                                course_id: mockSubjectId,
                                title: 'Photosynthesis Lab',
                                description: 'Complete worksheet',
                                deadline: '2026-09-10T23:59:00Z',
                                assessment_type: 'activity',
                                created_at: '2026-09-08T02:00:00Z',
                            }
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'assignments') {
                return {
                    select: vi.fn().mockReturnThis(),
                    in: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            if (table === 'quizzes') {
                return {
                    select: vi.fn().mockReturnThis(),
                    in: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            if (table === 'school_announcements') {
                return {
                    select: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: '101',
                                title: 'Campus Maintenance',
                                content: 'Power shutoff tomorrow',
                                created_at: '2026-09-07T12:00:00Z',
                            }
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'school_calendar_events') {
                return {
                    select: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: '202',
                                title: 'Science Fair',
                                event_date: '2026-09-15',
                                created_at: '2026-09-06T08:00:00Z',
                            }
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'lessons') {
                return {
                    select: vi.fn().mockReturnThis(),
                    in: vi.fn().mockResolvedValue({ data: [], error: null }),
                    or: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            return {
                select: vi.fn().mockReturnThis(),
                or: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
        });

        const results = await getMyNotifications();

        // Check that activity was included
        const activityItem = results.find(r => r.id === 'act-999');
        expect(activityItem).toBeDefined();
        expect(activityItem?.title).toBe('New Activity: Photosynthesis Lab');
        expect(activityItem?.body).toContain('Science 10');
        expect(activityItem?.is_read).toBe(false); // Unread!

        // Check announcement (should be marked read because 'ann-101' is in storage)
        const announcementItem = results.find(r => r.id === 'ann-101');
        expect(announcementItem).toBeDefined();
        expect(announcementItem?.is_read).toBe(true);

        // Check calendar event (unread)
        const eventItem = results.find(r => r.id === 'ev-202');
        expect(eventItem).toBeDefined();
        expect(eventItem?.is_read).toBe(false);

        // Check sorting: newest first (act-999 at 02:00, then notif-1 at 01:00)
        expect(results[0].id).toBe('act-999');
        expect(results[1].id).toBe('notif-1');
    });

    it('deduplicates duplicate message notifications and keeps the richer sender-specific title', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'notifications') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({
                        data: [
                            // Duplicate pair 1: "hi"
                            {
                                id: 'notif-msg-1a',
                                user_id: mockUserId,
                                title: 'New Message',
                                body: 'hi',
                                type: 'messages',
                                is_read: false,
                                created_at: '2026-09-08T12:49:00Z',
                            },
                            {
                                id: 'notif-msg-1b',
                                user_id: mockUserId,
                                title: 'New Message from Euri gin Jiao',
                                body: 'hi',
                                type: 'messages',
                                is_read: false,
                                created_at: '2026-09-08T12:49:00Z',
                            },
                            // Duplicate pair 2: "hello"
                            {
                                id: 'notif-msg-2a',
                                user_id: mockUserId,
                                title: 'New Message',
                                body: 'hello',
                                type: 'messages',
                                is_read: false,
                                created_at: '2026-09-08T12:49:00Z',
                            },
                            {
                                id: 'notif-msg-2b',
                                user_id: mockUserId,
                                title: 'New Message from Euri gin Jiao',
                                body: 'hello',
                                type: 'messages',
                                is_read: false,
                                created_at: '2026-09-08T12:49:00Z',
                            },
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'enrollments') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    in: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            if (table === 'subjects') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                    in: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            if (table === 'school_announcements' || table === 'school_calendar_events') {
                return {
                    select: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            return {
                select: vi.fn().mockReturnThis(),
                or: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
        });

        const results = await getMyNotifications();

        // 4 raw DB rows must be deduplicated into exactly 2 clean rows
        expect(results.length).toBe(2);

        // Verify the generic "New Message" was dropped in favor of "New Message from Euri gin Jiao"
        const hiNotif = results.find(n => n.body === 'hi');
        expect(hiNotif).toBeDefined();
        expect(hiNotif?.title).toBe('New Message from Euri gin Jiao');

        const helloNotif = results.find(n => n.body === 'hello');
        expect(helloNotif).toBeDefined();
        expect(helloNotif?.title).toBe('New Message from Euri gin Jiao');
    });

    it('creates notifications for class_materials uploaded for enrolled subjects', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'notifications') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            if (table === 'enrollments' || table === 'teacher_student_assignments') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [{ subject_id: mockSubjectId, status: 'Active' }],
                        error: null,
                    }),
                    in: vi.fn().mockResolvedValue({
                        data: [{ subject_id: mockSubjectId, status: 'Active' }],
                        error: null,
                    }),
                };
            }
            if (table === 'subjects') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                    in: vi.fn().mockResolvedValue({
                        data: [{ id: mockSubjectId, name: 'Physics 101' }],
                        error: null,
                    }),
                };
            }
            if (table === 'class_materials') {
                return {
                    select: vi.fn().mockReturnThis(),
                    in: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'mat-555',
                                subject_id: mockSubjectId,
                                title: 'Kinematics Handout',
                                description: 'Read chapters 1 and 2',
                                file_name: 'kinematics.pdf',
                                created_at: '2026-09-08T10:00:00Z',
                            }
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'lessons') {
                return {
                    select: vi.fn().mockReturnThis(),
                    in: vi.fn().mockResolvedValue({ data: [], error: null }),
                    or: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                or: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
        });

        const results = await getMyNotifications();
        const matNotif = results.find(n => n.id === 'mat-mat-555' || n.id === 'mat-555');
        expect(matNotif).toBeDefined();
        expect(matNotif?.title).toBe('New Material: Kinematics Handout');
        expect(matNotif?.body).toContain('Physics 101');
        expect(matNotif?.type).toBe('material');
        expect(matNotif?.route).toBe(`/(tabs)/subjects/${mockSubjectId}/materials`);
    });
});
