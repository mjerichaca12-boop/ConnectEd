import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessages } from '../../../data/messages/get-messages';
import { supabase } from '../../../lib/supabase';

export function useConversationQuery(partnerId: string) {
    const queryClient = useQueryClient();
    const queryKey = ['conversation', partnerId];

    const query = useQuery({
        queryKey,
        queryFn: () => getMessages(partnerId),
        enabled: !!partnerId,
    });

    useEffect(() => {
        if (!partnerId) return;

        const channel = supabase
            .channel(`conversation-${partnerId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                async (payload) => {
                    console.log('[messages] RT message received:', payload.new.id);
                    const newMessage = payload.new;
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
                        console.log('[messages] RT invalidating conversation:', partnerId);
                        queryClient.invalidateQueries({ queryKey });
                        queryClient.invalidateQueries({ queryKey: ['chat-list'] });
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
