import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

const isValidUuid = (value: unknown) =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function useMarkNotificationsReadMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('[MobileNotifications] Supabase auth error:', userError);
            }

            const user = userData?.user ?? null;
            console.log('[MobileNotifications] mark read current user object:', user);
            console.log('[MobileNotifications] mark read user.id:', user?.id);

            if (!isValidUuid(user?.id)) {
                console.warn('[MobileNotifications] Skipping mark-read because the authenticated user is missing or invalid.');
                return null;
            }
            
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);
                
            if (error) {
                console.error('[MobileNotifications] Supabase notification update error:', error);
                throw error;
            }
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
        },
    });
}
