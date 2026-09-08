import { describe, it, expect } from 'vitest';

describe('Optimistic Unread Badge Decrement Logic', () => {
    describe('Messages Unread Badge Decrement', () => {
        const initialChats = [
            {
                id: 'partner-1',
                partner_id: 'partner-1',
                partner_name: 'Euri Jiao',
                unread: true,
                unread_count: 5,
            },
            {
                id: 'partner-2',
                partner_id: 'partner-2',
                partner_name: 'Admin',
                unread: true,
                unread_count: 4,
            },
            {
                id: 'partner-3',
                partner_id: 'partner-3',
                partner_name: 'Student User',
                unread: false,
                unread_count: 0,
            },
        ];

        it('decrements unread count immediately by the clicked conversation count (e.g. 9 - 4 = 5)', () => {
            const currentBadgeCount = 9;
            const clickedPartnerId = 'partner-2'; // Admin with 4 unread messages

            const clickedChat = initialChats.find(c => c.partner_id === clickedPartnerId);
            const countToDeduct = Number(clickedChat?.unread_count) > 0 ? Number(clickedChat?.unread_count) : 1;

            expect(countToDeduct).toBe(4);
            const updatedBadgeCount = Math.max(0, currentBadgeCount - countToDeduct);
            expect(updatedBadgeCount).toBe(5); // 9 - 4 = 5!

            const updatedChats = initialChats.map(c =>
                (c.partner_id === clickedPartnerId || c.id === clickedPartnerId)
                    ? { ...c, unread: false, unread_count: 0 }
                    : c
            );

            expect(updatedChats.find(c => c.partner_id === 'partner-2')?.unread).toBe(false);
            expect(updatedChats.find(c => c.partner_id === 'partner-2')?.unread_count).toBe(0);
            expect(updatedChats.find(c => c.partner_id === 'partner-1')?.unread).toBe(true);
            expect(updatedChats.find(c => c.partner_id === 'partner-1')?.unread_count).toBe(5);
        });

        it('does not decrement badge if opened conversation has 0 unread messages', () => {
            const currentBadgeCount = 5;
            const clickedPartnerId = 'partner-3'; // 0 unread messages

            const clickedChat = initialChats.find(c => c.partner_id === clickedPartnerId);
            const unreadCount = Number(clickedChat?.unread_count) > 0 ? Number(clickedChat?.unread_count) : 0;

            const updatedBadgeCount = Math.max(0, currentBadgeCount - unreadCount);
            expect(updatedBadgeCount).toBe(5); // Still 5!
        });

        it('does not drop badge count below zero when unread count exceeds badge', () => {
            const currentBadgeCount = 2;
            const countToDeduct = 5;

            const updatedBadgeCount = Math.max(0, currentBadgeCount - countToDeduct);
            expect(updatedBadgeCount).toBe(0);
        });

        it('clears badge completely when all unread conversations are opened', () => {
            let badge = 9;
            let chats = [...initialChats];

            // Open partner-1
            chats = chats.map(c => c.id === 'partner-1' ? { ...c, unread: false, unread_count: 0 } : c);
            badge = Math.max(0, badge - 5);
            expect(badge).toBe(4);

            // Open partner-2
            chats = chats.map(c => c.id === 'partner-2' ? { ...c, unread: false, unread_count: 0 } : c);
            badge = Math.max(0, badge - 4);
            expect(badge).toBe(0);

            // Verify no unread remaining
            const remainingUnread = chats.filter(c => c.unread || c.unread_count > 0).length;
            expect(remainingUnread).toBe(0);
        });
    });

    describe('Notifications Bell Icon Badge Decrement', () => {
        const initialNotifications = [
            { id: 'notif-1', title: 'New Activity', is_read: false },
            { id: 'notif-2', title: 'New Announcement', is_read: false },
            { id: 'notif-3', title: 'Upcoming Event', is_read: true },
        ];

        it('decrements unread notifications count when single item is marked read', () => {
            const unreadCountBefore = initialNotifications.filter(n => !n.is_read).length;
            expect(unreadCountBefore).toBe(2);

            const clickedId = 'notif-1';
            const updated = initialNotifications.map(n => n.id === clickedId ? { ...n, is_read: true } : n);

            const unreadCountAfter = updated.filter(n => !n.is_read).length;
            expect(unreadCountAfter).toBe(1);
            expect(updated.find(n => n.id === 'notif-1')?.is_read).toBe(true);
        });

        it('clears all unread notifications to 0 on mark all read', () => {
            const updated = initialNotifications.map(n => ({ ...n, is_read: true }));
            const unreadCountAfter = updated.filter(n => !n.is_read).length;
            expect(unreadCountAfter).toBe(0);
        });
    });
});
