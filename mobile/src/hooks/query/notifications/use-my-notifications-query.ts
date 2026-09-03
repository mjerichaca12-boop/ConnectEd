import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyNotifications } from '../../../data/notifications/get-my-notifications';
import { supabase } from '../../../lib/supabase';

export function useMyNotificationsQuery() {
    const queryClient = useQueryClient();

    useEffect(() => {
        let channel: any = null;

        const setupRealtime = async () => {
            const { data } = await supabase.auth.getUser();
            const userId = data?.user?.id;
            if (!userId) return;

            channel = supabase
                .channel(`mobile-notifications-${userId}-${Date.now()}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'notifications',
                    },
                    (payload) => {
                        const newRow = payload.new || payload.old;
                        if (newRow && String(newRow.user_id) === String(userId)) {
                            queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
                        }
                    }
                )
                .subscribe();
        };

        setupRealtime();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['my-notifications'],
        queryFn: getMyNotifications,
    });
}
