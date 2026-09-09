import { describe, it, expect } from 'vitest';
import { getNotificationRoute, getNotificationMeta } from '../notification-navigation';

describe('notification-navigation', () => {
    describe('getNotificationMeta', () => {
        it('returns correct meta for chat notifications', () => {
            const meta = getNotificationMeta({ type: 'chat' });
            expect(meta.icon).toBe('chatbubble-ellipses');
            expect(meta.color).toBe('#0284C7');
        });

        it('returns correct meta for grade notifications', () => {
            const meta = getNotificationMeta({ type: 'grade' });
            expect(meta.icon).toBe('trending-up');
            expect(meta.color).toBe('#10B981');
        });

        it('returns correct meta for quiz notifications', () => {
            const meta = getNotificationMeta({ type: 'quiz' });
            expect(meta.icon).toBe('help-circle');
            expect(meta.color).toBe('#D97706');
        });

        it('returns correct meta for assignment notifications', () => {
            const meta = getNotificationMeta({ type: 'assignment' });
            expect(meta.icon).toBe('document-text');
            expect(meta.color).toBe('#16A34A');
        });

        it('returns correct meta for announcement notifications', () => {
            const meta = getNotificationMeta({ type: 'announcement' });
            expect(meta.icon).toBe('megaphone');
            expect(meta.color).toBe('#7C3AED');
        });

        it('returns correct meta for calendar/event notifications', () => {
            const meta = getNotificationMeta({ type: 'event' });
            expect(meta.icon).toBe('calendar');
            expect(meta.color).toBe('#EA580C');
        });
    });

    describe('getNotificationRoute', () => {
        const mockSubjectId = '11111111-2222-3333-4444-555555555555';
        const mockUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

        // 1. Grade Details Redirection
        it('redirects student to /(tabs)/grades on grade notification', () => {
            const route = getNotificationRoute({ type: 'grade' }, 'student');
            expect(route.pathname).toBe('/(tabs)/grades');
        });

        it('redirects teacher to /(tabs)/teacher/grades on grade notification', () => {
            const route = getNotificationRoute({ type: 'grade' }, 'teacher');
            expect(route.pathname).toBe('/(tabs)/teacher/grades');
        });

        it('redirects to grades based on title keywords', () => {
            const route = getNotificationRoute({ title: 'Your exam has been graded' }, 'student');
            expect(route.pathname).toBe('/(tabs)/grades');
        });

        // 2. Chat Redirection
        it('redirects to /conversation/[id] with partner params if partnerId is provided', () => {
            const route = getNotificationRoute({
                type: 'chat',
                data: {
                    partnerId: mockUserId,
                    name: 'Teacher John',
                    isRoom: 'false',
                },
            }, 'student');

            expect(route.pathname).toBe('/conversation/[id]');
            expect(route.params).toEqual({
                id: mockUserId,
                name: 'Teacher John',
                isRoom: 'false',
            });
        });

        it('redirects to /conversation/[id] with groupchat room details', () => {
            const route = getNotificationRoute({
                type: 'chat',
                data: {
                    partnerId: 'group_123456',
                    name: 'Science Study Group',
                    isRoom: true,
                },
            }, 'student');

            expect(route.pathname).toBe('/conversation/[id]');
            expect(route.params?.id).toBe('group_123456');
            expect(route.params?.isRoom).toBe('true');
        });

        it('redirects to messages tab if no partnerId exists', () => {
            const studentRoute = getNotificationRoute({ type: 'chat' }, 'student');
            expect(studentRoute.pathname).toBe('/(tabs)/messages');

            const teacherRoute = getNotificationRoute({ type: 'chat' }, 'teacher');
            expect(teacherRoute.pathname).toBe('/(tabs)/teacher/messages');
        });

        // 3. Announcement Redirection
        it('redirects to /announcement/[id] when announcement id is present', () => {
            const route = getNotificationRoute({
                id: 'ann-123',
                type: 'announcement',
            }, 'student');

            expect(route.pathname).toBe('/(tabs)/announcement/[id]');
            expect(route.params?.id).toBe('123');
            expect(route.params?.from).toBe('home');
        });

        it('redirects teacher to /announcement/[id] with from=manage', () => {
            const route = getNotificationRoute({
                related_id: '456',
                type: 'announcement',
            }, 'teacher');

            expect(route.pathname).toBe('/(tabs)/announcement/[id]');
            expect(route.params?.id).toBe('456');
            expect(route.params?.from).toBe('manage');
        });

        it('redirects student to /(tabs)/announcement/all if no specific ID', () => {
            const route = getNotificationRoute({ type: 'announcement' }, 'student');
            expect(route.pathname).toBe('/(tabs)/announcement/all');
        });

        it('redirects teacher to /(tabs)/teacher/announcements if no specific ID', () => {
            const route = getNotificationRoute({ type: 'announcement' }, 'teacher');
            expect(route.pathname).toBe('/(tabs)/teacher/announcements');
        });

        it('redirects class announcement with subject ID to subject announcements tab', () => {
            const route = getNotificationRoute({
                type: 'class_announcement',
                subject_id: mockSubjectId,
            }, 'student');

            expect(route.pathname).toBe('/(tabs)/subjects/[id]/announcement');
            expect(route.params?.id).toBe(mockSubjectId);
        });

        // 4. Activity / Assignment / Quiz Redirection
        it('redirects student to subject assignment tab when subject_id is present', () => {
            const route = getNotificationRoute({
                type: 'assignment',
                subject_id: mockSubjectId,
            }, 'student');

            expect(route.pathname).toBe('/(tabs)/subjects/[id]/assignment');
            expect(route.params?.id).toBe(mockSubjectId);
        });

        it('redirects student to /(tabs)/assignment when subject_id is not present', () => {
            const route = getNotificationRoute({ type: 'quiz' }, 'student');
            expect(route.pathname).toBe('/(tabs)/assignment');
        });

        it('redirects teacher to class details when subject_id is present on assignment', () => {
            const route = getNotificationRoute({
                type: 'assignment',
                subject_id: mockSubjectId,
            }, 'teacher');

            expect(route.pathname).toBe('/(tabs)/teacher/class/[id]');
            expect(route.params?.id).toBe(mockSubjectId);
        });

        it('redirects teacher to /(tabs)/teacher/materials when no subject_id is present', () => {
            const route = getNotificationRoute({ type: 'assignment' }, 'teacher');
            expect(route.pathname).toBe('/(tabs)/teacher/materials');
        });

        // 5. Calendar / Event Redirection
        it('redirects to /(tabs)/calendar on event notification', () => {
            const studentRoute = getNotificationRoute({ type: 'event' }, 'student');
            expect(studentRoute.pathname).toBe('/(tabs)/calendar');

            const teacherRoute = getNotificationRoute({ type: 'calendar' }, 'teacher');
            expect(teacherRoute.pathname).toBe('/(tabs)/calendar');
        });

        // 6. Subject / Enrollment Application Redirection
        it('redirects student to subject screen when enrollment is accepted', () => {
            const route = getNotificationRoute({
                type: 'alert',
                subject_id: mockSubjectId,
                title: 'Your application was accepted!',
            }, 'student');

            expect(route.pathname).toBe('/(tabs)/subjects/[id]');
            expect(route.params?.id).toBe(mockSubjectId);
        });

        it('redirects teacher to class screen on enrollment/subject notification with valid UUID', () => {
            const route = getNotificationRoute({
                type: 'enrollment',
                subject_id: mockSubjectId,
            }, 'teacher');

            expect(route.pathname).toBe('/(tabs)/teacher/class/[id]');
            expect(route.params?.id).toBe(mockSubjectId);
        });

        // 7. Sanitizes legacy plural routes
        it('sanitizes legacy /(tabs)/announcements route to /(tabs)/announcement/all', () => {
            const route = getNotificationRoute({ route: '/(tabs)/announcements' }, 'student');
            expect(route.pathname).toBe('/(tabs)/announcement/all');
        });
    });
});
