import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { recordConversationRead } from '../../../data/messages/message-storage';

export function useMarkReadMutation(partnerId: string, isGroup?: boolean) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !partnerId) return;

            const nowIso = new Date().toISOString();

            // 1. Immediately record in persistent AsyncStorage so seen messages never revert on reload
            await recordConversationRead(partnerId, nowIso, user.id);

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId);

            // 2. Also record in remote conversation_reads table in Supabase
            try {
                if (isUuid) {
                    if (isGroup) {
                        await supabase
                            .from('conversation_reads')
                            .upsert({
                                user_id: user.id,
                                conversation_id: partnerId,
                                last_read_at: nowIso,
                            }, { onConflict: 'user_id, conversation_id' });
                    } else {
                        const { error } = await supabase
                            .from('conversation_reads')
                            .upsert({
                                user_id: user.id,
                                counterpart_id: partnerId,
                                last_read_at: nowIso,
                            }, { onConflict: 'user_id, counterpart_id' });

                        // If counterpart upsert had an error (e.g. partnerId was a conversation UUID instead of profile UUID)
                        if (error) {
                            await supabase
                                .from('conversation_reads')
                                .upsert({
                                    user_id: user.id,
                                    conversation_id: partnerId,
                                    last_read_at: nowIso,
                                }, { onConflict: 'user_id, conversation_id' });
                        }
                    }
                }
            } catch (e) {
                console.warn('[MarkRead] Failed to upsert conversation_reads:', e);
            }

            if (isUuid) {
                // Mark direct messages as read in messages table
                const { error: directError } = await supabase
                    .from('messages')
                    .update({ is_read: true, status: 'read' })
                    .eq('sender_id', partnerId)
                    .eq('receiver_id', user.id);

                if (directError) console.error('Error marking direct as read:', directError);

                // Mark room messages as read (except your own)
                const { error: roomError } = await supabase
                    .from('messages')
                    .update({ is_read: true, status: 'read' })
                    .eq('room_id', partnerId)
                    .neq('sender_id', user.id);

                if (roomError) console.error('Error marking room as read:', roomError);
            }

            // Mark group or standard conversation messages as read
            const { error: convError } = await supabase
                .from('messages')
                .update({ is_read: true, status: 'read' })
                .eq('conversation_id', partnerId)
                .neq('sender_id', user.id);

            if (convError) console.error('Error marking conversation as read:', convError);
        },
        onMutate: async () => {
            // Cancel outgoing refetches to avoid overwriting optimistic update
            await queryClient.cancelQueries({ queryKey: ['chat-list'] });
            await queryClient.cancelQueries({ queryKey: ['unread-messages-count'] });

            const prevChats = queryClient.getQueryData<any[]>(['chat-list']);
            const prevCount = queryClient.getQueryData<number>(['unread-messages-count']);

            let chatUnreadToDeduct = 0;
            if (prevChats) {
                queryClient.setQueryData<any[]>(['chat-list'], old =>
                    (old || []).map(chat => {
                        if (chat.id === partnerId || chat.partner_id === partnerId) {
                            chatUnreadToDeduct = Number(chat.unread_count) > 0
                                ? Number(chat.unread_count)
                                : (chat.unread ? 1 : 0);
                            return { ...chat, unread: false, unread_count: 0 };
                        }
                        return chat;
                    })
                );
            }

            if (typeof prevCount === 'number' && chatUnreadToDeduct > 0) {
                queryClient.setQueryData<number>(['unread-messages-count'], Math.max(0, prevCount - chatUnreadToDeduct));
            }

            return { prevChats, prevCount };
        },
        onError: (_err, _vars, context) => {
            if (context?.prevChats) {
                queryClient.setQueryData(['chat-list'], context.prevChats);
            }
            if (typeof context?.prevCount === 'number') {
                queryClient.setQueryData(['unread-messages-count'], context.prevCount);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['chat-list'] });
            queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
            queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
        },
    });
}
