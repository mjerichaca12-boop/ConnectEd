import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Alert } from 'react-native';

export interface UpdateAttendanceArgs {
    enrollmentId: string;
    attendance: Record<string, any>;
}

export function useUpdateAttendanceMutation(subjectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ enrollmentId, attendance }: UpdateAttendanceArgs) => {
            const { data, error } = await supabase
                .from('teacher_student_assignments')
                .update({ attendance })
                .eq('id', enrollmentId)
                .select()
                .single();
                
            if (error) {
                throw error;
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-students', subjectId] });
            queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
        },
        onError: (error) => {
            console.error("Failed to update attendance:", error);
            Alert.alert("Error", "Failed to save attendance. Please try again.");
        }
    });
}
