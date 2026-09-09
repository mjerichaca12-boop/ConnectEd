import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUnreadMessagesCount } from '../get-unread-messages-count';
import { getMyChats } from '../get-my-chats';

vi.mock('../get-my-chats', () => ({
    getMyChats: vi.fn(),
}));

describe('getUnreadMessagesCount', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 0 if getMyChats throws error (e.g. unauthenticated)', async () => {
        (getMyChats as any).mockRejectedValue(new Error('Not authenticated'));
        const count = await getUnreadMessagesCount();
        expect(count).toBe(0);
    });

    it('returns 0 if user has no chats', async () => {
        (getMyChats as any).mockResolvedValue([]);
        const count = await getUnreadMessagesCount();
        expect(count).toBe(0);
    });

    it('returns sum of unread messages matching the conversation list', async () => {
        (getMyChats as any).mockResolvedValue([
            { id: 'partner-1', partner_name: 'Euri Jiao', unread: false, unread_count: 0 },
            { id: 'partner-2', partner_name: 'Admin', unread: true, unread_count: 1 },
        ]);

        const count = await getUnreadMessagesCount();
        expect(count).toBe(1); // Matches 1 unread message shown for Admin!
    });

    it('accurately sums unread counts across multiple direct and group chats', async () => {
        (getMyChats as any).mockResolvedValue([
            { id: 'partner-1', unread: true, unread_count: 4 },
            { id: 'group-1', unread: true, unread_count: 2 },
            { id: 'partner-2', unread: false, unread_count: 0 },
        ]);

        const count = await getUnreadMessagesCount();
        expect(count).toBe(6); // 4 + 2 = 6
    });

    it('decreases count when an unread conversation is seen and marked read', async () => {
        // Initial state: 1 unread chat with 1 unread message
        (getMyChats as any).mockResolvedValue([
            { id: 'partner-1', unread: false, unread_count: 0 },
            { id: 'partner-2', unread: true, unread_count: 1 },
        ]);
        let count = await getUnreadMessagesCount();
        expect(count).toBe(1);

        // After opening partner-2, both are seen
        (getMyChats as any).mockResolvedValue([
            { id: 'partner-1', unread: false, unread_count: 0 },
            { id: 'partner-2', unread: false, unread_count: 0 },
        ]);
        count = await getUnreadMessagesCount();
        expect(count).toBe(0); // Decreases to 0!
    });

    it('falls back to 1 when chat has unread=true but unread_count is not provided', async () => {
        (getMyChats as any).mockResolvedValue([
            { id: 'partner-1', unread: true },
            { id: 'partner-2', unread: false },
        ]);
        const count = await getUnreadMessagesCount();
        expect(count).toBe(1);
    });
});

