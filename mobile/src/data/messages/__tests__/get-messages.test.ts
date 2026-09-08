import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMessages, sendMessage } from '../get-messages';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => {
    return {
        supabase: {
            auth: {
                getUser: vi.fn(),
            },
            from: vi.fn(),
        },
    };
});

describe('getMessages and sendMessage scoping', () => {
    const mockUserId = '11111111-2222-3333-4444-555555555555';
    const mockUser = { id: mockUserId, email: 'user@example.com' };

    beforeEach(() => {
        vi.clearAllMocks();
        (supabase.auth.getUser as any).mockResolvedValue({
            data: { user: mockUser },
            error: null,
        });
    });

    describe('getMessages', () => {
        it('queries strictly by conversation_id for group IDs without querying UUID columns (avoids 22P02)', async () => {
            const groupId = 'group_1788778783300_940109';
            const mockMessages = [
                {
                    id: 'm1',
                    sender_id: mockUserId,
                    conversation_id: groupId,
                    content: 'Hello group!',
                    created_at: new Date().toISOString(),
                },
            ];

            const mockQueryBuilder: any = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                or: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
                }),
            };

            (supabase.from as any).mockReturnValue(mockQueryBuilder);

            const result = await getMessages(groupId);

            expect(supabase.from).toHaveBeenCalledWith('messages');
            // Must query eq('conversation_id', groupId)
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('conversation_id', groupId);
            // Must NOT query or() containing room_id or receiver_id for non-UUID groupId
            expect(mockQueryBuilder.or).not.toHaveBeenCalled();
            expect(result.length).toBe(1);
            expect(result[0].content).toBe('Hello group!');
        });

        it('does not fall through to direct messages when a group has 0 messages', async () => {
            const groupId = 'group_empty_123';
            const mockQueryBuilder: any = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                or: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            };

            (supabase.from as any).mockReturnValue(mockQueryBuilder);

            const result = await getMessages(groupId);

            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('conversation_id', groupId);
            // Must NOT attempt direct message lookup on receiver_id with non-UUID groupId
            expect(mockQueryBuilder.or).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        it('queries both conversation_id/room_id and falls back to direct messages for valid UUIDs', async () => {
            const partnerUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
            const mockDirectMessages = [
                {
                    id: 'm2',
                    sender_id: partnerUuid,
                    receiver_id: mockUserId,
                    content: 'Hello direct!',
                    created_at: new Date().toISOString(),
                },
            ];

            // Direct query returns direct messages
            const mockDirectQuery: any = {
                select: vi.fn().mockReturnThis(),
                or: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: mockDirectMessages, error: null }),
                }),
            };

            (supabase.from as any).mockReturnValue(mockDirectQuery);

            const result = await getMessages(partnerUuid);

            expect(mockDirectQuery.or).toHaveBeenCalledWith(
                `and(sender_id.eq.${mockUserId},receiver_id.eq.${partnerUuid}),and(sender_id.eq.${partnerUuid},receiver_id.eq.${mockUserId})`
            );
            expect(result.length).toBe(1);
            expect(result[0].content).toBe('Hello direct!');
        });
    });

    describe('sendMessage', () => {
        it('sets conversation_id and nullifies receiver_id for group IDs', async () => {
            const groupId = 'group_1788778783300_940109';
            const mockSaved = {
                id: 'saved-1',
                sender_id: mockUserId,
                conversation_id: groupId,
                receiver_id: null,
                content: 'Group chat message',
                created_at: new Date().toISOString(),
            };

            const mockInsertBuilder: any = {
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: mockSaved, error: null }),
                    }),
                }),
            };

            (supabase.from as any).mockReturnValue(mockInsertBuilder);

            const result = await sendMessage(groupId, 'Group chat message', undefined, undefined, false);

            expect(mockInsertBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender_id: mockUserId,
                    conversation_id: groupId,
                    receiver_id: null,
                    content: 'Group chat message',
                })
            );
            expect(result.content).toBe('Group chat message');
        });

        it('sets receiver_id and nullifies conversation_id for direct user UUIDs', async () => {
            const partnerUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
            const mockSaved = {
                id: 'saved-2',
                sender_id: mockUserId,
                conversation_id: null,
                receiver_id: partnerUuid,
                content: 'Direct message',
                created_at: new Date().toISOString(),
            };

            const mockInsertBuilder: any = {
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: mockSaved, error: null }),
                    }),
                }),
            };

            (supabase.from as any).mockReturnValue(mockInsertBuilder);

            const result = await sendMessage(partnerUuid, 'Direct message', undefined, undefined, false);

            expect(mockInsertBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender_id: mockUserId,
                    conversation_id: null,
                    receiver_id: partnerUuid,
                    content: 'Direct message',
                })
            );
            expect(result.content).toBe('Direct message');
        });
    });
});
