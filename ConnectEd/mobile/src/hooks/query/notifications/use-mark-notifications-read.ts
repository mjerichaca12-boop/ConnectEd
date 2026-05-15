import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

export function useMarkNotificationsReadMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) return null;
            
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userData.user.id)
                .eq('is_read', false);
                
            if (error) throw error;
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
        },
    });
}
