import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUnreadMessagesCount } from '../get-unread-messages-count';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(),
        },
        from: vi.fn(),
    },
}));

describe('getUnreadMessagesCount', () => {
    const mockUserId = '11111111-2222-3333-4444-555555555555';

    beforeEach(() => {
        vi.clearAllMocks();
        (supabase.auth.getUser as any).mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
        });
    });

    it('returns 0 if user is not authenticated', async () => {
        (supabase.auth.getUser as any).mockResolvedValue({
            data: { user: null },
            error: new Error('Not authenticated'),
        });

        const count = await getUnreadMessagesCount();
        expect(count).toBe(0);
    });

    it('returns sum of direct and group unread messages', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'conversation_participants') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [{ conversation_id: 'group_1' }, { conversation_id: 'group_2' }],
                        error: null,
                    }),
                };
            }
            if (table === 'messages') {
                return {
                    select: vi.fn((_cols: string, opts: any) => {
                        return {
                            eq: vi.fn((col: string, val: any) => {
                                if (col === 'receiver_id' && val === mockUserId) {
                                    return {
                                        or: vi.fn().mockResolvedValue({ count: 3, error: null }),
                                        eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
                                    };
                                }
                                return {
                                    or: vi.fn().mockResolvedValue({ count: 0, error: null }),
                                    eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
                                };
                            }),
                            in: vi.fn().mockReturnValue({
                                neq: vi.fn().mockReturnValue({
                                    or: vi.fn().mockResolvedValue({ count: 2, error: null }),
                                    eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
                                }),
                            }),
                        };
                    }),
                };
            }
            return {
                select: vi.fn().mockReturnThis(),
            };
        });

        const count = await getUnreadMessagesCount();
        expect(count).toBe(5); // 3 direct + 2 group
    });

    it('does not revert count to 9 when a conversation of 4 messages is read', async () => {
        const partnerA = 'aaaaaaaa-1111-1111-1111-111111111111';
        const partnerB = 'bbbbbbbb-2222-2222-2222-222222222222';

        // 4 messages from Partner A, 5 messages from Partner B (total 9)
        const mockDirectMsgs = [
            { id: '1', sender_id: partnerA, created_at: '2026-09-08T08:00:00.000Z', is_read: false },
            { id: '2', sender_id: partnerA, created_at: '2026-09-08T08:05:00.000Z', is_read: false },
            { id: '3', sender_id: partnerA, created_at: '2026-09-08T08:10:00.000Z', is_read: false },
            { id: '4', sender_id: partnerA, created_at: '2026-09-08T08:15:00.000Z', is_read: false },
            { id: '5', sender_id: partnerB, created_at: '2026-09-08T08:20:00.000Z', is_read: false },
            { id: '6', sender_id: partnerB, created_at: '2026-09-08T08:25:00.000Z', is_read: false },
            { id: '7', sender_id: partnerB, created_at: '2026-09-08T08:30:00.000Z', is_read: false },
            { id: '8', sender_id: partnerB, created_at: '2026-09-08T08:35:00.000Z', is_read: false },
            { id: '9', sender_id: partnerB, created_at: '2026-09-08T08:40:00.000Z', is_read: false },
        ];

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'conversation_reads') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [
                            // Partner A was read at 08:16:00 (after message 4 was sent)
                            { counterpart_id: partnerA, conversation_id: null, last_read_at: '2026-09-08T08:16:00.000Z' }
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'messages') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    or: vi.fn().mockResolvedValue({
                        data: mockDirectMsgs,
                        error: null,
                    }),
                };
            }
            if (table === 'conversation_participants') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                    }),
                };
            }
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
            };
        });

        const count = await getUnreadMessagesCount();
        // Partner A's 4 messages are excluded because they were created before last_read_at
        // Only Partner B's 5 messages remain unread
        expect(count).toBe(5);
    });
});
