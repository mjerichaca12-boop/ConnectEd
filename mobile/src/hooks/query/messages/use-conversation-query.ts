import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessages } from '../../../data/messages/get-messages';
import { supabase } from '../../../lib/supabase';

export function useConversationQuery(partnerId: string, isRoom?: boolean) {
    const queryClient = useQueryClient();
    const queryKey = ['conversation', partnerId];

    const query = useQuery({
        queryKey,
        queryFn: () => getMessages(partnerId, isRoom),
        enabled: !!partnerId,
        staleTime: 15000,
    });

    useEffect(() => {
        if (!partnerId) return;

        const channel = supabase
            .channel(`conversation-${partnerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                },
                async (payload) => {
                    const newMessage = (payload.new || payload.old) as any;
                    if (!newMessage) return;
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    // Match if it's the current room/conversation OR a direct message with the partner
                    const isRelevant = 
                        (newMessage.conversation_id === partnerId) || 
                        (newMessage.room_id === partnerId) || 
                        ((!newMessage.conversation_id && (!newMessage.room_id || newMessage.room_id === 'null')) && (
                            (newMessage.sender_id === partnerId && newMessage.receiver_id === user.id) ||
                            (newMessage.sender_id === user.id && newMessage.receiver_id === partnerId)
                        ));

                    if (isRelevant) {
                        if (payload.eventType === 'INSERT' && payload.new) {
                            const raw = payload.new as any;
                            const normalized = {
                                ...raw,
                                content: String(raw.content || raw.message_text || '').trim(),
                                message_text: String(raw.message_text || raw.content || '').trim(),
                                file_url: raw.file_url || null,
                                file_name: raw.file_name || null,
                                file_type: raw.file_type || null,
                                file_size: Number(raw.file_size || 0),
                                attachments: raw.file_url ? [{ file_url: raw.file_url, file_name: raw.file_name, file_type: raw.file_type }] : [],
                                status: 'sent',
                            };

                            queryClient.setQueryData(queryKey, (old: any[] = []) => {
                                if (!Array.isArray(old)) return [normalized];
                                if (old.some(m => m.id === normalized.id)) return old;
                                return [...old, normalized];
                            });
                        } else if (payload.eventType === 'UPDATE' && payload.new) {
                            const updated = payload.new as any;
                            queryClient.setQueryData(queryKey, (old: any[] = []) => {
                                if (!Array.isArray(old)) return old;
                                return old.map(m => m.id === updated.id ? { ...m, ...updated } : m);
                            });
                        } else if (payload.eventType === 'DELETE' && payload.old) {
                            const deletedId = (payload.old as any).id;
                            queryClient.setQueryData(queryKey, (old: any[] = []) => {
                                if (!Array.isArray(old)) return old;
                                return old.filter(m => m.id !== deletedId);
                            });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [partnerId, queryClient, queryKey]);

    return query;
}
