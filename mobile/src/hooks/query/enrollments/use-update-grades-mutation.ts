import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Alert } from 'react-native';

export interface UpdateGradesArgs {
    enrollmentId: string;
    grades: Record<string, any>;
}

export function useUpdateGradesMutation(subjectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ enrollmentId, grades }: UpdateGradesArgs) => {
            const { data, error } = await supabase
                .from('enrollments')
                .update({ grade: grades }) // Maps to 'grades' column via view rule, wait, we added 'grades' but 'enrollments' view selects 'grades AS grade'. We can't update a view easily unless the rule allows it.
                // It's better to update the underlying table:
                // .from('teacher_student_assignments')
                // .update({ grades })
                .eq('id', enrollmentId)
                .select()
                .single();
                
            if (error) {
                // If view update fails, fallback to table
                const { data: tData, error: tError } = await supabase
                    .from('teacher_student_assignments')
                    .update({ grades })
                    .eq('id', enrollmentId)
                    .select()
                    .single();
                
                if (tError) throw tError;
                return tData;
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-students', subjectId] });
            queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
        },
        onError: (error) => {
            console.error("Failed to update grades:", error);
            Alert.alert("Error", "Failed to save grades. Please try again.");
        }
    });
}
