import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

export function useMarkReadMutation(partnerId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId);

            if (isUuid) {
                // Mark direct messages as read
                const { error: directError } = await supabase
                    .from('messages')
                    .update({ is_read: true })
                    .eq('sender_id', partnerId)
                    .eq('receiver_id', user.id)
                    .eq('is_read', false);

                if (directError) console.error('Error marking direct as read:', directError);

                // Mark room messages as read (except your own)
                const { error: roomError } = await supabase
                    .from('messages')
                    .update({ is_read: true })
                    .eq('room_id', partnerId)
                    .neq('sender_id', user.id)
                    .eq('is_read', false);

                if (roomError) console.error('Error marking room as read:', roomError);
            }

            // Mark group or standard conversation messages as read
            const { error: convError } = await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('conversation_id', partnerId)
                .neq('sender_id', user.id)
                .eq('is_read', false);

            if (convError) console.error('Error marking conversation as read:', convError);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat-list'] });
        },
    });
}
